import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2, X, Calendar, Clock, MapPin, Users, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatTime, getCategoryColor } from "@/lib/utils";
import { format } from "date-fns";
import type { Meeting } from "@shared/schema";


interface MeetingDetailsModalProps {
  meeting: Meeting | null;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
}

export function MeetingDetailsModal({ meeting, onClose, onEdit }: MeetingDetailsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete meeting' }));
        throw new Error(errorData.message || 'Failed to delete meeting');
      }

      // Don't try to parse JSON for 204 No Content responses
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      toast({
        title: "Meeting deleted",
        description: "The meeting has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to delete meeting. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error('Delete error:', error);
    },
  });

  const handleDelete = async () => {
    if (!meeting) return;
    
    if (window.confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await deleteMutation.mutateAsync(meeting.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEdit = () => {
    if (meeting) {
      onEdit(meeting);
      onClose();
    }
  };



  if (!meeting) return null;

  const formatMeetingDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getAttendeesByType = () => {
    return {
      ddfs: {
        mandatory: meeting.mandatoryAttendees.filter(attendee => 
          meeting.ddfsAttendees.includes(attendee)
        ),
        optional: meeting.ddfsAttendees.filter(attendee => 
          !meeting.mandatoryAttendees.includes(attendee)
        )
      },
      brand: {
        mandatory: meeting.mandatoryAttendees.filter(attendee => 
          meeting.brandAttendees.includes(attendee)
        ),
        optional: meeting.brandAttendees.filter(attendee => 
          !meeting.mandatoryAttendees.includes(attendee)
        )
      }
    };
  };

  return (
    <Dialog open={!!meeting} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">
            {meeting.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Badge */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-500" />
            <Badge 
              style={{ 
                backgroundColor: getCategoryColor(meeting.category),
                color: 'white'
              }}
            >
              {meeting.category}
            </Badge>
          </div>

          {/* Date and Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>{formatMeetingDate(meeting.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>{formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}</span>
            </div>
          </div>

          {/* Location */}
          {meeting.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{meeting.location}</span>
            </div>
          )}

          {/* Scheduler */}
          {meeting.schedulerName && (
            <div className="text-sm">
              <span className="text-gray-500">Scheduled by: </span>
              <span className="font-medium">{meeting.schedulerName}</span>
            </div>
          )}

          {/* Attendees */}
          {(() => {
            const attendees = getAttendeesByType();
            const totalAttendees = attendees.ddfs.mandatory.length + attendees.ddfs.optional.length + 
                                   attendees.brand.mandatory.length + attendees.brand.optional.length;
            
            return totalAttendees > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span>Attendees ({totalAttendees})</span>
                </div>
                
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {/* DDFS Attendees */}
                  {(attendees.ddfs.mandatory.length > 0 || attendees.ddfs.optional.length > 0) && (
                    <div>
                      <h6 className="text-xs font-semibold text-blue-700 mb-2">DDFS Attendees</h6>
                      
                      {attendees.ddfs.mandatory.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-600">Mandatory: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attendees.ddfs.mandatory.map(attendee => (
                              <Badge key={attendee} variant="destructive" className="text-xs">{attendee}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {attendees.ddfs.optional.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-600">Optional: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attendees.ddfs.optional.map(attendee => (
                              <Badge key={attendee} variant="default" className="text-xs">{attendee}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Brand Attendees */}
                  {(attendees.brand.mandatory.length > 0 || attendees.brand.optional.length > 0) && (
                    <div>
                      <h6 className="text-xs font-semibold text-green-700 mb-2">Brand Attendees</h6>
                      
                      {attendees.brand.mandatory.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-600">Mandatory: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attendees.brand.mandatory.map(attendee => (
                              <Badge key={attendee} variant="destructive" className="text-xs">{attendee}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {attendees.brand.optional.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-600">Optional: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attendees.brand.optional.map(attendee => (
                              <Badge key={attendee} variant="secondary" className="text-xs">{attendee}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}



          <Separator />

          {/* Action Buttons - Only show if user has permissions for this meeting's category */}
          {(() => {
            const canEditMeeting = permissions?.canEdit && 
              (user?.role === 'admin' || permissions?.categories?.includes(meeting.category));
            
            if (!canEditMeeting) {
              return (
                <div className="pt-2 text-center text-sm text-gray-500">
                  You don't have permission to modify this meeting
                </div>
              );
            }
            
            return (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleEdit}
                  className="flex-1"
                  variant="outline"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  disabled={isDeleting}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}