const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase");
const {admin} = require("../config/firebase");

const axios = require("axios"); // Import axios
const {v4: uuidv4} = require("uuid");


// Helper function to fetch organization data
const getOrgData = async (orgId) => {
  const orgRef = db.ref(`organizations/${orgId}`);
  const orgSnapshot = await orgRef.once("value");
  return orgSnapshot.val();
};

// Helper function to fetch org_user data
const getOrgUserData = async (orgUserId) => {
  const orgUserRef = db.ref(`org_users/${orgUserId}`);
  const orgUserSnapshot = await orgUserRef.once("value");
  return orgUserSnapshot.val();
};

// Helper function to check if user is an admin for a given organization
const isAdminForOrg = async (orgUserId, orgId) => {
  const orgUserData = await getOrgUserData(orgUserId);
  return orgUserData && orgUserData.organization_id === orgId && orgUserData.user_role_in_Org === "Admin";
};

// Middleware to validate org_user_id and org_id
const validateOrgUserAndOrg = async (req, res, next) => {
  const {org_user_id, org_id} = req.body;

  try {
    // Check if org_id is valid
    const orgData = await getOrgData(org_id);
    if (!orgData) {
      return res.status(400).json({error: "Invalid organization ID."});
    }

    // Check if org_user_id exists
    const orgUserData = await getOrgUserData(org_user_id);
    if (!orgUserData) {
      return res.status(404).json({error: "Organization user not found."});
    }

    // Check if the user is an admin for the given org_id
    const isAdmin = await isAdminForOrg(org_user_id, org_id);
    if (!isAdmin) {
      return res.status(403).json({error: "User does not have admin role for this organization."});
    }

    // Proceed to next middleware or route handler
    next();
  } catch (error) {
    res.status(500).json({error: error.message});
  }
};

// CRUD operations for Events

// GET all events with optional filters for org_user_id and org_id
router.get("/", async (req, res) => {
  try {
    const {org_user_id, org_id} = req.body; // Using body parameters for filtering

    const eventsRef = db.ref("events");

    // Apply filters if provided
    if (org_user_id || org_id) {
      let filterQuery = eventsRef;

      if (org_user_id) {
        filterQuery = filterQuery.orderByChild("created_by").equalTo(org_user_id);
      } else if (org_id) {
        filterQuery = filterQuery.orderByChild("org_id").equalTo(org_id);
      }

      // Execute the query
      const snapshot = await filterQuery.once("value");
      const eventsData = snapshot.val() || {};

      const formattedEvents = Object.keys(eventsData).map((eventId) => {
        return {
          event_id: eventId,
          event: {
            ...eventsData[eventId], // Spread event data
            event_id: eventId, // Include event_id in event object
          },
        };
      });

      res.json(formattedEvents);
    } else {
      // No filters, return all events
      const snapshot = await eventsRef.once("value");
      const eventsData = snapshot.val() || {};

      const formattedEvents = Object.keys(eventsData).map((eventId) => {
        return {
          event_id: eventId,
          event: {
            ...eventsData[eventId], // Spread event data
            event_id: eventId, // Include event_id in event object
          },
        };
      });

      res.json(formattedEvents);
    }
  } catch (error) {
    console.error("Error fetching events:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not retrieve events."});
  }
});


