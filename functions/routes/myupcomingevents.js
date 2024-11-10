const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase");

// Utility function to get shifts for a given event and filter by shift_ids
const getShiftsForEvent = async (event_id, shiftIds) => {
  const shiftsSnapshot = await db.ref("shifts")
      .orderByChild("event_id")
      .equalTo(event_id)
      .once("value");
  const shiftsData = shiftsSnapshot.val() || {};

  // Filter the shifts by shift_ids (if provided) and format the response
  return Object.keys(shiftsData)
      .filter((shiftId) => !shiftIds || shiftIds.includes(shiftId)) // Only include shifts signed up for
      .map((shiftId) => ({
        shift_id: shiftId, // Use the Firebase key as shift_id
        ...shiftsData[shiftId], // Include other shift details
        shift_id: shiftId, // Overwrite any existing shift_id field
      }));
};

// Helper function to compare only the date part of two dates
const isSameDate = (date1, date2) => {
  return date1.toISOString().split("T")[0] === date2.toISOString().split("T")[0];
};

// Endpoint to get events and their shifts for specific user/volunteer based on signups
router.get("/", async (req, res) => {
  const {user_id, volunteer_id, start_date, end_date} = req.query;

  // Ensure user_id is provided
  if (!user_id) {
    return res.status(400).json({error: "user_id is required"});
  }

  try {
    let volunteerIds = [];

    // Step 1: Fetch volunteer IDs based on user_id or use volunteer_id if provided
    if (volunteer_id) {
      volunteerIds.push(volunteer_id); // Use passed volunteer_id directly
    } else {
      const volunteersSnapshot = await db.ref("volunteers")
          .orderByChild("user_id")
          .equalTo(user_id)
          .once("value");
      const volunteersData = volunteersSnapshot.val() || {};
      volunteerIds = Object.keys(volunteersData).filter((volunteerId) => volunteersData[volunteerId].status === "Active");

      if (volunteerIds.length === 0) {
        return res.status(404).json({error: "No active volunteer records found for this user_id"});
      }
    }

    // Step 2: Fetch signups for all volunteer IDs
    const signupsSnapshot = await db.ref("signups")
        .orderByChild("volunteer_id")
        .once("value");
    const signupsData = signupsSnapshot.val() || {};

    // Filter signups by volunteer IDs and create a map of event_ids to shift_ids
    const filteredSignups = Object.values(signupsData)
        .filter((signup) => volunteerIds.includes(signup.volunteer_id))
        .map((signup) => ({
          event_id: signup.event_id,
          shift_id: signup.shift_id,
        }));

    if (filteredSignups.length === 0) {
      return res.status(404).json({error: "No signups found for the given volunteer IDs"});
    }

    // Step 3: Retrieve event_ids and associated shift_ids from the signups
    const eventShiftMap = {};
    filteredSignups.forEach(({event_id, shift_id}) => {
      if (!eventShiftMap[event_id]) {
        eventShiftMap[event_id] = [];
      }
      eventShiftMap[event_id].push(shift_id); // Store shift_id associated with the event
    });

    const eventIds = Object.keys(eventShiftMap);

    // Step 4: Fetch events and apply date filters (if provided)
    const today = new Date().toISOString();
    const validEventIds = [];
    const startDateFilter = start_date ? new Date(start_date) : null;
    const endDateFilter = end_date ? new Date(end_date) : null;

    for (const event_id of eventIds) {
      // Fetch event details
      const eventSnapshot = await db.ref("events").child(event_id).once("value");
      const eventData = eventSnapshot.val();

      if (!eventData) {
        continue; // Skip if the event is not found
      }

      const eventStartDate = new Date(eventData.start_date);

      // Apply date filters
      if (startDateFilter && endDateFilter) {
        // Filter by events that fall between start_date and end_date
        if (eventStartDate >= startDateFilter && eventStartDate <= endDateFilter) {
          validEventIds.push(event_id);
        }
      } else if (startDateFilter) {
        // Filter by events that match exactly with the start_date (only comparing date part)
        if (isSameDate(eventStartDate, startDateFilter)) {
          validEventIds.push(event_id);
        }
      } else {
        // Default behavior: events that start on or after today (existing logic)
        if (eventStartDate >= new Date(today)) {
          validEventIds.push(event_id);
        }
      }
    }

    if (validEventIds.length === 0) {
      return res.status(200).json({ });
    }

    // Step 5: Fetch shifts related to the valid events, only include shifts the user signed up for
    const eventMap = {};
    for (const event_id of validEventIds) {
      const eventSnapshot = await db.ref("events").child(event_id).once("value");
      const eventData = eventSnapshot.val();

      if (!eventData) {
        continue; // Skip if the event is not found
      }

      // Fetch only the shifts the user signed up for
      const shiftIdsForEvent = eventShiftMap[event_id];

      // Step 3.1: Fetch organization name based on org_id
      const orgRef = db.ref(`organizations/${eventData.org_id}`);
      const orgSnapshot = await orgRef.once("value");
      const orgData = orgSnapshot.val();

      if (orgData && orgData.name) {
        // Add org_name to event data
        eventData.org_name = orgData.name;
      } else {
        eventData.org_name = "Unknown organization";
      }

      // Step 3.2: Fetch cause name based on cause_id
      const causeRef = db.ref(`causes/${eventData.cause_id}`);
      const causeSnapshot = await causeRef.once("value");
      const causeData = causeSnapshot.val();

      if (causeData && causeData.name) {
        // Add cause name to event data
        eventData.cause = causeData.name;
      } else {
        eventData.cause = "Unknown cause";
      }

      const shifts = await getShiftsForEvent(event_id, shiftIdsForEvent);

      // Structure the response in the desired format
      eventMap[event_id] = {
        event: {
          ...eventData,
          event_id, // Ensure event_id is included
        },
        shifts,
      };
    }

    // Step 6: Respond with the events and their shifts in the desired format
    res.json(eventMap);
  } catch (error) {
    console.error("Error fetching events and shifts:", error);
    res.status(500).json({error: "Internal Server Error"});
  }
});

module.exports = router;
