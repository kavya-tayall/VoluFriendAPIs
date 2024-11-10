const cron = require("node-cron");
const {admin} = require("../config/firebase"); // Import the messaging service
const {db} = require("../config/firebase");

const getUserFcmToken = async (userId) => {
  try {
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (userData && userData.token) {
      return userData.token;
    } else {
      throw new Error("Token not found for this user");
    }
  } catch (error) {
    throw new Error(error.message);
  }
};
// Function to send the notification
const {v4: uuidv4} = require("uuid"); // Use uuid for generating unique IDs

async function sendEventReminder(userId, eventTitle, eventId) {
  // Retrieve the FCM token for the user
  const userToken = await getUserFcmToken(userId); // Assume you have this function to fetch the user's FCM token

  if (!userToken) {
    console.error("User FCM token not found");
    return;
  }

  // Generate a unique ID for the notification
  const notificationId = uuidv4();
  const title= `Upcoming event reminder from Volufriend`;
  const messagebody= `Reminder: The event '${eventTitle}' is happening in 24 hours!`;
  // Define the notification message
  const message = {
    notification: {
      title: title,
      body: messagebody,
    },
    data: {
      id: notificationId, // Unique ID for the notification
      userId: userId, // The ID of the user receiving the notification
      eventId: eventId, // The ID of the event
      title: title,
      message: messagebody,
      isRead: "false", // Mark it as unread initially
      source: "VoluFriend",
      receiver: userId, // Receiver's userId
    },
    token: userToken, // Use the token parameter to send to the specific device
  };

  // Send the notification
  try {
    const response = await admin.messaging().send(message); // Using Firebase Admin SDK's messaging service
    console.log("Reminder sent successfully:", response);

    // No need to save notification on the server side as it's handled by UI's SharedPreferences
  } catch (error) {
    console.error("Error sending reminder:", error);
  }
}

// Function to schedule the reminder notification
function scheduleEventReminder(userId, eventTitle, eventTime, eventId) {
  const notificationTime = new Date(eventTime);

  // Subtract 1 day from the event time
  notificationTime.setDate(notificationTime.getDate() - 1);

  // Set the notification time to 10:00 AM
  notificationTime.setHours(21, 45, 0, 0); // Set hours to 10:00 AM exactly (hours, minutes, seconds, milliseconds)

  // Create the cron expression for the scheduled time
  const cronTime = `${notificationTime.getMinutes()} ${notificationTime.getHours()} ${notificationTime.getDate()} ${notificationTime.getMonth() + 1} *`;

  // Schedule the cron job
  cron.schedule(cronTime, () => {
    console.log(`Sending reminder for user: ${userId}, event: ${eventTitle}`);
    sendEventReminder(userId, eventTitle, eventId);
  });

  console.log(`Scheduled notification for user: ${userId}, event: ${eventTitle}, at: ${notificationTime}`);
}


module.exports = {
  scheduleEventReminder,
  // ... other exports
};
