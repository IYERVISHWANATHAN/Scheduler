import type { Meeting } from "@shared/schema";

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

interface MeetingConflict {
  conflictingMeeting: Meeting;
  attendees: string[];
  suggestion: string;
}

export async function findOptimalMeetingTimes(
  requestedDuration: number,
  requiredAttendees: string[],
  preferredTimeRange: { start: string; end: string },
  dateRange: { start: string; end: string },
  existingMeetings: Meeting[],
  category: string
): Promise<TimeSlot[]> {
  return generateBasicTimeSlots(
    requestedDuration,
    requiredAttendees,
    preferredTimeRange,
    dateRange,
    existingMeetings,
    category
  );
}

function generateBasicTimeSlots(
  duration: number,
  requiredAttendees: string[],
  timeRange: { start: string; end: string },
  dateRange: { start: string; end: string },
  existingMeetings: Meeting[],
  category: string
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends
    
    const dateStr = date.toISOString().split('T')[0];
    const dayMeetings = existingMeetings.filter(m => m.date === dateStr);
    
    // Generate morning slots (9:00-12:00)
    for (let hour = 9; hour < 12; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 15) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const endTimeMinutes = timeToMinutes(startTime) + duration;
        const endTime = minutesToTime(endTimeMinutes);
        
        if (endTimeMinutes > timeToMinutes("12:00")) break; // Don't go past noon
        
        if (!hasConflict(dateStr, startTime, endTime, dayMeetings)) {
          slots.push({
            date: dateStr,
            startTime,
            endTime,
            score: 85 + Math.random() * 10,
            reason: `Morning slot with good productivity potential`
          });
        }
      }
    }
    
    // Generate afternoon slots (14:00-17:00)
    for (let hour = 14; hour < 17; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 15) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const endTimeMinutes = timeToMinutes(startTime) + duration;
        const endTime = minutesToTime(endTimeMinutes);
        
        if (endTimeMinutes > timeToMinutes("17:00")) break; // Don't go past 5 PM
        
        if (!hasConflict(dateStr, startTime, endTime, dayMeetings)) {
          slots.push({
            date: dateStr,
            startTime,
            endTime,
            score: 75 + Math.random() * 10,
            reason: `Afternoon slot with moderate availability`
          });
        }
      }
    }
  }
  
  return slots.slice(0, 5);
}

function hasConflict(date: string, startTime: string, endTime: string, meetings: Meeting[]): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  return meetings.some(meeting => {
    const meetingStart = timeToMinutes(meeting.startTime);
    const meetingEnd = timeToMinutes(meeting.endTime);
    return (start < meetingEnd && end > meetingStart);
  });
}

export async function analyzeSchedulingConflicts(
  proposedMeeting: { date: string; startTime: string; endTime: string; mandatoryAttendees: string[] },
  existingMeetings: Meeting[]
): Promise<MeetingConflict[]> {
  const conflicts = existingMeetings.filter(meeting => 
    meeting.date === proposedMeeting.date &&
    meeting.mandatoryAttendees.some(attendee => 
      proposedMeeting.mandatoryAttendees.includes(attendee)
    ) &&
    timeOverlaps(
      proposedMeeting.startTime, 
      proposedMeeting.endTime,
      meeting.startTime,
      meeting.endTime
    )
  );

  return conflicts.map(conflict => ({
    conflictingMeeting: conflict,
    attendees: conflict.mandatoryAttendees.filter(attendee => 
      proposedMeeting.mandatoryAttendees.includes(attendee)
    ),
    suggestion: "Consider rescheduling to avoid conflicts"
  }));
}

function timeOverlaps(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  return s1 < e2 && s2 < e1;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}