import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Clock, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/utils";

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

interface AISuggestionsProps {
  title: string;
  duration: number;
  category: string;
  requiredAttendees: string[];
  preferredDates: string[];
  onSelectTime: (timeSlot: TimeSlot) => void;
}

export function AISuggestions({ 
  title, 
  duration, 
  category, 
  requiredAttendees, 
  preferredDates,
  onSelectTime 
}: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TimeSlot[]>([]);
  const { toast } = useToast();

  const suggestionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/suggest-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          duration,
          category,
          requiredAttendees,
          preferredDates,
          constraints: {
            preferredTimeStart: '09:00',
            preferredTimeEnd: '17:00',
            priority: 'normal'
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get AI suggestions');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      toast({
        title: "AI Suggestions Ready",
        description: `Found ${data.suggestions?.length || 0} optimal time slots for your meeting.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "AI Suggestions Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Fair";
    return "Poor";
  };

  if (!title || !duration || !category || requiredAttendees.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <Brain className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Fill in meeting details to get AI scheduling suggestions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Meeting Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Analyzing {requiredAttendees.length} attendees across {preferredDates.length} days
          </div>
          <Button
            onClick={() => suggestionMutation.mutate()}
            disabled={suggestionMutation.isPending}
            variant="outline"
            size="sm"
          >
            {suggestionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            Get Suggestions
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Recommended Time Slots</h4>
            {suggestions.slice(0, 5).map((slot, index) => (
              <Card key={index} className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {new Date(slot.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`${getScoreColor(slot.score)} text-white`}
                      >
                        {getScoreLabel(slot.score)} ({slot.score}%)
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{slot.reason}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users className="h-3 w-3" />
                      <span>{duration} min meeting</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onSelectTime(slot)}
                      className="text-xs"
                    >
                      Select This Time
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {suggestionMutation.isError && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">
              Unable to generate suggestions. Please try again or schedule manually.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}