router.get("/events-with-shifts", async (req, res) => {
  try {
    const {org_user_id, org_id} = req.query;
    const eventsRef = db.ref("events");

    // Apply filters if provided
    let filterQuery = eventsRef;
    if (org_user_id) {
      filterQuery = filterQuery.orderByChild("created_by").equalTo(org_user_id);
    }
    if (org_id) {
      filterQuery = filterQuery.orderByChild("org_id").equalTo(org_id);
    }

    // Execute the query to get events
    const eventsSnapshot = await filterQuery.once("value");
    const eventsData = eventsSnapshot.val() || {};

    const eventIds = Object.keys(eventsData);

    if (!eventIds.length) {
      return res.status(404).json({message: "No events found for the given filters."});
    }

    // Query shifts for each event
    const shiftsPromises = eventIds.map((eventId) =>
      db.ref("shifts").orderByChild("event_id").equalTo(eventId).once("value"),
    );
    const shiftsSnapshots = await Promise.all(shiftsPromises);

    // Process shifts data
    const shiftsMap = {};
    const formattedEventsMap = {};

    for (let i = 0; i < shiftsSnapshots.length; i++) {
      const snapshot = shiftsSnapshots[i];
      const shiftData = snapshot.val() || {};
      const eventId = eventIds[i];

      let totalSignupsForEvent = 0; // Initialize total signups for the event
      let totalCheckinsForEvent = 0; // Initialize total checkins for the event

      shiftsMap[eventId] = await Promise.all(
          Object.keys(shiftData).map(async (shiftId) => {
            // Fetch total signups from the 'signups' table
            const signupsSnapshot = await db.ref("signups").orderByChild("shift_id").equalTo(shiftId).once("value");
            const totalSignups = signupsSnapshot.exists() ? signupsSnapshot.numChildren() : 0;
            totalSignupsForEvent += totalSignups; // Add to event total

            // Fetch total attendance from the 'attendance' table
            const attendanceSnapshot = await db.ref("attendances").orderByChild("shift_id").equalTo(shiftId).once("value");
            const totalCheckins = attendanceSnapshot.exists() ? attendanceSnapshot.numChildren() : 0;
            totalCheckinsForEvent += totalCheckins; // Add to event total

            // Add total signups and checkins for each shift
            return {
              shift_id: shiftId,
              ...shiftData[shiftId],
              total_signups: totalSignups, // Total signups at shift level
              total_checkins: totalCheckins, // Total checkins at shift level
            };
          }),
      );

      // After processing all shifts for the event, add totals to the event map
      formattedEventsMap[eventId] = {
        event: {
          ...eventsData[eventId],
          event_id: eventId, // Include event_id
          total_signups: totalSignupsForEvent, // Total signups for the event
          total_checkins: totalCheckinsForEvent, // Total checkins for the event
        },
        shifts: shiftsMap[eventId] || [], // Shifts for the event, with signups and checkins
      };
    }

    res.json(formattedEventsMap);
  } catch (error) {
    console.error("Error fetching events with shifts:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not retrieve events with shifts."});
  }
});


// GET a single event with its corresponding shifts by event_id
router.get("/events-with-shifts/:event_id", async (req, res) => {
  try {
    const {event_id} = req.params;

    // Query the specific event by event_id
    const eventSnapshot = await db.ref("events").child(event_id).once("value");
    const eventData = eventSnapshot.val();

    if (!eventData) {
      return res.status(404).json({error: "Event not found"});
    }

    // Fetch organization name based on org_id
    const orgRef = db.ref(`organizations/${eventData.org_id}`);
    const orgSnapshot = await orgRef.once("value");
    const orgData = orgSnapshot.val();

    if (orgData && orgData.name) {
      // Add org_name to event data
      orgName = orgData.name;
      eventData.org_name = orgData.name;
    } else {
      eventData.org_name = "Unknown organization";
    }

    // Query shifts for the event
    const shiftsSnapshot = await db.ref("shifts").orderByChild("event_id").equalTo(event_id).once("value");
    const shiftsData = shiftsSnapshot.val() || {};

    // Format the shifts data using the Firebase key as shift_id
    const formattedShifts = Object.keys(shiftsData).map((shiftId) => ({
      shift_id: shiftId, // Use the Firebase key as the shift_id
      ...shiftsData[shiftId], // Include other shift details
      shift_id: shiftId, // Overwrite the inner `shift_id` field if it exists
    }));

    // Create a map structure to hold event data along with shifts
    const eventMap = {
      [event_id]: {
        event: {
          ...eventData,
          event_id: event_id, // Ensure event_id is included in the event object
        },
        shifts: formattedShifts,
      },
    };

    res.json(eventMap); // Return the map-like structure with event_id as the key
  } catch (error) {
    console.error("Error fetching event with shifts:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not retrieve event with shifts."});
  }
});

// NEW: GET single event by event ID
router.get("/:event_id", async (req, res) => {
  try {
    const {event_id} = req.params; // Get event_id from route parameters

    const eventRef = db.ref("events").child(event_id);

    // Fetch the single event by event_id
    const snapshot = await eventRef.once("value");
    const eventData = snapshot.val();

    if (eventData) {
      res.json({
        event_id: event_id,
        event: {
          ...eventData,
          event_id: event_id, // Ensure event_id is included in the event object
        },
      });
    } else {
      res.status(404).json({error: "Event not found"});
    }
  } catch (error) {
    console.error("Error fetching the event:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not retrieve the event."});
  }
});

