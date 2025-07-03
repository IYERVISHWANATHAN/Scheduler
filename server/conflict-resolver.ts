import { storage } from "./storage";
import type { Meeting, InsertMeeting } from "@shared/schema";

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: ConflictDetail[];
  suggestions: ConflictSuggestion[];
  severity: 'low' | 'medium' | 'high';
  totalConflicts: number;
}

export interface ConflictDetail {
  conflictId: string;
  type: 'attendee_overlap' | 'room_conflict' | 'buffer_violation' | 'mandatory_conflict';
  conflictingMeeting: Meeting;
  affectedAttendees: string[];
  conflictDuration: number; // minutes
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ConflictSuggestion {
  suggestionId: string;
  type: 'reschedule' | 'split_meeting' | 'remove_attendee' | 'shorten_duration' | 'buffer_adjustment';
  description: string;
  newTimeSlot?: {
    date: string;
    startTime: string;
    endTime: string;
  };
  attendeeChanges?: {
    remove: string[];
    optional: string[];
  };
  durationChange?: number;
  priority: 'high' | 'medium' | 'low';
  feasibilityScore: number; // 0-100
  impactLevel: 'minimal' | 'moderate' | 'significant';
}

export class ConflictResolver {
  async analyzeConflicts(
    date: string,
    startTime: string,
    endTime: string,
    mandatoryAttendees: string[],
    optionalAttendees: string[] = [],
    excludeMeetingId?: number
  ): Promise<ConflictAnalysis> {
    const allMeetings = await storage.getAllMeetings();
    const conflicts: ConflictDetail[] = [];
    
    // Find overlapping meetings
    const overlappingMeetings = allMeetings.filter(meeting => {
      if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
      if (meeting.date !== date) return false;
      
      return this.timeOverlaps(
        meeting.startTime,
        meeting.endTime,
        startTime,
        endTime
      );
    });

    // Analyze attendee conflicts
    for (const meeting of overlappingMeetings) {
      const conflictingAttendees = this.findConflictingAttendees(
        mandatoryAttendees,
        meeting.mandatoryAttendees || []
      );

      if (conflictingAttendees.length > 0) {
        const overlapDuration = this.calculateOverlapDuration(
          meeting.startTime,
          meeting.endTime,
          startTime,
          endTime
        );

        conflicts.push({
          conflictId: `attendee-${meeting.id}`,
          type: 'mandatory_conflict',
          conflictingMeeting: meeting,
          affectedAttendees: conflictingAttendees,
          conflictDuration: overlapDuration,
          severity: this.calculateConflictSeverity(conflictingAttendees.length, overlapDuration),
          description: `${conflictingAttendees.length} mandatory attendee(s) have overlapping commitments`
        });
      }
    }

    // Check buffer violations
    const bufferConflicts = await this.checkBufferViolations(
      date,
      startTime,
      endTime,
      mandatoryAttendees,
      excludeMeetingId
    );
    conflicts.push(...bufferConflicts);

    // Generate suggestions
    const suggestions = await this.generateSuggestions(
      date,
      startTime,
      endTime,
      mandatoryAttendees,
      optionalAttendees,
      conflicts,
      excludeMeetingId
    );

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      suggestions,
      severity: this.calculateOverallSeverity(conflicts),
      totalConflicts: conflicts.length
    };
  }

  private timeOverlaps(start1: string, end1: string, start2: string, end2: string): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private findConflictingAttendees(attendees1: string[], attendees2: string[]): string[] {
    return attendees1.filter(attendee => attendees2.includes(attendee));
  }

  private calculateOverlapDuration(start1: string, end1: string, start2: string, end2: string): number {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    const overlapStart = Math.max(start1Minutes, start2Minutes);
    const overlapEnd = Math.min(end1Minutes, end2Minutes);
    
    return Math.max(0, overlapEnd - overlapStart);
  }

  private calculateConflictSeverity(attendeeCount: number, duration: number): 'low' | 'medium' | 'high' {
    if (attendeeCount >= 3 || duration >= 60) return 'high';
    if (attendeeCount >= 2 || duration >= 30) return 'medium';
    return 'low';
  }

  private calculateOverallSeverity(conflicts: ConflictDetail[]): 'low' | 'medium' | 'high' {
    if (conflicts.some(c => c.severity === 'high')) return 'high';
    if (conflicts.some(c => c.severity === 'medium')) return 'medium';
    return 'low';
  }

