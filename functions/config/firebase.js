const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

// Path to your service account key file
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin SDK if it hasn't been initialized already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://volufriend-default-rtdb.firebaseio.com/' // Replace with your Firebase project URL
  });
}

// Export both the database and messaging services
const db = admin.database();
//const admin = admin;

module.exports = { db, admin };

