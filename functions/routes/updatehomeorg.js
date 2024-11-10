const express = require("express");
const router = express.Router();
const {db, admin} = require("../config/firebase"); // Import Firebase configuration

// Define valid roles
const validRoles = ["Volunteer", "Organization"];
const validOrgRoles = ["Admin", "General"];

// PUT endpoint to update home org and role
router.put("/:userId", async (req, res) => {
  try {
    const {userId} = req.params;
    const {orgId, role, createdAt, createdBy, orgRole} = req.body; // Extract values from request body

    // Validate request body
    if (!orgId || !role || !createdAt || !createdBy) {
      return res.status(400).json({message: "Missing required fields in request body"});
    }

    // Validate roles
    if (!validRoles.includes(role)) {
      return res.status(400).json({message: "Invalid role"});
    }

    // Check if organization exists
    const orgRef = db.ref(`organizations/${orgId}`);
    const orgSnapshot = await orgRef.once("value");
    const orgData = orgSnapshot.val();

    if (!orgData) {
      return res.status(404).json({message: "Organization not found"});
    }

    const parent_org = orgData["parent_org"];

    // Check if user exists
    const userRef = db.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({message: "User not found"});
    }

    const userFCMToken = userData["token"];

    // Update user's home_org and role
    await userRef.update({
      school_home_org_id: orgId,
      role: role,
    });

    // Check if the role is "Organization" before updating org_user table
    if (role === "Organization") {
      if (!validOrgRoles.includes(orgRole)) {
        return res.status(400).json({message: "Invalid organization role"});
      }

      // Reference to the org_users table
      const orgUserRef = db.ref("org_users");

      // Query to find existing entry
      const orgUserSnapshot = await orgUserRef
          .orderByChild("user_id")
          .equalTo(userId)
          .once("value");
      const existingEntries = orgUserSnapshot.val();

      if (existingEntries) {
        // Update existing entry
        const [entryId] = Object.keys(existingEntries);

        await orgUserRef.child(entryId).update({
          updated_at: createdAt,
          updated_by: createdBy,
          user_role_in_Org: orgRole,
        });
      } else {
        // Insert new entry
        const newOrgUserRef = orgUserRef.push();

        await newOrgUserRef.set({
          created_at: createdAt,
          created_by: createdBy,
          organization_id: orgId,
          updated_at: createdAt,
          updated_by: createdBy,
          user_id: userId,
          user_role_in_Org: orgRole,
        });
      }
    }

    // Handle volunteer logic
    if (role === "Volunteer") {
      const volunteerRef = db.ref("volunteers");

      // Query to find active entry for the user and org
      const volunteerSnapshot = await volunteerRef
          .orderByChild("user_id")
          .equalTo(userId)
          .once("value");
      const volunteerEntries = volunteerSnapshot.val();

      const existingEntry = Object.values(volunteerEntries || {}).find(
          (entry) => entry.org_id === orgId && entry.status === "Active",
      );

      if (!existingEntry) {
        // Insert new entry if no active entry exists
        const newVolunteerRef = volunteerRef.push();
        await newVolunteerRef.set({
          user_id: userId,
          org_id: orgId,
          org_sign_update_time: createdAt,
          status: "Active",
        });
      }

      // Subscribe to org topic
      console.log("Subscribing to org:", parent_org);
      const topic = parent_org.replace(/\s+/g, "_"); // Replace spaces with underscores
      console.log("Topic:", topic);
      console.log("User FCM Token:", userFCMToken);
      if (parent_org) {
        try {
          await admin.messaging().subscribeToTopic(userFCMToken, topic);
          console.log("Successfully subscribed to topic.");
        } catch (error) {
          console.error("Error subscribing to topic:", error);
        }
      }
    }

    // Combine the user and organization data to create the response
    const response = {
      userId: userId,
      username: `${userData["First Name"]} ${userData["Last Name"]}`,
      orgId: orgId,
      role: role,
      orgName: orgData ? orgData["name"] : null,
      user_role_in_Org: role === "Organization" ? orgRole : undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
