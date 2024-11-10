const { isAfter, isBefore, parseISO, startOfDay } = require('date-fns');
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

router.get('/', async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    // Ensure `user_id` is provided
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Parse and normalize start_date and end_date to day-level comparisons
    const startDate = start_date ? startOfDay(parseISO(start_date)) : null;
    const endDate = end_date ? startOfDay(parseISO(end_date)) : null;

    // Fetch attendances directly for the specified user_id
    const attendancesSnapshot = await db.ref('attendances')
      .orderByChild('user_id')
      .equalTo(user_id)
      .once('value');

    const attendancesData = attendancesSnapshot.val();
    if (!attendancesData) {
      return res.status(404).json({ message: 'No attendance records found for the user' });
    }

    // Prepare the response structure
    const reportData = {};

    // Filter and format attendances based on date range only if start_date or end_date is provided
    Object.entries(attendancesData).forEach(([attendanceId, attendance]) => {
      const attendanceDate = attendance.event_date ? startOfDay(parseISO(attendance.event_date)) : null;

      // Only apply date range filtering if startDate or endDate is specified
      const withinStartDate = startDate ? (attendanceDate && !isBefore(attendanceDate, startDate)) : true;
      const withinEndDate = endDate ? (attendanceDate && !isAfter(attendanceDate, endDate)) : true;

      if (withinStartDate && withinEndDate) {
        const volunteerId = attendance.volunteer_id || user_id;
        if (!reportData[volunteerId]) {
          reportData[volunteerId] = {
            user_id: user_id,
            volunteer_name: `${attendance.volunteer_first_name} ${attendance.volunteer_last_name}`,
            "First Name": attendance.volunteer_first_name,
            "Last Name": attendance.volunteer_last_name,
            attendances: {},
          };
        }

        reportData[volunteerId].attendances[attendanceId] = {
          organization_name: attendance.organization_name,
          event_id: attendance.event_id,
          event_date: attendance.event_date,
          event_name: attendance.event_name,
          shift_id: attendance.shift_id,
          shift_name: attendance.shift_name,
          coordinator_name: attendance.coordinator_name || 'N/A',
          coordinator_email: attendance.coordinator_email || 'N/A',
          hours_attended: attendance.hours_attended,
          hours_approved: attendance.hours_approved || 0,
          hours_rejected: attendance.hours_rejected || 0,
          signup_id: attendance.signup_id,
          approved_by_approver_id: attendance.approved_by_approver_id,
          approved_by_approver_name: attendance.approved_by_approver_name,
          approved_date: attendance.approved_date,
          rejected_by_approver_id: attendance.rejected_by_approver_id,
          rejected_by_approver_name: attendance.rejected_by_approver_name,
          rejected_date: attendance.rejected_date,
          attendance_status: attendance.attendance_status,
        };
      }
    });

    // Return the final report data
    return res.status(200).json(reportData);

  } catch (error) {
    console.error('Error generating volunteering report:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

module.exports = router;
