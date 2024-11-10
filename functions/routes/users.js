const express = require("express");
const router = express.Router();
const {db}= require("../config/firebase");
// const { verifyToken } = require('../config/jwtConfig');

// // Middleware for JWT validation
// function validateJwt(req, res, next) {
//     const token = req.headers['authorization'];
//     if (!token) {
//         return res.status(403).json({ message: 'No token provided' });
//     }
//     verifyToken(token.split(' ')[1], (err, decoded) => {
//         if (err) {
//             return res.status(500).json({ message: 'Failed to authenticate token' });
//         }
//         req.userId = decoded.id; // Save the decoded user ID
//         next();
//     });
// }

// // API key validation middleware
// function validateApiKey(req, res, next) {
//     const apiKey = req.headers['x-api-key'];
//     if (apiKey === process.env.API_KEY) {
//         next();
//     } else {
//         res.status(401).json({ message: 'Invalid API Key' });
//     }
// }

// CRUD operations for Users
router.get("/", async (req, res) => {
  try {
    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.params.id}`);
    const snapshot = await userRef.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.post("/:NewuserId", async (req, res) => {
  try {
    // Create a reference to the user's data in the database using the Firebase Admin SDK
    const userId = req.params.NewuserId;
    const newUserRef = db.ref(`users/${userId}`);

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === undefined || req.body[key] === "") {
      // Explicitly set fields to null if they are undefined or an empty string
        req.body[key] = null;
      }
    });

    // Directly write the request body to Firebase
    await newUserRef.set(req.body);

    res.status(201).json({id: newUserRef.key});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.params.id}`);
    await userRef.update(req.body);
    res.json({message: "User updated successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userRef = db.ref(`users/${req.params.id}`);
    await userRef.remove();
    res.json({message: "User deleted successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});


// Additional Endpoints for Other Entities (attendances, events, etc.)
// Repeat the pattern for each entity in your schema (attendances, events, shifts, etc.)

module.exports = router;

