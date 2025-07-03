import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday, parse } from 'date-fns';
import { ArrowLeft, Calendar, Clock, Users, Printer, ChevronLeft, ChevronRight, Tag, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { MeetingDetailsModal } from '@/components/meeting-details-modal';
import { printMeetingSummary } from '@/lib/meeting-summary';

interface Meeting {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  location: string;
  status: string;
  schedulerName: string;
  ddfsAttendees: string[];
  brandAttendees: string[];
  mandatoryDdfsAttendees: string[];
  mandatoryBrandAttendees: string[];
  mandatoryAttendees: string[];
}

export default function DailySchedulePage() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [useCustomDates, setUseCustomDates] = useState(true);

  // Get default start date from Date Settings Database
  const { data: dateSettings } = useQuery({
    queryKey: ['/api/date-settings'],
    enabled: !!user,
  });

  // Initialize custom dates when date settings are loaded
  useEffect(() => {
    if (dateSettings?.defaultStartDate && !customStartDate) {
      setCustomStartDate(dateSettings.defaultStartDate);
      // Set end date to 7 days after start date by default
      const defaultStart = new Date(dateSettings.defaultStartDate);
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setDate(defaultEnd.getDate() + 6);
      setCustomEndDate(format(defaultEnd, 'yyyy-MM-dd'));
    }
  }, [dateSettings, customStartDate]);

  const startDate = useCustomDates && customStartDate ? 
    (isValidDate(customStartDate) ? new Date(customStartDate) : currentWeekStart) : currentWeekStart;
  const endDate = useCustomDates && customEndDate ? 
    (isValidDate(customEndDate) ? new Date(customEndDate) : endOfWeek(currentWeekStart, { weekStartsOn: 0 })) : endOfWeek(currentWeekStart, { weekStartsOn: 0 });

  // Helper function to validate date strings
  function isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['/api/meetings', { 
      startDate: format(startDate, 'yyyy-MM-dd'), 
      endDate: format(endDate, 'yyyy-MM-dd') 
    }],
    enabled: !!user,
  }) as { data: Meeting[], isLoading: boolean };

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: !!user,
  }) as { data: any[] };

  const weekMeetings = (startDate && endDate) ? (meetings as Meeting[]).filter((meeting: Meeting) => {
    const meetingDate = new Date(meeting.date);
    return meetingDate >= startDate && meetingDate <= endDate;
  }).sort((a: Meeting, b: Meeting) => {
    if (a.date !== b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return a.startTime.localeCompare(b.startTime);
  }) : [];

  const getAttendeesList = (meeting: Meeting) => {
    const ddfsAttendees = meeting.ddfsAttendees || [];
    const brandAttendees = meeting.brandAttendees || [];
    return [...ddfsAttendees, ...brandAttendees];
  };

  const getMeetingColor = (category: string) => {
    const categoryData = categories.find((cat: any) => cat.key === category);
    return categoryData?.color || '#6B7280';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const handlePrintWeeklySummary = () => {
    printMeetingSummary({
      startDate,
      endDate,
      meetings: weekMeetings,
      title: 'Weekly Meeting Summary',
      categories
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Calendar
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Meeting Summary Page</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {useCustomDates && customStartDate && customEndDate && isValidDate(customStartDate) && isValidDate(customEndDate) ? 
                    `${format(new Date(customStartDate + 'T00:00:00'), 'MMM d')} - ${format(new Date(customEndDate + 'T00:00:00'), 'MMM d, yyyy')}` :
                    `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
                  }
                </p>
              </div>
            </div>
            {user?.role !== 'guest' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintWeeklySummary}
                className="flex items-center gap-2 bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Print Summary
              </Button>
            )}
          </div>

          {/* Date Range Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useCustomDates"
                  checked={useCustomDates}
                  onChange={(e) => setUseCustomDates(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useCustomDates" className="text-sm font-medium text-gray-700">
                  Use Custom Date Range
                </label>
              </div>
              
              {useCustomDates ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Start Date:
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      End Date:
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Week View: {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!useCustomDates && (
            <div className="flex items-center justify-center mb-4 gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous Week
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentWeek}
              >
                Current Week
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
              >
                Next Week
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{weekMeetings.length} meeting{weekMeetings.length !== 1 ? 's' : ''} this week</span>
            </div>
            
            {weekMeetings.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {new Set(weekMeetings.map((m: any) => getAttendeesList(m)).flat()).size} total attendees
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <span>
                    {new Set(weekMeetings.map((m: any) => m.category)).size} categories
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Meetings List */}
        <div className="space-y-6">
          {weekMeetings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No meetings scheduled
                </h3>
                <p className="text-gray-500">
                  No meetings scheduled for the week of {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                </p>
              </CardContent>
            </Card>
          ) : (
            // Group meetings by date
            Array.from(new Set(weekMeetings.map((m: any) => m.date))).sort().map(date => {
              const dayMeetings = weekMeetings.filter((m: any) => m.date === date);
              return (
                <Card key={date}>
                  <div className="border-b border-gray-200 px-6 py-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {dayMeetings.length} meeting{dayMeetings.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {dayMeetings.map((meeting: any, index: number) => {
                        const attendees = getAttendeesList(meeting);
                        const canViewDetails = user?.role !== 'guest';
                        
                        return (
                          <div 
                            key={meeting.id}
                            className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => canViewDetails && setSelectedMeeting(meeting)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-4 h-16 rounded-md flex-shrink-0"
                                  style={{ backgroundColor: getMeetingColor(meeting.category) }}
                                />
                                
                                <div>
                                  <h4 className="text-lg font-semibold">
                                    {canViewDetails ? meeting.title : 'Blocked Time'}
                                  </h4>
                                  
                                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      <span>{formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}</span>
                                    </div>
                                    
                                    {canViewDetails && (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <Tag className="h-4 w-4" />
                                          <span className="capitalize">{meeting.category}</span>
                                        </div>
                                        
                                        {meeting.location && (
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-4 w-4" />
                                            <span>{meeting.location}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {canViewDetails && attendees.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-600">
                                    {attendees.length} attendee{attendees.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {canViewDetails && attendees.length > 0 && (
                              <div className="mt-4">
                                <div className="flex flex-wrap gap-2">
                                  {attendees.slice(0, 8).map((attendee, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="secondary" 
                                      className="text-xs"
                                    >
                                      {attendee}
                                    </Badge>
                                  ))}
                                  
                                  {attendees.length > 8 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{attendees.length - 8} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Navigation Footer */}
        {weekMeetings.length > 0 && (
          <div className="mt-8 p-4 bg-white rounded-lg border">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                Week of {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              </div>
              
              <div className="flex items-center gap-4">
                <span>
                  Total duration: {(() => {
                    const totalMinutes = weekMeetings.reduce((acc: number, meeting: any) => {
                      const start = new Date(`2000-01-01T${meeting.startTime}:00`);
                      const end = new Date(`2000-01-01T${meeting.endTime}:00`);
                      return acc + (end.getTime() - start.getTime()) / (1000 * 60);
                    }, 0);
                    
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    
                    return hours > 0 
                      ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
                      : `${minutes}m`;
                  })()}
                </span>
                
                <span>
                  Categories: {Array.from(new Set(weekMeetings.map((m: any) => m.category))).join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <MeetingDetailsModal
          meeting={selectedMeeting}
          isOpen={!!selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  );
}