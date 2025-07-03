import { useState, useCallback, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Meeting } from '@shared/schema';
import { MeetingSummary } from './meeting-summary';
import { ModernMeetingForm } from './modern-meeting-form';
import { MeetingDetailsModal } from './meeting-details-modal';
import { printCalendar } from '@/lib/print-calendar';

interface DayViewProps {
  meetings: Meeting[];
  selectedDate: Date;
  onEditMeeting: (meeting: Meeting) => void;
  onTimeSlotClick: (date: string, time: string) => void;
  userRole?: string;
  canViewDetails?: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedMeeting: Meeting | null;
  dragStartY: number;
  dragStartTime: string;
  currentDropTime: string | null;
}

interface GhostMeeting {
  meeting: Meeting;
  top: number;
  height: number;
}

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 4) + 8;
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export function NewDayView({
  meetings,
  selectedDate,
  onEditMeeting,
  onTimeSlotClick,
  userRole = 'admin',
  canViewDetails = true
}: DayViewProps) {
  // Fetch categories for dynamic colors
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getCategoryColor = useCallback((category: string) => {
    if (!categories || !Array.isArray(categories)) return '#9CA3AF';
    const categoryData = categories.find((cat: any) => cat.key === category);
    return categoryData?.color || '#9CA3AF';
  }, [categories]);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedMeeting: null,
    dragStartY: 0,
    dragStartTime: '',
    currentDropTime: null
  });

  const [ghostMeeting, setGhostMeeting] = useState<GhostMeeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [formData, setFormData] = useState<{ date: string; time: string } | null>(null);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [detailsMeeting, setDetailsMeeting] = useState<Meeting | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Filter meetings for selected day
  const dayStr = format(selectedDate, 'yyyy-MM-dd');
  const dayMeetings = meetings.filter(meeting => meeting.date === dayStr);

  // Position meetings with pixel-perfect alignment
  const positionedMeetings = dayMeetings.map(meeting => {
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
          currentDropTime: meeting.startTime
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

    setDragState(prev => ({
      ...prev,
      currentDropTime: newTime
    }));

    // Update ghost meeting position
    const startMinutes = timeToMinutes(newTime);
    const originalDuration = timeToMinutes(dragState.draggedMeeting.endTime) - timeToMinutes(dragState.draggedMeeting.startTime);
    const slotIndex = timeSlots.findIndex(slot => timeToMinutes(slot) === startMinutes);
    
    if (slotIndex >= 0) {
      setGhostMeeting({
        meeting: dragState.draggedMeeting,
        top: 48 + (slotIndex * 16) + 16, // Add 16px offset to match meeting positioning
        height: (originalDuration / 15) * 16
      });
    }
  }, [dragState]);

  // Handle mouse up for drag end
  const handleMouseUp = useCallback(async () => {
    if (!dragState.isDragging || !dragState.draggedMeeting || !dragState.currentDropTime) return;

    const originalMeeting = dragState.draggedMeeting;
    const newStartTime = dragState.currentDropTime;
    
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
          date: dayStr
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
      currentDropTime: null
    });
    setGhostMeeting(null);
  }, [dragState, dayStr, timeToMinutes, minutesToTime]);

  // Handle empty slot double click
  const handleSlotDoubleClick = useCallback((slotIndex: number) => {
    const timeSlot = timeSlots[slotIndex];
    
    setFormData({ date: dayStr, time: timeSlot });
    setShowMeetingForm(true);
  }, [dayStr]);

  const isToday = isSameDay(selectedDate, new Date());

  // Handle print day view
  const handlePrintDay = useCallback(() => {
    if (userRole === 'guest') return; // Restrict print for guest users
    
    const dayTitle = `Day View - ${format(selectedDate, 'EEEE, MMMM d, yyyy')}`;
    printCalendar({
      type: 'day',
      date: selectedDate,
      meetings: dayMeetings,
      title: dayTitle
    });
  }, [selectedDate, dayMeetings, userRole]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex border-b border-gray-200">
        <div className="w-20 flex-shrink-0 border-r border-gray-200"></div>
        <div className={`flex-1 p-4 ${
          isToday ? 'bg-yellow-50' : 'bg-gray-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-sm font-medium text-gray-600">
                {format(selectedDate, 'EEEE')}
              </div>
              <div className={`text-xl font-bold ${
                isToday ? 'text-yellow-600' : 'text-gray-900'
              }`}>
                {format(selectedDate, 'MMMM d, yyyy')}
              </div>
            </div>
            {userRole !== 'guest' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintDay}
                className="ml-4"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Day
              </Button>
            )}
          </div>
        </div>
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

        {/* Day Grid */}
        <div className="flex-1 relative">
          {/* Header spacer */}
          <div className="h-12 border-b border-gray-200"></div>
          
          {/* Time grid */}
          {timeSlots.map((slot, slotIndex) => {
            const isHour = slot.endsWith(':00');
            return (
              <div
                key={slot}
                className={`border-b ${isHour ? 'border-gray-400' : 'border-gray-200'} relative cursor-pointer hover:bg-blue-50`}
                style={{ 
                  height: '16px',
                  borderBottomWidth: isHour ? '2.25px' : '1.6px',
                  borderBottomStyle: isHour ? 'solid' : 'dashed',
                  borderBottomColor: isHour ? '#6b7280' : '#d1d5db'
                }}
                onDoubleClick={() => handleSlotDoubleClick(slotIndex)}
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
                <div className="p-2 h-full flex flex-col justify-between text-white text-sm">
                  <div>
                    <div className="font-medium truncate">
                      {canViewDetails ? meeting.title : 'Blocked'}
                    </div>
                    {canViewDetails && meeting.location && (
                      <div className="opacity-90 truncate text-xs mt-1">
                        📍 {meeting.location}
                      </div>
                    )}
                    {canViewDetails && meeting.schedulerName && (
                      <div className="opacity-90 truncate text-xs">
                        👤 {meeting.schedulerName}
                      </div>
                    )}
                  </div>
                  <div className="opacity-90 text-xs">
                    {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ghost meeting for drag preview */}
          {ghostMeeting && (
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
              <div className="p-2 h-full flex flex-col justify-between text-white text-sm">
                <div>
                  <div className="font-medium truncate">
                    {canViewDetails ? ghostMeeting.meeting.title : 'Blocked'}
                  </div>
                  {canViewDetails && ghostMeeting.meeting.location && (
                    <div className="opacity-90 truncate text-xs mt-1">
                      📍 {ghostMeeting.meeting.location}
                    </div>
                  )}
                </div>
                <div className="opacity-90 text-xs">
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
          categories={[]}
          ddfsAttendees={[]}
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