import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { Calendar, Plus, Download, Upload, ChevronLeft, ChevronRight, Grid3X3, User, LogOut, Settings, TrendingUp, FolderOpen, Link2, ExternalLink, CalendarDays, Lock, AlertTriangle, FileText, Eye, EyeOff, HelpCircle, Tags, Printer, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NewWeekView } from "@/components/new-week-view";
import { NewDayView } from "@/components/new-day-view";
import { CalendarView } from "@/components/calendar-view";
import { ModernMeetingForm } from "@/components/modern-meeting-form";
import { CalendarIntegration } from "@/components/calendar-integration";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { VoiceInput } from "@/components/voice-input";
import { WabiSabiLayout, WabiSabiCard, WabiSabiButton, WabiSabiInput, WabiSabiBadge } from "@/components/wabi-sabi-layout";
import { formatDate, getCategoryColor } from "@/lib/utils";
import { printCalendar } from "@/lib/print-calendar";
import { printMeetingSummary } from "@/lib/meeting-summary";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useLocation } from "wouter";
import { useDateStore } from "@/hooks/use-date-store";
import type { Meeting, DdfsAttendee } from "@shared/schema";


export default function WeekPage() {
  const { defaultDate } = useDateStore();
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [userHasChangedDate, setUserHasChangedDate] = useState(false);

  // Only update selected date from store if user hasn't manually changed it
  useEffect(() => {
    if (!userHasChangedDate) {
      setSelectedDate(defaultDate);
    }
  }, [defaultDate, userHasChangedDate]);
  // Start with day view on mobile, week view on desktop
  const [viewMode, setViewMode] = useState<'week' | 'day'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'day';
    }
    return 'week';
  });
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showCalendarIntegration, setShowCalendarIntegration] = useState(false);
  const [selectedMeetingForCalendar, setSelectedMeetingForCalendar] = useState<Meeting | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [voiceFormData, setVoiceFormData] = useState<any>(null);
  const [zenMode, setZenMode] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined);
  const [schedulingContext, setSchedulingContext] = useState<{date: string, startTime: string, endTime: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions, logout } = useAuth();
  const { restartOnboarding } = useOnboarding();
  const [, setLocation] = useLocation();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  
  // Fetch meetings for the entire week
  const { data: allMeetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
    enabled: true
  });

  const { data: ddfsAttendees = [] } = useQuery<DdfsAttendee[]>({
    queryKey: ['/api/ddfs-attendees'],
  });

  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<any[]>({
    queryKey: ['/api/categories'],
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
    onSuccess: (data) => {
      console.log('Categories query onSuccess:', data);
    },
    onError: (error) => {
      console.error('Categories query error:', error);
    }
  });

  // Debug log categories data in the component
  console.log('Categories data in WeekPage:', categoriesData, 'length:', categoriesData?.length);

  // Handle custom event from time slot clicks
  useEffect(() => {
    const handleOpenScheduleForm = (event: CustomEvent) => {
      const context = event.detail;
      if (context && permissions?.canSchedule) {
        setSchedulingContext(context);
        setEditingMeeting(null);
        setShowMeetingForm(true);
      }
    };

    const handleMeetingUpdated = () => {
      // Invalidate meetings cache to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
    };

    window.addEventListener('openScheduleForm', handleOpenScheduleForm as EventListener);
    window.addEventListener('meetingUpdated', handleMeetingUpdated as EventListener);
    return () => {
      window.removeEventListener('openScheduleForm', handleOpenScheduleForm as EventListener);
      window.removeEventListener('meetingUpdated', handleMeetingUpdated as EventListener);
    };
  }, [permissions, queryClient]);

  // Filter meetings for the current week
  const weekMeetings = allMeetings.filter((meeting: Meeting) => {
    const meetingDate = new Date(meeting.date);
    return meetingDate >= weekStart && meetingDate <= weekEnd;
  });

  const handlePreviousWeek = () => {
    const newDate = viewMode === 'day' ? subDays(selectedDate, 1) : subWeeks(selectedDate, 1);
    setSelectedDate(newDate);
    setUserHasChangedDate(true);
  };

  const handleNextWeek = () => {
    const newDate = viewMode === 'day' ? addDays(selectedDate, 1) : addWeeks(selectedDate, 1);
    setSelectedDate(newDate);
    setUserHasChangedDate(true);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
    setUserHasChangedDate(true);
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value + 'T12:00:00'); // Add time to avoid timezone issues
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
      setUserHasChangedDate(true);
    }
  };

  const handleScheduleMeeting = () => {
    if (!permissions?.canSchedule && user?.role !== 'guest' && user?.role !== 'vendor') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to schedule meetings",
        variant: "destructive"
      });
      return;
    }
    
    setEditingMeeting(null);
    setShowMeetingForm(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    if (!permissions?.canEdit) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to edit meetings",
        variant: "destructive"
      });
      return;
    }

    // Check if user has access to this meeting's category
    if (!permissions?.categories?.includes(meeting.category)) {
      toast({
        title: "Access Denied",
        description: `You don't have permission to edit ${meeting.category} meetings`,
        variant: "destructive"
      });
      return;
    }

    setEditingMeeting(meeting);
    setShowMeetingForm(true);
  };

  const handleMeetingSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/import/excel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/export/excel');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'calendar.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({
          title: "Success",
          description: "Calendar exported as Excel file"
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export Excel file",
        variant: "destructive"
      });
    }
  };

  const handleExportICal = async () => {
    try {
      const response = await fetch('/api/export/ical');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'calendar.ics';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({
          title: "Success",
          description: "Calendar exported as iCal file"
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export iCal file",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  // Print Calendar handlers
  const handlePrintWeek = () => {
    printCalendar({
      type: 'week',
      date: selectedDate,
      meetings: weekMeetings,
      title: `Week Schedule - ${format(weekStart, 'MMMM dd')} to ${format(weekEnd, 'MMMM dd, yyyy')}`
    });
  };

  const handlePrintDay = () => {
    printCalendar({
      type: 'day',
      date: selectedDate,
      meetings: weekMeetings,
      title: `Daily Schedule - ${format(selectedDate, 'EEEE, MMMM dd, yyyy')}`
    });
  };

  const handlePrintMeetingList = () => {
    printCalendar({
      type: 'meeting-list',
      date: selectedDate,
      meetings: allMeetings, // Use all meetings instead of just week meetings
      title: `Complete Meeting List - All Scheduled Meetings`
    });
  };

  // One-Click Meeting Summary Generator
  const handleGenerateMeetingSummary = () => {
    printMeetingSummary({
      meetings: weekMeetings,
      title: `Meeting Summary Report - Week of ${format(weekStart, 'MMMM dd')} to ${format(weekEnd, 'MMMM dd, yyyy')}`,
      dateRange: {
        start: weekStart,
        end: weekEnd
      },
      includeAnalytics: true
    });
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setUserHasChangedDate(true);
    setViewMode('day');
  };

  const handleTimeSlotClick = (date: string, time: string) => {
    if (!permissions?.canSchedule) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to schedule meetings",
        variant: "destructive"
      });
      return;
    }
    
    const endTime = new Date(`1970-01-01T${time}:00`);
    endTime.setMinutes(endTime.getMinutes() + 30); // Default 30-minute duration
    const endTimeString = endTime.toTimeString().slice(0, 5);
    
    setSchedulingContext({
      date,
      startTime: time,
      endTime: endTimeString
    });
    setEditingMeeting(null);
    setShowMeetingForm(true);
  };

  const handleVoiceTranscript = (transcript: string) => {
    console.log('Voice transcript:', transcript);
  };

  const handleVoiceCommand = (command: any) => {
    console.log('Voice command:', command);
    
    // Parse voice command and open meeting form with pre-filled data
    const formData: any = {};
    
    if (command.title) {
      formData.title = command.title;
    }
    
    if (command.date) {
      // Parse date from voice command
      const today = new Date();
      if (command.date === 'today') {
        formData.date = today;
      } else if (command.date === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        formData.date = tomorrow;
      } else if (command.date.startsWith('next ')) {
        // Handle "next monday", "next tuesday", etc.
        const dayName = command.date.replace('next ', '');
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayName);
        if (dayIndex !== -1) {
          const nextDay = new Date(today);
          const daysUntilNext = (dayIndex + 7 - today.getDay()) % 7 || 7;
          nextDay.setDate(today.getDate() + daysUntilNext);
          formData.date = nextDay;
        }
      } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(command.date)) {
        // Handle this week's day
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(command.date);
        const targetDay = new Date(today);
        const daysUntil = (dayIndex - today.getDay() + 7) % 7;
        targetDay.setDate(today.getDate() + (daysUntil || 7));
        formData.date = targetDay;
      } else if (command.date.includes('of september') || command.date.includes('september')) {
        // Handle "28th of September" or "September 28th"
        const dayMatch = command.date.match(/(\d{1,2})(?:st|nd|rd|th)?/);
        if (dayMatch) {
          const day = parseInt(dayMatch[1]);
          const targetDate = new Date(2025, 8, day); // September is month 8 (0-indexed)
          formData.date = targetDate;
        }
      }
    }
    
    const convertTimeToFormat = (timeStr: string) => {
      let time = timeStr.toLowerCase().trim();
      
      if (time.includes('pm') || time.includes('p.m.')) {
        time = time.replace(/\s*p\.?m\.?/g, '');
        const [hours, minutes = '00'] = time.split(':');
        let hour = parseInt(hours);
        if (hour !== 12) hour += 12;
        return `${hour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      } else if (time.includes('am') || time.includes('a.m.')) {
        time = time.replace(/\s*a\.?m\.?/g, '');
        const [hours, minutes = '00'] = time.split(':');
        let hour = parseInt(hours);
        if (hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      } else {
        // No AM/PM specified, assume 24-hour format or add best guess
        const [hours, minutes = '00'] = time.split(':');
        const hour = parseInt(hours);
        if (hour >= 1 && hour <= 12) {
          // Assume business hours (9 AM - 6 PM)
          const adjustedHour = hour < 8 ? hour + 12 : hour;
          return `${adjustedHour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        } else {
          return `${hour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        }
      }
    };

    if (command.time) {
      formData.startTime = convertTimeToFormat(command.time);
    }
    
    if (command.endTime) {
      formData.endTime = convertTimeToFormat(command.endTime);
    } else if (formData.startTime) {
      // Set end time (default to 1 hour later)
      const [hours, minutes] = formData.startTime.split(':');
      const startHour = parseInt(hours);
      const startMinute = parseInt(minutes);
      const endHour = startHour + 1;
      formData.endTime = `${endHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    }
    
    if (command.location) {
      formData.location = command.location;
    }
    
    if (command.category) {
      formData.category = command.category;
    }
    
    // Set voice form data and open meeting form
    setVoiceFormData(formData);
    setShowMeetingForm(true);
    
    const details = [];
    if (command.title) details.push(`"${command.title}"`);
    if (command.date) details.push(`on ${command.date}`);
    if (command.time) details.push(`at ${command.time}`);
    if (command.location) details.push(`in ${command.location}`);
    
    toast({
      title: "Voice Command Recognized",
      description: `Creating meeting${details.length > 0 ? ` ${details.join(' ')}` : ''}`
    });
  };

  return (
    <div className={`min-h-screen ${zenMode ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Header - Hidden in zen mode */}
      {!zenMode && (
        <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="py-3 sm:py-4">
            {/* App Title Row - Optimized for mobile */}
            <div className="flex justify-center items-center mb-2 sm:mb-3">
              <div className="flex items-center">
                <Calendar className="text-blue-600 text-lg sm:text-2xl lg:text-3xl mr-2 sm:mr-3" />
                <h1 className="text-lg sm:text-2xl lg:text-4xl font-bold text-gray-900">Meeting Scheduler</h1>
              </div>
            </div>
            
            {/* Action Row */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 sm:space-x-4">
                {(permissions?.canSchedule || user?.role === 'guest' || user?.role === 'vendor') && (
                  <>
                    <Button 
                      onClick={handleScheduleMeeting}
                      className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm px-2 sm:px-4"
                    >
                      <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Schedule Meeting</span>
                      <span className="sm:hidden">Add Meeting</span>
                    </Button>
                    {/* Voice input only available on mobile */}
                    {user?.role !== 'guest' && (
                      <div className="sm:hidden flex items-center space-x-2">
                        <VoiceInput 
                          onTranscript={handleVoiceTranscript}
                          onVoiceCommand={handleVoiceCommand}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </>
                )}
                {user?.role !== 'vendor' && user?.role !== 'guest' && (
                  <div className="hidden sm:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          disabled={importMutation.isPending}
                          className="text-sm px-4"
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          File Management
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {permissions?.canSchedule && (
                          <>
                            <DropdownMenuItem onClick={handleImportClick}>
                              <Upload className="mr-2 h-4 w-4" />
                              Import Excel File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open('/api/template/excel', '_blank')}>
                              <Download className="mr-2 h-4 w-4" />
                              Download Template
                            </DropdownMenuItem>
                            <div className="border-t my-1"></div>
                          </>
                        )}
                        <DropdownMenuItem onClick={handleExportExcel}>
                          <i className="fas fa-file-excel mr-2 text-green-600"></i>
                          Export as Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportICal}>
                          <i className="fas fa-calendar mr-2 text-blue-600"></i>
                          Export as iCal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                <div className="hidden sm:block">
                  <ThemeToggle />
                </div>
              </div>
              
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="text-xs sm:text-sm px-2 sm:px-4">
                      <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="truncate max-w-24 sm:max-w-none">{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user?.role === 'guest' ? (
                    // Guest users only see logout option
                    <>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => setZenMode(!zenMode)}>
                        {zenMode ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                        {zenMode ? "Exit Zen Mode" : "Enter Zen Mode"}
                      </DropdownMenuItem>
                      
                      {user?.role !== 'vendor' && (
                        <DropdownMenuItem onClick={() => setLocation('/analytics')}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Analytics & Reports
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setLocation('/date-settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Date Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation('/daily-schedule')}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Meeting Summary
                      </DropdownMenuItem>
                      {user?.role !== 'vendor' && (
                        <DropdownMenuItem onClick={() => setLocation('/conflicts')}>
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Conflict Resolver
                        </DropdownMenuItem>
                      )}
                      {user?.role !== 'vendor' && (
                        <DropdownMenuItem onClick={() => {
                          if (allMeetings && allMeetings.length > 0) {
                            setSelectedMeetingForCalendar(allMeetings[0]);
                            setShowCalendarIntegration(true);
                          } else {
                            toast({
                              title: "No meetings found",
                              description: "Create a meeting first to use calendar integration.",
                              variant: "destructive"
                            });
                          }
                        }}>
                          <Link2 className="mr-2 h-4 w-4" />
                          Calendar Integration
                        </DropdownMenuItem>
                      )}
                      
                      {/* File Management for Mobile - Only show on small screens */}
                      {user?.role !== 'vendor' && (
                        <div className="sm:hidden">
                          <div className="border-t my-1"></div>
                          {permissions?.canSchedule && (
                            <>
                              <DropdownMenuItem onClick={handleImportClick}>
                                <Upload className="mr-2 h-4 w-4" />
                                Import Excel File
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open('/api/template/excel', '_blank')}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={handleExportExcel}>
                            <i className="fas fa-file-excel mr-2 text-green-600"></i>
                            Export as Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportICal}>
                            <i className="fas fa-calendar mr-2 text-blue-600"></i>
                            Export as iCal
                          </DropdownMenuItem>
                          <div className="border-t my-1"></div>
                        </div>
                      )}
                      {user?.role !== 'vendor' && (
                        <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                          <Lock className="mr-2 h-4 w-4" />
                          Change Password
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem onClick={() => restartOnboarding()}>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        App Walkthrough
                      </DropdownMenuItem>

                      {user?.role === 'admin' && (
                        <>
                          <DropdownMenuItem onClick={() => setLocation('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            User Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation('/categories')}>
                            <Tags className="mr-2 h-4 w-4" />
                            Manage Categories
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation('/change-logs')}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Change Logs
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        </header>
      )}

      {/* Category Legend - Hidden in zen mode */}
      {!zenMode && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-3">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Category Legend</h3>
              <div className="flex flex-wrap gap-4">
                {categoriesData
                  .filter(category => category.isActive)
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map(category => (
                  <div key={category.key} className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm text-gray-600">{category.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation - Hidden in zen mode */}
      {!zenMode && (
        <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 space-y-3 sm:space-y-0">
            <div className="flex items-center justify-between sm:justify-start sm:space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handlePreviousWeek}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center sm:text-left px-2">
                {viewMode === 'week' ? (
                  <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                    {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                  </h2>
                ) : (
                  <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                    {formatDate(selectedDate)}
                  </h2>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleNextWeek}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center sm:justify-end space-x-2">
              <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">Go to week:</span>
              <div className="flex items-center space-x-1">
                <Input 
                  type="date" 
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={handleDateChange}
                  className="w-32 sm:w-auto text-xs sm:text-sm"
                  title="Select a date to jump to that week"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 sm:w-9 sm:h-9 p-0"
                      title="Open calendar picker"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setUserHasChangedDate(true);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 pt-3 sm:pt-0">
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              Week
            </Button>
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Day
            </Button>
            <Button 
              variant="outline"
              onClick={handleGoToToday}
              className="text-blue-600 hover:text-blue-700"
            >
              Today
            </Button>
          </div>
        </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading calendar...</div>
          </div>
        ) : (viewMode === 'week') ? (
          <NewWeekView 
            meetings={weekMeetings}
            selectedDate={selectedDate}
            onEditMeeting={handleEditMeeting}
            onSelectDate={handleSelectDate}
            onTimeSlotClick={handleTimeSlotClick}
            userRole={user?.role}
            canViewDetails={user?.role !== 'guest' && permissions?.canView !== false}
            categories={categoriesData}
            ddfsAttendees={ddfsAttendees}
          />
        ) : (
          <>
            {(() => {
              const filteredMeetings = allMeetings.filter(meeting => meeting.date === format(selectedDate, 'yyyy-MM-dd'));
              
              return (
                <NewDayView 
                  meetings={filteredMeetings}
                  selectedDate={selectedDate}
                  onEditMeeting={handleEditMeeting}
                  onTimeSlotClick={(date: string, time: string) => {
                    const context = { date, startTime: time, endTime: time };
                    setSchedulingContext(context);
                    setEditingMeeting(null);
                    setShowMeetingForm(true);
                  }}
                  userRole={user?.role}
                  canViewDetails={user?.role !== 'guest' && permissions?.canView !== false}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Meeting Form Modal - Only render when categories are loaded */}
      {(permissions?.canSchedule || user?.role === 'guest' || user?.role === 'vendor') && categoriesData.length > 0 && (
        <ModernMeetingForm 
          open={showMeetingForm}
          onClose={() => {
            setShowMeetingForm(false);
            setVoiceFormData(null);
            setSchedulingContext(null);
          }}
          onSuccess={() => {
            handleMeetingSuccess();
            setVoiceFormData(null);
            setSchedulingContext(null);
          }}
          selectedDate={schedulingContext ? new Date(schedulingContext.date) : selectedDate}
          selectedTime={schedulingContext?.startTime || selectedTime}
          categories={categoriesData}
          ddfsAttendees={ddfsAttendees}
          editingMeeting={editingMeeting}
          schedulingContext={schedulingContext}
        />
      )}
      {console.log('Passing categories to form:', categoriesData, 'show form:', showMeetingForm, 'categories loaded:', categoriesData.length > 0)}

      {/* Calendar Integration Dialog */}
      {showCalendarIntegration && selectedMeetingForCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <CalendarIntegration 
            meeting={selectedMeetingForCalendar}
            onClose={() => {
              setShowCalendarIntegration(false);
              setSelectedMeetingForCalendar(null);
            }}
          />
        </div>
      )}

      {/* Change Password Dialog */}
      <ChangePasswordDialog 
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Zen Mode Exit Button */}
      {zenMode && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setZenMode(false)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            size="lg"
          >
            <EyeOff className="h-5 w-5 mr-2" />
            Exit Zen Mode
          </Button>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}