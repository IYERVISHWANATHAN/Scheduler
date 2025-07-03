import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, addMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";
import { Calendar, ChevronLeft, ChevronRight, Download, Filter, TrendingUp, Users, Clock, MapPin, Brain, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { CATEGORY_COLORS } from "@shared/schema";
import type { Meeting } from "@shared/schema";
import { useLocation } from "wouter";

interface AnalyticsData {
  totalMeetings: number;
  totalHours: number;
  averageDuration: number;
  uniqueAttendees: number;
  categoryBreakdown: { category: string; count: number; percentage: number; color: string }[];
  monthlyTrend: { month: string; meetings: number; hours: number }[];
  locationStats: { location: string; count: number; percentage: number }[];
  attendeeStats: { name: string; meetings: number; hours: number }[];
  dailyPattern: { day: string; meetings: number; hours: number }[];
  statusDistribution: { status: string; count: number; percentage: number }[];
  hourlyDistribution: { hour: string; meetings: number; utilization: number }[];
  productivityMetrics: {
    peakHours: string;
    averageAttendeesPerMeeting: number;
    mostPopularLocation: string;
    conflictRate: number;
    cancellationRate: number;
  };
  attendeeEngagement: { name: string; attendance: number; noShows: number; engagement: number }[];
  weeklyComparison: { week: string; meetings: number; hours: number; efficiency: number }[];
}

export default function AnalyticsPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [, setLocation] = useLocation();
  
  const { user, permissions } = useAuth();

  // Only allow access for users with view permissions
  if (!permissions?.canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view analytics.</p>
        </div>
      </div>
    );
  }

  const { data: allMeetings = [], isLoading } = useQuery({
    queryKey: ['/api/meetings'],
    enabled: true
  });

  const analyticsData = useMemo((): AnalyticsData => {
    let filteredMeetings = allMeetings as Meeting[];

    // Filter by date range
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch (timeRange) {
      case 'month':
        startDate = startOfMonth(selectedMonth);
        endDate = endOfMonth(selectedMonth);
        break;
      case 'quarter':
        const quarterStart = new Date(selectedMonth.getFullYear(), Math.floor(selectedMonth.getMonth() / 3) * 3, 1);
        startDate = quarterStart;
        endDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        break;
      case 'year':
        startDate = new Date(selectedMonth.getFullYear(), 0, 1);
        endDate = new Date(selectedMonth.getFullYear(), 11, 31);
        break;
    }

    filteredMeetings = filteredMeetings.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      return meetingDate >= startDate && meetingDate <= endDate;
    });

    // Filter by category if selected
    if (selectedCategory !== 'all') {
      filteredMeetings = filteredMeetings.filter(meeting => meeting.category === selectedCategory);
    }

    // Filter by user permissions
    const userCategories = permissions?.categories || [];
    if (userCategories.length > 0) {
      filteredMeetings = filteredMeetings.filter(meeting => 
        userCategories.includes(meeting.category)
      );
    }

    // Calculate total hours and average duration
    const totalHours = filteredMeetings.reduce((sum, meeting) => {
      const start = new Date(`1970-01-01T${meeting.startTime}`);
      const end = new Date(`1970-01-01T${meeting.endTime}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    const averageDuration = filteredMeetings.length > 0 ? totalHours / filteredMeetings.length : 0;

    // Get unique attendees
    const allAttendees = new Set<string>();
    filteredMeetings.forEach(meeting => {
      meeting.ddfsAttendees.forEach(attendee => allAttendees.add(attendee));
      meeting.brandAttendees.forEach(attendee => allAttendees.add(attendee));
    });

    // Category breakdown
    const categoryMap = new Map<string, number>();
    filteredMeetings.forEach(meeting => {
      categoryMap.set(meeting.category, (categoryMap.get(meeting.category) || 0) + 1);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      count,
      percentage: (count / filteredMeetings.length) * 100,
      color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#8884d8'
    }));

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthMeetings = allMeetings.filter((meeting: Meeting) => {
        const meetingDate = new Date(meeting.date);
        return meetingDate >= monthStart && meetingDate <= monthEnd;
      });

      const monthHours = monthMeetings.reduce((sum, meeting) => {
        const start = new Date(`1970-01-01T${meeting.startTime}`);
        const end = new Date(`1970-01-01T${meeting.endTime}`);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

      monthlyTrend.push({
        month: format(month, 'MMM yyyy'),
        meetings: monthMeetings.length,
        hours: Number(monthHours.toFixed(1))
      });
    }

    // Location statistics
    const locationMap = new Map<string, number>();
    filteredMeetings.forEach(meeting => {
      locationMap.set(meeting.location, (locationMap.get(meeting.location) || 0) + 1);
    });

    const locationStats = Array.from(locationMap.entries())
      .map(([location, count]) => ({
        location,
        count,
        percentage: (count / filteredMeetings.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Attendee statistics
    const attendeeMap = new Map<string, { meetings: number; hours: number }>();
    filteredMeetings.forEach(meeting => {
      const start = new Date(`1970-01-01T${meeting.startTime}`);
      const end = new Date(`1970-01-01T${meeting.endTime}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      [...meeting.ddfsAttendees, ...meeting.brandAttendees].forEach(attendee => {
        const current = attendeeMap.get(attendee) || { meetings: 0, hours: 0 };
        attendeeMap.set(attendee, {
          meetings: current.meetings + 1,
          hours: current.hours + hours
        });
      });
    });

    const attendeeStats = Array.from(attendeeMap.entries())
      .map(([name, stats]) => ({ name, ...stats, hours: Number(stats.hours.toFixed(1)) }))
      .sort((a, b) => b.meetings - a.meetings)
      .slice(0, 10);

    // Daily pattern (day of week)
    const dayMap = new Map<string, { meetings: number; hours: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    filteredMeetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);
      const dayName = dayNames[meetingDate.getDay()];
      const start = new Date(`1970-01-01T${meeting.startTime}`);
      const end = new Date(`1970-01-01T${meeting.endTime}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      const current = dayMap.get(dayName) || { meetings: 0, hours: 0 };
      dayMap.set(dayName, {
        meetings: current.meetings + 1,
        hours: current.hours + hours
      });
    });

    const dailyPattern = dayNames.map(day => ({
      day,
      meetings: dayMap.get(day)?.meetings || 0,
      hours: Number((dayMap.get(day)?.hours || 0).toFixed(1))
    }));

    // Status distribution
    const statusMap = new Map<string, number>();
    filteredMeetings.forEach(meeting => {
      statusMap.set(meeting.status, (statusMap.get(meeting.status) || 0) + 1);
    });

    const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: (count / filteredMeetings.length) * 100
    }));

    // Calculate hourly distribution
    const hourlyMap = new Map<string, number>();
    filteredMeetings.forEach(meeting => {
      const hour = meeting.startTime.split(':')[0] + ':00';
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });

    const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, meetings]) => ({
      hour,
      meetings,
      utilization: (meetings / Math.max(filteredMeetings.length, 1)) * 100
    }));

    // Find peak hours
    const peakHour = hourlyDistribution.reduce((max, current) => 
      current.meetings > max.meetings ? current : max, 
      { hour: "09:00", meetings: 0 }
    );

    // Calculate conflict rate
    const conflictCount = filteredMeetings.filter(meeting => 
      filteredMeetings.some(other => 
        other.id !== meeting.id &&
        other.date === meeting.date &&
        other.mandatoryAttendees.some(attendee => meeting.mandatoryAttendees.includes(attendee))
      )
    ).length;

    const conflictRate = filteredMeetings.length > 0 ? conflictCount / filteredMeetings.length : 0;

    // Calculate productivity metrics
    const productivityMetrics = {
      peakHours: `${peakHour.hour}-${(parseInt(peakHour.hour) + 1).toString().padStart(2, '0')}:00`,
      averageAttendeesPerMeeting: filteredMeetings.length > 0 ? 
        filteredMeetings.reduce((sum, m) => sum + m.mandatoryAttendees.length, 0) / filteredMeetings.length : 0,
      mostPopularLocation: locationStats.length > 0 ? locationStats[0].location : "No data",
      conflictRate
    };

    return {
      totalMeetings: filteredMeetings.length,
      totalHours: Number(totalHours.toFixed(1)),
      averageDuration: Number(averageDuration.toFixed(1)),
      uniqueAttendees: allAttendees.size,
      categoryBreakdown,
      monthlyTrend,
      locationStats,
      attendeeStats,
      dailyPattern,
      statusDistribution,
      hourlyDistribution,
      productivityMetrics,
      attendeeEngagement: attendeeStats,
      weeklyComparison: dailyPattern
    };
  }, [allMeetings, selectedMonth, timeRange, selectedCategory, permissions]);

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/export/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          timeRange,
          selectedMonth: selectedMonth.toISOString(),
          selectedCategory,
          data: analyticsData
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `analytics-report-${format(selectedMonth, 'yyyy-MM')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="text-blue-600 text-2xl mr-3" />
              <h1 className="font-semibold text-gray-900 text-[16px]">Analytics </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setLocation('/')}
                className="px-6 bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
              >
                Close
              </Button>
              <Select value={timeRange} onValueChange={(value: 'month' | 'quarter' | 'year') => setTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {permissions?.categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExportReport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Time Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-4 space-x-4">
            <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-medium text-gray-900 min-w-48 text-center">
              {timeRange === 'month' && format(selectedMonth, 'MMMM yyyy')}
              {timeRange === 'quarter' && `Q${Math.floor(selectedMonth.getMonth() / 3) + 1} ${selectedMonth.getFullYear()}`}
              {timeRange === 'year' && selectedMonth.getFullYear()}
            </h2>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading analytics...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.totalMeetings}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.totalHours}h</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.averageDuration}h</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Attendees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.uniqueAttendees}</div>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI-Powered Workload Analysis
                </CardTitle>
                <CardDescription>
                  Intelligent insights and recommendations for optimizing your meeting schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Peak Productivity Hours</h4>
                      <p className="text-sm text-muted-foreground">
                        {analyticsData.productivityMetrics.peakHours} show highest meeting concentration
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {analyticsData.hourlyDistribution
                          .filter(h => h.hour === analyticsData.productivityMetrics.peakHours.split('-')[0])
                          .map(h => h.meetings)[0] || 0} meetings
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Conflict Analysis</h4>
                      <p className="text-sm text-muted-foreground">
                        {(analyticsData.productivityMetrics.conflictRate * 100).toFixed(1)}% potential scheduling conflicts detected
                      </p>
                      <Badge variant={analyticsData.productivityMetrics.conflictRate > 0.1 ? "destructive" : "secondary"} className="mt-1">
                        {analyticsData.productivityMetrics.conflictRate > 0.1 ? "High Risk" : "Low Risk"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Optimization Score</h4>
                      <p className="text-sm text-muted-foreground">
                        Schedule efficiency based on buffer times and distribution
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {Math.round((1 - analyticsData.productivityMetrics.conflictRate) * 100)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">AI Recommendations</h4>
                  <div className="space-y-2">
                    {analyticsData.productivityMetrics.conflictRate > 0.1 && (
                      <div className="flex items-start gap-2 p-3 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div className="text-sm">
                          <strong>High Conflict Rate:</strong> Consider redistributing meetings to reduce overlapping attendee commitments.
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2 p-3 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div className="text-sm">
                        <strong>Buffer Time:</strong> Add 10-minute buffers between consecutive meetings for better transitions.
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 border border-green-200 dark:border-green-800 rounded-lg">
                      <Target className="h-4 w-4 text-green-500 mt-0.5" />
                      <div className="text-sm">
                        <strong>Optimal Timing:</strong> Schedule high-priority meetings during {analyticsData.productivityMetrics.peakHours} for maximum engagement.
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                  <CardDescription>Meetings by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percentage }) => `${category} (${percentage.toFixed(1)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analyticsData.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trend</CardTitle>
                  <CardDescription>Meeting count and hours over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="meetings" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Pattern</CardTitle>
                  <CardDescription>Meetings by day of week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.dailyPattern}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="meetings" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Locations</CardTitle>
                  <CardDescription>Most frequently used meeting locations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.locationStats.slice(0, 5).map((location, index) => (
                      <div key={location.location} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{location.location}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{location.count}</Badge>
                          <span className="text-xs text-gray-500">{location.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Attendees */}
            <Card>
              <CardHeader>
                <CardTitle>Top Attendees</CardTitle>
                <CardDescription>Most active meeting participants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analyticsData.attendeeStats.slice(0, 9).map((attendee, index) => (
                    <div key={attendee.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{attendee.name}</div>
                        <div className="text-xs text-gray-500">{attendee.hours}h total</div>
                      </div>
                      <Badge variant="outline">{attendee.meetings}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}