import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Edit3, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCategoryColor } from '@/lib/utils';
import type { Meeting } from '@shared/schema';

interface EnhancedDayViewProps {
  meetings: Meeting[];
  selectedDate: Date;
  onEditMeeting: (meeting: Meeting) => void;
  onTimeSlotClick: (date: string, time: string) => void;
  userRole?: string;
  canViewDetails: boolean;
}

interface PositionedMeeting extends Meeting {
  top: number;
  height: number;
  width: number;
  left: number;
}

export function EnhancedDayView({
  meetings,
  selectedDate,
  onEditMeeting,
  onTimeSlotClick,
  userRole,
  canViewDetails
}: EnhancedDayViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMeeting, setDraggedMeeting] = useState<Meeting | null>(null);
  const [currentDropTime, setCurrentDropTime] = useState<string>('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate time slots (8 AM to 8 PM, 15-minute intervals)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  }, []);

  // Category colors mapping
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      destination: '#FF6B6B',
      liquor: '#4ECDC4',
      tobacco: '#45B7D1',
      pnc: '#96CEB4',
      confectionary: '#FFEAA7',
      fashion: '#DDA0DD'
    };
    return colors[category] || '#95A5A6';
  };

  // Convert time string to minutes from midnight
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to time string
  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Convert pixel position to time using exact formula
  const pixelToTime = useCallback((y: number) => {
    // Remove header offset and convert to slot index
    const relativeY = Math.max(0, y - 48);
    const slotIndex = Math.floor(relativeY / 16);
    const clampedIndex = Math.max(0, Math.min(slotIndex, timeSlots.length - 1));
    return timeSlots[clampedIndex];
  }, [timeSlots]);

  // Calculate positioned meetings with pixel-perfect alignment
  const positionedMeetings = useMemo((): PositionedMeeting[] => {
    const positioned: PositionedMeeting[] = [];
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const dayMeetings = meetings.filter(meeting => meeting.date === dateString);

    dayMeetings.forEach(meeting => {
      const startMinutes = timeToMinutes(meeting.startTime);
      const endMinutes = timeToMinutes(meeting.endTime);
      const durationMinutes = endMinutes - startMinutes;
      
      // Calculate top position using timeSlots array indexing for perfect alignment
      const slotIndex = timeSlots.findIndex(slot => {
        const slotMinutes = timeToMinutes(slot);
        return slotMinutes === startMinutes;
      });
      
      // Pixel-perfect positioning: 48px header + (timeSlotIndex * 16px)
      const top = 48 + (slotIndex >= 0 ? slotIndex * 16 : 0);
      
      // Calculate height based on duration (16px per 15-minute slot)
      const height = (durationMinutes / 15) * 16;
      
      positioned.push({
        ...meeting,
        top,
        height,
        width: 100,
        left: 0
      });
    });

    return positioned;
  }, [meetings, selectedDate, timeSlots]);

  // Update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, updates }: { meetingId: number; updates: Partial<Meeting> }) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        throw new Error('Failed to update meeting');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({ title: 'Meeting updated successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error updating meeting', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete meeting');
      }
      return response.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setSelectedMeeting(null);
      toast({ title: 'Meeting deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error deleting meeting', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mouse event handlers for drag and drop
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !calendarRef.current) return;

    const rect = calendarRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newTime = pixelToTime(y);
    setCurrentDropTime(newTime);
  }, [isDragging, pixelToTime]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedMeeting || !calendarRef.current) {
      setIsDragging(false);
      setDraggedMeeting(null);
      setCurrentDropTime('');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      return;
    }

    const rect = calendarRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newStartTime = pixelToTime(y);
    
    // Calculate new end time based on original duration
    const originalDuration = timeToMinutes(draggedMeeting.endTime) - timeToMinutes(draggedMeeting.startTime);
    const newEndTime = minutesToTime(timeToMinutes(newStartTime) + originalDuration);

    // Update the meeting with new times
    updateMeetingMutation.mutate({
      meetingId: draggedMeeting.id,
      updates: {
        startTime: newStartTime,
        endTime: newEndTime
      }
    });

    setIsDragging(false);
    setDraggedMeeting(null);
    setCurrentDropTime('');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, draggedMeeting, pixelToTime, updateMeetingMutation, handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent, meeting: Meeting) => {
    if (!canViewDetails) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDraggedMeeting(meeting);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [canViewDetails, handleMouseMove, handleMouseUp]);

  // Handle single click - show details
  const handleMeetingClick = useCallback((meeting: Meeting) => {
    if (canViewDetails) {
      setSelectedMeeting(meeting);
    }
  }, [canViewDetails]);

  // Handle double click - edit meeting
  const handleMeetingDoubleClick = useCallback((meeting: Meeting) => {
    if (canViewDetails) {
      onEditMeeting(meeting);
      setSelectedMeeting(null);
    }
  }, [canViewDetails, onEditMeeting]);

  // Handle time slot click
  const handleTimeSlotClick = useCallback((time: string) => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    onTimeSlotClick(dateString, time);
  }, [selectedDate, onTimeSlotClick]);

  // Handle time slot double click
  const handleTimeSlotDoubleClick = useCallback((time: string) => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    onTimeSlotClick(dateString, time);
  }, [selectedDate, onTimeSlotClick]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h3>
      </div>

      {/* Calendar Grid */}
      <div 
        ref={calendarRef}
        className="relative bg-white"
        style={{ height: `${48 + timeSlots.length * 16}px` }}
      >
        {/* Time Grid Lines and Labels */}
        {timeSlots.map((time, index) => {
          const isHourMark = time.endsWith(':00');
          return (
            <div key={time}>
              {/* Time Grid Line */}
              <div
                className={`absolute left-0 right-0 ${isHourMark ? 'border-gray-300' : 'border-gray-100'}`}
                style={{
                  top: `${48 + index * 16}px`,
                  borderTopWidth: '1px'
                }}
              />
              
              {/* Time Label (only for hour marks) */}
              {isHourMark && (
                <div
                  className="absolute left-4 text-xs text-gray-500 -translate-y-2"
                  style={{ top: `${48 + index * 16}px` }}
                >
                  {(() => {
                    const hour = parseInt(time.split(':')[0]);
                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    const period = hour < 12 ? 'AM' : 'PM';
                    return `${displayHour}:00 ${period}`;
                  })()}
                </div>
              )}
              
              {/* Clickable Time Slot */}
              <div
                className="absolute left-16 right-4 cursor-pointer hover:bg-blue-50 transition-colors duration-150"
                style={{
                  top: `${48 + index * 16}px`,
                  height: '16px'
                }}
                onClick={() => handleTimeSlotClick(time)}
                onDoubleClick={() => handleTimeSlotDoubleClick(time)}
              />
            </div>
          );
        })}

        {/* Drop Zone Indicator */}
        {isDragging && currentDropTime && (
          <div
            className="absolute left-16 right-4 bg-blue-200 border-2 border-blue-400 border-dashed rounded opacity-75"
            style={{
              top: `${48 + timeSlots.findIndex(slot => slot === currentDropTime) * 16}px`,
              height: draggedMeeting ? `${(timeToMinutes(draggedMeeting.endTime) - timeToMinutes(draggedMeeting.startTime)) / 15 * 16}px` : '16px'
            }}
          />
        )}

        {/* Meeting Blocks */}
        {positionedMeetings.map((meeting) => (
          <div
            key={meeting.id}
            className={`absolute left-16 right-4 rounded-lg border shadow-sm cursor-pointer transition-all duration-200 ${
              isDragging && draggedMeeting?.id === meeting.id
                ? 'transform rotate-1 scale-105 shadow-lg z-50'
                : 'hover:shadow-md hover:scale-105'
            } ${canViewDetails ? '' : 'opacity-75'}`}
            style={{
              top: `${meeting.top}px`,
              height: `${meeting.height}px`,
              backgroundColor: getCategoryColor(meeting.category),
              borderColor: getCategoryColor(meeting.category),
              zIndex: isDragging && draggedMeeting?.id === meeting.id ? 50 : 10
            }}
            onMouseDown={(e) => handleMouseDown(e, meeting)}
            onClick={() => handleMeetingClick(meeting)}
            onDoubleClick={() => handleMeetingDoubleClick(meeting)}
          >
            <div className="p-2 h-full flex flex-col justify-between text-white">
              <div>
                <div className="font-medium text-sm truncate">
                  {canViewDetails ? meeting.title : 'Blocked'}
                </div>
                {canViewDetails && meeting.location && (
                  <div className="text-xs opacity-90 truncate">
                    {meeting.location}
                  </div>
                )}
              </div>
              <div className="text-xs opacity-90">
                {meeting.startTime} - {meeting.endTime}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && canViewDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{selectedMeeting.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMeeting(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    {selectedMeeting.startTime} - {selectedMeeting.endTime}
                  </span>
                </div>
                
                {selectedMeeting.location && (
                  <div className="text-sm text-gray-600">
                    <strong>Location:</strong> {selectedMeeting.location}
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  <strong>Category:</strong> {selectedMeeting.category}
                </div>
                
                {selectedMeeting.description && (
                  <div className="text-sm text-gray-600">
                    <strong>Description:</strong> {selectedMeeting.description}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMeetingMutation.mutate(selectedMeeting.id)}
                  disabled={deleteMeetingMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onEditMeeting(selectedMeeting);
                    setSelectedMeeting(null);
                  }}
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}