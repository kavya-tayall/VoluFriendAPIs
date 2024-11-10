require('dotenv').config();  // Load environment variables

const express = require('express');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Import Firebase Admin SDK initialization
const sendNotification = require('./functions/routes/volufriendsendnotifications');

// Import routes
const authRoutes = require('./functions/routes/auth');
const volunteerRoutes = require('./functions/routes/volunteer');
const usersRoutes = require('./functions/routes/users');
const organizationsRoutes = require('./functions/routes/organizations');
const userhomeorgRoutes = require('./functions/routes/userhomeorg'); 
const updatehomeorgRoutes = require('./functions/routes/updatehomeorg'); 
const causesRoutes = require('./functions/routes/causes');
const voluevents = require('./functions/routes/voluevents');
const myupcomingevents = require('./functions/routes//myupcomingevents');
const userinterestevents = require('./functions/routes/userinterestevents');
const eventsignup = require('./functions/routes/eventsignup');
const uservolunteeringreport = require('./functions/routes/uservolunteeringreport');
const volufriendmsgserverRoutes = require('./functions/routes/volufriendmsgserver'); // New route for messages
const scheduleReminder = require('./functions/routes/scheduleReminder');
const eventmessages = require('./functions/routes/eventmessages');
const orgupcomingevents = require('./functions/routes/orgupcomingevents');
const attendance = require('./functions/routes/attendance');
const geteventandshiftforapproval = require('./functions/routes/geteventandshiftforapproval');
const orgupcomingeventspagewise = require('./functions/routes/orgupcomingeventspagewise');

// Use routes
app.use('/eventmessages', eventmessages);
app.use('/auth', authRoutes);
app.use('/volunteers', volunteerRoutes);
app.use('/users', usersRoutes);
app.use('/organizations', organizationsRoutes);
app.use('/userhomeorg', userhomeorgRoutes); 
app.use('/setuserhomeorg', updatehomeorgRoutes); 
app.use('/causes', causesRoutes); 
app.use('/events', voluevents);
app.use('/myupcomingevents', myupcomingevents);
app.use('/userinterestevents', userinterestevents);
app.use('/eventsignup', eventsignup);
app.use('/uservolunteeringreport', uservolunteeringreport);
app.use('/volufriendmsgserver', volufriendmsgserverRoutes); // New route for messages
app.use('/scheduleReminder', scheduleReminder);
app.use('/orgupcomingevents', orgupcomingevents);
app.use('/attendance', attendance);
app.use('/geteventandshiftforapproval', geteventandshiftforapproval);
app.use('/orgupcomingeventspagewise', orgupcomingeventspagewise);



// New route to send FCM notification
app.post('/sendNotification', async (req, res) => {
    const { token, source, message, sender, receiver,userId,eventId } = req.body;

    // Validate required fields
    if (!token || !source || !message || !sender || !receiver) {
        return res.status(400).send({
            error: 'Missing required parameters: token, source, message, sender, or receiver'
        });
    }

    try {
        // Call the sendNotification function with parameters
        const response = await sendNotification(token, source, message, sender, receiver,userId,eventId );
        res.status(200).send({
            message: 'Successfully sent message',
            response: response
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send({
            error: 'Error sending message',
            details: error.message || error
        });
    }
});

// Define a Hello World endpoint as POST
app.post('/hello', (req, res) => {
    res.status(200).send('Hello, World!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
