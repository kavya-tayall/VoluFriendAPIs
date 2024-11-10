const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Helper function to fetch user data
const getUserData = async (userId) => {
  const userRef = db.ref(`users/${userId}`);
  const userSnapshot = await userRef.once('value');
  return userSnapshot.val();
};

// Helper function to fetch organization data
const getOrgData = async (orgId) => {
  const orgRef = db.ref(`organizations/${orgId}`);
  const orgSnapshot = await orgRef.once('value');
  return orgSnapshot.val();
};

// Endpoint to check if homeorg exists
router.get('/:id/check-homeorg', async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = await getUserData(userId);

    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orgId = userData['school_home_org_id'];
    if (!orgId || orgId.trim() === '') {
      return res.status(400).json({ message: 'Invalid or missing school home org' });
    }

    const orgData = await getOrgData(orgId);
    if (!orgData) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const response = {
      userId: userId,
      username: `${userData['First Name']} ${userData['Last Name']}`,
      orgId: orgId,
      role: userData['role'] || null,
      orgName: orgData?.name || null,
    };
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to return homeorg with actual values
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = await getUserData(userId);

    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orgId = userData['school_home_org_id'];
    let orgData = null;

    if (orgId && orgId.trim() !== '') {
      orgData = await getOrgData(orgId);
    } else {
      return res.status(200).json({
        userId: userId,
        username: `${userData['First Name']} ${userData['Last Name']}`,
        orgId: orgId,
        role: null,
        orgName: null,
        userRoleInOrg: null,
        userIdInOrg: null,
        parentOrg: null,
      });
    }
    // Check if user role is 'Organization'
    if (userData.role === "Organization") {
      const orgUserRef = db.ref('org_users')
        .orderByChild('user_id')
        .equalTo(userId);
      const orgUserSnapshot = await orgUserRef.once('value');
      const orgUserData = orgUserSnapshot.val();

      if (!orgUserData) {
        return res.status(404).json({ message: 'User not found in org_users' });
      }

      // Find the user in the organization
      const userInOrgEntry = Object.entries(orgUserData).find(([key, user]) => user.organization_id === orgId);

      if (!userInOrgEntry) {
        return res.status(404).json({ message: `No role found for user ${userId} in organization ${orgId}` });
      }

      // Destructure to get the key (default ID) and the user data
      const [defaultId, userInOrg] = userInOrgEntry;

      const response = {
        userId: userId,
        username: `${userData['First Name']} ${userData['Last Name']}`,
        orgId: orgId,
        role: userData?.role || null,
        orgName: orgData?.name || null,
        userRoleInOrg: userInOrg.user_role_in_Org,
        userIdInOrg: defaultId,
        parentOrg: orgData?.parent_org || null,
      };
      return res.status(200).json(response);
    } else {
      // If role is not 'Organization'
      const response = {
        userId: userId,
        username: `${userData['First Name']} ${userData['Last Name']}`,
        orgId: orgId,
        role: userData?.role || null,
        orgName: orgData?.name || null,
        userRoleInOrg: null,
        userIdInOrg: null,
        parentOrg: orgData?.parent_org || null,
      };
      return res.status(200).json(response);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
