import { useMemo } from "react";
import { format } from "date-fns";
import type { Meeting } from "@shared/schema";
import { formatTime, timeToMinutes, getCategoryColor } from "@/lib/utils";
import { cn } from "@/lib/utils";


interface CalendarViewProps {
  meetings: Meeting[];
  selectedDate: Date;
  onEditMeeting: (meeting: Meeting) => void;
  onTimeSlotClick?: (date: string, time: string) => void;
  userRole?: string;
  canViewDetails?: boolean;
}

interface PositionedMeeting extends Meeting {
  top: number;
  height: number;
  width: number;
  left: number;
}

export function CalendarView({ meetings, selectedDate, onEditMeeting, onTimeSlotClick, userRole, canViewDetails = true }: CalendarViewProps) {
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 20 && minute > 0) break;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  }, []);

  const positionedMeetings = useMemo(() => {
    const positioned: PositionedMeeting[] = [];
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayMeetings = meetings.filter(m => m.date === selectedDateStr);

    // Calculate positions for each meeting
    dayMeetings.forEach(meeting => {
      const startMinutes = timeToMinutes(meeting.startTime);
      const endMinutes = timeToMinutes(meeting.endTime);
      const durationMinutes = endMinutes - startMinutes;
      
      // Calculate top position (8:00 AM = 0, adjust for proper alignment)
      // Each 15-minute slot is 16px high, add 8px offset to align with adjusted time labels
      const slotIndex = (startMinutes - 480) / 15; // How many 15-min slots from 8:00 AM
      const top = Math.round(slotIndex * 16) + 8;
      
      // Calculate height
      const height = (durationMinutes / 15) * 16;
      
      positioned.push({
        ...meeting,
        top,
        height,
        width: 100,
        left: 0
      });
    });

    // Handle overlapping meetings
    positioned.sort((a, b) => a.top - b.top);
    
    // Group overlapping meetings
    const overlapGroups: PositionedMeeting[][] = [];
    const processed = new Set<number>();
    
    for (const meeting of positioned) {
      if (processed.has(meeting.id)) continue;
      
      const group = [meeting];
      processed.add(meeting.id);
      
      // Find all meetings that overlap with this one
      for (const other of positioned) {
        if (processed.has(other.id)) continue;
        
        // Check if meetings overlap in time
        const overlap = (meeting.top < other.top + other.height) && 
                       (other.top < meeting.top + meeting.height);
        
        if (overlap) {
          group.push(other);
          processed.add(other.id);
        }
      }
      
      overlapGroups.push(group);
    }
    
    // Position meetings within each group
    for (const group of overlapGroups) {
      if (group.length === 1) {
        // Single meeting takes full width
        group[0].width = 100;
        group[0].left = 0;
      } else {
        // Multiple overlapping meetings share the width
        const groupWidth = 100 / group.length;
        group.forEach((meeting, index) => {
          meeting.width = groupWidth;
          meeting.left = index * groupWidth;
        });
      }
    }

    return positioned;
  }, [meetings, selectedDate]);

  const hourLabels = useMemo(() => {
    const labels: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      const time12 = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
      labels.push(time12);
    }
    return labels;
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 p-4 hidden sm:block">
        <div className="text-sm font-medium text-gray-700">
          Day Schedule - 8:00 AM to 8:00 PM (15-minute intervals)
        </div>
      </div>
      
      <div className="relative">
        <div className="grid grid-cols-[100px_1fr] min-h-[800px]">
          {/* Time Labels */}
          <div className="bg-gray-50 border-r border-gray-200 relative">
            {/* Generate hour labels positioned to align with grid */}
            {Array.from({ length: 13 }, (_, i) => {
              const hour = i + 8; // 8 AM to 8 PM
              if (hour > 20) return null;
              
              const time12 = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
              const topPosition = i * 64; // 4 slots per hour * 16px = 64px per hour
              
              return (
                <div
                  key={`hour-${hour}`}
                  className="absolute flex items-center justify-end pr-2 text-xs text-gray-500 whitespace-nowrap"
                  style={{ 
                    top: `${topPosition}px`,
                    height: '16px',
                    transform: 'translateY(8px)' // Align the label with the hour line
                  }}
                >
                  {time12}
                </div>
              );
            })}
            
            {/* Invisible spacer to maintain grid height */}
            {timeSlots.map((slot) => (
              <div key={slot} style={{ height: '16px' }} />
            ))}
          </div>
          
          {/* Calendar Content Area */}
          <div className="relative" style={{ minHeight: `${timeSlots.length * 16}px` }}>
            {/* Time Slot Grid Background */}
            <div className="absolute inset-0 pointer-events-none">
              {timeSlots.map((slot, index) => {
                const isHourMark = slot.endsWith(':00');
                const isQuarterHour = slot.endsWith(':15') || slot.endsWith(':30') || slot.endsWith(':45');
                return (
                  <div 
                    key={slot} 
                    className={cn(
                      "border-b",
                      isHourMark ? "border-gray-400 border-solid" : 
                      isQuarterHour ? "border-dotted border-gray-300" : "border-gray-100"
                    )} 
                    style={{ height: '16px' }}
                  />
                );
              })}
            </div>
            
            {/* Meetings */}
            {positionedMeetings.map(meeting => (
              <div
                key={meeting.id}
                className={cn(
                  "absolute rounded-lg p-2 shadow-sm border cursor-pointer hover:shadow-md transition-shadow text-white text-xs overflow-hidden",
                  meeting.status === 'tentative' && "opacity-80"
                )}
                style={{
                  top: `${meeting.top}px`,
                  height: `${meeting.height}px`,
                  left: `${meeting.left}%`,
                  width: `calc(${meeting.width}% - 8px)`,
                  backgroundColor: getCategoryColor(meeting.category),
                  borderColor: getCategoryColor(meeting.category),
                  marginLeft: '4px',
                  marginRight: '4px'
                }}
                onDoubleClick={() => canViewDetails ? onEditMeeting(meeting) : undefined}
              >
                {canViewDetails ? (
                  <>
                    <div className={cn(
                      "font-medium mb-1 truncate",
                      meeting.status === 'tentative' ? "text-red-600 font-bold" : "text-white"
                    )} title={meeting.title}>
                      {meeting.title}
                    </div>
                    <div className={cn(
                      "opacity-90 text-xs",
                      meeting.status === 'tentative' ? "text-red-600 font-bold opacity-100" : "text-white"
                    )}>
                      {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                    </div>
                    <div className={cn(
                      "opacity-80 mt-1 text-xs",
                      meeting.status === 'tentative' ? "text-red-600 font-bold opacity-100" : "text-white"
                    )}>
                      <i className={`fas ${meeting.status === 'confirmed' ? 'fa-check-circle' : 'fa-clock'} mr-1`}></i>
                      {meeting.status === 'confirmed' ? 'Confirmed' : 'Tentative'}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col h-full justify-center items-center">
                    <div className="text-white font-medium text-xs">
                      Meeting Scheduled
                    </div>
                    <div className="text-white opacity-90 text-xs">
                      {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                    </div>
                  </div>
                )}
                {meeting.location && (
                  <div className={cn(
                    "opacity-80 text-xs truncate",
                    meeting.status === 'tentative' ? "text-red-600 font-bold opacity-100" : "text-white"
                  )} title={meeting.location}>
                    <i className="fas fa-map-marker-alt mr-1"></i>
                    {meeting.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
