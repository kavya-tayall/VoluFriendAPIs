const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase");

// Route to get events and shifts, including total signups, hours attended, and attendance
router.get("/", async (req, res) => {
  const {org_user_id} = req.query;

  // Check if orgUserId is provided
  if (!org_user_id) {
    return res.status(400).json({error: "orgUserId is required"});
  }

  try {
    // Step 1: Fetch events for the org_user_id where start_date is less than or equal to today
    const currentDate = new Date().toISOString(); // Current date in ISO format

    const eventsSnapshot = await db.ref("events")
        .orderByChild("org_user_id")
        .equalTo(org_user_id)
        .once("value");

    const allEvents = eventsSnapshot.val();
    if (!allEvents) {
      return res.status(404).json({error: "No events found"});
    }

    // Filter the events to include only those where start_date <= currentDate
    const filteredEvents = Object.entries(allEvents)
        .filter(([key, event]) => new Date(event.start_date) <= new Date(currentDate))
        .map(([key, event]) => ({...event, event_id: key}));

    // Step 2: Fetch shifts for each event
    const eventsWithShiftsPromises = filteredEvents.map(async (event) => {
      const shiftsSnapshot = await db.ref("shifts").orderByChild("event_id").equalTo(event.event_id).once("value");
      const shiftsData = shiftsSnapshot.val() || {};

      let totalSignupsForEvent = 0; // To keep track of total signups for the entire event
      let totalCheckinsForEvent = 0; // To keep track of total check-ins for the entire event

      // Step 3: For each shift, fetch signups and attendance from separate tables
      const formattedShifts = await Promise.all(Object.keys(shiftsData).map(async (shiftId) => {
        const shift = shiftsData[shiftId];

        // Fetch total signups from the 'signups' table
        const signupsSnapshot = await db.ref("signups").orderByChild("shift_id").equalTo(shiftId).once("value");
        const totalSignups = signupsSnapshot.exists() ? signupsSnapshot.numChildren() : 0;
        totalSignupsForEvent += totalSignups; // Add to event total

        // Fetch total attendance from the 'attendance' table
        const attendanceSnapshot = await db.ref("attendances").orderByChild("shift_id").equalTo(shiftId).once("value");
        const totalAttendance = attendanceSnapshot.exists() ? attendanceSnapshot.numChildren() : 0;
        totalCheckinsForEvent += totalAttendance; // Add to event total

        return {
          shift_id: shiftId,
          ...shift,
          total_signups: totalSignups,
          total_checkins: totalAttendance,
        };
      }));

      // Step 4: Check if the event has any shifts with signups
      const hasSignups = totalSignupsForEvent > 0;

      // Only return the event if there is at least one shift with signups
      if (hasSignups) {
        return {
          [event.event_id]: {
            event: {
              ...event,
              org_name: "BothellHighSchool", // Assuming org_name is stored elsewhere
              cause_name: "Environmental Conservation", // Assuming cause_name is stored elsewhere
              total_signups: totalSignupsForEvent, // Total signups for the event
              total_checkins: totalCheckinsForEvent, // Total check-ins for the event
            },
            shifts: formattedShifts,
          },
        };
      } else {
        return null; // Return null if no shifts have signups
      }
    });

    // Wait for all shift fetch promises to complete
    const eventsWithShiftsArray = await Promise.all(eventsWithShiftsPromises);

    // Step 5: Filter out null values (events with no shifts that have signups)
    const nonNullEvents = eventsWithShiftsArray.filter((event) => event !== null);

    // Step 6: Merge the array of events into a single JSON object
    const eventsWithShifts = nonNullEvents.reduce((acc, eventWithShifts) => {
      return {...acc, ...eventWithShifts};
    }, {});

    // Step 7: Return the event and shift details as a JSON map
    res.json(eventsWithShifts);
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("Error fetching data:", error);
    res.status(500).json({error: "Internal Server Error"});
  }
});

module.exports = router;
