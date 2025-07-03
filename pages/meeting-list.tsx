import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { Calendar, Clock, MapPin, Users, Filter, ChevronLeft, ChevronRight, X, CalendarDays, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Meeting, DdfsAttendee, CATEGORY_COLORS } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { useDateStore } from '@/hooks/use-date-store';

export default function MeetingList() {
  const { user, permissions } = useAuth();
  const [, setLocation] = useLocation();
  const { defaultDate } = useDateStore();
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [userHasChangedDate, setUserHasChangedDate] = useState(false);

  // Only update selected date from store if user hasn't manually changed it
  useEffect(() => {
    if (!userHasChangedDate) {
      setSelectedDate(defaultDate);
    }
  }, [defaultDate, userHasChangedDate]);
  const [selectedAttendee, setSelectedAttendee] = useState<string>('all');
  const [attendeeType, setAttendeeType] = useState<string>('all'); // mandatory, optional, all
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch meetings
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['/api/meetings'],
  });

  // Fetch DDFS attendees for filtering
  const { data: ddfsAttendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ['/api/ddfs-attendees'],
  });

  // Get week dates starting from Sunday
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter meetings by selected attendee and search term
  const filteredMeetings = useMemo(() => {
    let filtered = meetings.filter((meeting: Meeting) => {
      // Check if user has permission to view this meeting
      if (!permissions?.canView && user?.role !== 'admin' && !permissions?.categories.includes(meeting.category)) {
        return false;
      }

      // Filter by category
      if (selectedCategory !== 'all') {
        if (meeting.category !== selectedCategory) {
          return false;
        }
      }

      // Filter by attendee type (mandatory/optional)
      if (attendeeType !== 'all' && selectedAttendee !== 'all') {
        const isMandatory = meeting.mandatoryAttendees.includes(selectedAttendee);
        const isOptional = meeting.ddfsAttendees.includes(selectedAttendee) && !isMandatory;
        
        if (attendeeType === 'mandatory' && !isMandatory) {
          return false;
        }
        if (attendeeType === 'optional' && !isOptional) {
          return false;
        }
      }

      // Filter by attendee
      if (selectedAttendee !== 'all') {
        if (!meeting.mandatoryAttendees.includes(selectedAttendee) && 
            !meeting.ddfsAttendees.includes(selectedAttendee)) {
          return false;
        }
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          meeting.title.toLowerCase().includes(searchLower) ||
          meeting.schedulerName.toLowerCase().includes(searchLower) ||
          meeting.location.toLowerCase().includes(searchLower) ||
          meeting.mandatoryAttendees.some(attendee => 
            attendee.toLowerCase().includes(searchLower)
          ) ||
          meeting.ddfsAttendees.some(attendee => 
            attendee.toLowerCase().includes(searchLower)
          )
        );
      }

      // Filter by specific date
      if (dateFilter) {
        const meetingDate = new Date(meeting.date);
        const filterDate = new Date(dateFilter);
        if (format(meetingDate, 'yyyy-MM-dd') !== format(filterDate, 'yyyy-MM-dd')) {
          return false;
        }
      }

      return true;
    });

    return filtered;
  }, [meetings, selectedAttendee, attendeeType, selectedCategory, searchTerm, dateFilter, permissions, user]);

  // Group meetings by date
  const meetingsByDate = useMemo(() => {
    const grouped: { [key: string]: Meeting[] } = {};
    
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      grouped[dateStr] = filteredMeetings
        .filter((meeting: Meeting) => meeting.date === dateStr)
        .sort((a: Meeting, b: Meeting) => a.startTime.localeCompare(b.startTime));
    });

    return grouped;
  }, [filteredMeetings, weekDays]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = addDays(selectedDate, direction === 'next' ? 7 : -7);
    setSelectedDate(newDate);
    setUserHasChangedDate(true);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getMeetingDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  const canViewDetails = (meeting: Meeting) => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'vendor') return false;
    return permissions?.categories.includes(meeting.category) || false;
  };

  if (meetingsLoading || attendeesLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Meeting Schedule</h1>
          <p className="text-gray-600 dark:text-gray-400">Day-wise meeting overview with attendee filtering</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLocation('/week')}
          className="flex items-center gap-2 bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm sm:text-base lg:text-lg font-medium px-2 sm:px-4 whitespace-nowrap">
            Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-2 min-w-0 items-start lg:items-center">
          <Input
            placeholder="Search meetings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full lg:w-64"
          />
          
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full lg:w-auto flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="font-medium text-sm">Filter Options</div>
                
                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category">
                        {selectedCategory === 'all' ? 'All Categories' : 
                         selectedCategory === 'liquor' ? 'Liquor' :
                         selectedCategory === 'tobacco' ? 'Tobacco' :
                         selectedCategory === 'pnc' ? 'PNC' :
                         selectedCategory === 'confectionary' ? 'Confectionary' :
                         selectedCategory === 'fashion' ? 'Fashion' : 'Category'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="liquor">Liquor</SelectItem>
                      <SelectItem value="tobacco">Tobacco</SelectItem>
                      <SelectItem value="pnc">PNC</SelectItem>
                      <SelectItem value="confectionary">Confectionary</SelectItem>
                      <SelectItem value="fashion">Fashion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Attendee Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Attendee</label>
                  <Select value={selectedAttendee} onValueChange={setSelectedAttendee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Attendee">
                        {selectedAttendee === 'all' ? 'All Attendees' : selectedAttendee}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendees</SelectItem>
                      {ddfsAttendees.map((attendee: DdfsAttendee) => (
                        <SelectItem key={attendee.id} value={attendee.name}>
                          {attendee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Attendee Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Attendee Type</label>
                  <Select value={attendeeType} onValueChange={setAttendeeType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type">
                        {attendeeType === 'all' ? 'All Types' :
                         attendeeType === 'mandatory' ? 'Mandatory' :
                         attendeeType === 'optional' ? 'Optional' : 'Type'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mandatory">Mandatory</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Specific Date</label>
                  <Input 
                    type="date" 
                    value={dateFilter ? format(dateFilter, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDateFilter(new Date(e.target.value));
                      } else {
                        setDateFilter(null);
                      }
                    }}
                    className="w-full"
                    placeholder="Select date"
                  />
                </div>

                {/* Clear All Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedAttendee('all');
                    setAttendeeType('all');
                    setDateFilter(null);
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Meeting List by Day */}
      <div className="grid gap-6">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayMeetings = meetingsByDate[dateStr] || [];
          
          return (
            <Card key={dateStr} className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {format(day, 'EEEE, MMMM d, yyyy')}
                  <Badge variant="secondary" className="ml-auto">
                    {dayMeetings.length} meeting{dayMeetings.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayMeetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No meetings scheduled for this day
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayMeetings.map((meeting: Meeting) => (
                      <div
                        key={meeting.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                {canViewDetails(meeting) ? meeting.title : 'Meeting Scheduled'}
                              </h3>
                              <Badge 
                                style={{ 
                                  backgroundColor: CATEGORY_COLORS[meeting.category as keyof typeof CATEGORY_COLORS] 
                                }}
                                className="text-white"
                              >
                                {meeting.category}
                              </Badge>
                              <Badge variant={meeting.status === 'confirmed' ? 'default' : 'secondary'}>
                                {meeting.status}
                              </Badge>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                                <span className="text-xs">({getMeetingDuration(meeting.startTime, meeting.endTime)})</span>
                              </div>
                              
                              {canViewDetails(meeting) && meeting.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {meeting.location}
                                </div>
                              )}
                              
                              {canViewDetails(meeting) && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  Organized by {meeting.schedulerName}
                                </div>
                              )}
                            </div>

                            {canViewDetails(meeting) && (meeting.mandatoryAttendees.length > 0 || meeting.ddfsAttendees.length > 0) && (
                              <div className="mt-2">
                                {meeting.mandatoryAttendees.length > 0 && (
                                  <div className="mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Mandatory Attendees: 
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {meeting.mandatoryAttendees.map((attendee, index) => (
                                        <Badge key={index} variant="default" className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                          {attendee}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {meeting.ddfsAttendees.filter(attendee => !meeting.mandatoryAttendees.includes(attendee)).length > 0 && (
                                  <div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Optional Attendees: 
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {meeting.ddfsAttendees
                                        .filter(attendee => !meeting.mandatoryAttendees.includes(attendee))
                                        .map((attendee, index) => (
                                          <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                                            {attendee}
                                          </Badge>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {canViewDetails(meeting) && meeting.brandAttendees.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Brand Attendees: 
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {meeting.brandAttendees.map((attendeeStr, index) => {
                                    try {
                                      const attendee = JSON.parse(attendeeStr);
                                      return (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {attendee.name} ({attendee.designation})
                                        </Badge>
                                      );
                                    } catch {
                                      return (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {attendeeStr}
                                        </Badge>
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}