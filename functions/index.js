/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

require('dotenv').config();  // Load environment variables

// [START import]
const functions = require("firebase-functions/v1");
const express = require("express");
const app = express();
// [END import]

// [START middleware]
const cors = require("cors")({origin: true});
app.use(cors);
// [END middleware]


app.use(express.json());

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
const orgupcomingeventspagewise = require("./routes/orgupcomingeventspagewise");
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
app.use("/orgupcomingeventspagewise", orgupcomingeventspagewise);

// [START export]
// Export the express app as an HTTP Cloud Function
exports.app = functions.https.onRequest(app);
// [END export]
