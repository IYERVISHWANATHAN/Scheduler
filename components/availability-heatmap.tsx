import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, startOfMonth, endOfMonth, isToday, isSameDay } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Meeting } from "@shared/schema";
import { cn } from "@/lib/utils";

interface AvailabilityData {
  date: string;
  hour: number;
  availability: number; // 0-100 percentage
  meetingCount: number;
  conflictLevel: 'none' | 'low' | 'medium' | 'high';
  recommendedFor: string[];
}

interface HeatmapProps {
  onTimeSlotSelect?: (date: string, hour: number) => void;
  selectedCategories?: string[];
}

export function AvailabilityHeatmap({ onTimeSlotSelect, selectedCategories = [] }: HeatmapProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedAttendee, setSelectedAttendee] = useState<string>('all');

  const { data: meetings = [] } = useQuery({
    queryKey: ['/api/meetings'],
  });

  const { data: attendeeAvailability = [] } = useQuery({
    queryKey: ['/api/attendees/availability', selectedAttendee],
    enabled: selectedAttendee !== 'all'
  });

  // Generate availability data based on meetings and conflicts
  const heatmapData = useMemo(() => {
    const data: AvailabilityData[] = [];
    const startDate = viewMode === 'week' 
      ? startOfWeek(currentWeek, { weekStartsOn: 0 })
      : startOfMonth(currentWeek);
    const endDate = viewMode === 'week' 
      ? addDays(startDate, 6)
      : endOfMonth(currentWeek);
    
    let currentDate = startDate;
    while (currentDate <= endDate) {
      // For each hour from 8 AM to 8 PM
      for (let hour = 8; hour <= 20; hour++) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayMeetings = (meetings as Meeting[]).filter(meeting => 
          meeting.date === dateStr &&
          parseInt(meeting.startTime.split(':')[0]) <= hour &&
          parseInt(meeting.endTime.split(':')[0]) > hour
        );

        // Calculate availability based on meeting density and conflicts
        const meetingCount = dayMeetings.length;
        const maxConcurrentMeetings = Math.max(1, Math.ceil(dayMeetings.length / 2));
        const availability = Math.max(0, 100 - (meetingCount * 25));
        
        // Determine conflict level
        let conflictLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
        if (meetingCount === 0) conflictLevel = 'none';
        else if (meetingCount <= 1) conflictLevel = 'low';
        else if (meetingCount <= 3) conflictLevel = 'medium';
        else conflictLevel = 'high';

        // Recommend for specific categories based on time and availability
        const recommendedFor: string[] = [];
        if (availability > 75) {
          if (hour >= 9 && hour <= 11) recommendedFor.push('Strategy Meetings');
          if (hour >= 14 && hour <= 16) recommendedFor.push('Client Presentations');
          if (hour >= 16 && hour <= 18) recommendedFor.push('Team Sync');
        } else if (availability > 50) {
          if (hour >= 10 && hour <= 12) recommendedFor.push('Quick Check-ins');
          if (hour >= 15 && hour <= 17) recommendedFor.push('Follow-ups');
        }

        data.push({
          date: dateStr,
          hour,
          availability,
          meetingCount,
          conflictLevel,
          recommendedFor
        });
      }
      currentDate = addDays(currentDate, 1);
    }

    return data;
  }, [meetings, currentWeek, viewMode, selectedCategories]);

  const getHeatmapColor = (availability: number, conflictLevel: string) => {
    if (availability >= 80) return 'bg-green-500';
    if (availability >= 60) return 'bg-green-400';
    if (availability >= 40) return 'bg-yellow-400';
    if (availability >= 20) return 'bg-orange-400';
    return 'bg-red-500';
  };

  const getIntensity = (availability: number) => {
    if (availability >= 80) return 'opacity-90';
    if (availability >= 60) return 'opacity-75';
    if (availability >= 40) return 'opacity-60';
    if (availability >= 20) return 'opacity-45';
    return 'opacity-30';
  };

  const handlePreviousPeriod = () => {
    if (viewMode === 'week') {
      setCurrentWeek(prev => addWeeks(prev, -1));
    } else {
      setCurrentWeek(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentWeek(prev => addWeeks(prev, 1));
    } else {
      setCurrentWeek(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const uniqueDates = [...new Set(heatmapData.map(item => item.date))];
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Meeting Availability Heatmap
              </CardTitle>
              <CardDescription>
                Visual representation of meeting density and optimal scheduling times
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week View</SelectItem>
                  <SelectItem value="month">Month View</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handlePreviousPeriod}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Legend */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Availability:</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-xs">High (80%+)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                    <span className="text-xs">Medium (40-79%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span className="text-xs">Low (0-39%)</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {viewMode === 'week' 
                  ? format(currentWeek, 'MMM d, yyyy')
                  : format(currentWeek, 'MMMM yyyy')
                }
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <div className="grid gap-1" style={{ 
                gridTemplateColumns: `80px repeat(${uniqueDates.length}, minmax(60px, 1fr))` 
              }}>
                {/* Header Row */}
                <div className="p-2"></div>
                {uniqueDates.map(date => (
                  <div key={date} className="text-center p-2 text-xs font-medium">
                    <div>{format(new Date(date), 'EEE')}</div>
                    <div className={cn(
                      "font-bold",
                      isToday(new Date(date)) && "text-blue-600"
                    )}>
                      {format(new Date(date), 'd')}
                    </div>
                  </div>
                ))}

                {/* Time slots */}
                {hours.map(hour => (
                  <div key={hour} className="contents">
                    <div className="p-2 text-xs font-medium text-right">
                      {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </div>
                    {uniqueDates.map(date => {
                      const cellData = heatmapData.find(item => 
                        item.date === date && item.hour === hour
                      );
                      
                      if (!cellData) return <div key={`${date}-${hour}`} className="p-1" />;

                      return (
                        <Tooltip key={`${date}-${hour}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "p-1 m-0.5 rounded cursor-pointer transition-all hover:scale-110 border",
                                getHeatmapColor(cellData.availability, cellData.conflictLevel),
                                getIntensity(cellData.availability),
                                "hover:opacity-100"
                              )}
                              style={{ minHeight: '20px' }}
                              onClick={() => onTimeSlotSelect?.(date, hour)}
                            >
                              <div className="w-full h-full min-h-[16px]" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-2">
                              <div className="font-medium">
                                {format(new Date(date), 'MMM d, yyyy')} at {hour}:00
                              </div>
                              <div className="space-y-1 text-sm">
                                <div>Availability: {cellData.availability}%</div>
                                <div>Active meetings: {cellData.meetingCount}</div>
                                <div>Conflict level: {cellData.conflictLevel}</div>
                                {cellData.recommendedFor.length > 0 && (
                                  <div>
                                    <div className="font-medium">Recommended for:</div>
                                    {cellData.recommendedFor.map(rec => (
                                      <Badge key={rec} variant="secondary" className="mr-1 text-xs">
                                        {rec}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Best Time Slots</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {heatmapData
                      .filter(item => item.availability >= 80)
                      .slice(0, 3)
                      .map(item => (
                        <div key={`${item.date}-${item.hour}`} className="text-xs text-gray-600">
                          {format(new Date(item.date), 'MMM d')} at {item.hour}:00 ({item.availability}%)
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Busiest Periods</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {heatmapData
                      .filter(item => item.meetingCount > 0)
                      .sort((a, b) => b.meetingCount - a.meetingCount)
                      .slice(0, 3)
                      .map(item => (
                        <div key={`${item.date}-${item.hour}`} className="text-xs text-gray-600">
                          {format(new Date(item.date), 'MMM d')} at {item.hour}:00 ({item.meetingCount} meetings)
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Recommendations</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {['Morning slots (9-11 AM) ideal for strategy',
                     'Afternoon (2-4 PM) best for presentations',
                     'Late afternoon (4-6 PM) good for team sync'
                    ].map((rec, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        {rec}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}