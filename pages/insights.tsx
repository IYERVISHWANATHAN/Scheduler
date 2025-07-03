import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AvailabilityHeatmap } from "@/components/availability-heatmap";
import { MeetingRecommendations } from "@/components/meeting-recommendations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Calendar, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Meeting } from "@shared/schema";

export default function InsightsPage() {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: string; hour: number } | null>(null);
  const { user, permissions } = useAuth();

  // Only allow access for users with view permissions
  if (!permissions?.canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view meeting insights.</p>
        </div>
      </div>
    );
  }

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['/api/meetings'],
    enabled: true
  });

  const handleTimeSlotSelect = (date: string, hour: number) => {
    setSelectedTimeSlot({ date, hour });
    // Could trigger meeting form with pre-filled date/time
  };

  const handleRecommendationApply = (recommendation: any) => {
    // Apply the recommendation by triggering appropriate actions
    console.log('Applying recommendation:', recommendation);
    
    // Example: If it's a time optimization recommendation, could open meeting form
    // If it's a follow-up recommendation, could create follow-up meetings
    // If it's a workload balance recommendation, could suggest rescheduling
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meeting insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Brain className="h-8 w-8 text-purple-600" />
                Meeting Insights & Intelligence
              </h1>
              <p className="text-gray-600 mt-2">
                AI-powered analytics and recommendations to optimize your meeting schedule
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Recommended Time
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="heatmap" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="heatmap" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Availability Heatmap
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Smart Recommendations
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Overview Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap" className="space-y-6">
            <AvailabilityHeatmap 
              onTimeSlotSelect={handleTimeSlotSelect}
              selectedCategories={permissions?.categories || []}
            />
            
            {selectedTimeSlot && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Time Slot</CardTitle>
                  <CardDescription>
                    {selectedTimeSlot.date} at {selectedTimeSlot.hour}:00
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    This time slot has been selected. You can now create a meeting or analyze this period.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Meeting
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <MeetingRecommendations 
              currentMeetings={meetings as Meeting[]}
              onRecommendationApply={handleRecommendationApply}
            />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Meetings</p>
                      <p className="text-3xl font-bold text-blue-600">{meetings.length}</p>
                    </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {meetings.length > 10 ? 'High activity' : 'Normal activity'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                      <p className="text-3xl font-bold text-green-600">1.2h</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Optimal meeting length
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Efficiency Score</p>
                      <p className="text-3xl font-bold text-purple-600">87%</p>
                    </div>
                    <Brain className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Above average performance
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Collaborators</p>
                      <p className="text-3xl font-bold text-orange-600">
                        {new Set([
                          ...meetings.flatMap((m: Meeting) => m.ddfsAttendees),
                          ...meetings.flatMap((m: Meeting) => m.mandatoryAttendees)
                        ]).size}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-orange-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Unique attendees this period
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Peak Meeting Hours</CardTitle>
                  <CardDescription>When you're most active</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { time: '10:00 AM', count: 5, percentage: 85 },
                      { time: '2:00 PM', count: 4, percentage: 70 },
                      { time: '11:00 AM', count: 3, percentage: 55 },
                      { time: '3:00 PM', count: 2, percentage: 40 }
                    ].map(({ time, count, percentage }) => (
                      <div key={time} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{time}</p>
                          <p className="text-sm text-gray-600">{count} meetings</p>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                  <CardDescription>Meeting types breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(
                      meetings.reduce((acc: any, meeting: Meeting) => {
                        acc[meeting.category] = (acc[meeting.category] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-sm text-gray-600">{count as number} meetings</p>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ 
                              width: `${((count as number) / meetings.length) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}