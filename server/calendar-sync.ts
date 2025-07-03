import { google } from 'googleapis';
import type { Meeting } from '@shared/schema';

// Calendar synchronization service for Google Calendar, Outlook, and Apple Calendar
export class CalendarSyncService {
  private googleAuth: any = null;

  constructor() {
    this.initializeGoogleAuth();
  }

  private initializeGoogleAuth() {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.googleAuth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
      );
    }
  }

  // Google Calendar Integration
  async syncToGoogleCalendar(meeting: Meeting, userAccessToken: string): Promise<boolean> {
    if (!this.googleAuth) {
      console.warn('Google Calendar integration not configured');
      return false;
    }

    try {
      this.googleAuth.setCredentials({ access_token: userAccessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });

      const event = {
        summary: meeting.title,
        location: meeting.location,
        description: `Organized by: ${meeting.schedulerName}\nCategory: ${meeting.category}\n\nAttendees:\nDDFS: ${meeting.ddfsAttendees.join(', ')}\nMandatory: ${meeting.mandatoryAttendees.join(', ')}\nBrand: ${meeting.brandAttendees.join(', ')}`,
        start: {
          dateTime: `${meeting.date}T${meeting.startTime}:00`,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: `${meeting.date}T${meeting.endTime}:00`,
          timeZone: 'America/New_York',
        },
        attendees: this.getEmailsFromAttendees(meeting),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 60 }, // 1 hour before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      console.log(`Meeting synced to Google Calendar: ${response.data.id}`);
      return true;
    } catch (error) {
      console.error('Failed to sync to Google Calendar:', error);
      return false;
    }
  }

  // Generate iCal format for cross-platform compatibility
  generateICalEvent(meeting: Meeting): string {
    const now = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const startDateTime = `${meeting.date.replace(/-/g, '')}T${meeting.startTime.replace(':', '')}00`;
    const endDateTime = `${meeting.date.replace(/-/g, '')}T${meeting.endTime.replace(':', '')}00`;
    
    const attendeeList = [
      ...meeting.ddfsAttendees.map(name => `DDFS: ${name}`),
      ...meeting.mandatoryAttendees.map(name => `Mandatory: ${name}`),
      ...meeting.brandAttendees.map(name => `Brand: ${name}`)
    ].join('\\n');

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Meeting Scheduler Pro//EN
BEGIN:VEVENT
UID:meeting-${meeting.id}-${now}@meetingscheduler.com
DTSTAMP:${now}
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:${meeting.title}
DESCRIPTION:Organized by: ${meeting.schedulerName}\\nCategory: ${meeting.category}\\n\\nAttendees:\\n${attendeeList}
LOCATION:${meeting.location}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:EMAIL
DESCRIPTION:Meeting reminder: ${meeting.title}
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Meeting starting in 1 hour: ${meeting.title}
END:VALARM
END:VEVENT
END:VCALENDAR`;
  }

  // Microsoft Outlook integration using Graph API
  async syncToOutlook(meeting: Meeting, userAccessToken: string): Promise<boolean> {
    try {
      const event = {
        subject: meeting.title,
        body: {
          contentType: 'HTML',
          content: `
            <p><strong>Organized by:</strong> ${meeting.schedulerName}</p>
            <p><strong>Category:</strong> ${meeting.category}</p>
            <p><strong>Location:</strong> ${meeting.location}</p>
            <br>
            <p><strong>Attendees:</strong></p>
            <ul>
              <li><strong>DDFS:</strong> ${meeting.ddfsAttendees.join(', ')}</li>
              <li><strong>Mandatory:</strong> ${meeting.mandatoryAttendees.join(', ')}</li>
              <li><strong>Brand:</strong> ${meeting.brandAttendees.join(', ')}</li>
            </ul>
          `
        },
        start: {
          dateTime: `${meeting.date}T${meeting.startTime}:00.000Z`,
          timeZone: 'UTC'
        },
        end: {
          dateTime: `${meeting.date}T${meeting.endTime}:00.000Z`,
          timeZone: 'UTC'
        },
        location: {
          displayName: meeting.location
        },
        attendees: this.getEmailsFromAttendees(meeting).map(email => ({
          emailAddress: {
            address: email.email,
            name: email.name
          }
        })),
        reminderMinutesBeforeStart: 60
      };

      const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Meeting synced to Outlook: ${result.id}`);
        return true;
      } else {
        console.error('Failed to sync to Outlook:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Outlook sync error:', error);
      return false;
    }
  }

  // Generate calendar links for easy addition
  generateCalendarLinks(meeting: Meeting) {
    const startDate = meeting.date.replace(/-/g, '');
    const startTime = meeting.startTime.replace(':', '');
    const endTime = meeting.endTime.replace(':', '');
    const title = encodeURIComponent(meeting.title);
    const location = encodeURIComponent(meeting.location);
    const details = encodeURIComponent(`Organized by: ${meeting.schedulerName}\nCategory: ${meeting.category}`);

    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}T${startTime}00/${startDate}T${endTime}00&details=${details}&location=${location}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${meeting.date}T${meeting.startTime}&enddt=${meeting.date}T${meeting.endTime}&body=${details}&location=${location}`,
      yahoo: `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${startDate}T${startTime}00&dur=0200&desc=${details}&in_loc=${location}`,
      ics: `/api/meetings/${meeting.id}/ical` // Our own iCal endpoint
    };
  }

  private getEmailsFromAttendees(meeting: Meeting) {
    // In a real implementation, map attendee names to email addresses from user database
    const allAttendees = [
      ...meeting.ddfsAttendees,
      ...meeting.mandatoryAttendees,
      ...meeting.brandAttendees
    ];
    
    return allAttendees.map(name => ({
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
      name: name
    }));
  }

  // Sync meeting updates across all connected calendars
  async syncMeetingUpdate(meeting: Meeting, userTokens: { google?: string, outlook?: string }): Promise<void> {
    const promises = [];

    if (userTokens.google) {
      promises.push(this.syncToGoogleCalendar(meeting, userTokens.google));
    }

    if (userTokens.outlook) {
      promises.push(this.syncToOutlook(meeting, userTokens.outlook));
    }

    await Promise.all(promises);
  }

  // Get authorization URLs for calendar connections
  getAuthUrls() {
    const googleAuthUrl = this.googleAuth?.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar']
    });

    const outlookAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/auth/microsoft/callback')}&scope=${encodeURIComponent('https://graph.microsoft.com/calendars.readwrite')}`;

    return {
      google: googleAuthUrl,
      outlook: outlookAuthUrl
    };
  }
}

export const calendarSyncService = new CalendarSyncService();