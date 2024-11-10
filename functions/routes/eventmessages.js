const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase"); // Ensure your firebase config is correct

// GET all messages for a specific user
router.get("/", async (req, res) => {
  try {
    const {user_id} = req.query;

    // Ensure user_id is provided
    if (!user_id) {
      return res.status(400).json({error: "user_id is required"});
    }

    // Reference to the 'messages' node
    const messagesRef = db.ref("messages");
    const snapshot = await messagesRef.once("value"); // Get all messages

    const messages = snapshot.val();
    const userMessages = {};

    // Filter messages by userId
    for (const messageId in messages) {
      if (messages[messageId].userId === user_id) {
        userMessages[messageId] = messages[messageId]; // Add to userMessages if userId matches
      }
    }

    // Check if userMessages is empty
    if (Object.keys(userMessages).length === 0) {
      return res.status(200).json({ });
    }

    res.json(userMessages); // Send the messages to the client
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// GET a single message
router.get("/:id", async (req, res) => {
  try {
    const orgRef = db.ref(`messages/${req.params.id}`);
    const snapshot = await orgRef.once("value");

    // Check if message exists
    if (!snapshot.exists()) {
      return res.status(404).json({error: "Message not found."});
    }

    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// POST a new message
router.post("/", async (req, res) => {
  try {
    const newOrgRef = db.ref("messages").push();
    await newOrgRef.set(req.body);
    res.status(201).json({id: newOrgRef.key});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// PUT (update) an existing message
router.put("/:id", async (req, res) => {
  try {
    const orgRef = db.ref(`messages/${req.params.id}`);
    await orgRef.update(req.body);
    res.json({message: "Message updated successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});


// DELETE specific messages by id
router.delete("/deleteall", async (req, res) => {
  console.log("Request received at /deleteall");
  console.log("Request body:", req.body); // Log the request body

  try {
    const messagesToDelete = req.body; // Object containing messages to delete

    if (typeof messagesToDelete !== "object" || Array.isArray(messagesToDelete)) {
      return res.status(400).json({error: "Invalid request format, expected an object of messages."});
    }

    const messagesRef = db.ref("messages"); // Reference to the messages collection

    // Traverse through each message object and remove it based on id
    for (const messageId in messagesToDelete) {
      const record = messagesToDelete[messageId];
      const messageIdToDelete = record.id; // Get the message id to delete

      if (!messageIdToDelete) {
        continue; // Skip if id is missing
      }

      // Search for the dbid using the id in your database
      const snapshot = await messagesRef.orderByChild("id").equalTo(messageIdToDelete).once("value");

      // If a message with the given id exists, delete it
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const dbid = childSnapshot.key; // Get the dbid
          console.log("Deleting record with dbid:", dbid);
          messagesRef.child(dbid).remove(); // Remove the specific record
        });
      } else {
        console.log(`No message found with id: ${messageIdToDelete}`);
      }
    }

    res.json({ });
  } catch (error) {
    console.error("Error during deletion:", error);
    res.status(500).json({error: error.message});
  }
});


// Export the router
module.exports = router;