// POST endpoint to create an event and its shifts
router.post("/", validateOrgUserAndOrg, async (req, res) => {
  try {
    const eventsRef = db.ref("events");
    const newEventRef = eventsRef.push(); // Generate Firebase event ID
    const eventData = req.body;
    const {parent_org, org_user_id, title, start_date, org_name} = req.body; // Destructure the necessary fields

    // Extract and remove shifts from the event data if present
    const {shifts, ...eventWithoutShifts} = eventData;
    const event_id = newEventRef.key; // Capture the new event ID
    const currentTimestamp = new Date().toISOString();

    // Prepare event data with additional fields
    const eventWithDefaults = {
      ...eventWithoutShifts,
      created_at: currentTimestamp,
      updated_at: currentTimestamp,
      created_by: org_user_id, // Ensure created_by is set
      updated_by: org_user_id, // Ensure updated_by is set
      event_id: event_id, // Ensure event_id is included
    };

    // Post the event data
    await newEventRef.set(eventWithDefaults);

    let shiftResults = [];

    // Handle shifts if provided
    if (shifts && Array.isArray(shifts)) {
      const shiftPromises = shifts.map(async (shiftData) => {
        const newShiftRef = db.ref("shifts").push(); // Generate new shift ID
        const shiftWithDefaults = {
          ...shiftData,
          event_id: event_id, // Link shift to the created event
          created_at: currentTimestamp, // Add created_at timestamp for shifts
          updated_at: currentTimestamp, // Add updated_at timestamp for shifts
          created_by: org_user_id, // Ensure created_by is set
          updated_by: org_user_id, // Ensure updated_by is set
        };
        await newShiftRef.set(shiftWithDefaults);
        return {shift_id: newShiftRef.key, ...shiftWithDefaults}; // Return new shift ID and data
      });

      shiftResults = await Promise.all(shiftPromises);
    }

    const eventMap = {
      [event_id]: {
        event: {
          ...eventWithDefaults,
          event_id: event_id, // Ensure event_id is included in the event object
        },
        shifts: shiftResults,
      },
    };

    console.log(parent_org);

    // Handle sending notifications if parent_org exists
    if (parent_org) {
      try {
        const orgName = org_name || "Unknown Organization"; // Fallback if org_name is missing
        const topic = parent_org.replace(/\s+/g, "_"); // Replace spaces with underscores

        const notificationId = uuidv4();
        const titleMsg = `Exciting New Opportunity with ${orgName}!`;
        const messageBody = `A new event has been organized by ${orgName}. The event "${title}" is happening on ${start_date}. Register now and make a difference!`;

        // Define the notification message
        const message = {
          notification: {
            title: titleMsg,
            body: messageBody,
          },
          data: {
            id: notificationId, // Unique ID for the notification
            userId: "allusers", // The ID of the user receiving the notification
            eventId: event_id, // The ID of the event
            title: titleMsg,
            message: messageBody,
            isRead: "false", // Mark it as unread initially
            source: "VoluFriend",
            receiver: "allusers", // Receiver's userId
          },
          topic: "GreenLake_School_District", // Send the notification to the organization topic
        };

        // Send the notification
        const messageResponse = await admin.messaging().send(message);
        console.log("Successfully sent message for event:", messageResponse);
      } catch (error) {
        console.error("Error sending message:", error);
        throw error; // Ensure the error is caught in the outer catch block
      }
    }

    // Send a successful response back
    res.status(201).json(eventMap);
  } catch (error) {
    console.error("Error creating event:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not create the event."});
  }
});


router.put("/:event_id", validateOrgUserAndOrg, async (req, res) => {
  try {
    const eventRef = db.ref(`events/${req.params.event_id}`);
    const updateData = req.body;

    // Check if the event exists before updating
    const snapshot = await eventRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({error: "Event not found."});
    }

    // Remove shifts from update data if present
    const {shifts, ...updateWithoutShifts} = updateData;
    await eventRef.update(updateWithoutShifts);

    // Handle shifts if provided
    if (shifts && Array.isArray(shifts)) {
      const shiftPromises = shifts.map(async (shift) => {
        // Extract shift_id and remove it from shiftData
        const {shift_id, ...shiftData} = shift;

        // Get reference based on shift_id
        const shiftRef = db.ref(`shifts/${shift_id}`);

        // Update the shift in the database
        await shiftRef.update(shiftData);
      });

      // Wait for all shifts to be processed
      await Promise.all(shiftPromises);
    }

    // Set the environment (either 'local' or 'production')
const isLocal = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development";

// Define the API endpoint based on the environment
const externalEndpoint = isLocal
  ? `${process.env.LOCAL_API_ENDPOINT}/events/events-with-shifts/${req.params.event_id}`
  : `${process.env.API_HOST}/events/events-with-shifts/${req.params.event_id}`;

  console.log("External API endpoint:", externalEndpoint);

    // Call the external API to get event data including shifts
   
    const externalResponse = await axios.get(externalEndpoint);

    // Return the external API response
    return res.status(200).json(externalResponse.data);
  } catch (error) {
    console.error("Error updating event:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not update the event."});
  }
});