  private async checkBufferViolations(
    date: string,
    startTime: string,
    endTime: string,
    mandatoryAttendees: string[],
    excludeMeetingId?: number
  ): Promise<ConflictDetail[]> {
    const bufferMinutes = 10;
    const conflicts: ConflictDetail[] = [];
    const allMeetings = await storage.getAllMeetings();

    const meetings = allMeetings.filter(meeting => {
      if (excludeMeetingId && meeting.id === excludeMeetingId) return false;
      return meeting.date === date;
    });

    for (const meeting of meetings) {
      const sharedAttendees = this.findConflictingAttendees(
        mandatoryAttendees,
        meeting.mandatoryAttendees || []
      );

      if (sharedAttendees.length > 0) {
        const hasBufferViolation = this.checkBufferViolation(
          meeting.startTime,
          meeting.endTime,
          startTime,
          endTime,
          bufferMinutes
        );

        if (hasBufferViolation) {
          conflicts.push({
            conflictId: `buffer-${meeting.id}`,
            type: 'buffer_violation',
            conflictingMeeting: meeting,
            affectedAttendees: sharedAttendees,
            conflictDuration: bufferMinutes,
            severity: 'medium',
            description: `Less than ${bufferMinutes} minutes buffer between meetings`
          });
        }
      }
    }

    return conflicts;
  }

  private checkBufferViolation(
    meetingStart: string,
    meetingEnd: string,
    newStart: string,
    newEnd: string,
    bufferMinutes: number
  ): boolean {
    const meetingStartMinutes = this.timeToMinutes(meetingStart);
    const meetingEndMinutes = this.timeToMinutes(meetingEnd);
    const newStartMinutes = this.timeToMinutes(newStart);
    const newEndMinutes = this.timeToMinutes(newEnd);

    // Check if new meeting starts too close to existing meeting end
    if (newStartMinutes >= meetingEndMinutes && newStartMinutes < meetingEndMinutes + bufferMinutes) {
      return true;
    }

    // Check if new meeting ends too close to existing meeting start
    if (newEndMinutes <= meetingStartMinutes && newEndMinutes > meetingStartMinutes - bufferMinutes) {
      return true;
    }

    return false;
  }

  private async generateSuggestions(
    date: string,
    startTime: string,
    endTime: string,
    mandatoryAttendees: string[],
    optionalAttendees: string[],
    conflicts: ConflictDetail[],
    excludeMeetingId?: number
  ): Promise<ConflictSuggestion[]> {
    const suggestions: ConflictSuggestion[] = [];

    if (conflicts.length === 0) return suggestions;

    // Suggest alternative time slots
    const alternativeSlots = await this.findAlternativeTimeSlots(
      date,
      startTime,
      endTime,
      mandatoryAttendees,
      excludeMeetingId
    );

    alternativeSlots.forEach((slot, index) => {
      suggestions.push({
        suggestionId: `reschedule-${index}`,
        type: 'reschedule',
        description: `Reschedule to ${slot.startTime} - ${slot.endTime}`,
        newTimeSlot: slot,
        priority: index === 0 ? 'high' : 'medium',
        feasibilityScore: slot.score,
        impactLevel: 'minimal'
      });
    });

    // Suggest removing optional attendees if they cause conflicts
    const conflictingOptionalAttendees = this.findConflictingOptionalAttendees(
      optionalAttendees,
      conflicts
    );

    if (conflictingOptionalAttendees.length > 0) {
      suggestions.push({
        suggestionId: 'remove-optional',
        type: 'remove_attendee',
        description: `Remove ${conflictingOptionalAttendees.length} optional attendee(s) with conflicts`,
        attendeeChanges: {
          remove: conflictingOptionalAttendees,
          optional: []
        },
        priority: 'medium',
        feasibilityScore: 85,
        impactLevel: 'moderate'
      });
    }

    // Suggest shortening meeting duration
    const durationMinutes = this.timeToMinutes(endTime) - this.timeToMinutes(startTime);
    if (durationMinutes > 30) {
      const shortenedDuration = Math.max(30, durationMinutes - 15);
      suggestions.push({
        suggestionId: 'shorten-duration',
        type: 'shorten_duration',
        description: `Reduce meeting duration by 15 minutes`,
        durationChange: shortenedDuration,
        priority: 'low',
        feasibilityScore: 70,
        impactLevel: 'moderate'
      });
    }

    return suggestions.sort((a, b) => b.feasibilityScore - a.feasibilityScore);
  }

