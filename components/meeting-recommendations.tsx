import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Brain, Clock, Users, MapPin, Zap, TrendingUp, Calendar, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Meeting } from "@shared/schema";
import { CATEGORY_ATTENDEES } from "@shared/schema";

interface Recommendation {
  id: string;
  type: 'optimal_time' | 'attendee_match' | 'location_efficiency' | 'workload_balance' | 'follow_up';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedAction: string;
  confidence: number;
  metadata: {
    suggestedDate?: string;
    suggestedTime?: string;
    suggestedLocation?: string;
    suggestedAttendees?: string[];
    conflictResolution?: string;
    efficiency_gain?: number;
  };
}

interface RecommendationEngineProps {
  currentMeetings: Meeting[];
  onRecommendationApply?: (recommendation: Recommendation) => void;
}

export function MeetingRecommendations({ currentMeetings, onRecommendationApply }: RecommendationEngineProps) {
  const [selectedTab, setSelectedTab] = useState('insights');
  const { toast } = useToast();

  const { data: historicalData = [] } = useQuery({
    queryKey: ['/api/meetings/historical-patterns'],
  });

  const { data: attendeePreferences = {} } = useQuery({
    queryKey: ['/api/attendees/preferences'],
  });

  const generateRecommendationsMutation = useMutation({
    mutationFn: async (context: any) => {
      return await apiRequest("POST", "/api/ai/contextual-recommendations", context);
    },
    onSuccess: () => {
      toast({
        title: "Recommendations Updated",
        description: "New contextual recommendations have been generated"
      });
    }
  });

  // Generate contextual recommendations based on current data
  const recommendations = useMemo((): Recommendation[] => {
    const recs: Recommendation[] = [];
    const today = new Date();
    const nextWeek = addDays(today, 7);

    // 1. Optimal Time Recommendations
    const morningMeetings = currentMeetings.filter(m => {
      const hour = parseInt(m.startTime.split(':')[0]);
      return hour >= 9 && hour <= 11;
    });

    if (morningMeetings.length < 2) {
      recs.push({
        id: 'morning-optimization',
        type: 'optimal_time',
        priority: 'high',
        title: 'Optimize Morning Schedule',
        description: 'Your mornings have low meeting density. Consider scheduling important strategic meetings between 9-11 AM.',
        suggestedAction: 'Schedule high-priority meetings in morning slots',
        confidence: 85,
        metadata: {
          suggestedTime: '09:00',
          efficiency_gain: 25
        }
      });
    }

    // 2. Attendee Collaboration Patterns
    const attendeeFrequency = new Map();
    currentMeetings.forEach(meeting => {
      [...meeting.ddfsAttendees, ...meeting.mandatoryAttendees].forEach(attendee => {
        attendeeFrequency.set(attendee, (attendeeFrequency.get(attendee) || 0) + 1);
      });
    });

    const frequentCollaborators = Array.from(attendeeFrequency.entries())
      .filter(([_, count]) => count >= 3)
      .map(([attendee]) => attendee);

    if (frequentCollaborators.length > 0) {
      recs.push({
        id: 'collaboration-sync',
        type: 'attendee_match',
        priority: 'medium',
        title: 'Schedule Regular Sync',
        description: `You frequently meet with ${frequentCollaborators.slice(0, 2).join(', ')}. Consider setting up a recurring sync.`,
        suggestedAction: 'Create recurring meeting series',
        confidence: 75,
        metadata: {
          suggestedAttendees: frequentCollaborators,
          suggestedTime: '15:00'
        }
      });
    }

    // 3. Location Efficiency
    const locationUsage = new Map();
    currentMeetings.forEach(meeting => {
      if (meeting.location) {
        locationUsage.set(meeting.location, (locationUsage.get(meeting.location) || 0) + 1);
      }
    });

    const underutilizedLocations = ['Conference Room A', 'Conference Room B', 'Meeting Room 1']
      .filter(loc => !locationUsage.has(loc) || locationUsage.get(loc) < 2);

    if (underutilizedLocations.length > 0) {
      recs.push({
        id: 'location-optimization',
        type: 'location_efficiency',
        priority: 'low',
        title: 'Optimize Room Usage',
        description: `${underutilizedLocations[0]} is underutilized. Consider it for upcoming meetings.`,
        suggestedAction: 'Book underutilized conference rooms',
        confidence: 60,
        metadata: {
          suggestedLocation: underutilizedLocations[0],
          efficiency_gain: 15
        }
      });
    }

    // 4. Workload Balance
    const dailyMeetingCount = new Map();
    currentMeetings.forEach(meeting => {
      const date = meeting.date;
      dailyMeetingCount.set(date, (dailyMeetingCount.get(date) || 0) + 1);
    });

    const overloadedDays = Array.from(dailyMeetingCount.entries())
      .filter(([_, count]) => count > 4);

    if (overloadedDays.length > 0) {
      recs.push({
        id: 'workload-balance',
        type: 'workload_balance',
        priority: 'high',
        title: 'Balance Daily Workload',
        description: `${format(new Date(overloadedDays[0][0]), 'MMM d')} has ${overloadedDays[0][1]} meetings. Consider redistributing.`,
        suggestedAction: 'Reschedule some meetings to lighter days',
        confidence: 80,
        metadata: {
          conflictResolution: 'Move 2-3 non-critical meetings to adjacent days',
          efficiency_gain: 30
        }
      });
    }

    // 5. Follow-up Recommendations
    const recentMeetings = currentMeetings.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      const daysSince = Math.floor((today.getTime() - meetingDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 1 && daysSince <= 7 && meeting.status === 'confirmed';
    });

    if (recentMeetings.length > 0) {
      recs.push({
        id: 'follow-up-needed',
        type: 'follow_up',
        priority: 'medium',
        title: 'Schedule Follow-ups',
        description: `${recentMeetings.length} recent meetings may need follow-up actions.`,
        suggestedAction: 'Schedule follow-up meetings or action item reviews',
        confidence: 70,
        metadata: {
          suggestedTime: '14:00',
          efficiency_gain: 20
        }
      });
    }

    return recs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [currentMeetings]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimal_time': return <Clock className="h-4 w-4" />;
      case 'attendee_match': return <Users className="h-4 w-4" />;
      case 'location_efficiency': return <MapPin className="h-4 w-4" />;
      case 'workload_balance': return <TrendingUp className="h-4 w-4" />;
      case 'follow_up': return <Calendar className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Meeting Intelligence Engine
        </CardTitle>
        <CardDescription>
          AI-powered contextual recommendations to optimize your meeting schedule
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights">Smart Insights</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="patterns">Usage Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Meeting Efficiency</p>
                      <p className="text-2xl font-bold text-green-600">87%</p>
                    </div>
                    <Zap className="h-8 w-8 text-green-600" />
                  </div>
                  <Progress value={87} className="mt-2" />
                  <p className="text-xs text-gray-600 mt-1">Above average performance</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Optimal Time Usage</p>
                      <p className="text-2xl font-bold text-blue-600">72%</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                  <Progress value={72} className="mt-2" />
                  <p className="text-xs text-gray-600 mt-1">Room for improvement</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Collaboration Score</p>
                      <p className="text-2xl font-bold text-purple-600">94%</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                  <Progress value={94} className="mt-2" />
                  <p className="text-xs text-gray-600 mt-1">Excellent team engagement</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No specific recommendations at this time.</p>
                  <p className="text-sm text-gray-500 mt-1">Your scheduling is already well optimized!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <Card key={rec.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-purple-50">
                            {getTypeIcon(rec.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{rec.title}</h4>
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority}
                              </Badge>
                              <Badge variant="outline">
                                {rec.confidence}% confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                            <p className="text-sm font-medium text-purple-600">{rec.suggestedAction}</p>
                            
                            {rec.metadata.efficiency_gain && (
                              <div className="flex items-center gap-1 mt-2">
                                <TrendingUp className="h-3 w-3 text-green-600" />
                                <span className="text-xs text-green-600">
                                  +{rec.metadata.efficiency_gain}% efficiency gain
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => onRecommendationApply?.(rec)}
                          className="ml-2"
                        >
                          Apply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Peak Meeting Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { time: '10:00 AM', usage: 85, label: 'Peak productivity' },
                      { time: '2:00 PM', usage: 70, label: 'High activity' },
                      { time: '4:00 PM', usage: 60, label: 'Moderate usage' },
                      { time: '11:00 AM', usage: 45, label: 'Light usage' }
                    ].map(({ time, usage, label }) => (
                      <div key={time} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{time}</p>
                          <p className="text-xs text-gray-600">{label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={usage} className="w-20" />
                          <span className="text-sm text-gray-600">{usage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { category: 'Liquor', count: 12, percentage: 40 },
                      { category: 'Tobacco', count: 8, percentage: 27 },
                      { category: 'PNC', count: 6, percentage: 20 },
                      { category: 'Confectionary', count: 4, percentage: 13 }
                    ].map(({ category, count, percentage }) => (
                      <div key={category} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-xs text-gray-600">{count} meetings</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={percentage} className="w-20" />
                          <span className="text-sm text-gray-600">{percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}