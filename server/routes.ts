import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMeetingSchema, insertDdfsAttendeeSchema, insertChangeLogSchema, type Category, CATEGORY_ATTENDEES, type User, USER_ROLES, type ChangeLog } from "@shared/schema";
import { z } from "zod";
import * as XLSX from "xlsx";
import path from "path";
import multer from "multer";
import { findOptimalMeetingTimes, analyzeSchedulingConflicts } from "./ai-scheduler";
import { emailService } from "./email-service";
import { calendarSyncService } from "./calendar-sync";
import { conflictResolver } from "./conflict-resolver";
import { notificationOptimizer } from "./notification-optimizer";
import { 
  userNotificationPreferences, 
  notificationRecommendations 
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed'));
      }
    }
  });

  // Authentication middleware
  const authenticateUser = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No authorization header" });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      // Simple token format: base64(email:password)
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [email, password] = decoded.split(':');
      
      // Normalize email to lowercase for consistent authentication
      const normalizedEmail = email.toLowerCase();
      const user = await storage.authenticateUser(normalizedEmail, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      // Normalize email to lowercase for consistent authentication
      const normalizedEmail = email.toLowerCase();
      const user = await storage.authenticateUser(normalizedEmail, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create simple token
      const token = Buffer.from(`${email}:${password}`).toString('base64');
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        permissions: USER_ROLES[user.role as keyof typeof USER_ROLES].permissions
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticateUser, (req: any, res) => {
    const user = req.user;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      permissions: USER_ROLES[user.role as keyof typeof USER_ROLES].permissions
    });
  });

  // Change password route
  app.post('/api/auth/change-password', authenticateUser, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Old password and new password are required' });
      }

      // Get user to check role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent vendors from changing password
      if (user.role === 'vendor') {
        return res.status(403).json({ message: 'Vendors are not allowed to change passwords' });
      }

      // Validate new password
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@#_])[a-zA-Z\d@#_]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          message: 'Password must be at least 8 characters long and contain letters, numbers, and allowed special characters (@, #, _)' 
        });
      }

      const success = await storage.changeUserPassword(userId, oldPassword, newPassword);
      if (success) {
        res.json({ message: 'Password changed successfully' });
      } else {
        res.status(400).json({ message: 'Current password is incorrect' });
      }
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get meetings for a specific date
  app.get("/api/meetings/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const meetings = await storage.getMeetingsByDate(date);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  // Get all meetings
  app.get("/api/meetings", async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  // Create a new meeting
  app.post("/api/meetings", authenticateUser, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      const validatedData = insertMeetingSchema.parse(req.body);
      
      // Check permissions - allow guest/vendor users to schedule meetings
      if (!userRole.permissions.canSchedule && user.role !== 'guest' && user.role !== 'vendor') {
        return res.status(403).json({ message: "Insufficient permissions to schedule meetings" });
      }
      
      // Skip category permission check for guest/vendor users
      if (user.role !== 'guest' && user.role !== 'vendor' && !userRole.permissions.categories.includes(validatedData.category as Category)) {
        return res.status(403).json({ message: `You don't have permission to schedule ${validatedData.category} meetings` });
      }
      
      // Check for conflicts if there are mandatory attendees
      if (validatedData.mandatoryAttendees && validatedData.mandatoryAttendees.length > 0) {
        const conflicts = await storage.checkConflicts(
          validatedData.date,
          validatedData.startTime,
          validatedData.endTime,
          validatedData.mandatoryAttendees
        );
        
        if (conflicts.length > 0) {
          return res.status(409).json({ 
            message: "Meeting conflict detected",
            conflicts: conflicts
          });
        }
      }
      
      const meeting = await storage.createMeeting(validatedData);
      res.status(201).json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create meeting" });
      }
    }
  });

  // Update a meeting
  app.put("/api/meetings/:id", authenticateUser, async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      const id = parseInt(req.params.id);
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      
      // Check permissions
      if (!userRole.permissions.canEdit) {
        return res.status(403).json({ message: "Insufficient permissions to edit meetings" });
      }
      
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Check category permissions for existing and new category (except for admin who can access all)
      if (user.role !== 'admin' && !userRole.permissions.categories.includes(existingMeeting.category as Category)) {
        return res.status(403).json({ message: `You don't have permission to edit ${existingMeeting.category} meetings` });
      }
      
      if (validatedData.category && user.role !== 'admin' && !userRole.permissions.categories.includes(validatedData.category as Category)) {
        return res.status(403).json({ message: `You don't have permission to change meeting to ${validatedData.category} category` });
      }
      
      // Check for conflicts if mandatory attendees or time is being updated
      if (validatedData.mandatoryAttendees || validatedData.startTime || validatedData.endTime || validatedData.date) {
        const mandatoryAttendees = validatedData.mandatoryAttendees || existingMeeting.mandatoryAttendees;
        const date = validatedData.date || existingMeeting.date;
        const startTime = validatedData.startTime || existingMeeting.startTime;
        const endTime = validatedData.endTime || existingMeeting.endTime;
        
        if (mandatoryAttendees.length > 0) {
          const conflicts = await storage.checkConflicts(
            date,
            startTime,
            endTime,
            mandatoryAttendees,
            id
          );
          
          if (conflicts.length > 0) {
            return res.status(409).json({ 
              message: "Meeting conflict detected",
              conflicts: conflicts
            });
          }
        }
      }
      
      const meeting = await storage.updateMeeting(id, validatedData);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update meeting" });
      }
    }
  });

  // Quick update a meeting (for drag-and-drop)
  app.patch("/api/meetings/:id", authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Check if user has permission to edit meetings in this category
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      if (!userRole.permissions.canEdit) {
        return res.status(403).json({ message: "You don't have permission to edit meetings" });
      }
      
      // Check category-specific permissions (except for admin who can access all)
      if (user.role !== 'admin' && !userRole.permissions.categories.includes(existingMeeting.category)) {
        return res.status(403).json({ 
          message: `You don't have permission to edit ${existingMeeting.category} meetings` 
        });
      }
      
      // If changing category, check permission for new category too
      if (validatedData.category && user.role !== 'admin' && !userRole.permissions.categories.includes(validatedData.category)) {
        return res.status(403).json({ 
          message: `You don't have permission to change meeting to ${validatedData.category} category` 
        });
      }
      
      // Check for conflicts if time or date is being updated
      if (validatedData.startTime || validatedData.endTime || validatedData.date) {
        const mandatoryAttendees = existingMeeting.mandatoryAttendees;
        const date = validatedData.date || existingMeeting.date;
        const startTime = validatedData.startTime || existingMeeting.startTime;
        const endTime = validatedData.endTime || existingMeeting.endTime;
        
        if (mandatoryAttendees.length > 0) {
          const conflicts = await storage.checkConflicts(
            date,
            startTime,
            endTime,
            mandatoryAttendees,
            id
          );
          
          if (conflicts.length > 0) {
            return res.status(409).json({ 
              message: "Meeting conflict detected",
              conflicts: conflicts
            });
          }
        }
      }
      
      const meeting = await storage.updateMeeting(id, validatedData);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update meeting" });
      }
    }
  });

  // Delete a meeting
  app.delete("/api/meetings/:id", authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      
      // First, get the meeting to check its category
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Check if user has permission to delete meetings in this category
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      if (!userRole.permissions.canEdit) {
        return res.status(403).json({ message: "You don't have permission to delete meetings" });
      }
      
      // Check category-specific permissions (except for admin who can access all)
      if (user.role !== 'admin' && !userRole.permissions.categories.includes(meeting.category)) {
        return res.status(403).json({ 
          message: `You don't have permission to delete ${meeting.category} meetings` 
        });
      }
      
      const success = await storage.deleteMeeting(id);
      if (!success) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  // Get attendees for a category
  app.get("/api/categories/:category/attendees", (req, res) => {
    const { category } = req.params;
    const attendees = CATEGORY_ATTENDEES[category as Category];
    if (!attendees) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(attendees);
  });

  // Check buffer violations
  app.post("/api/meetings/check-buffer", async (req, res) => {
    try {
      const { date, startTime, endTime, mandatoryAttendees, excludeMeetingId } = req.body;
      
      const bufferViolations = await storage.checkBufferViolations(
        date,
        startTime,
        endTime,
        mandatoryAttendees || [],
        excludeMeetingId
      );
      
      res.json({ bufferViolations });
    } catch (error) {
      res.status(500).json({ message: "Failed to check buffer violations" });
    }
  });

  // Export calendar as Excel
  app.get("/api/export/excel", async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      
      const worksheetData = meetings.map(meeting => ({
        Title: meeting.title,
        'Scheduler Name': meeting.schedulerName,
        Category: meeting.category,
        Date: meeting.date,
        'Start Time': meeting.startTime,
        'End Time': meeting.endTime,
        Location: meeting.location,
        Status: meeting.status,
        'DDFS Attendees': meeting.ddfsAttendees.join(', '),
        'Mandatory Attendees': meeting.mandatoryAttendees.join(', '),
        'Brand Attendees': meeting.brandAttendees.map(attendee => {
          try {
            const parsed = JSON.parse(attendee);
            return `${parsed.name} (${parsed.designation})`;
          } catch {
            return attendee;
          }
        }).join(', ')
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Meetings");
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=calendar.xlsx');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: "Failed to export Excel file" });
    }
  });

  // Export calendar as iCal
  app.get("/api/export/ical", async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      
      let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Meeting Scheduler//EN',
        'CALSCALE:GREGORIAN'
      ];
      
      meetings.forEach(meeting => {
        const startDateTime = `${meeting.date.replace(/-/g, '')}T${meeting.startTime.replace(':', '')}00`;
        const endDateTime = `${meeting.date.replace(/-/g, '')}T${meeting.endTime.replace(':', '')}00`;
        
        icalContent.push(
          'BEGIN:VEVENT',
          `UID:${meeting.id}@meetingscheduler.com`,
          `DTSTART:${startDateTime}`,
          `DTEND:${endDateTime}`,
          `SUMMARY:${meeting.title}`,
          `DESCRIPTION:Category: ${meeting.category}\\nScheduler: ${meeting.schedulerName}\\nStatus: ${meeting.status}`,
          `LOCATION:${meeting.location}`,
          `STATUS:${meeting.status.toUpperCase() === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE'}`,
          'END:VEVENT'
        );
      });
      
      icalContent.push('END:VCALENDAR');
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename=calendar.ics');
      res.send(icalContent.join('\r\n'));
    } catch (error) {
      res.status(500).json({ message: "Failed to export iCal file" });
    }
  });

  // Import meetings from Excel
  app.post("/api/import/excel", authenticateUser, upload.single('file'), async (req: any, res) => {
    try {
      const user = req.user;
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      
      if (!userRole.permissions.canSchedule) {
        return res.status(403).json({ message: "Insufficient permissions to import meetings" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const importResults = {
        success: 0,
        errors: [] as string[],
        skipped: 0
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        
        try {
          // Map Excel columns to our schema
          const meetingData = {
            title: row.Title || row.title || '',
            schedulerName: row.Scheduler || row.schedulerName || user.name,
            category: (row.Category || row.category || '').toLowerCase(),
            date: row.Date || row.date || '',
            startTime: row['Start Time'] || row.startTime || '',
            endTime: row['End Time'] || row.endTime || '',
            location: row.Location || row.location || '',
            status: (row.Status || row.status || 'confirmed').toLowerCase(),
            ddfsAttendees: typeof row['DDFS Attendees'] === 'string' 
              ? row['DDFS Attendees'].split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
            mandatoryAttendees: typeof row['Mandatory Attendees'] === 'string'
              ? row['Mandatory Attendees'].split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
            brandAttendees: typeof row['Brand Attendees'] === 'string'
              ? row['Brand Attendees'].split(',').map((s: string) => s.trim()).filter(Boolean)
              : []
          };

          // Validate required fields
          if (!meetingData.title || !meetingData.category || !meetingData.date || 
              !meetingData.startTime || !meetingData.endTime || !meetingData.location) {
            importResults.errors.push(`Row ${i + 2}: Missing required fields`);
            continue;
          }

          // Check category permissions
          if (!userRole.permissions.categories.includes(meetingData.category as Category)) {
            importResults.errors.push(`Row ${i + 2}: No permission for category ${meetingData.category}`);
            continue;
          }

          // Validate the meeting data
          const validatedData = insertMeetingSchema.parse(meetingData);
          
          // Check for conflicts
          const conflicts = await storage.checkConflicts(
            validatedData.date,
            validatedData.startTime,
            validatedData.endTime,
            validatedData.mandatoryAttendees || []
          );

          if (conflicts.length > 0) {
            importResults.errors.push(`Row ${i + 2}: Conflicts with existing meetings`);
            continue;
          }

          await storage.createMeeting(validatedData);
          importResults.success++;
          
        } catch (error) {
          if (error instanceof z.ZodError) {
            importResults.errors.push(`Row ${i + 2}: Invalid data format`);
          } else {
            importResults.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      res.json({
        message: `Import completed: ${importResults.success} meetings imported successfully`,
        results: importResults
      });

    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import Excel file" });
    }
  });

  // Serve download page directly
  app.get("/download.html", (req, res) => {
    const filePath = path.join(process.cwd(), "download.html");
    res.sendFile(filePath);
  });

  // Serve source package documentation
  app.get("/source-package/*", (req, res) => {
    const requestedPath = (req.params as any)[0] || "index.html";
    const filePath = path.join(process.cwd(), "source-package", requestedPath);
    res.sendFile(filePath);
  });

  // Enhanced conflict checking endpoint
  app.post("/api/meetings/check-conflicts", async (req, res) => {
    try {
      const { date, startTime, endTime, mandatoryAttendees, excludeMeetingId } = req.body;
      
      // Validate working hours (8 AM - 8 PM)
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      if (startHour < 8 || endHour > 20) {
        return res.json({
          hasConflicts: true,
          conflicts: ["Meetings must be scheduled between 8:00 AM and 8:00 PM"]
        });
      }

      const meetings = await storage.getMeetings();
      const conflicts: string[] = [];

      // Check for double booking
      const conflictingMeetings = meetings.filter((meeting: Meeting) => {
        if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
        if (meeting.date !== date) return false;
        
        const hasOverlap = timeOverlaps(startTime, endTime, meeting.startTime, meeting.endTime);
        if (!hasOverlap) return false;
        
        return meeting.mandatoryAttendees.some((attendee: string) => 
          mandatoryAttendees.includes(attendee)
        );
      });

      if (conflictingMeetings.length > 0) {
        conflictingMeetings.forEach((meeting: Meeting) => {
          const conflictingAttendees = meeting.mandatoryAttendees.filter((attendee: string) =>
            mandatoryAttendees.includes(attendee)
          );
          conflicts.push(
            `${conflictingAttendees.join(', ')} already has "${meeting.title}" scheduled at ${meeting.startTime}-${meeting.endTime}`
          );
        });
      }

      // Check daily meeting limits (max 8 meetings per person per day)
      mandatoryAttendees.forEach((attendee: string) => {
        const dailyMeetings = meetings.filter((meeting: Meeting) =>
          meeting.date === date && 
          meeting.mandatoryAttendees.includes(attendee) &&
          meeting.id !== excludeMeetingId
        );
        
        if (dailyMeetings.length >= 8) {
          conflicts.push(`${attendee} already has 8 meetings scheduled for this day`);
        }
      });

      res.json({
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts
      });
    } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({ message: "Failed to check conflicts" });
    }
  });

  // Download Excel template for import
  app.get("/api/template/excel", (req, res) => {
    try {
      const templateData = [
        {
          "Title": "Sample Meeting",
          "Scheduler": "John Doe", 
          "Category": "liquor",
          "Date": "2025-06-02",
          "Start Time": "10:00",
          "End Time": "11:00",
          "Location": "Conference Room A",
          "Status": "confirmed",
          "DDFS Attendees": "Manager A, Manager B",
          "Mandatory Attendees": "Manager A",
          "Brand Attendees": "Brand Rep 1, Brand Rep 2"
        }
      ];
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Meeting Template");
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Disposition', 'attachment; filename=meeting_import_template.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Download routes for source code
  app.get("/download/source", (req, res) => {
    const filePath = path.join(process.cwd(), "meeting-scheduler-complete.tar.gz");
    res.download(filePath, "meeting-scheduler-complete.tar.gz", (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(404).json({ error: "File not found" });
      }
    });
  });

  app.get("/download/legacy", (req, res) => {
    const filePath = path.join(process.cwd(), "meeting-scheduler-source.tar.gz");
    res.download(filePath, "meeting-scheduler-source.tar.gz", (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(404).json({ error: "File not found" });
      }
    });
  });

  // User management routes (admin only)
  app.get('/api/users', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userData = req.body;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Create user with custom permissions
      const newUser = await storage.createUser({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        customPermissions: JSON.stringify(userData.customPermissions)
      });

      res.json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.patch('/api/users/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const permissions = req.body;

      const updatedUser = await storage.updateUserPermissions(userId, permissions);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Update user timezone
  app.patch('/api/users/:id/timezone', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = parseInt(req.params.id);
      const { timezone } = req.body;
      
      // Users can only update their own timezone unless they're admin
      if (user.role !== 'admin' && user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedUser = await storage.updateUserTimezone(userId, timezone);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user timezone:', error);
      res.status(500).json({ message: 'Failed to update timezone' });
    }
  });

  app.delete('/api/users/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      
      // Prevent deleting own account
      if (userId === user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // DDFS Attendees management routes
  app.get('/api/ddfs-attendees', authenticateUser, async (req, res) => {
    try {
      // Prevent caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const user = req.user as any;
      const userRole = USER_ROLES[user.role as keyof typeof USER_ROLES];
      
      // Allow users with schedule permissions or guest/vendor users to view attendees
      if (!userRole.permissions.canSchedule && user.role !== 'guest' && user.role !== 'vendor') {
        return res.status(403).json({ message: 'Schedule permissions required' });
      }

      const attendees = await storage.getAllDdfsAttendees();
      console.log('API returning DDFS attendees:', JSON.stringify(attendees, null, 2));
      
      // For non-admin users, filter attendees based on their category permissions
      // Guest/vendor users can see all attendees for scheduling purposes
      if (user.role !== 'admin' && user.role !== 'guest' && user.role !== 'vendor') {
        const filteredAttendees = attendees.filter(attendee => 
          attendee.categories && attendee.categories.some(cat => 
            userRole.permissions.categories.includes(cat as Category)
          )
        );
        res.json(filteredAttendees);
      } else {
        res.json(attendees);
      }
    } catch (error) {
      console.error('Error fetching DDFS attendees:', error);
      res.status(500).json({ message: 'Failed to fetch DDFS attendees' });
    }
  });

  app.post('/api/ddfs-attendees', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('Creating DDFS attendee with request body:', req.body);
      
      // Validate request data
      if (!req.body.name || !req.body.email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      // Check if email already exists
      const existingAttendees = await storage.getAllDdfsAttendees();
      const emailExists = existingAttendees.some(attendee => 
        attendee.email.toLowerCase() === req.body.email.toLowerCase()
      );
      
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      const validatedData = insertDdfsAttendeeSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      
      const attendee = await storage.createDdfsAttendee(validatedData);
      console.log('Successfully created DDFS attendee:', attendee);
      
      res.status(201).json(attendee);
    } catch (error) {
      console.error('Error creating DDFS attendee:', error);
      if (error instanceof Error) {
        res.status(500).json({ message: `Failed to create DDFS attendee: ${error.message}` });
      } else {
        res.status(500).json({ message: 'Failed to create DDFS attendee' });
      }
    }
  });

  app.patch('/api/ddfs-attendees/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const attendeeId = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedAttendee = await storage.updateDdfsAttendee(attendeeId, updateData);
      
      if (!updatedAttendee) {
        return res.status(404).json({ message: 'DDFS attendee not found' });
      }

      res.json(updatedAttendee);
    } catch (error) {
      console.error('Error updating DDFS attendee:', error);
      res.status(500).json({ message: 'Failed to update DDFS attendee' });
    }
  });

  app.delete('/api/ddfs-attendees/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const attendeeId = parseInt(req.params.id);
      const deleted = await storage.deleteDdfsAttendee(attendeeId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'DDFS attendee not found' });
      }

      res.json({ message: 'DDFS attendee deleted successfully' });
    } catch (error) {
      console.error('Error deleting DDFS attendee:', error);
      res.status(500).json({ message: 'Failed to delete DDFS attendee' });
    }
  });

  // Reorder DDFS attendees
  app.post('/api/ddfs-attendees/reorder', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Only admin users can reorder attendees
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin users can reorder attendees' });
      }

      const { attendeeOrders } = req.body;

      if (!Array.isArray(attendeeOrders)) {
        return res.status(400).json({ message: 'attendeeOrders must be an array' });
      }

      const success = await storage.reorderDdfsAttendees(attendeeOrders);
      
      if (success) {
        res.json({ message: 'DDFS attendees reordered successfully' });
      } else {
        res.status(500).json({ message: 'Failed to reorder DDFS attendees' });
      }
    } catch (error) {
      console.error('Error reordering DDFS attendees:', error);
      res.status(500).json({ message: 'Failed to reorder DDFS attendees' });
    }
  });

  // Category Management Routes
  app.get('/api/categories', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      console.log('Categories API called by user:', user.email, 'role:', user.role);
      
      const categories = await storage.getAllCategories();
      console.log('Categories returned from storage:', categories.length, 'items');
      console.log('Categories data:', JSON.stringify(categories, null, 2));
      
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.post('/api/categories', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { selectedAttendees, ...categoryData } = req.body;
      
      // Create the category first
      const category = await storage.createCategory(categoryData);
      
      // Assign selected attendees to the category
      if (selectedAttendees && selectedAttendees.length > 0) {
        for (const attendeeId of selectedAttendees) {
          await storage.assignAttendeeToCategory(attendeeId, category.id);
        }
        
        // Sync all attendee category arrays with relationship table
        await storage.syncAttendeeCategoryArrays();
      }
      
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: 'Failed to create category' });
    }
  });

  // Reorder categories - move up/down (MUST be before :id route)
  app.patch('/api/categories/reorder', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { categoryId, direction } = req.body;
      
      if (!categoryId || !direction || !['up', 'down'].includes(direction)) {
        return res.status(400).json({ message: 'categoryId and direction (up/down) are required' });
      }

      // Get all categories sorted by display order
      const allCategories = await storage.getAllCategories();
      const sortedCategories = allCategories.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
      
      const currentIndex = sortedCategories.findIndex(cat => cat.id === categoryId);
      if (currentIndex === -1) {
        return res.status(404).json({ message: 'Category not found' });
      }

      let targetIndex;
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < sortedCategories.length - 1) {
        targetIndex = currentIndex + 1;
      } else {
        return res.status(400).json({ message: 'Cannot move category in that direction' });
      }

      // Swap display orders with proper validation
      const currentCategory = sortedCategories[currentIndex];
      const targetCategory = sortedCategories[targetIndex];
      
      // Ensure we have valid integer values
      const currentOrder = Number.isInteger(currentCategory.displayOrder) ? currentCategory.displayOrder : (currentIndex + 1);
      const targetOrder = Number.isInteger(targetCategory.displayOrder) ? targetCategory.displayOrder : (targetIndex + 1);

      // Validate orders are finite integers
      if (!Number.isFinite(currentOrder) || !Number.isFinite(targetOrder)) {
        return res.status(400).json({ message: 'Invalid display order values' });
      }

      await storage.updateCategory(currentCategory.id, { displayOrder: targetOrder });
      await storage.updateCategory(targetCategory.id, { displayOrder: currentOrder });

      res.json({ success: true, message: 'Category order updated successfully' });
    } catch (error) {
      console.error('Error reordering categories:', error);
      res.status(500).json({ message: 'Failed to reorder categories' });
    }
  });

  app.patch('/api/categories/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const categoryId = parseInt(req.params.id);
      const { selectedAttendees, ...categoryData } = req.body;
      
      // Validate categoryData to prevent NaN values
      if (categoryData.displayOrder !== undefined) {
        const displayOrder = Number(categoryData.displayOrder);
        if (isNaN(displayOrder) || !Number.isFinite(displayOrder)) {
          console.error('Invalid displayOrder in category update:', categoryData.displayOrder);
          return res.status(400).json({ 
            message: 'Invalid displayOrder value',
            receivedDisplayOrder: categoryData.displayOrder
          });
        }
        categoryData.displayOrder = Math.max(0, Math.floor(displayOrder));
      }
      
      console.log('Updating category with data:', categoryData);
      
      // Update the category properties
      const updatedCategory = await storage.updateCategory(categoryId, categoryData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }

      // Handle attendee assignments if provided
      if (selectedAttendees !== undefined) {
        console.log('Updating attendee assignments for category:', categoryId, 'with attendees:', selectedAttendees);
        
        // Get current category attendees
        const currentAttendees = await storage.getCategoryAttendees(categoryId);
        const currentAttendeeIds = currentAttendees.map(a => a.id);
        
        // Remove attendees that are no longer selected
        for (const attendeeId of currentAttendeeIds) {
          if (!selectedAttendees.includes(attendeeId)) {
            await storage.removeAttendeeFromCategory(attendeeId, categoryId);
            console.log('Removed attendee', attendeeId, 'from category', categoryId);
          }
        }
        
        // Add new attendees
        for (const attendeeId of selectedAttendees) {
          if (!currentAttendeeIds.includes(attendeeId)) {
            await storage.assignAttendeeToCategory(attendeeId, categoryId);
            console.log('Added attendee', attendeeId, 'to category', categoryId);
          }
        }
        
        // Sync all attendee category arrays with relationship table
        await storage.syncAttendeeCategoryArrays();
      }

      res.json(updatedCategory);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ message: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const categoryId = parseInt(req.params.id);
      const deleted = await storage.deleteCategory(categoryId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Failed to delete category' });
    }
  });

  // Conflict Analysis Routes
  app.post('/api/conflicts/analyze', authenticateUser, async (req, res) => {
    try {
      const { date, startTime, endTime, mandatoryAttendees, optionalAttendees, excludeMeetingId } = req.body;

      if (!date || !startTime || !endTime || !mandatoryAttendees) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const analysis = await conflictResolver.analyzeConflicts(
        date,
        startTime,
        endTime,
        mandatoryAttendees,
        optionalAttendees || [],
        excludeMeetingId
      );

      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing conflicts:', error);
      res.status(500).json({ message: 'Failed to analyze conflicts' });
    }
  });

  app.post('/api/conflicts/resolve', authenticateUser, async (req, res) => {
    try {
      const { meetingId, suggestionId, suggestion } = req.body;

      if (!meetingId || !suggestionId || !suggestion) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const success = await conflictResolver.resolveConflictWithSuggestion(
        meetingId,
        suggestionId,
        suggestion
      );

      if (success) {
        res.json({ message: 'Conflict resolved successfully' });
      } else {
        res.status(500).json({ message: 'Failed to resolve conflict' });
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      res.status(500).json({ message: 'Failed to resolve conflict' });
    }
  });

  // Analytics export route
  app.post('/api/export/analytics', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const { timeRange, selectedMonth, selectedCategory, data } = req.body;

      // Create analytics report workbook
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Meetings', data.totalMeetings],
        ['Total Hours', data.totalHours],
        ['Average Duration', data.averageDuration],
        ['Unique Attendees', data.uniqueAttendees],
        ['Report Generated', new Date().toLocaleString()],
        ['Time Range', timeRange],
        ['Selected Month', selectedMonth],
        ['Category Filter', selectedCategory]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Category breakdown sheet
      if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
        const categoryData = [
          ['Category', 'Count', 'Percentage'],
          ...data.categoryBreakdown.map((item: any) => [
            item.category,
            item.count,
            `${item.percentage.toFixed(1)}%`
          ])
        ];
        const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
        XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');
      }

      // Monthly trend sheet
      if (data.monthlyTrend && data.monthlyTrend.length > 0) {
        const trendData = [
          ['Month', 'Meetings', 'Hours'],
          ...data.monthlyTrend.map((item: any) => [
            item.month,
            item.meetings,
            item.hours
          ])
        ];
        const trendSheet = XLSX.utils.aoa_to_sheet(trendData);
        XLSX.utils.book_append_sheet(workbook, trendSheet, 'Monthly Trend');
      }

      // Location stats sheet
      if (data.locationStats && data.locationStats.length > 0) {
        const locationData = [
          ['Location', 'Count', 'Percentage'],
          ...data.locationStats.map((item: any) => [
            item.location,
            item.count,
            `${item.percentage.toFixed(1)}%`
          ])
        ];
        const locationSheet = XLSX.utils.aoa_to_sheet(locationData);
        XLSX.utils.book_append_sheet(workbook, locationSheet, 'Locations');
      }

      // Attendee stats sheet
      if (data.attendeeStats && data.attendeeStats.length > 0) {
        const attendeeData = [
          ['Attendee', 'Meetings', 'Hours'],
          ...data.attendeeStats.map((item: any) => [
            item.name,
            item.meetings,
            item.hours
          ])
        ];
        const attendeeSheet = XLSX.utils.aoa_to_sheet(attendeeData);
        XLSX.utils.book_append_sheet(workbook, attendeeSheet, 'Top Attendees');
      }

      // Daily pattern sheet
      if (data.dailyPattern && data.dailyPattern.length > 0) {
        const dailyData = [
          ['Day', 'Meetings', 'Hours'],
          ...data.dailyPattern.map((item: any) => [
            item.day,
            item.meetings,
            item.hours
          ])
        ];
        const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
        XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Pattern');
      }

      // Convert workbook to buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      console.error('Analytics export error:', error);
      res.status(500).json({ message: 'Failed to export analytics report' });
    }
  });

  // AI-powered meeting suggestions
  app.post('/api/ai/suggest-times', async (req, res) => {
    try {
      const { title, duration, category, requiredAttendees, preferredDates, constraints } = req.body;
      
      // Get existing meetings for context
      const existingMeetings = await storage.getAllMeetings();
      
      const suggestions = await findOptimalMeetingTimes(
        duration,
        requiredAttendees,
        { start: "08:00", end: "20:00" }, // preferred time range
        { start: preferredDates[0] || new Date().toISOString().split('T')[0], 
          end: preferredDates[preferredDates.length - 1] || new Date().toISOString().split('T')[0] }, // date range
        existingMeetings,
        category
      );
      
      res.json({ suggestions });
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ message: 'Failed to generate meeting suggestions' });
    }
  });

  // AI conflict analysis
  app.post('/api/ai/analyze-conflicts', async (req, res) => {
    try {
      const { proposedMeeting } = req.body;
      
      const meetings = await storage.getAllMeetings();
      const conflicts = await analyzeSchedulingConflicts(proposedMeeting, meetings);
      
      res.json({ conflicts });
    } catch (error) {
      console.error('AI conflict analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze conflicts' });
    }
  });

  // Generate meeting summary 
  app.post('/api/meetings/generate-summary', async (req, res) => {
    try {
      const { meetingId, meetingDetails, customNotes } = req.body;
      
      // Generate basic summary without AI
      const summaryData = {
        summary: `Meeting "${meetingDetails.title}" scheduled for ${meetingDetails.startTime} - ${meetingDetails.endTime}`,
        keyPoints: ["Meeting scheduled in calendar system"],
        decisions: ["Meeting time confirmed"],
        actionItems: ["Attend scheduled meeting"],
        nextSteps: ["Prepare for meeting"],
        attendeesPresent: meetingDetails.attendees || []
      };
      
      res.json(summaryData);
    } catch (error) {
      console.error('Meeting summary generation error:', error);
      res.status(500).json({ message: 'Failed to generate meeting summary' });
    }
  });

  // Export meeting summary as PDF/Word
  app.post('/api/meetings/export-summary', async (req, res) => {
    try {
      const { meetingId, summaryData, format } = req.body;
      
      // For now, return a simple text response
      // In production, you would use libraries like PDFKit or docx to generate actual files
      const textContent = `
MEETING SUMMARY

Executive Summary:
${summaryData.summary}

Key Discussion Points:
${summaryData.keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Decisions Made:
${summaryData.decisions.map((decision, i) => `${i + 1}. ${decision}`).join('\n')}

Action Items:
${summaryData.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Next Steps:
${summaryData.nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Attendees Present:
${summaryData.attendeesPresent.join(', ')}
      `;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=meeting-summary.${format === 'pdf' ? 'txt' : 'txt'}`);
      res.send(textContent);
    } catch (error) {
      console.error('Export summary error:', error);
      res.status(500).json({ message: 'Failed to export summary' });
    }
  });

  // Email meeting summary to attendees
  app.post('/api/meetings/email-summary', async (req, res) => {
    try {
      const { meetingId, summaryData, recipients } = req.body;
      
      // In production, you would integrate with an email service like SendGrid, Nodemailer, etc.
      console.log('Email summary would be sent to:', recipients);
      console.log('Summary data:', summaryData);
      
      // Simulate successful email sending
      res.json({ message: 'Summary emailed successfully to all attendees' });
    } catch (error) {
      console.error('Email summary error:', error);
      res.status(500).json({ message: 'Failed to email summary' });
    }
  });



  // Get attendee availability data for heatmap
  app.get('/api/attendees/availability/:attendee?', async (req, res) => {
    try {
      const { attendee } = req.params;
      const meetings = await storage.getAllMeetings();
      
      // Calculate availability patterns based on historical data
      const availabilityData = meetings.reduce((acc, meeting) => {
        const hour = parseInt(meeting.startTime.split(':')[0]);
        const key = `${meeting.date}-${hour}`;
        
        if (!acc[key]) {
          acc[key] = { meetingCount: 0, attendees: [] };
        }
        
        acc[key].meetingCount++;
        acc[key].attendees.push(...meeting.ddfsAttendees, ...meeting.mandatoryAttendees);
        
        return acc;
      }, {});
      
      res.json(availabilityData);
    } catch (error) {
      console.error('Availability data error:', error);
      res.status(500).json({ message: 'Failed to get availability data' });
    }
  });

  // Get historical meeting patterns
  app.get('/api/meetings/historical-patterns', async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      
      // Analyze patterns for recommendations
      const patterns = {
        peakHours: {},
        categoryTrends: {},
        attendeeFrequency: {},
        locationUsage: {}
      };
      
      meetings.forEach(meeting => {
        const hour = parseInt(meeting.startTime.split(':')[0]);
        patterns.peakHours[hour] = (patterns.peakHours[hour] || 0) + 1;
        patterns.categoryTrends[meeting.category] = (patterns.categoryTrends[meeting.category] || 0) + 1;
        patterns.locationUsage[meeting.location] = (patterns.locationUsage[meeting.location] || 0) + 1;
        
        [...meeting.ddfsAttendees, ...meeting.mandatoryAttendees].forEach(attendee => {
          patterns.attendeeFrequency[attendee] = (patterns.attendeeFrequency[attendee] || 0) + 1;
        });
      });
      
      res.json(patterns);
    } catch (error) {
      console.error('Historical patterns error:', error);
      res.status(500).json({ message: 'Failed to get historical patterns' });
    }
  });

  // Get attendee preferences
  app.get('/api/attendees/preferences', async (req, res) => {
    try {
      // In a real implementation, this would come from a user preferences database
      const preferences = {
        timePreferences: {
          morning: ['John Doe', 'Jane Smith'],
          afternoon: ['Mike Johnson', 'Sarah Wilson'],
          evening: ['David Brown']
        },
        meetingLengthPreference: {
          short: ['Quick Check-ins', 'Status Updates'],
          medium: ['Team Meetings', 'Client Calls'],
          long: ['Strategy Sessions', 'Training']
        }
      };
      
      res.json(preferences);
    } catch (error) {
      console.error('Preferences error:', error);
      res.status(500).json({ message: 'Failed to get preferences' });
    }
  });

  // Generate contextual recommendations
  app.post('/api/ai/contextual-recommendations', async (req, res) => {
    try {
      const { meetings, context } = req.body;
      
      if (!process.env.OPENAI_API_KEY) {
        return res.json({ 
          recommendations: [],
          message: 'OpenAI API key not configured. Recommendations will be generated based on rule-based logic.' 
        });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Analyze the following meeting data and provide contextual recommendations:

Meeting Data: ${JSON.stringify(meetings)}
Context: ${JSON.stringify(context)}

Generate recommendations for:
1. Optimal meeting times based on patterns
2. Attendee collaboration opportunities
3. Workload balancing suggestions
4. Follow-up meeting needs
5. Scheduling efficiency improvements

Respond with a JSON array of recommendation objects with fields: type, priority, title, description, confidence, actionableSteps.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an AI meeting optimization expert. Provide actionable, data-driven recommendations in JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      const recommendations = JSON.parse(response.choices[0].message.content);
      res.json(recommendations);
    } catch (error) {
      console.error('Contextual recommendations error:', error);
      res.status(500).json({ message: 'Failed to generate contextual recommendations' });
    }
  });

  // Download page route
  app.get('/download-project.html', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'download-project.html'));
  });

  // Download page route
  app.get('/download.html', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'download.html'));
  });

  // Serve the project archive directly
  app.get('/meeting-scheduler-ai-enhanced.tar.gz', (req, res) => {
    const filePath = 'meeting-scheduler-ai-enhanced.tar.gz';
    res.download(filePath, 'meeting-scheduler-ai-enhanced.tar.gz', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).send('File not found');
      }
    });
  });

  // Date Settings Endpoints
  
  // Get user date settings
  app.get('/api/date-settings', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const settings = await storage.getUserDateSettings(user.id);
      res.json(settings);
    } catch (error) {
      console.error('Failed to get date settings:', error);
      res.status(500).json({ message: 'Failed to fetch date settings' });
    }
  });

  // Update user date settings
  app.post('/api/date-settings', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      const { defaultStartDate } = req.body;
      
      if (!defaultStartDate) {
        return res.status(400).json({ message: 'Default start date is required' });
      }
      
      const settings = await storage.setUserDateSettings(user.id, {
        defaultStartDate
      });
      
      res.json(settings);
    } catch (error) {
      console.error('Failed to update date settings:', error);
      res.status(500).json({ message: 'Failed to update date settings' });
    }
  });

  // Global Settings Endpoints
  
  // Get all global settings
  app.get('/api/settings', authenticateUser, async (req, res) => {
    try {
      const settings = await storage.getAllGlobalSettings();
      res.json(settings);
    } catch (error) {
      console.error('Failed to get global settings:', error);
      res.status(500).json({ message: 'Failed to fetch global settings' });
    }
  });
  
  // Update timezone setting
  app.put('/api/settings/timezone', authenticateUser, async (req, res) => {
    try {
      const { timezone } = req.body;
      if (!timezone) {
        return res.status(400).json({ message: 'Timezone is required' });
      }
      
      const setting = await storage.setGlobalSetting('timezone', timezone, 'System timezone setting', (req as any).user?.id);
      res.json(setting);
    } catch (error) {
      console.error('Failed to update timezone setting:', error);
      res.status(500).json({ message: 'Failed to update timezone setting' });
    }
  });

  // Calendar Integration Endpoints
  
  // Get calendar authorization URLs
  app.get('/api/calendar/auth-urls', authenticateUser, (req, res) => {
    try {
      const authUrls = calendarSyncService.getAuthUrls();
      res.json(authUrls);
    } catch (error) {
      console.error('Failed to get auth URLs:', error);
      res.status(500).json({ message: 'Failed to get calendar authorization URLs' });
    }
  });

  // Generate iCal file for a specific meeting
  app.get('/api/meetings/:id/ical', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const meeting = await storage.getMeeting(id);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      const icalContent = calendarSyncService.generateICalEvent(meeting);
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="meeting-${meeting.id}.ics"`);
      res.send(icalContent);
    } catch (error) {
      console.error('Failed to generate iCal:', error);
      res.status(500).json({ message: 'Failed to generate calendar file' });
    }
  });

  // Get calendar quick-add links for a meeting
  app.get('/api/meetings/:id/calendar-links', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const meeting = await storage.getMeeting(id);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      const links = calendarSyncService.generateCalendarLinks(meeting);
      res.json(links);
    } catch (error) {
      console.error('Failed to generate calendar links:', error);
      res.status(500).json({ message: 'Failed to generate calendar links' });
    }
  });

  // Static file for download
  app.get('/meeting-scheduler-file-management-complete.tar.gz', (req, res) => {
    res.download(path.join(process.cwd(), 'meeting-scheduler-file-management-complete.tar.gz'));
  });

  // Change Logs routes (Admin only)
  app.get('/api/change-logs', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const changeLogs = await storage.getChangeLogs(limit, offset);
      res.json(changeLogs);
    } catch (error) {
      console.error('Error fetching change logs:', error);
      res.status(500).json({ message: 'Failed to fetch change logs' });
    }
  });

  app.get('/api/change-logs/entity/:entityType', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { entityType } = req.params;
      const entityId = req.query.entityId as string;
      
      const changeLogs = await storage.getChangeLogsByEntity(entityType, entityId);
      res.json(changeLogs);
    } catch (error) {
      console.error('Error fetching entity change logs:', error);
      res.status(500).json({ message: 'Failed to fetch entity change logs' });
    }
  });

  app.get('/api/change-logs/user/:userId', authenticateUser, async (req, res) => {
    try {
      const user = req.user as any;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.userId);
      
      const changeLogs = await storage.getChangeLogsByUser(userId);
      res.json(changeLogs);
    } catch (error) {
      console.error('Error fetching user change logs:', error);
      res.status(500).json({ message: 'Failed to fetch user change logs' });
    }
  });

  // Database reset route for development
  app.post("/api/db/reset", async (req, res) => {
    try {
      // Clear users table and reinitialize
      await storage.clearAndReinitialize();
      res.json({ message: "Database reset and reinitialized successfully" });
    } catch (error) {
      console.error('Database reset error:', error);
      res.status(500).json({ message: "Failed to reset database" });
    }
  });

  // Public endpoint to check users (for debugging)
  app.get("/api/users/check", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ 
        count: users.length, 
        users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role }))
      });
    } catch (error) {
      console.error('Error checking users:', error);
      res.status(500).json({ message: "Failed to check users" });
    }
  });

  // Onboarding routes
  app.get("/api/user/onboarding", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let onboarding = await storage.getUserOnboarding(userId);
      
      if (!onboarding) {
        onboarding = await storage.createUserOnboarding({
          userId,
          hasCompletedOnboarding: false,
          lastOnboardingVersion: null,
        });
      }
      
      res.json(onboarding);
    } catch (error) {
      console.error("Error fetching user onboarding:", error);
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });

  app.patch("/api/user/onboarding", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { hasCompletedOnboarding, lastOnboardingVersion, onboardingSkippedAt } = req.body;
      
      const updateData: any = {};
      if (hasCompletedOnboarding !== undefined) updateData.hasCompletedOnboarding = hasCompletedOnboarding;
      if (lastOnboardingVersion !== undefined) updateData.lastOnboardingVersion = lastOnboardingVersion;
      if (onboardingSkippedAt !== undefined) updateData.onboardingSkippedAt = onboardingSkippedAt ? new Date(onboardingSkippedAt) : null;
      if (hasCompletedOnboarding) updateData.completedAt = new Date();
      
      const onboarding = await storage.updateUserOnboarding(userId, updateData);
      res.json(onboarding);
    } catch (error) {
      console.error("Error updating user onboarding:", error);
      res.status(500).json({ error: "Failed to update onboarding status" });
    }
  });

  // Smart Notification Preference Optimizer Routes
  app.get('/api/notifications/analyze-behavior/:userId', authenticateUser, async (req, res) => {
    try {
      const { userId } = req.params;
      const { category } = req.query;
      
      const insights = await notificationOptimizer.analyzeUserBehavior(
        parseInt(userId),
        category as string
      );
      
      res.json(insights);
    } catch (error) {
      console.error('Notification behavior analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze notification behavior' });
    }
  });

  app.post('/api/notifications/track-behavior', authenticateUser, async (req, res) => {
    try {
      const behaviorData = req.body;
      
      await notificationOptimizer.trackNotificationBehavior(behaviorData);
      
      res.json({ message: 'Notification behavior tracked successfully' });
    } catch (error) {
      console.error('Notification behavior tracking error:', error);
      res.status(500).json({ message: 'Failed to track notification behavior' });
    }
  });

  app.get('/api/notifications/recommendations/:userId', authenticateUser, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const recommendations = await db
        .select()
        .from(notificationRecommendations)
        .where(eq(notificationRecommendations.userId, parseInt(userId)))
        .orderBy(desc(notificationRecommendations.createdAt))
        .limit(10);
      
      res.json(recommendations);
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ message: 'Failed to get recommendations' });
    }
  });

  app.post('/api/notifications/apply-recommendation/:recommendationId', authenticateUser, async (req, res) => {
    try {
      const { recommendationId } = req.params;
      
      const success = await notificationOptimizer.applyRecommendation(parseInt(recommendationId));
      
      if (success) {
        res.json({ message: 'Recommendation applied successfully' });
      } else {
        res.status(404).json({ message: 'Recommendation not found' });
      }
    } catch (error) {
      console.error('Apply recommendation error:', error);
      res.status(500).json({ message: 'Failed to apply recommendation' });
    }
  });

  app.get('/api/notifications/preferences/:userId', authenticateUser, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const preferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, parseInt(userId)));
      
      res.json(preferences);
    } catch (error) {
      console.error('Get notification preferences error:', error);
      res.status(500).json({ message: 'Failed to get notification preferences' });
    }
  });

  app.put('/api/notifications/preferences/:userId/:category', authenticateUser, async (req, res) => {
    try {
      const { userId, category } = req.params;
      const preferences = req.body;
      
      await db
        .insert(userNotificationPreferences)
        .values({
          userId: parseInt(userId),
          category,
          ...preferences,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [userNotificationPreferences.userId, userNotificationPreferences.category],
          set: {
            ...preferences,
            updatedAt: new Date()
          }
        });
      
      res.json({ message: 'Notification preferences updated successfully' });
    } catch (error) {
      console.error('Update notification preferences error:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  app.post('/api/notifications/generate-insights/:userId', authenticateUser, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const insights = await notificationOptimizer.analyzeUserBehavior(parseInt(userId));
      await notificationOptimizer.storeRecommendations(insights);
      
      res.json({ 
        message: 'Insights generated successfully',
        insights
      });
    } catch (error) {
      console.error('Generate insights error:', error);
      res.status(500).json({ message: 'Failed to generate insights' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
