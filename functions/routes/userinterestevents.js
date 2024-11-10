const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const { db } = require('../config/firebase');

// Route to get events for a user, filtering out those they've already signed up for and events that are canceled
router.get('/', async (req, res) => {
  const { userId, currentDate } = req.query;

  // Check if userId is provided
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Step 1: Fetch user data from the 'users' table using the userId
    const userSnapshot = await db.ref('users').child(userId).once('value');
    const userData = userSnapshot.val();

    // If the user is not found, return a 404 error
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract the school_home_org_id from the user's data
    const userSchoolHomeOrgId = userData.school_home_org_id;

    // Step 2: Fetch organization data for the user's school/home organization
    const orgSnapshot = await db.ref('organizations').child(userSchoolHomeOrgId).once('value');
    const orgData = orgSnapshot.val();

    // If the organization is not found, return a 404 error
    if (!orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Extract the parent_org field from the organization data
    const parentOrg = orgData.parent_org;

    // Declare allOrgIds to use in both cases
    let allOrgIds;

    if (parentOrg) {
      // Step 3: Find all organizations with the same parent_org value
      const allOrgsSnapshot = await db.ref('organizations').orderByChild('parent_org').equalTo(parentOrg).once('value');
      const allOrgs = allOrgsSnapshot.val();
      allOrgIds = Object.keys(allOrgs);  // Get all org IDs with the same parent_org value
    } else {
      allOrgIds = [userSchoolHomeOrgId];
    }

    // Step 4: Find all organizations where the user is volunteering
    const volunteerSnapshot = await db.ref('volunteers').orderByChild('user_id').equalTo(userId).once('value');
    const volunteerData = volunteerSnapshot.val();
    const volunteeringOrgIds = Object.values(volunteerData || {}).map(vol => vol.org_id);  // Get org IDs where user is volunteering

    // Combine org_ids from both the user's volunteering organizations and the parent_org organizations
    const combinedOrgIds = Array.from(new Set([...volunteeringOrgIds, ...allOrgIds]));

    // Step 5: Fetch upcoming events for these org_ids, within a date range and limited to 100 results
    const currentDateISO = moment(currentDate).toISOString();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);  // Set end date as one month from now
    const endDateISO = endDate.toISOString();

    // Query for events happening between now and the next month, limited to 100 results
    const query = db.ref('events')
      .orderByChild('start_date')
      .startAt(currentDateISO)
      .endAt(endDateISO)
      .limitToFirst(100);

    const eventsSnapshot = await query.once('value');
    const allEvents = eventsSnapshot.val();

    // Filter the events to include only those that belong to the combinedOrgIds and have a status other than 'canceled'
    let filteredEvents = Object.entries(allEvents || {})
      .filter(([_, event]) => combinedOrgIds.includes(event.org_id) && event.event_status !== 'canceled')
      .map(([key, event]) => ({ ...event, event_id: key }));

    // Step 6: Find volunteer_id for the user
    const volunteerIds = Object.keys(volunteerSnapshot.val() || {});

    // If volunteer IDs exist, filter out the events the user has already signed up for
    if (volunteerIds.length > 0) {
      const signupsSnapshot = await db.ref('signups')
        .orderByChild('volunteer_id')
        .startAt(volunteerIds[0])
        .endAt(volunteerIds[volunteerIds.length - 1])
        .once('value');

      const signupsData = signupsSnapshot.val() || {};
      const signedUpEventIds = new Set(Object.values(signupsData).map(signup => signup.event_id));

      // Filter out events that the user has already signed up for
      filteredEvents = filteredEvents.filter(event => !signedUpEventIds.has(event.event_id));
    }

    // Step 7: Fetch shifts for each event and add additional data (organization and cause names)
    const eventsWithShiftsPromises = filteredEvents.map(async (event) => {
      const shiftsSnapshot = await db.ref('shifts').orderByChild('event_id').equalTo(event.event_id).once('value');
      const shiftsData = shiftsSnapshot.val() || {};

      // Format the shifts to include shift_id in each shift object
      const formattedShifts = Object.keys(shiftsData).map(shiftId => ({
        shift_id: shiftId,
        ...shiftsData[shiftId]
      }));

      // Fetch organization name based on org_id
      const orgRef = db.ref(`organizations/${event.org_id}`);
      const orgSnapshot = await orgRef.once('value');
      const orgData = orgSnapshot.val();
      event.org_name = orgData?.name || 'Unknown organization';

      // Fetch cause name based on cause_id
      const causeRef = db.ref(`causes/${event.cause_id}`);
      const causeSnapshot = await causeRef.once('value');
      const causeData = causeSnapshot.val();
      event.cause_name = causeData?.name || 'Unknown cause';

      // Return event along with its shifts and additional details
      return {
        event_id: event.event_id,
        event,
        shifts: formattedShifts
      };
    });

    // Wait for all shift fetch promises to complete
    const eventsWithShifts = await Promise.all(eventsWithShiftsPromises);

    // Step 8: Create a map structure to hold event data along with shifts
    const eventMap = {};
    eventsWithShifts.forEach(({ event_id, event, shifts }) => {
      eventMap[event_id] = {
        event,
        shifts
      };
    });

    // Return the map-like structure with event_id as the key
    res.json(eventMap);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
