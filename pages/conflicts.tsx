import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Clock, Users, Search, Filter, X, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConflictResolver } from "@/components/conflict-resolver";
import { Badge } from "@/components/ui/badge";
import type { Meeting } from "@shared/schema";

export default function ConflictsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [timeSlotFilter, setTimeSlotFilter] = useState({
    startTime: "09:00",
    endTime: "17:00"
  });
  const [, setLocation] = useLocation();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['/api/meetings'],
  });

  const filteredMeetings = (meetings as Meeting[]).filter(meeting => {
    const meetingDate = meeting.date;
    const meetingStart = meeting.startTime;
    const meetingEnd = meeting.endTime;
    
    return meetingDate === selectedDate &&
           meetingStart >= timeSlotFilter.startTime &&
           meetingEnd <= timeSlotFilter.endTime;
  });

  const getMeetingConflictStatus = (meeting: Meeting) => {
    const overlappingMeetings = (meetings as Meeting[]).filter(m => 
      m.id !== meeting.id &&
      m.date === meeting.date &&
      ((m.startTime < meeting.endTime && m.endTime > meeting.startTime))
    );

    const hasAttendeeConflicts = overlappingMeetings.some(m => 
      m.mandatoryAttendees?.some(attendee => 
        meeting.mandatoryAttendees?.includes(attendee)
      )
    );

    return {
      hasConflicts: hasAttendeeConflicts,
      conflictCount: overlappingMeetings.length,
      severity: hasAttendeeConflicts ? 'high' : overlappingMeetings.length > 0 ? 'medium' : 'low'
    };
  };

  const handleAnalyzeMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    timeSlots.push(timeStr);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                Conflict Management
              </h1>
              <p className="text-gray-600 mt-1">
                Identify and resolve scheduling conflicts across all meetings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Calendar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <Select value={timeSlotFilter.startTime} onValueChange={(value) => 
                setTimeSlotFilter(prev => ({ ...prev, startTime: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <Select value={timeSlotFilter.endTime} onValueChange={(value) => 
                setTimeSlotFilter(prev => ({ ...prev, endTime: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full flex items-center gap-2">
                <Search className="h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meetings List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meetings for {selectedDate}
              </CardTitle>
              <CardDescription>
                Click on a meeting to analyze potential conflicts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading meetings...</div>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No meetings scheduled for the selected date and time range.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMeetings.map((meeting: Meeting) => {
                    const conflictStatus = getMeetingConflictStatus(meeting);
                    
                    return (
                      <div
                        key={meeting.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedMeeting?.id === meeting.id ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => handleAnalyzeMeeting(meeting)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                            <div className="text-sm text-gray-600 mt-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {meeting.startTime} - {meeting.endTime}
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {meeting.mandatoryAttendees?.length || 0} attendees
                              </div>
                              <div>
                                <span className="font-medium">Scheduler:</span> {meeting.schedulerName}
                              </div>
                              <div>
                                <Badge variant="outline" className="capitalize">
                                  {meeting.category}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="ml-4">
                            {conflictStatus.hasConflicts ? (
                              <Badge variant="destructive">
                                High Risk
                              </Badge>
                            ) : conflictStatus.conflictCount > 0 ? (
                              <Badge variant="secondary">
                                Potential Risk
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                No Conflicts
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conflict Analysis */}
          <div>
            {selectedMeeting ? (
              <ConflictResolver
                meetingData={{
                  id: selectedMeeting.id,
                  date: selectedMeeting.date,
                  startTime: selectedMeeting.startTime,
                  endTime: selectedMeeting.endTime,
                  mandatoryAttendees: selectedMeeting.mandatoryAttendees || [],
                  brandAttendees: selectedMeeting.brandAttendees || []
                }}
                onResolutionApplied={() => {
                  setSelectedMeeting(null);
                }}
                autoAnalyze={true}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Meeting to Analyze
                  </h3>
                  <p className="text-gray-600">
                    Choose a meeting from the list to analyze potential conflicts and get resolution suggestions.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Meetings</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredMeetings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Potential Conflicts</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredMeetings.filter(m => getMeetingConflictStatus(m).hasConflicts).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredMeetings.reduce((sum, m) => sum + (m.mandatoryAttendees?.length || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}