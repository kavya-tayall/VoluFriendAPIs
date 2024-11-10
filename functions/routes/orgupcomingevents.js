const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");

// Utility function to fetch shifts and calculate total signups/check-ins for events
const getShiftsForEvents = async (eventIds) => {
  const [shiftsSnapshot, signupsSnapshot, attendancesSnapshot] = await Promise.all([
    db.ref("shifts").once("value"),
    db.ref("signups").once("value"),
    db.ref("attendances").once("value")
  ]);

  const shiftsData = shiftsSnapshot.val() || {};
  const signupsData = signupsSnapshot.val() || {};
  const attendancesData = attendancesSnapshot.val() || {};

  const shiftsForEvent = {};

  // Organize signups and attendances by shift ID for quick lookup
  const signupsByShift = {};
  const attendancesByShift = {};

  for (const signupId in signupsData) {
    const { shift_id } = signupsData[signupId];
    signupsByShift[shift_id] = (signupsByShift[shift_id] || 0) + 1;
  }

  for (const attendanceId in attendancesData) {
    const { shift_id } = attendancesData[attendanceId];
    attendancesByShift[shift_id] = (attendancesByShift[shift_id] || 0) + 1;
  }

  // Organize shifts by event ID and calculate totals
  eventIds.forEach((eventId) => {
    shiftsForEvent[eventId] = Object.keys(shiftsData)
      .filter((shiftId) => shiftsData[shiftId].event_id === eventId)
      .map((shiftId) => {
        const shift = shiftsData[shiftId];
        const totalSignups = signupsByShift[shiftId] || 0;
        const totalCheckins = attendancesByShift[shiftId] || 0;

        return {
          shift_id: shiftId,
          ...shift,
          total_signups: totalSignups,
          total_checkins: totalCheckins
        };
      });
  });

  return shiftsForEvent;
};

// Endpoint to get events and their shifts
router.get("/", async (req, res) => {
  const { org_user_id, start_date, end_date } = req.query;

  if (!org_user_id) {
    return res.status(400).json({ error: "org_user_id is required" });
  }

  try {
    // Fetch events for org_user_id
    const eventsSnapshot = await db.ref("events")
      .orderByChild("org_user_id")
      .equalTo(org_user_id)
      .once("value");

    const eventsData = eventsSnapshot.val() || {};
    const validEventIds = [];
    const today = new Date();

    for (const event_id in eventsData) {
      const eventStartDate = new Date(eventsData[event_id].start_date);
      console.log(event_id);
      console.log(eventStartDate);

      if (
        (!start_date && eventStartDate >= today) ||
        (start_date && eventStartDate >= new Date(start_date) && (!end_date || eventStartDate <= new Date(end_date)))
      ) {
        validEventIds.push(event_id);
      }
    }

    if (validEventIds.length === 0) {
      return res.status(200).json({ });
    }

    // Fetch shifts for events in parallel and calculate totals
    const shiftsForEvent = await getShiftsForEvents(validEventIds);

    // Prepare event data map
    const eventMap = {};

    await Promise.all(validEventIds.map(async (event_id) => {
      const eventData = eventsData[event_id];

      // Fetch org and cause data in parallel
      const [orgSnapshot, causeSnapshot] = await Promise.all([
        db.ref(`organizations/${eventData.org_id}`).once("value"),
        db.ref(`causes/${eventData.cause_id}`).once("value")
      ]);

      const orgData = orgSnapshot.val();
      const causeData = causeSnapshot.val();

      // Aggregate shifts data for each event
      const shifts = shiftsForEvent[event_id] || [];
      const totalSignups = shifts.reduce((acc, shift) => acc + shift.total_signups, 0);
      const totalCheckins = shifts.reduce((acc, shift) => acc + shift.total_checkins, 0);

      eventMap[event_id] = {
        event: {
          ...eventData,
          event_id,
          org_name: orgData?.name || "Unknown organization",
          cause: causeData?.name || "Unknown cause",
          total_signups: totalSignups,
          total_checkins: totalCheckins
        },
        shifts
      };
    }));

    // Return events and shifts data
    res.json(eventMap);
  } catch (error) {
    console.error("Error fetching events and shifts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
