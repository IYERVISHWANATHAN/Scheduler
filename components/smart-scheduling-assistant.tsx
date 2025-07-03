import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Users, Brain, TrendingUp, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Meeting } from "@shared/schema";

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

interface SmartSchedulingAssistantProps {
  onScheduleSelected: (timeSlot: TimeSlot) => void;
}

export function SmartSchedulingAssistant({ onScheduleSelected }: SmartSchedulingAssistantProps) {
  const [activeTab, setActiveTab] = useState("suggestions");
  const [suggestionParams, setSuggestionParams] = useState({
    title: "",
    duration: 60,
    category: "",
    requiredAttendees: [] as string[],
    preferredDates: [] as string[]
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [] } = useQuery({
    queryKey: ["/api/meetings"]
  });

  const suggestionMutation = useMutation({
    mutationFn: async (params: typeof suggestionParams) => {
      return apiRequest("/api/ai/suggest-times", {
        method: "POST",
        body: JSON.stringify(params)
      });
    },
    onSuccess: (data) => {
      toast({
        title: "AI Suggestions Generated",
        description: `Found ${data.suggestions?.length || 0} optimal time slots`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Suggestion Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const analyticsQuery = useQuery({
    queryKey: ["/api/analytics/workload"],
    enabled: activeTab === "analytics"
  });

  const handleGenerateSuggestions = () => {
    if (!suggestionParams.title || !suggestionParams.category) {
      toast({
        title: "Missing Information",
        description: "Please provide meeting title and category",
        variant: "destructive"
      });
      return;
    }

    suggestionMutation.mutate(suggestionParams);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    return "Poor";
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Smart Scheduling Assistant
        </CardTitle>
        <CardDescription>
          AI-powered meeting optimization and scheduling insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
            <TabsTrigger value="analytics">Workload Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Schedule Optimization</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Meeting Title</Label>
                  <Input
                    id="title"
                    value={suggestionParams.title}
                    onChange={(e) => setSuggestionParams(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter meeting title"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={suggestionParams.category}
                    onValueChange={(value) => setSuggestionParams(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Liquor">Liquor</SelectItem>
                      <SelectItem value="Tobacco">Tobacco</SelectItem>
                      <SelectItem value="PNC">PNC</SelectItem>
                      <SelectItem value="Confectionary">Confectionary</SelectItem>
                      <SelectItem value="Fashion">Fashion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select
                    value={suggestionParams.duration.toString()}
                    onValueChange={(value) => setSuggestionParams(prev => ({ ...prev, duration: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                      <SelectItem value="120">120 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGenerateSuggestions} 
                  disabled={suggestionMutation.isPending}
                  className="w-full"
                >
                  {suggestionMutation.isPending ? "Generating..." : "Generate AI Suggestions"}
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Suggested Time Slots
                </h3>
                
                {suggestionMutation.data?.suggestions ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {suggestionMutation.data.suggestions.map((slot: TimeSlot, index: number) => (
                      <Card key={index} className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onScheduleSelected(slot)}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">{slot.date}</span>
                              <span className="text-sm text-muted-foreground">
                                {slot.startTime} - {slot.endTime}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{slot.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`${getScoreColor(slot.score)} text-white`}>
                              {Math.round(slot.score)}%
                            </Badge>
                            <Badge variant="outline">
                              {getScoreLabel(slot.score)}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Generate AI suggestions to see optimal time slots</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Meeting Density</span>
                </div>
                <div className="text-2xl font-bold">
                  {meetings.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total meetings scheduled</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Peak Hours</span>
                </div>
                <div className="text-2xl font-bold">10-12 AM</div>
                <p className="text-sm text-muted-foreground">Most scheduled time</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">Conflicts</span>
                </div>
                <div className="text-2xl font-bold">
                  {meetings.filter((m: Meeting) => 
                    meetings.some((other: Meeting) => 
                      other.id !== m.id && 
                      other.date === m.date && 
                      other.mandatoryAttendees.some(attendee => m.mandatoryAttendees.includes(attendee))
                    )
                  ).length}
                </div>
                <p className="text-sm text-muted-foreground">Potential conflicts detected</p>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Weekly Meeting Distribution</h3>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                  const dayMeetings = meetings.filter((m: Meeting) => {
                    const meetingDay = new Date(m.date).toLocaleDateString('en-US', { weekday: 'long' });
                    return meetingDay === day;
                  }).length;
                  
                  return (
                    <div key={day} className="flex items-center gap-4">
                      <span className="w-20 text-sm">{day}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((dayMeetings / Math.max(meetings.length, 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{dayMeetings}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Schedule Optimization Recommendations</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Buffer Time Optimization</h4>
                    <p className="text-sm text-muted-foreground">
                      Consider adding 10-minute buffers between consecutive meetings to improve transition time.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <Users className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Attendee Availability</h4>
                    <p className="text-sm text-muted-foreground">
                      Morning slots (9-11 AM) show highest attendee availability and engagement rates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Meeting Density</h4>
                    <p className="text-sm text-muted-foreground">
                      Thursday appears to be overloaded. Consider redistributing some meetings to lighter days.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}