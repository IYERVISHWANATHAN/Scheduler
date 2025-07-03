import { useState, useCallback, useRef, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, endOfWeek } from 'date-fns';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Meeting } from '@shared/schema';
import { MeetingSummary } from './meeting-summary';
import { ModernMeetingForm } from './modern-meeting-form';
import { MeetingDetailsModal } from './meeting-details-modal';
import { useCategoryColors } from '@/hooks/use-category-colors';
import { printCalendar } from '@/lib/print-calendar';

interface WeekViewProps {
  meetings: Meeting[];
  selectedDate: Date;
  onEditMeeting: (meeting: Meeting) => void;
  onSelectDate: (date: Date) => void;
  onTimeSlotClick: (date: string, time: string) => void;
  userRole?: string;
  canViewDetails?: boolean;
  categories?: any[];
  ddfsAttendees?: any[];
}

interface DragState {
  isDragging: boolean;
  draggedMeeting: Meeting | null;
  dragStartY: number;
  dragStartTime: string;
  currentDropTime: string | null;
  currentDropDate: string | null;
}

interface GhostMeeting {
  meeting: Meeting;
  top: number;
  height: number;
  dayIndex: number;
}

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 4) + 8;
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

// Category colors mapping
const categoryColors = {
  destination: '#FF6B6B',
  liquor: '#4ECDC4',
  tobacco: '#45B7D1',
  pnc: '#96CEB4',
  confectionary: '#FFEAA7',
  fashion: '#DDA0DD'
};

