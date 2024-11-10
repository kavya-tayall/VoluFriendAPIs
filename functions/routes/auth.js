const express = require("express");
const router = express.Router();
const {generateToken} = require("../config/jwtConfig");

// Login endpoint to authenticate and issue JWT token
router.post("/", (req, res) => {
  const {username, password} = req.body;

  console.log("I am here"); // Debugging line

  if (username === "volu" && password === "friend") {
    const userId = 1008; // Replace with actual user ID from your database
    try {
      const token = generateToken(userId);
      res.status(200).json({auth: true, token});
    } catch (error) {
      res.status(500).json({auth: false, message: "Error generating token"});
    }
  } else {
    res.status(401).json({auth: false, message: "Invalid credentials"});
  }
});

module.exports = router;
