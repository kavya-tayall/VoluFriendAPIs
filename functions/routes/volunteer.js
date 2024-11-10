const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase");
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

// Endpoint to get a list of all volunteers
router.get("/", validateApiKey, validateJwt, (req, res) => {
  db.ref("volunteers").once("value")
      .then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          res.status(200).json({message: "Volunteers data retrieved successfully", data});
        } else {
          res.status(404).json({message: "No volunteers found"});
        }
      })
      .catch((error) => {
        console.error("Error retrieving volunteers data:", error);
        res.status(500).json({message: "Error retrieving volunteers data", error});
      });
});

// Endpoint to get a specific volunteer by ID
router.get("/:id", validateApiKey, validateJwt, (req, res) => {
  const volunteerId = req.params.id;
  db.ref(`volunteers/${volunteerId}`).once("value")
      .then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          res.status(200).json({message: "Volunteer data found", data});
        } else {
          res.status(404).json({message: `No volunteer record found for ID: ${volunteerId}`});
        }
      })
      .catch((error) => {
        console.error("Error reading volunteer data:", error);
        res.status(500).json({message: "Error reading volunteer data", error});
      });
});

// Endpoint to create a new volunteer entry (join organization)
router.post("/joinorg", validateApiKey, validateJwt, (req, res) => {
  const {user_id, org_id} = req.body;
  db.ref("volunteers").orderByChild("user_id").equalTo(user_id).once("value")
      .then((snapshot) => {
        let alreadyVolunteering = false;
        let volunteerKey = null;
        snapshot.forEach((childSnapshot) => {
          const volunteer = childSnapshot.val();
          if (volunteer.org_id === org_id && volunteer.status === "Active") {
            alreadyVolunteering = true;
          }
          if (volunteer.org_id === org_id && volunteer.status !== "Active") {
            volunteerKey = childSnapshot.key;
          }
        });
        if (alreadyVolunteering) {
          return res.status(200).json({message: `User ID ${user_id} is already volunteering for Org ID ${org_id}.`});
        }
        if (volunteerKey) {
          db.ref(`volunteers/${volunteerKey}`).update({
            org_sign_update_time: new Date().toISOString(),
            status: "Active",
            org_withdrawal_date_time: null,
          });
          return res.status(200).json({message: "Volunteer status updated to Active.", volunteer_id: volunteerKey});
        }
        const newVolunteerRef = db.ref("volunteers").push();
        const newVolunteerId = newVolunteerRef.key;
        newVolunteerRef.set({
          user_id,
          org_id,
          org_sign_update_time: new Date().toISOString(),
          status: "Active",
          org_withdrawal_date_time: null,
        });
        res.status(200).json({message: "Volunteer added successfully.", volunteer_id: newVolunteerId});
      })
      .catch((error) => {
        console.error("Error joining organization:", error);
        res.status(500).json({message: "Error joining organization", error});
      });
});

// Endpoint to withdraw from organization
router.post("/withdraw", validateApiKey, validateJwt, (req, res) => {
  const {user_id, org_id} = req.body;
  db.ref("volunteers").orderByChild("user_id").equalTo(user_id).once("value")
      .then((snapshot) => {
        let volunteerKey = null;
        snapshot.forEach((childSnapshot) => {
          const volunteer = childSnapshot.val();
          if (volunteer.org_id === org_id && volunteer.status === "Active") {
            volunteerKey = childSnapshot.key;
          }
        });
        if (volunteerKey) {
          db.ref(`volunteers/${volunteerKey}`).update({
            status: "withdrawal",
            org_withdrawal_date_time: new Date().toISOString(),
          });
          return res.status(200).json({message: `User ID ${user_id} has withdrawn from Org ID ${org_id}.`});
        }
        res.status(404).json({message: `No active volunteer record found for User ID ${user_id} with Org ID ${org_id}.`});
      })
      .catch((error) => {
        console.error("Error withdrawing from organization:", error);
        res.status(500).json({message: "Error withdrawing from organization", error});
      });
});

module.exports = router;
