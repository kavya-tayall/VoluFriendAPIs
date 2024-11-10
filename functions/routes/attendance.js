const {format, isAfter, isBefore, parseISO} = require("date-fns"); // For date comparison
const express = require("express");
const router = express.Router();
const {db} = require("../config/firebase"); // Firebase initialization with Realtime Database

router.get("/", async (req, res) => {
  try {
    const {event_id, shift_id, start_date, end_date} = req.query;

    if (!event_id) {
      return res.status(400).json({error: "event_id is required"});
    }

    // Fetch all attendances for the given event_id
    const attendanceSnapshot = await db.ref("attendances")
        .orderByChild("event_id")
        .equalTo(event_id)
        .once("value");
    const attendanceData = attendanceSnapshot.val();

    if (!attendanceData) {
      return res.status(404).json({message: "No attendance records found for the event"});
    }

    const reportData = {};
    const startDate = start_date ? parseISO(start_date) : null;
    const endDate = end_date ? parseISO(end_date) : null;

    Object.entries(attendanceData).forEach(([attendanceId, attendance]) => {
      const eventDate = parseISO(attendance.event_date);

      const withinStartDate = startDate ? isAfter(eventDate, startDate) || eventDate.getTime() === startDate.getTime() : true;
      const withinEndDate = endDate ? isBefore(eventDate, endDate) || eventDate.getTime() === endDate.getTime() : true;

      if (withinStartDate && withinEndDate) {
        reportData[attendanceId] = {
          approved_by_approver_id: attendance.approved_by_approver_id,
          attendance_status: attendance.attendance_status,
          coordinator_email: attendance.coordinator_email,
          coordinator_name: attendance.coordinator_name,
          event_date: attendance.event_date,
          event_id: attendance.event_id,
          event_name: attendance.event_name,
          hours_approved: attendance.hours_approved,
          hours_attended: attendance.hours_attended,
          hours_rejected: attendance.hours_rejected,
          organization_name: attendance.organization_name,
          shift_id: attendance.shift_id,
          shift_name: attendance.shift_name,
          signup_id: attendance.signup_id,
          user_id: attendance.user_id,
          volunteer_name: attendance.volunteer_name,
        };
      }
    });

    if (Object.keys(reportData).length === 0) {
      return res.status(200).json({});
    }

    return res.status(200).json(reportData);
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Internal Server Error", error: error.message});
  }
});

// POST endpoint to add a new attendance record
router.post("/checkin", async (req, res) => {
  try {
    const {
      event_id,
      user_id,
      volunteer_name,
      attendance_status,
      coordinator_name,
      coordinator_email,
      hours_attended,
      hours_approved,
      hours_rejected,
      approved_by_approver_id,
      organization_name,
      shift_id,
      shift_name,
      signup_id,
      event_date, // Expected in ISO format
      event_name,
    } = req.body;

    // Validate required fields
    if (!event_id || !user_id || !event_date) {
      return res.status(400).json({error: "event_id, user_id, and event_date are required"});
    }

    // Parse and format the event date using date-fns
    const formattedEventDate = format(new Date(event_date), "yyyy-MM-dd");

    // Create a new attendance entry
    const newAttendanceRef = db.ref("attendances").push();
    const newAttendance = {
      event_id,
      user_id,
      volunteer_name: volunteer_name || "", // Set default empty string if missing
      attendance_status: attendance_status || "pending", // Default status
      coordinator_name: coordinator_name || "",
      coordinator_email: coordinator_email || "",
      hours_attended: hours_attended || 0,
      hours_approved: hours_approved || 0,
      hours_rejected: hours_rejected || 0,
      approved_by_approver_id: approved_by_approver_id || "",
      organization_name: organization_name || "",
      shift_id: shift_id || "",
      shift_name: shift_name || "",
      signup_id: signup_id || "",
      event_date: formattedEventDate,
      event_name: event_name || "",
    };

    // Save the new attendance record to Firebase
    await newAttendanceRef.set(newAttendance);

    // Return the new attendance record with the generated ID
    const createdAttendance = {
      id: newAttendanceRef.key,
      ...newAttendance,
    };

    return res.status(201).json(createdAttendance);
  } catch (error) {
    return res.status(500).json({message: "Internal Server Error", error: error.message});
  }
});

// PUT endpoint for bulk approval or rejection of attendance records
router.put("/approve/", async (req, res) => {
  try {
    const attendances = req.body; // Expect the same JSON response structure from the GET request

    if (!attendances || Object.keys(attendances).length === 0) {
      return res.status(400).json({error: "Attendance data is required"});
    }

    // Loop through each attendance record and update based on the status
    const updatePromises = Object.entries(attendances).map(async ([id, attendance]) => {
      const {
        attendance_status,
        approved_by_approver_id,
        hours_approved = 0, // Default to 0 if not provided
        hours_rejected = 0, // Default to 0 if not provided
      } = attendance;

      // Validate required fields based on status
      if (!attendance_status || !approved_by_approver_id) {
        throw new Error(`Attendance with ID ${id} must have attendance_status and approved_by_approver_id`);
      }

      // Reference to the specific attendance record in Firebase
      const attendanceRef = db.ref(`attendances/${id}`);

      // Fetch the attendance record to ensure it exists
      const attendanceSnapshot = await attendanceRef.once("value");
      if (!attendanceSnapshot.exists()) {
        throw new Error(`Attendance record with ID ${id} not found`);
      }

      let updatedAttendance = {};

      // Handle approval
      if (attendance_status === "approved") {
        updatedAttendance = {
          ...attendance,
          attendance_status: "approved", // Set status to approved
          hours_approved,
          approved_by_approver_id,
        };
      }
      // Handle rejection
      else if (attendance_status === "rejected") {
        updatedAttendance = {
          ...attendance,
          attendance_status: "rejected", // Set status to rejected
          hours_rejected,
          rejected_by_approver_id: approved_by_approver_id, // Use the same approver ID
        };
      } else {
        throw new Error(`Invalid attendance_status for attendance with ID ${id}. It must be 'approved' or 'rejected'.`);
      }

      // Update the record in Firebase
      await attendanceRef.update(updatedAttendance);
    });

    // Wait for all the updates to complete
    await Promise.all(updatePromises);

    return res.status(200).json({message: "Attendance records processed successfully"});
  } catch (error) {
    return res.status(500).json({message: "Internal Server Error", error: error.message});
  }
});


module.exports = router;
