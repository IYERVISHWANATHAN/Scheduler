import sgMail from '@sendgrid/mail';
import type { Meeting } from '@shared/schema';

// Email service for meeting notifications
export class EmailService {
  private isConfigured = false;

  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.isConfigured = true;
    }
  }

  private formatMeetingTime(meeting: Meeting): string {
    const date = new Date(meeting.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return `${date} from ${meeting.startTime} to ${meeting.endTime}`;
  }

  private getAttendeeEmails(meeting: Meeting): string[] {
    // In a real implementation, you would map attendee names to email addresses
    // from your user database. For now, we'll use placeholder logic.
    const allAttendees = [
      ...meeting.ddfsAttendees,
      ...meeting.mandatoryAttendees,
      ...meeting.brandAttendees
    ];
    
    // This would be replaced with actual email lookup from user database
    return allAttendees.map(attendee => `${attendee.toLowerCase().replace(/\s+/g, '.')}@company.com`);
  }

  async sendMeetingInvite(meeting: Meeting, organizerEmail: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured - SENDGRID_API_KEY missing');
      return false;
    }

    try {
      const attendeeEmails = this.getAttendeeEmails(meeting);
      const timeString = this.formatMeetingTime(meeting);

      const emailContent = {
        to: attendeeEmails,
        from: organizerEmail,
        subject: `Meeting Invitation: ${meeting.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Meeting Invitation</h2>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">${meeting.title}</h3>
              <p><strong>Date & Time:</strong> ${timeString}</p>
              <p><strong>Location:</strong> ${meeting.location}</p>
              <p><strong>Category:</strong> ${meeting.category}</p>
              <p><strong>Organized by:</strong> ${meeting.schedulerName}</p>
            </div>

            <div style="margin: 20px 0;">
              <h4>Attendees:</h4>
              <ul>
                ${meeting.ddfsAttendees.map(attendee => `<li><strong>DDFS:</strong> ${attendee}</li>`).join('')}
                ${meeting.mandatoryAttendees.map(attendee => `<li><strong>Mandatory:</strong> ${attendee}</li>`).join('')}
                ${meeting.brandAttendees.map(attendee => `<li><strong>Brand:</strong> ${attendee}</li>`).join('')}
              </ul>
            </div>

            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
              <p style="margin: 0;"><strong>Note:</strong> Please confirm your attendance by replying to this email.</p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
              <p>This meeting was scheduled through Meeting Scheduler Pro</p>
            </div>
          </div>
        `
      };

      await sgMail.sendMultiple(emailContent);
      console.log(`Meeting invite sent for: ${meeting.title}`);
      return true;
    } catch (error) {
      console.error('Failed to send meeting invite:', error);
      return false;
    }
  }

  async sendMeetingReminder(meeting: Meeting, organizerEmail: string, reminderType: 'day' | 'hour'): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured - SENDGRID_API_KEY missing');
      return false;
    }

    try {
      const attendeeEmails = this.getAttendeeEmails(meeting);
      const timeString = this.formatMeetingTime(meeting);
      const reminderText = reminderType === 'day' ? 'tomorrow' : 'in 1 hour';

      const emailContent = {
        to: attendeeEmails,
        from: organizerEmail,
        subject: `Reminder: ${meeting.title} - ${reminderText}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Meeting Reminder</h2>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3 style="margin-top: 0; color: #1f2937;">Your meeting "${meeting.title}" is ${reminderText}</h3>
              <p><strong>Date & Time:</strong> ${timeString}</p>
              <p><strong>Location:</strong> ${meeting.location}</p>
            </div>

            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
              <p style="margin: 0;"><strong>Preparation:</strong> Please review any relevant materials and arrive 5 minutes early.</p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Meeting Scheduler Pro - Automated Reminder</p>
            </div>
          </div>
        `
      };

      await sgMail.sendMultiple(emailContent);
      console.log(`Meeting reminder sent for: ${meeting.title} (${reminderType})`);
      return true;
    } catch (error) {
      console.error('Failed to send meeting reminder:', error);
      return false;
    }
  }

  async sendMeetingUpdate(meeting: Meeting, organizerEmail: string, changeType: 'modified' | 'cancelled'): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured - SENDGRID_API_KEY missing');
      return false;
    }

    try {
      const attendeeEmails = this.getAttendeeEmails(meeting);
      const timeString = this.formatMeetingTime(meeting);
      const isCancel = changeType === 'cancelled';

      const emailContent = {
        to: attendeeEmails,
        from: organizerEmail,
        subject: `${isCancel ? 'CANCELLED' : 'UPDATED'}: ${meeting.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${isCancel ? '#dc2626' : '#d97706'};">Meeting ${isCancel ? 'Cancelled' : 'Updated'}</h2>
            
            <div style="background-color: ${isCancel ? '#fef2f2' : '#fffbeb'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isCancel ? '#dc2626' : '#d97706'};">
              <h3 style="margin-top: 0; color: #1f2937;">${meeting.title}</h3>
              ${isCancel ? 
                '<p style="color: #dc2626; font-weight: bold;">This meeting has been cancelled.</p>' :
                `<p><strong>Updated Details:</strong></p>
                 <p><strong>Date & Time:</strong> ${timeString}</p>
                 <p><strong>Location:</strong> ${meeting.location}</p>`
              }
            </div>

            ${!isCancel ? `
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
              <p style="margin: 0;"><strong>Note:</strong> Please update your calendar with the new meeting details.</p>
            </div>
            ` : ''}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Meeting Scheduler Pro - ${isCancel ? 'Cancellation' : 'Update'} Notification</p>
            </div>
          </div>
        `
      };

      await sgMail.sendMultiple(emailContent);
      console.log(`Meeting ${changeType} notification sent for: ${meeting.title}`);
      return true;
    } catch (error) {
      console.error(`Failed to send meeting ${changeType} notification:`, error);
      return false;
    }
  }

  // Schedule automatic reminders
  scheduleReminders(meeting: Meeting, organizerEmail: string): void {
    const meetingDateTime = new Date(`${meeting.date} ${meeting.startTime}`);
    const now = new Date();

    // Schedule 24-hour reminder
    const dayBefore = new Date(meetingDateTime.getTime() - 24 * 60 * 60 * 1000);
    if (dayBefore > now) {
      const delay = dayBefore.getTime() - now.getTime();
      setTimeout(() => {
        this.sendMeetingReminder(meeting, organizerEmail, 'day');
      }, delay);
    }

    // Schedule 1-hour reminder
    const hourBefore = new Date(meetingDateTime.getTime() - 60 * 60 * 1000);
    if (hourBefore > now) {
      const delay = hourBefore.getTime() - now.getTime();
      setTimeout(() => {
        this.sendMeetingReminder(meeting, organizerEmail, 'hour');
      }, delay);
    }
  }
}

export const emailService = new EmailService();