  private async findAlternativeTimeSlots(
    date: string,
    originalStart: string,
    originalEnd: string,
    mandatoryAttendees: string[],
    excludeMeetingId?: number
  ): Promise<Array<{ date: string; startTime: string; endTime: string; score: number }>> {
    const duration = this.timeToMinutes(originalEnd) - this.timeToMinutes(originalStart);
    const slots: Array<{ date: string; startTime: string; endTime: string; score: number }> = [];

    // Check same day alternative slots
    const timeSlots = this.generateTimeSlots(date, duration);
    
    for (const slot of timeSlots) {
      const conflicts = await storage.checkConflicts(
        slot.date,
        slot.startTime,
        slot.endTime,
        mandatoryAttendees,
        excludeMeetingId
      );

      if (conflicts.length === 0) {
        slots.push({
          ...slot,
          score: this.calculateSlotScore(slot.startTime, originalStart)
        });
      }
    }

    // Check next few days if no good slots found
    if (slots.length < 3) {
      for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
        const futureDate = this.addDaysToDate(date, dayOffset);
        const futureSlotsToday = this.generateTimeSlots(futureDate, duration);
        
        for (const slot of futureSlotsToday.slice(0, 3)) {
          const conflicts = await storage.checkConflicts(
            slot.date,
            slot.startTime,
            slot.endTime,
            mandatoryAttendees,
            excludeMeetingId
          );

          if (conflicts.length === 0) {
            slots.push({
              ...slot,
              score: Math.max(50, 90 - dayOffset * 10)
            });
          }
        }
      }
    }

    return slots.slice(0, 5).sort((a, b) => b.score - a.score);
  }

  private generateTimeSlots(date: string, durationMinutes: number): Array<{ date: string; startTime: string; endTime: string }> {
    const slots = [];
    const startHour = 8;
    const endHour = 20;
    const intervalMinutes = 15;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const startTimeMinutes = hour * 60 + minute;
        const endTimeMinutes = startTimeMinutes + durationMinutes;
        
        if (endTimeMinutes <= endHour * 60) {
          slots.push({
            date,
            startTime: this.minutesToTime(startTimeMinutes),
            endTime: this.minutesToTime(endTimeMinutes)
          });
        }
      }
    }

    return slots;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private calculateSlotScore(slotTime: string, originalTime: string): number {
    const slotMinutes = this.timeToMinutes(slotTime);
    const originalMinutes = this.timeToMinutes(originalTime);
    const timeDiff = Math.abs(slotMinutes - originalMinutes);
    
    // Higher score for times closer to original
    return Math.max(20, 100 - timeDiff / 5);
  }

  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private findConflictingOptionalAttendees(optionalAttendees: string[], conflicts: ConflictDetail[]): string[] {
    const conflictingAttendees = new Set<string>();
    
    conflicts.forEach(conflict => {
      conflict.affectedAttendees.forEach(attendee => {
        if (optionalAttendees.includes(attendee)) {
          conflictingAttendees.add(attendee);
        }
      });
    });

    return Array.from(conflictingAttendees);
  }

  async resolveConflictWithSuggestion(
    meetingId: number,
    suggestionId: string,
    suggestion: ConflictSuggestion
  ): Promise<boolean> {
    try {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return false;

      switch (suggestion.type) {
        case 'reschedule':
          if (suggestion.newTimeSlot) {
            await storage.updateMeeting(meetingId, {
              date: suggestion.newTimeSlot.date,
              startTime: suggestion.newTimeSlot.startTime,
              endTime: suggestion.newTimeSlot.endTime
            });
          }
          break;

        case 'remove_attendee':
          if (suggestion.attendeeChanges) {
            const newOptionalAttendees = (meeting.optionalAttendees || [])
              .filter(attendee => !suggestion.attendeeChanges!.remove.includes(attendee));
            
            await storage.updateMeeting(meetingId, {
              optionalAttendees: newOptionalAttendees
            });
          }
          break;

        case 'shorten_duration':
          if (suggestion.durationChange) {
            const startMinutes = this.timeToMinutes(meeting.startTime);
            const newEndTime = this.minutesToTime(startMinutes + suggestion.durationChange);
            
            await storage.updateMeeting(meetingId, {
              endTime: newEndTime
            });
          }
          break;

        default:
          return false;
      }

      return true;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  }
}

export const conflictResolver = new ConflictResolver();