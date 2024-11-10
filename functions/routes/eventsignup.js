const express = require("express");
const router = express.Router();
const axios = require("axios");
const {db} = require("../config/firebase");

// Helper function to fetch organization data
const getOrgData = async (orgId) => {
  const orgRef = db.ref(`organizations/${orgId}`);
  const orgSnapshot = await orgRef.once("value");
  return orgSnapshot.val();
};

// Helper function to fetch user data
const getUserData = async (userId) => {
  const userRef = db.ref(`users/${userId}`);
  const userSnapshot = await userRef.once("value");
  return userSnapshot.val();
};

// Helper function to fetch event data
const getEventData = async (eventId) => {
  const eventRef = db.ref(`events/${eventId}`);
  const eventSnapshot = await eventRef.once("value");
  return eventSnapshot.val();
};

// Helper function to validate if shift belongs to the event
const validateShiftBelongsToEvent = async (shiftId, eventId) => {
  const shiftRef = db.ref(`shifts/${shiftId}`);
  const shiftSnapshot = await shiftRef.once("value");
  const shiftData = shiftSnapshot.val();
  return shiftData && shiftData.event_id === eventId;
};

// Middleware to validate user_id, org_id, event_id, and shift_ids
const validateUserOrgEventShift = async (req, res, next) => {
  const {user_id, org_id, event_id, selected_shift_ids} = req.body;

  try {
    const orgData = await getOrgData(org_id);
    if (!orgData) {
      return res.status(400).json({error: "Invalid organization ID."});
    }

    const userData = await getUserData(user_id);
    if (!userData) {
      return res.status(404).json({error: "User not found."});
    }

    const eventData = await getEventData(event_id);
    if (!eventData) {
      return res.status(400).json({error: "Invalid event ID."});
    }

    const {title, start_date} = eventData;
    req.eventDetails = {title, start_date}; // Store event details in req object

    for (const shift of selected_shift_ids) {
      const isValidShift = await validateShiftBelongsToEvent(shift.shift_id, event_id);
      if (!isValidShift) {
        return res.status(400).json({error: `Shift ID ${shift.shift_id} does not belong to Event ID ${event_id}.`});
      }
    }

    next();
  } catch (error) {
    res.status(500).json({error: error.message});
  }
};

// Helper function to check existing signup excluding withdrawals
const checkExistingSignup = async (volunteerId, eventId, shiftId) => {
  const signupsRef = db.ref("signups");
  const signupsSnapshot = await signupsRef
      .orderByChild("volunteer_id")
      .equalTo(volunteerId)
      .once("value");

  let existingSignup = null;
  signupsSnapshot.forEach((signup) => {
    const signupData = signup.val();
    if (signupData.event_id === eventId && signupData.shift_id === shiftId && !signupData.withdrawal) {
      existingSignup = {
        signupId: signup.key,
        signUpDateTime: signupData.sign_up_date_time,
      };
    }
  });

  return existingSignup;
};

// Helper function to mark a signup as withdrawn
const markSignupAsWithdrawn = async (signupId) => {
  const currentTime = new Date().toISOString();
  const signupsRef = db.ref(`signups/${signupId}`);
  await signupsRef.update({
    withdrawal: true,
    withdrawal_date_time: currentTime,
  });
};

// POST endpoint for creating/updating signups
router.post("/", validateUserOrgEventShift, async (req, res) => {
  const {org_id, user_id, event_id, selected_shift_ids} = req.body;
  const {title: eventTitle, start_date: eventTime} = req.eventDetails;

  try {
    const volunteersSnapshot = await db.ref("volunteers")
        .orderByChild("user_id")
        .equalTo(user_id)
        .once("value");

    let volunteerId = null;

    volunteersSnapshot.forEach((volunteer) => {
      const volunteerData = volunteer.val();
      if (volunteerData.org_id === org_id && volunteerData.status === "Active") {
        volunteerId = volunteer.key; // Use the key as volunteer_id
      }
    });

    // If no active volunteer found, create a new volunteer entry
    if (!volunteerId) {
      const newVolunteerRef = db.ref("volunteers").push();
      await newVolunteerRef.set({
        org_id: org_id,
        org_sign_update_time: new Date().toISOString(),
        status: "Active",
        user_id: user_id,
      });
      volunteerId = newVolunteerRef.key; // Get the newly created volunteer ID
    }

    const signupsSnapshot = await db.ref("signups")
        .orderByChild("volunteer_id")
        .equalTo(volunteerId)
        .once("value");

    const existingShiftSignups = {};
    signupsSnapshot.forEach((signup) => {
      const signupData = signup.val();
      if (signupData.event_id === event_id && !signupData.withdrawal) {
        existingShiftSignups[signupData.shift_id] = signup.key;
      }
    });

    const signupsRef = db.ref("signups");
    const currentTime = new Date().toISOString();

    // Process shifts provided in the request
    for (const shift of selected_shift_ids) {
      const existingSignup = existingShiftSignups[shift.shift_id];

      if (existingSignup) {
        await signupsRef.child(existingSignup).update({updated_at: currentTime});
        delete existingShiftSignups[shift.shift_id];
      } else {
        const signupId = signupsRef.push().key;
        await signupsRef.child(signupId).set({
          created_at: currentTime,
          event_id: event_id,
          shift_id: shift.shift_id,
          sign_up_date_time: currentTime,
          updated_at: currentTime,
          volunteer_id: volunteerId,
        });
      }
    }

    // Mark remaining shifts as withdrawn
    for (const shiftId in existingShiftSignups) {
      await markSignupAsWithdrawn(existingShiftSignups[shiftId]);
    }

    // Set the environment (either 'local' or 'production')
    const isLocal = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development";

    // Define the API endpoint based on the environment
    const externalEndpoint = isLocal
    ? `${process.env.LOCAL_API_ENDPOINT}/scheduleReminder/`
    : `${process.env.API_HOST}/scheduleReminder`;

    console.log("External API endpoint:", externalEndpoint);

    // Call the external API to schedule a reminder for the event
    if (!eventTime || !eventTitle) {
      console.error("Event time or title is missing");
      return res.status(400).json({error: "Event time or title is missing"});
    }

    const body = {
      userId: user_id,
      eventTitle: eventTitle,
      eventTime: eventTime,
      eventId: event_id,
    };

    try {
      const externalResponse = await axios.post(externalEndpoint, body);
      if (externalResponse.status === 200) {
        console.log("Reminder successfully scheduled");
      } else {
        console.error("Failed to schedule reminder", externalResponse.data);
      }
    } catch (error) {
      console.error("Error calling external reminder API:", error.message);
    }

    res.status(201).json({message: "Signups created/updated successfully", volunteer_id: volunteerId});
  } catch (error) {
    console.error("Error signing up for event:", error);
    res.status(500).json({error: "Internal Server Error. Could not sign up for event."});
  }
});

module.exports = router;
