const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const {scheduleEventReminder} = require("./cronjobforeventnotifications");
// Middleware
router.use(bodyParser.json());


// API route to schedule a reminder
router.post("/", async (req, res) => {
  const {userId, eventTitle, eventTime, eventId} = req.body;

  try {
    // Call the scheduling function
    scheduleEventReminder(userId, eventTitle, eventTime, eventId);
    res.status(200).json({message: "Reminder scheduled successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;

