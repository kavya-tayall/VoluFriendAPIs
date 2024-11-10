'use strict';

// [START import]
const functions = require('firebase-functions/v1');
const express = require('express');
const app = express();
// [END import]

// [START middleware]
const cors = require('cors')({origin: true});
app.use(cors);
// [END middleware]


// Import your routes
const authRoutes = require("./routes/auth");
const volunteerRoutes = require("./routes/volunteer");
const usersRoutes = require("./routes/users");
const organizationsRoutes = require("./routes/organizations");
const userhomeorgRoutes = require("./routes/userhomeorg");
const updatehomeorgRoutes = require("./routes/updatehomeorg");
const causesRoutes = require("./routes/causes");
const voluevents = require("./routes/voluevents");
const myupcomingevents = require("./routes/myupcomingevents");
const userinterestevents = require("./routes/userinterestevents");
const eventsignup = require("./routes/eventsignup");
const uservolunteeringreport = require("./routes/uservolunteeringreport");
const volufriendmsgserverRoutes = require("./routes/volufriendmsgserver");
const scheduleReminder = require("./routes/scheduleReminder");
const eventmessages = require("./routes/eventmessages");
const orgupcomingevents = require("./routes/orgupcomingevents");
const attendance = require("./routes/attendance");
const geteventandshiftforapp = require("./routes/geteventandshiftforapproval");

// Use the imported routes
app.use("/auth", authRoutes);
app.use("/volunteers", volunteerRoutes);
app.use("/users", usersRoutes);
app.use("/organizations", organizationsRoutes);
app.use("/userhomeorg", userhomeorgRoutes);
app.use("/setuserhomeorg", updatehomeorgRoutes);
app.use("/causes", causesRoutes);
app.use("/events", voluevents);
app.use("/myupcomingevents", myupcomingevents);
app.use("/userinterestevents", userinterestevents);
app.use("/eventsignup", eventsignup);
app.use("/uservolunteeringreport", uservolunteeringreport);
app.use("/volufriendmsgserver", volufriendmsgserverRoutes);
app.use("/scheduleReminder", scheduleReminder);
app.use("/eventmessages", eventmessages);
app.use("/orgupcomingevents", orgupcomingevents);
app.use("/attendance", attendance);
app.use("/geteventandshiftforapproval", geteventandshiftforapp);

// Example basic route for homepage
app.get("/", (req, res) => {
  res.send("Welcome to the VoluFriend app");
});

module.exports = app;  // Export the Express app
