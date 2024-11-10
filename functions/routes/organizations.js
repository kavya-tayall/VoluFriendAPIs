const express = require("express");
const router = express.Router();
const {db}= require("../config/firebase");
const {verifyToken} = require("../config/jwtConfig");

// Middleware for JWT validation
function validateJwt(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(403).json({message: "No token provided"});
  }
  verifyToken(token.split(" ")[1], (err, decoded) => {
    if (err) {
      return res.status(500).json({message: "Failed to authenticate token"});
    }
    req.userId = decoded.id; // Save the decoded user ID
    next();
  });
}

// API key validation middleware
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({message: "Invalid API Key"});
  }
}

// CRUD operations for Organizations
router.get("/", async (req, res) => {
  try {
    const orgsRef = db.ref("organizations");
    const snapshot = await orgsRef.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.get("/:id", async (req, res) => {
  try {
    const orgRef = db.ref(`organizations/${req.params.id}`);
    const snapshot = await orgRef.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.post("/", async (req, res) => {
  try {
    const newOrgRef = db.ref("organizations").push();
    await newOrgRef.set(req.body);
    res.status(201).json({id: newOrgRef.key});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.put("/:id", async (req, res) => {
  try {
    const orgRef = db.ref(`organizations/${req.params.id}`);
    await orgRef.update(req.body);
    res.json({message: "Organization updated successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const orgRef = db.ref(`organizations/${req.params.id}`);
    await orgRef.remove();
    res.json({message: "Organization deleted successfully"});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Additional Endpoints for Other Entities (attendances, events, etc.)
// Repeat the pattern for each entity in your schema (attendances, events, shifts, etc.)

module.exports = router;

