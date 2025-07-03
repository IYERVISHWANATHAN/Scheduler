import { format, eachDayOfInterval, isSameDay } from 'date-fns';

export interface MeetingSummaryOptions {
  startDate: Date;
  endDate: Date;
  meetings: any[];
  title: string;
  categories: any[];
}

export function printMeetingSummary(options: MeetingSummaryOptions) {
  const { startDate, endDate, meetings, title, categories } = options;
  
  // Get all days in the week range
  const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group meetings by date
  const meetingsByDate = daysInRange.map(date => {
    const dayMeetings = meetings.filter(meeting => 
      isSameDay(new Date(meeting.date), date)
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    return {
      date,
      meetings: dayMeetings
    };
  });

  // Get category color helper
  const getCategoryColor = (categoryKey: string) => {
    const category = categories.find(cat => cat.key === categoryKey);
    return category?.color || '#6B7280';
  };

  // Get attendees list helper
  const getAttendeesList = (meeting: any) => {
    const ddfsAttendees = meeting.ddfsAttendees || [];
    const brandAttendees = meeting.brandAttendees || [];
    return [...ddfsAttendees, ...brandAttendees].filter(Boolean);
  };

  // Create print content
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page {
          margin: 0.75in;
          size: letter;
        }
        
        @media print {
          .page-break {
            page-break-before: always;
          }
          
          .no-print {
            display: none !important;
          }
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          font-size: 11pt;
          line-height: 1.4;
          color: #1f2937;
          margin: 0;
          padding: 0;
        }
        
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .header h1 {
          font-size: 18pt;
          font-weight: bold;
          color: #111827;
          margin: 0 0 8px 0;
        }
        
        .header .date-range {
          font-size: 12pt;
          color: #6b7280;
          margin: 0;
        }
        
        .day-section {
          margin-bottom: 32px;
          break-inside: avoid;
        }
        
        .day-header {
          background: #f9fafb;
          padding: 12px 16px;
          border-left: 4px solid #3b82f6;
          margin-bottom: 16px;
        }
        
        .day-header h2 {
          font-size: 14pt;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        
        .day-header .day-date {
          font-size: 10pt;
          color: #6b7280;
          margin: 2px 0 0 0;
        }
        
        .meeting-list {
          margin-left: 0;
        }
        
        .meeting-item {
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
          break-inside: avoid;
        }
        
        .meeting-item:last-child {
          border-bottom: none;
        }
        
        .meeting-header {
          display: flex;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        
        .meeting-category {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          margin-right: 8px;
          margin-top: 2px;
          flex-shrink: 0;
        }
        
        .meeting-title {
          font-size: 12pt;
          font-weight: 600;
          color: #111827;
          margin: 0;
          flex-grow: 1;
        }
        
        .meeting-time {
          font-size: 10pt;
          color: #059669;
          font-weight: 500;
          margin-left: 12px;
          white-space: nowrap;
        }
        
        .meeting-details {
          margin-left: 20px;
          font-size: 10pt;
          color: #4b5563;
        }
        
        .detail-row {
          margin-bottom: 4px;
          display: flex;
          align-items: flex-start;
        }
        
        .detail-label {
          font-weight: 500;
          min-width: 70px;
          color: #374151;
        }
        
        .detail-value {
          flex-grow: 1;
        }
        
        .attendees-list {
          line-height: 1.3;
        }
        
        .no-meetings {
          text-align: center;
          color: #9ca3af;
          font-style: italic;
          padding: 24px 0;
        }
        
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 9pt;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <p class="date-range">${format(startDate, 'EEEE, MMMM d')} - ${format(endDate, 'EEEE, MMMM d, yyyy')}</p>
      </div>
      
      ${meetingsByDate.map((dayData, dayIndex) => `
        <div class="day-section ${dayIndex > 0 && dayData.meetings.length > 3 ? 'page-break' : ''}">
          <div class="day-header">
            <h2>${format(dayData.date, 'EEEE')}</h2>
            <p class="day-date">${format(dayData.date, 'MMMM d, yyyy')}</p>
          </div>
          
          ${dayData.meetings.length === 0 ? `
            <div class="no-meetings">No meetings scheduled</div>
          ` : `
            <div class="meeting-list">
              ${dayData.meetings.map(meeting => {
                const attendees = getAttendeesList(meeting);
                const categoryColor = getCategoryColor(meeting.category);
                
                return `
                  <div class="meeting-item">
                    <div class="meeting-header">
                      <div class="meeting-category" style="background-color: ${categoryColor};"></div>
                      <h3 class="meeting-title">${meeting.title || 'Untitled Meeting'}</h3>
                      <span class="meeting-time">${meeting.startTime} - ${meeting.endTime}</span>
                    </div>
                    
                    <div class="meeting-details">
                      ${meeting.location ? `
                        <div class="detail-row">
                          <span class="detail-label">Location:</span>
                          <span class="detail-value">${meeting.location}</span>
                        </div>
                      ` : ''}
                      
                      ${attendees.length > 0 ? `
                        <div class="detail-row">
                          <span class="detail-label">Attendees:</span>
                          <span class="detail-value attendees-list">${attendees.join(', ')}</span>
                        </div>
                      ` : ''}
                      
                      ${meeting.category ? `
                        <div class="detail-row">
                          <span class="detail-label">Category:</span>
                          <span class="detail-value">${meeting.category.charAt(0).toUpperCase() + meeting.category.slice(1)}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `).join('')}
      
      <div class="footer">
        <p>Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</p>
      </div>
    </body>
    </html>
  `;

  // Create and open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
}