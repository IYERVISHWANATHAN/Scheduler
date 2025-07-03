import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import type { Meeting } from '@shared/schema';
import { getCategoryColor } from './utils';

export interface PrintOptions {
  type: 'week' | 'day' | 'meeting-list';
  date: Date;
  meetings: Meeting[];
  title?: string;
}

export function generatePrintContent(options: PrintOptions): string {
  const { type, date, meetings, title } = options;
  
  const styles = `
    <style>
      @media print {
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          color: #000;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .print-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .week-view {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
          margin-top: 20px;
        }
        .day-column {
          border: 1px solid #ddd;
          padding: 10px;
          min-height: 400px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .day-header {
          font-weight: bold;
          text-align: center;
          padding: 8px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #ddd;
          margin-bottom: 10px;
        }
        .meeting-item {
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 8px;
          font-size: 12px;
          page-break-inside: avoid;
          break-inside: avoid;
          border-left: 12px solid;
        }
        .meeting-item.liquor {
          background-color: rgba(165, 42, 42, 0.1);
          border-left-color: #A52A2A;
        }
        .meeting-item.tobacco {
          background-color: rgba(210, 105, 30, 0.1);
          border-left-color: #D2691E;
        }
        .meeting-item.confectionary {
          background-color: rgba(255, 215, 0, 0.1);
          border-left-color: #FFD700;
        }
        .meeting-item.pnc {
          background-color: rgba(205, 92, 92, 0.1);
          border-left-color: #CD5C5C;
        }
        .meeting-item.fashion {
          background-color: rgba(60, 179, 113, 0.1);
          border-left-color: #3CB371;
        }
        .meeting-item.destination {
          background-color: rgba(107, 114, 128, 0.1);
          border-left-color: #6B7280;
        }
        .meeting-time {
          font-weight: bold;
          color: #333;
        }
        .meeting-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .meeting-category {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }
        .day-view {
          margin-top: 20px;
        }
        .time-slot {
          display: flex;
          border-bottom: 1px solid #eee;
          min-height: 60px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .time-label {
          width: 80px;
          padding: 10px;
          font-weight: bold;
          border-right: 1px solid #ddd;
          background-color: #f9f9f9;
        }
        .time-content {
          flex: 1;
          padding: 10px;
        }
        .meeting-list {
          margin-top: 20px;
        }
        .meeting-list-item {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background-color: #fafafa;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .meeting-list-item.meeting-item {
          border-left: 12px solid;
        }
        .meeting-list-item.meeting-item.liquor {
          border-left-color: #A52A2A;
        }
        .meeting-list-item.meeting-item.tobacco {
          border-left-color: #D2691E;
        }
        .meeting-list-item.meeting-item.confectionary {
          border-left-color: #FFD700;
        }
        .meeting-list-item.meeting-item.pnc {
          border-left-color: #CD5C5C;
        }
        .meeting-list-item.meeting-item.fashion {
          border-left-color: #3CB371;
        }
        .meeting-list-item.meeting-item.destination {
          border-left-color: #6B7280;
        }
        .meeting-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .meeting-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          font-size: 14px;
        }
        .detail-item {
          display: flex;
        }
        .detail-label {
          font-weight: bold;
          margin-right: 8px;
          min-width: 80px;
        }
        .attendees-list {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
        .attendee-tag {
          display: inline-block;
          background-color: #e3f2fd;
          border: 1px solid #bbdefb;
          border-radius: 12px;
          padding: 4px 8px;
          margin: 2px;
          font-size: 12px;
        }
        .date-group {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 30px;
        }
        .date-group-header {
          background-color: #f0f0f0;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          color: #333;
        }
        .no-meetings {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 40px;
        }
        @page {
          margin: 1cm;
          size: A4;
        }
      }
    </style>
  `;

  let content = '';
  
  if (type === 'week') {
    content = generateWeekView(date, meetings);
  } else if (type === 'day') {
    content = generateDayView(date, meetings);
  } else if (type === 'meeting-list') {
    content = generateMeetingListView(date, meetings);
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title || 'Calendar Print'}</title>
      ${styles}
    </head>
    <body>
      <div class="print-header">
        <div class="print-title">${title || 'DDFS Calendar Schedule'}</div>
      </div>
      ${content}
    </body>
    </html>
  `;
}

function generateWeekView(date: Date, meetings: Meeting[]): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday start to match calendar
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dayColumns = weekDays.map(day => {
    const dayMeetings = meetings.filter(meeting => 
      isSameDay(new Date(meeting.date), day)
    );

    const meetingItems = dayMeetings
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(meeting => `
        <div class="meeting-item ${meeting.category}">
          <div class="meeting-time">${meeting.startTime} - ${meeting.endTime}</div>
          <div class="meeting-title">${meeting.title}</div>
          <div class="meeting-category">${meeting.category}</div>
          ${meeting.location ? `<div style="font-size: 10px; color: #666;">📍 ${meeting.location}</div>` : ''}
        </div>
      `).join('');

    return `
      <div class="day-column">
        <div class="day-header">
          ${format(day, 'EEEE')}
          <br>
          ${format(day, 'MMM dd')}
        </div>
        ${meetingItems || '<div class="no-meetings">No meetings</div>'}
      </div>
    `;
  }).join('');

  return `
    <div>
      <h2 style="text-align: center; margin-bottom: 20px;">
        Week of ${format(weekStart, 'MMMM dd')} - ${format(weekEnd, 'MMMM dd, yyyy')}
      </h2>
      <div class="week-view">
        ${dayColumns}
      </div>
    </div>
  `;
}

function generateDayView(date: Date, meetings: Meeting[]): string {
  const dayMeetings = meetings.filter(meeting => 
    isSameDay(new Date(meeting.date), date)
  ).sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (dayMeetings.length === 0) {
    return `
      <div class="day-view">
        <h2 style="text-align: center; margin-bottom: 20px;">
          ${format(date, 'EEEE, MMMM dd, yyyy')}
        </h2>
        <div class="no-meetings" style="text-align: center; padding: 40px; color: #666;">
          No meetings scheduled
        </div>
      </div>
    `;
  }

  const meetingElements = dayMeetings.map(meeting => `
    <div class="meeting-item ${meeting.category}" style="margin-bottom: 20px; padding: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          <div class="meeting-title" style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${meeting.title}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600;">${meeting.category}</div>
        </div>
        <div style="text-align: right;">
          <div class="meeting-time" style="font-size: 14px; font-weight: bold;">${meeting.startTime} - ${meeting.endTime}</div>
        </div>
      </div>
      ${meeting.location ? `<div style="font-size: 12px; color: #666; margin-bottom: 8px;">📍 ${meeting.location}</div>` : ''}
      ${meeting.schedulerName ? `<div style="font-size: 12px; color: #666;">Scheduler: ${meeting.schedulerName}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="day-view">
      <h2 style="text-align: center; margin-bottom: 20px;">
        ${format(date, 'EEEE, MMMM dd, yyyy')}
      </h2>
      <div style="margin-bottom: 20px; text-align: center; color: #666;">
        ${dayMeetings.length} meeting${dayMeetings.length !== 1 ? 's' : ''} scheduled
      </div>
      ${meetingElements}
    </div>
  `;
}

function generateMeetingListView(date: Date, meetings: Meeting[]): string {
  // Show all meetings - no date filtering
  if (meetings.length === 0) {
    return `
      <div class="meeting-list">
        <h2 style="text-align: center; margin-bottom: 20px;">
          Complete Meeting List - All Scheduled Meetings
        </h2>
        <div class="no-meetings">No meetings scheduled</div>
      </div>
    `;
  }

  const sortedMeetings = meetings.sort((a: Meeting, b: Meeting) => {
    const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateComparison !== 0) return dateComparison;
    return a.startTime.localeCompare(b.startTime);
  });

  // Group meetings by date
  const groupedMeetings: { [date: string]: Meeting[] } = {};
  sortedMeetings.forEach(meeting => {
    const dateKey = meeting.date;
    if (!groupedMeetings[dateKey]) {
      groupedMeetings[dateKey] = [];
    }
    groupedMeetings[dateKey].push(meeting);
  });

  const dateGroups = Object.entries(groupedMeetings).map(([dateStr, dateMeetings]) => {
    const meetingItems = dateMeetings.map((meeting: Meeting) => {
      const attendeesList = [
        ...(meeting.ddfsAttendees || []),
        ...(meeting.mandatoryAttendees || []),
        ...(meeting.brandAttendees || [])
      ].filter(Boolean);

      return `
        <div class="meeting-list-item meeting-item ${meeting.category}">
          <div class="meeting-list-header">
            <div>
              <div style="font-size: 18px; font-weight: bold;">${meeting.title}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: bold;">${meeting.startTime} - ${meeting.endTime}</div>
              <div style="font-size: 12px; color: #666; text-transform: uppercase;">${meeting.category}</div>
            </div>
          </div>
          <div class="meeting-details">
            <div class="detail-item">
              <span class="detail-label">Scheduler:</span>
              <span>${meeting.schedulerName}</span>
            </div>
            ${meeting.location ? `
              <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span>${meeting.location}</span>
              </div>
            ` : ''}
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span style="text-transform: capitalize;">${meeting.status}</span>
            </div>
          </div>
          ${attendeesList.length > 0 ? `
            <div class="attendees-list">
              <div style="font-weight: bold; margin-bottom: 8px;">Attendees:</div>
              ${attendeesList.map(attendee => `<span class="attendee-tag">${attendee}</span>`).join('')}
            </div>
          ` : ''}
          ${(meeting as any).notes ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
              <div style="font-weight: bold; margin-bottom: 5px;">Notes:</div>
              <div style="font-size: 14px; line-height: 1.4;">${(meeting as any).notes}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="date-group">
        <div class="date-group-header">
          ${format(new Date(dateStr), 'EEEE, MMMM dd, yyyy')}
          <div style="font-size: 14px; font-weight: normal; margin-top: 4px; color: #666;">
            ${dateMeetings.length} meeting${dateMeetings.length !== 1 ? 's' : ''}
          </div>
        </div>
        ${meetingItems}
      </div>
    `;
  }).join('');

  return `
    <div class="meeting-list">
      <div style="margin-bottom: 30px; text-align: center; color: #666;">
        Total Meetings: ${sortedMeetings.length} across ${Object.keys(groupedMeetings).length} day${Object.keys(groupedMeetings).length !== 1 ? 's' : ''}
      </div>
      ${dateGroups}
    </div>
  `;
}

export function printCalendar(options: PrintOptions): void {
  const printContent = generatePrintContent(options);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to enable printing');
    return;
  }

  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };
}