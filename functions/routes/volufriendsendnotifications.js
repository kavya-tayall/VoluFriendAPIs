const { admin } = require("../config/firebase"); // Ensure this is correctly imported and initialized
const { v4: uuidv4 } = require("uuid");

/**
 * Sends a notification message using Firebase Cloud Messaging (FCM).
 *
 * @param {string} token - The recipient device token.
 * @param {string} source - The source of the notification (e.g., app, service).
 * @param {string} messageContent - The main message body.
 * @param {string} sender - The name or ID of the sender.
 * @param {string} receiver - The name or ID of the receiver.
 * @param {string} userId - The ID of the user receiving the notification.
 * @param {string} eventId - The ID of the event.
 * @param {string} eventtitle - The title of the notification.
 * @param {string} start_date - The start date of the event.
 * @param {string} orgName - The name of the organization.
 */
const sendNotification = async (token, source, messageContent, sender, receiver, userId, eventId, eventtitle, start_date, orgName) => {
  const notificationId = uuidv4(); // Generate a unique ID for the notification

  const message = {
    notification: {
      title: `Message from ${sender}`,
      body: messageContent,
    },
    data: {
      id: notificationId,
      userId: userId,
      eventId: eventId,
      title: `Message from ${sender}`,
      message: messageContent,
      source: source,
      receiver: receiver,
    },
    token: token,
  };

  const orgName1 = "Greenlake School District";
const start_date1 = "2024-12-22";
const eventtitle1="Girls Who Code"

  try {
    // Construct the event message
    const titleMsg = `Exciting New Opportunity with ${orgName1}!`;
    const messageBody = `A new event has been organized by ${orgName1}. The event "${eventtitle1}" is happening on ${start_date1}. Register now and make a difference!`;

    const messageevent = {
      notification: {
        title: titleMsg,
        body: messageBody,
      },
      data: {
        id: notificationId,
        userId: "allusers",
        eventId: 'HparcUwvtvWgjmdRMGYmDgDLmR62',
        title: titleMsg,
        message: messageBody,
        isRead: "false",
        source: "VoluFriend",
        receiver: "Kavya Tayal",
      },
      token: token,
    };

    console.log("messageevent", messageevent);

    const eventresponse = await admin.messaging().send(messageevent);
    console.log("Successfully sent message: to token", eventresponse);

   // await admin.messaging().subscribeToTopic(token, "Northshore_School_District");

   // const response2 = await admin.messaging().send(message); // Using the messaging service

   // console.log("Successfully sent message: to token", response2);

    //await admin.messaging().subscribeToTopic(token, "mohit");

    //const response3 = await admin.messaging().send(message2); // Using the messaging service

   // console.log("Successfully sent message: to topic", response3);


    return eventresponse;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

module.exports = sendNotification;