export function NewWeekView({
  meetings,
  selectedDate,
  onEditMeeting,
  onSelectDate,
  onTimeSlotClick,
  userRole = 'admin',
  canViewDetails = true,
  categories = [],
  ddfsAttendees = []
}: WeekViewProps) {
  const { getCategoryColor } = useCategoryColors();
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedMeeting: null,
    dragStartY: 0,
    dragStartTime: '',
    currentDropTime: null,
    currentDropDate: null
  });

  const [ghostMeeting, setGhostMeeting] = useState<GhostMeeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [formData, setFormData] = useState<{ date: string; time: string } | null>(null);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [detailsMeeting, setDetailsMeeting] = useState<Meeting | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate week start (Sunday = 0)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });

  // Helper functions
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };



  const pixelToTime = (pixel: number): string => {
    const slotIndex = Math.floor(pixel / 16);
    const clampedIndex = Math.max(0, Math.min(47, slotIndex));
    return timeSlots[clampedIndex];
  };

  // Position meetings with pixel-perfect alignment
  const positionMeetings = (dayMeetings: Meeting[]) => {
    return dayMeetings.map(meeting => {
      const startMinutes = timeToMinutes(meeting.startTime);
      const endMinutes = timeToMinutes(meeting.endTime);
      const durationMinutes = endMinutes - startMinutes;
      
      // Calculate exact positioning based on time (8:00 AM = 0, each minute precise)
      const startFromEight = startMinutes - (8 * 60); // Minutes from 8:00 AM
      const pixelsFromTop = (startFromEight / 15) * 16; // Exact pixel position per minute
      const offsetPixels = (15 / 15) * 16; // 15-minute offset in pixels
      
      // Pixel-perfect positioning: 48px header + exact pixel calculation + 15min offset
      const top = Math.max(0, 48 + pixelsFromTop + offsetPixels);
      const height = Math.max(16, (durationMinutes / 15) * 16);
      
      return {
        ...meeting,
        top,
        height,
        width: 95, // Full width minus padding
        left: 2 // Small left margin
      };
    });
  };

  // Handle single click - show meeting details with edit/delete options
  const handleMeetingClick = useCallback((meeting: Meeting) => {
    if (dragState.isDragging) return;
    setDetailsMeeting(meeting);
    setShowMeetingDetails(true);
  }, [dragState.isDragging]);

  // Handle double click - edit meeting directly
  const handleMeetingDoubleClick = useCallback((meeting: Meeting) => {
    if (dragState.isDragging) return;
    onEditMeeting(meeting);
  }, [dragState.isDragging, onEditMeeting]);

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((e: React.MouseEvent, meeting: Meeting) => {
    // Don't prevent default immediately - allow click events to fire
    const startX = e.clientX;
    const startY = e.clientY;
    const threshold = 5; // pixels to move before considering it a drag
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      
      if (deltaX > threshold || deltaY > threshold) {
        // Now it's a drag operation
        setDragState({
          isDragging: true,
          draggedMeeting: meeting,
          dragStartY: startY,
          dragStartTime: meeting.startTime,
          currentDropTime: meeting.startTime,
          currentDropDate: meeting.date
        });
        
        // Remove the temporary listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };
    
    const handleMouseUp = () => {
      // Clean up if mouse up without drag
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add temporary listeners to detect drag
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedMeeting) return;

    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const headerHeight = 48;
    const timeColumnWidth = 80;
    
    // Calculate Y position relative to the time grid
    const relativeY = e.clientY - rect.top - headerHeight;
    const newTime = pixelToTime(Math.max(0, relativeY));
    
    // Calculate which day column we're in
    const dayAreaWidth = rect.width - timeColumnWidth;
    const dayWidth = dayAreaWidth / 7;
    const relativeX = e.clientX - rect.left - timeColumnWidth;
    const dayIndex = Math.floor(relativeX / dayWidth);
    const clampedDayIndex = Math.max(0, Math.min(6, dayIndex));
    const newDate = format(addDays(weekStart, clampedDayIndex), 'yyyy-MM-dd');

    setDragState(prev => ({
      ...prev,
      currentDropTime: newTime,
      currentDropDate: newDate
    }));

    // Update ghost meeting position
    const startMinutes = timeToMinutes(newTime);
    const originalDuration = timeToMinutes(dragState.draggedMeeting.endTime) - timeToMinutes(dragState.draggedMeeting.startTime);
    const slotIndex = timeSlots.findIndex(slot => timeToMinutes(slot) === startMinutes);
    
    if (slotIndex >= 0) {
      setGhostMeeting({
        meeting: dragState.draggedMeeting,
        top: 48 + (slotIndex * 16) + 16, // Add 16px offset to match meeting positioning
        height: (originalDuration / 15) * 16,
        dayIndex: clampedDayIndex
      });
    }
  }, [dragState, weekStart]);

  // Handle mouse up for drag end
  const handleMouseUp = useCallback(async () => {
    if (!dragState.isDragging || !dragState.draggedMeeting || !dragState.currentDropTime || !dragState.currentDropDate) return;

    const originalMeeting = dragState.draggedMeeting;
    const newStartTime = dragState.currentDropTime;
    const newDate = dragState.currentDropDate;
    
    // Calculate new end time based on original duration
    const originalDuration = timeToMinutes(originalMeeting.endTime) - timeToMinutes(originalMeeting.startTime);
    const newEndMinutes = timeToMinutes(newStartTime) + originalDuration;
    const newEndTime = minutesToTime(newEndMinutes);

    try {
      // Update meeting via API
      const response = await fetch(`/api/meetings/${originalMeeting.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          startTime: newStartTime,
          endTime: newEndTime,
          date: newDate
        })
      });

      if (response.ok) {
        // Trigger a re-fetch of meetings data instead of page reload
        const event = new CustomEvent('meetingUpdated');
        window.dispatchEvent(event);
      } else {
        console.error('Failed to update meeting');
      }
    } catch (error) {
      console.error('Error updating meeting:', error);
    }

    setDragState({
      isDragging: false,
      draggedMeeting: null,
      dragStartY: 0,
      dragStartTime: '',
      currentDropTime: null,
      currentDropDate: null
    });
    setGhostMeeting(null);
  }, [dragState, timeToMinutes, minutesToTime]);

  // Handle empty slot double click
  const handleSlotDoubleClick = useCallback((date: Date, slotIndex: number) => {
    const timeSlot = timeSlots[slotIndex];
    const dateStr = format(date, 'yyyy-MM-dd');
    
    setFormData({ date: dateStr, time: timeSlot });
    setShowMeetingForm(true);
  }, []);

  // Group meetings by day
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    if (!acc[meeting.date]) {
      acc[meeting.date] = [];
    }
    acc[meeting.date].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  // Handle print week view
  const handlePrintWeek = useCallback(() => {
    if (userRole === 'guest') return; // Restrict print for guest users
    
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekTitle = `Week View - ${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`;
    printCalendar({
      type: 'week',
      date: selectedDate,
      meetings: meetings,
      title: weekTitle
    });
  }, [selectedDate, meetings, userRole, weekStart]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Week Title Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-gray-900">
            {format(weekStart, 'MMMM d')} - {format(endOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMMM d, yyyy')}
          </h2>
        </div>
        {userRole !== 'guest' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintWeek}
            className="ml-4"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Week
          </Button>
        )}
      </div>
      
      {/* Day Headers */}
      <div className="flex border-b border-gray-200">
        <div className="w-20 flex-shrink-0 border-r border-gray-200"></div>
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          
          return (
            <div
              key={i}
              className={`flex-1 p-3 text-center border-r border-gray-200 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-50' : isToday ? 'bg-yellow-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelectDate(day)}
            >
              <div className="text-sm font-medium text-gray-600">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-semibold ${
                isToday ? 'text-yellow-600' : isSelected ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Time Labels Column */}
        <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200 relative">
          <div className="h-12 border-b border-gray-200"></div>
          
          {/* Hour labels aligned with grid lines */}
          {timeSlots.map((slot, slotIndex) => {
            if (!slot.endsWith(':00')) return null;
            
            const hour = parseInt(slot.split(':')[0]);
            const time12 = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
            
            // Position at the bottom of the slot where the border line is drawn
            const topPosition = 48 + (slotIndex * 16) + 16;
            
            return (
              <div
                key={`hour-${hour}`}
                className="absolute flex items-center justify-center text-xs text-gray-500 whitespace-nowrap"
                style={{ 
                  top: `${topPosition}px`,
                  height: '0px',
                  width: '100%',
                  transform: 'translateY(-50%)' // Center the text vertically on the line
                }}
              >
                {time12}
              </div>
            );
          })}
          
          {/* Spacer for grid height */}
          {timeSlots.map((slot) => (
            <div key={slot} style={{ height: '16px' }} />
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex-1 flex">
          {Array.from({ length: 7 }, (_, dayIndex) => {
            const day = addDays(weekStart, dayIndex);
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayMeetings = groupedMeetings[dayStr] || [];
            const positionedMeetings = positionMeetings(dayMeetings);
            
            return (
              <div key={dayIndex} className="flex-1 border-r border-gray-200 relative">
                {/* Header spacer */}
                <div className="h-12 border-b border-gray-200"></div>
                
                {/* Time grid - Hour lines: 2.25px solid, 15-min lines: 1.6px dashed */}
                {timeSlots.map((slot, slotIndex) => {
                  const isHour = slot.endsWith(':00');
                  return (
                    <div
                      key={slot}
                      className="border-b relative cursor-pointer hover:bg-blue-50"
                      style={{ 
                        height: '16px',
                        borderBottomWidth: isHour ? '2.25px' : '1.6px',
                        borderBottomStyle: isHour ? 'solid' : 'dashed',
                        borderBottomColor: isHour ? '#6b7280' : '#d1d5db'
                      }}
                      onDoubleClick={() => handleSlotDoubleClick(day, slotIndex)}
                    />
                  );
                })}

                {/* Meetings */}
                {positionedMeetings.map((meeting) => {
                  const isDragging = dragState.draggedMeeting?.id === meeting.id;
                  
                  return (
                    <div
                      key={meeting.id}
                      className={`absolute rounded-md border shadow-sm cursor-pointer transition-all duration-200 ${
                        isDragging ? 'opacity-50 rotate-3 scale-105' : 'hover:shadow-md hover:scale-105'
                      }`}
                      style={{
                        top: `${meeting.top}px`,
                        height: `${meeting.height}px`,
                        left: `${meeting.left}px`,
                        right: `${meeting.left}px`,
                        backgroundColor: getCategoryColor(meeting.category),
                        borderColor: getCategoryColor(meeting.category),
                        zIndex: isDragging ? 50 : 10
                      }}
                      onClick={() => handleMeetingClick(meeting)}
                      onDoubleClick={() => handleMeetingDoubleClick(meeting)}
                      onMouseDown={(e) => handleMouseDown(e, meeting)}
                    >
                      <div className="p-1 h-full flex flex-col justify-between text-white text-xs">
                        <div>
                          <div className="font-medium truncate">
                            {canViewDetails ? meeting.title : 'Blocked'}
                          </div>
                          {canViewDetails && meeting.location && (
                            <div className="opacity-90 truncate">
                              {meeting.location}
                            </div>
                          )}
                        </div>
                        <div className="opacity-90">
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Ghost meeting for drag preview */}
                {ghostMeeting && ghostMeeting.dayIndex === dayIndex && (
                  <div
                    className="absolute rounded-md border-2 border-dashed opacity-70 pointer-events-none z-40 animate-pulse"
                    style={{
                      top: `${ghostMeeting.top}px`,
                      height: `${ghostMeeting.height}px`,
                      left: '2px',
                      right: '2px',
                      backgroundColor: getCategoryColor(ghostMeeting.meeting.category),
                      borderColor: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div className="p-1 h-full flex flex-col justify-between text-white text-xs">
                      <div>
                        <div className="font-medium truncate">
                          {canViewDetails ? ghostMeeting.meeting.title : 'Blocked'}
                        </div>
                        {canViewDetails && ghostMeeting.meeting.location && (
                          <div className="opacity-90 truncate">
                            {ghostMeeting.meeting.location}
                          </div>
                        )}
                      </div>
                      <div className="opacity-90">
                        {dragState.currentDropTime && (() => {
                          const startMinutes = timeToMinutes(dragState.currentDropTime);
                          const durationMinutes = timeToMinutes(ghostMeeting.meeting.endTime) - timeToMinutes(ghostMeeting.meeting.startTime);
                          const endTime = minutesToTime(startMinutes + durationMinutes);
                          return `${formatTime(dragState.currentDropTime)} - ${formatTime(endTime)}`;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meeting Summary Modal */}
      {selectedMeeting && (
        <MeetingSummary
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}

      {/* Meeting Form Modal */}
      {showMeetingForm && formData && (
        <ModernMeetingForm
          open={showMeetingForm}
          onClose={() => {
            setShowMeetingForm(false);
            setFormData(null);
          }}
          onSuccess={() => {
            setShowMeetingForm(false);
            setFormData(null);
          }}
          selectedDate={new Date(formData.date)}
          selectedTime={formData.time}
          categories={categories}
          ddfsAttendees={ddfsAttendees}
          schedulingContext={{
            date: formData.date,
            startTime: formData.time,
            endTime: formData.time
          }}
        />
      )}

      {/* Meeting Details Modal */}
      <MeetingDetailsModal
        meeting={detailsMeeting}
        onClose={() => {
          setDetailsMeeting(null);
          setShowMeetingDetails(false);
        }}
        onEdit={(meeting) => {
          onEditMeeting(meeting);
          setDetailsMeeting(null);
          setShowMeetingDetails(false);
        }}
      />
    </div>
  );
}