router.put("/cancel/:event_id", async (req, res) => {
  try {
    const eventRef = db.ref(`events/${req.params.event_id}`);

    // Check if the event exists
    const snapshot = await eventRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({error: "Event not found."});
    }

    // Update event status to 'canceled'
    await eventRef.update({event_status: "canceled"});

    // Optionally call external API to get event data including shifts
    const externalEndpoint = `http://localhost:3000/events/events-with-shifts/${req.params.event_id}`;

    try {
      const externalResponse = await axios.get(externalEndpoint);
      // Return the external API response data
      return res.status(200).json(externalResponse.data);
    } catch (externalError) {
      console.error("Error calling external API:", externalError.message);
      return res.status(500).json({error: "Failed to retrieve event data from external service."});
    }
  } catch (error) {
    console.error("Error canceling event:", error.message);
    return res.status(500).json({error: "Internal Server Error. Could not cancel the event."});
  }
});


// DELETE an event
router.delete("/:event_id", async (req, res) => {
  try {
    const eventId = req.params.event_id;

    // First, delete all shifts related to the event
    const shiftsRef = db.ref("shifts");
    const shiftsSnapshot = await shiftsRef.orderByChild("event_id").equalTo(eventId).once("value");
    const shiftsData = shiftsSnapshot.val();

    if (shiftsData) {
      const shiftPromises = Object.keys(shiftsData).map((shiftId) =>
        shiftsRef.child(shiftId).remove(),
      );
      await Promise.all(shiftPromises);
    }

    // Then, delete the event
    const eventRef = db.ref(`events/${eventId}`);
    const eventSnapshot = await eventRef.once("value");
    if (!eventSnapshot.exists()) {
      return res.status(404).json({error: "Event not found."});
    }

    await eventRef.remove();
    res.json({message: "Event and associated shifts deleted successfully"});
  } catch (error) {
    console.error("Error deleting event:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not delete the event."});
  }
});

// GET all shifts for a specific event ID
router.get("/:event_id/shifts", async (req, res) => {
  try {
    const eventId = req.params.event_id;
    const shiftsRef = db.ref("shifts");
    const shiftsSnapshot = await shiftsRef.orderByChild("event_id").equalTo(eventId).once("value");
    const shiftsData = shiftsSnapshot.val() || {};
    res.json(shiftsData);
  } catch (error) {
    console.error("Error fetching shifts for event:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not retrieve shifts for the event."});
  }
});

// POST a new shift
router.post("/shifts", async (req, res) => {
  try {
    const shiftsRef = db.ref("shifts");
    const newShiftRef = shiftsRef.push(); // Use Firebase ID generation
    const shiftData = req.body;
    shiftData.created_at = new Date().toISOString();
    shiftData.updated_at = new Date().toISOString();
    await newShiftRef.set(shiftData);
    res.status(201).json({id: newShiftRef.key});
  } catch (error) {
    console.error("Error creating shift:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not create the shift."});
  }
});

// PUT to update a shift
router.put("/shifts/:shift_id", async (req, res) => {
  try {
    const shiftRef = db.ref(`shifts/${req.params.shift_id}`);
    const updateData = req.body;

    // Check if the shift exists before updating
    const snapshot = await shiftRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({error: "Shift not found."});
    }

    await shiftRef.update(updateData);
    res.json({message: "Shift updated successfully"});
  } catch (error) {
    console.error("Error updating shift:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not update the shift."});
  }
});

// DELETE a shift
router.delete("/shifts/:shift_id", async (req, res) => {
  try {
    const shiftRef = db.ref(`shifts/${req.params.shift_id}`);
    const snapshot = await shiftRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({error: "Shift not found."});
    }

    await shiftRef.remove();
    res.json({message: "Shift deleted successfully"});
  } catch (error) {
    console.error("Error deleting shift:", error.message);
    res.status(500).json({error: "Internal Server Error. Could not delete the shift."});
  }
});

module.exports = router;
