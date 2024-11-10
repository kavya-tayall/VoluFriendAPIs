// routes/volufriendmsgserver.js
const express = require("express");
const axios = require("axios");
const admin = require("../config/firebase"); // Import the initialized admin instance
const router = express.Router();

// Function to get the access token
async function getAccessToken() {
  const audience = `https://fcm.googleapis.com/googleapis.com/${admin.app().options.projectId}`;
  const accessToken = await admin.auth().createCustomToken(audience);
  return accessToken;
}

// Endpoint to send a push notification
router.post("/send-notification", async (req, res) => {
  const {receiverToken, title, body} = req.body;

  // Validate required fields
  if (!receiverToken || !title || !body) {
    return res.status(400).json({error: "All fields are required: receiverToken, title, and body."});
  }

  // Define the message payload
  const payload = {
    message: {
      token: receiverToken,
      notification: {
        title: title,
        body: body,
      },
    },
  };

  try {
    // Get the access token
    const accessToken = await getAccessToken();

    // Send the notification via v1 API
    const response = await axios.post(
        `https://fcm.googleapis.com/v1/projects/${admin.app().options.projectId}/messages:send`,
        payload,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
    );

    console.log("Notification sent successfully:", response.data);
    res.status(201).json({message: "Notification sent successfully", response: response.data});
  } catch (error) {
    console.error("Error sending notification:", error.response ? error.response.data : error.message);
    res.status(500).json({error: error.response ? error.response.data : error.message});
  }
});

module.exports = router;
