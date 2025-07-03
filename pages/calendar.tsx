import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { Calendar, Plus, Download, Upload, ChevronLeft, ChevronRight, User, LogOut, Settings, TrendingUp, Grid3X3, FolderOpen, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewDayView } from "@/components/new-day-view";
import { SimpleMeetingForm } from "@/components/simple-meeting-form";
import { formatDate, getCategoryColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useDateStore } from "@/hooks/use-date-store";
import type { Meeting, DdfsAttendee } from "@shared/schema";
import { VoiceInput } from "@/components/voice-input";


export default function CalendarPage() {
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [voiceFormData, setVoiceFormData] = useState<any>(null);
  const [selectedSchedulingDate, setSelectedSchedulingDate] = useState<string>('');
  const [selectedSchedulingTime, setSelectedSchedulingTime] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions } = useAuth();
  const { defaultDate } = useDateStore();
  const [selectedDate, setSelectedDate] = useState(() => {
    return defaultDate ? new Date(defaultDate) : new Date();
  });

  // Update selected date when default date changes
  useEffect(() => {
    if (defaultDate) {
      setSelectedDate(new Date(defaultDate));
    }
  }, [defaultDate]);
  
  const dateString = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  
  const { data: allMeetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings']
  });

  // Filter meetings for selected date in day view
  const meetings = allMeetings.filter((meeting: Meeting) => meeting.date === dateString);
  
  // Debug: Check if we're getting the right date and meetings
  if (allMeetings.length > 0 && dateString.includes('2025-09-28')) {
    console.log(`Calendar Page: Looking for meetings on ${dateString}, found ${meetings.length} meetings`);
  }

  const { data: ddfsAttendees = [] } = useQuery<DdfsAttendee[]>({
    queryKey: ['/api/ddfs-attendees'],
  });

  const { data: categoriesData = [] } = useQuery<any[]>({
    queryKey: ['/api/categories'],
  });

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (inputValue) {
      // Parse the date string correctly to avoid timezone issues
      const [year, month, day] = inputValue.split('-').map(Number);
      const newDate = new Date(year, month - 1, day); // month is 0-indexed
      if (!isNaN(newDate.getTime())) {
        setSelectedDate(newDate);
      }
    }
  };

  const handleScheduleMeeting = () => {
    setEditingMeeting(null);
    setShowMeetingForm(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setShowMeetingForm(true);
  };

  const handleTimeSlotClick = (date: string, time: string) => {
    setSelectedSchedulingDate(date);
    setSelectedSchedulingTime(time);
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

  const handleMeetingSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Calendar className="text-blue-600 text-lg sm:text-2xl mr-2 sm:mr-3" />
              <h1 className="text-sm sm:text-xl font-semibold text-gray-900 truncate">Meeting Scheduler</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">

              {permissions?.canSchedule && (
                <>
                  <Button onClick={handleScheduleMeeting} className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm px-2 sm:px-4">
                    <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Schedule Meeting</span>
                    <span className="sm:hidden">Add Meeting</span>
                  </Button>
                  <VoiceInput 
                    onTranscript={handleVoiceTranscript}
                    onVoiceCommand={handleVoiceCommand}
                    className="text-xs sm:text-sm"
                  />
                </>
              )}
              <div className="hidden sm:flex sm:space-x-2">
                
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-xs sm:text-sm px-2 sm:px-4">
                    <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="truncate max-w-24 sm:max-w-none">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user?.role !== 'vendor' && (
                    <DropdownMenuItem onClick={() => window.location.href = '/meetings'}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Day-wise Meeting List
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.location.href = '/analytics'}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Analytics & Reports
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = '/date-settings'}>
                    <Settings className="mr-2 h-4 w-4" />
                    Date Settings
                  </DropdownMenuItem>
                  
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
                  
                  <DropdownMenuItem onClick={() => window.location.href = '/date-settings'}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Date Settings
                  </DropdownMenuItem>
                  {user?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                      <Settings className="mr-2 h-4 w-4" />
                      User Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.location.href = '/login'}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>



      {/* Category Legend */}
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

      {/* Date Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handlePreviousDay}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {formatDate(selectedDate)}
                </h2>
                <Input 
                  type="date" 
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={handleDateChange}
                  className="w-auto"
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleNextDay}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading calendar...</div>
          </div>
        ) : (
          <NewDayView 
            meetings={meetings}
            selectedDate={selectedDate}
            onEditMeeting={handleEditMeeting}
            onTimeSlotClick={handleTimeSlotClick}
            userRole={user?.role}
            canViewDetails={user?.role !== 'guest' && permissions?.canView !== false}
          />
        )}

      </div>

      {/* Meeting Form Modal */}
      <SimpleMeetingForm 
        open={showMeetingForm}
        onClose={() => {
          setShowMeetingForm(false);
          setVoiceFormData(null);
        }}
        onSuccess={() => {
          handleMeetingSuccess();
          setVoiceFormData(null);
        }}
        selectedDate={selectedDate}
        categories={categoriesData}
        ddfsAttendees={ddfsAttendees}
      />


      
      {/* Hidden file input for Excel import */}
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
