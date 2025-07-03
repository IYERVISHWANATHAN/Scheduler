import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Users, CheckCircle, XCircle, ArrowRight, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ConflictDetail {
  conflictId: string;
  type: 'attendee_overlap' | 'room_conflict' | 'buffer_violation' | 'mandatory_conflict';
  conflictingMeeting: {
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    schedulerName: string;
  };
  affectedAttendees: string[];
  conflictDuration: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface ConflictSuggestion {
  suggestionId: string;
  type: 'reschedule' | 'split_meeting' | 'remove_attendee' | 'shorten_duration' | 'buffer_adjustment';
  description: string;
  newTimeSlot?: {
    date: string;
    startTime: string;
    endTime: string;
  };
  attendeeChanges?: {
    remove: string[];
    optional: string[];
  };
  durationChange?: number;
  priority: 'high' | 'medium' | 'low';
  feasibilityScore: number;
  impactLevel: 'minimal' | 'moderate' | 'significant';
}

interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: ConflictDetail[];
  suggestions: ConflictSuggestion[];
  severity: 'low' | 'medium' | 'high';
  totalConflicts: number;
}

interface ConflictResolverProps {
  meetingData: {
    id?: number;
    date: string;
    startTime: string;
    endTime: string;
    mandatoryAttendees: string[];
    brandAttendees?: string[];
  };
  onResolutionApplied?: () => void;
  autoAnalyze?: boolean;
}

export function ConflictResolver({ meetingData, onResolutionApplied, autoAnalyze = false }: ConflictResolverProps) {
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(autoAnalyze);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ConflictSuggestion | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeConflictsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/conflicts/analyze', {
        date: meetingData.date,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        mandatoryAttendees: meetingData.mandatoryAttendees,
        optionalAttendees: meetingData.brandAttendees || [],
        excludeMeetingId: meetingData.id
      });
    },
    onSuccess: (data: ConflictAnalysis) => {
      setAnalysis(data);
      setIsAnalyzing(false);
      if (data.hasConflicts) {
        toast({
          title: "Conflicts Detected",
          description: `Found ${data.totalConflicts} conflict(s) with severity: ${data.severity}`,
          variant: data.severity === 'high' ? "destructive" : "default",
        });
      } else {
        toast({
          title: "No Conflicts",
          description: "No scheduling conflicts detected for this time slot.",
        });
      }
    },
    onError: (error: Error) => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async (suggestion: ConflictSuggestion) => {
      if (!meetingData.id) {
        throw new Error("Meeting ID is required to resolve conflicts");
      }
      return await apiRequest('POST', '/api/conflicts/resolve', {
        meetingId: meetingData.id,
        suggestionId: suggestion.suggestionId,
        suggestion
      });
    },
    onSuccess: () => {
      toast({
        title: "Conflict Resolved",
        description: "The suggested resolution has been applied successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      onResolutionApplied?.();
      setAnalysis(null);
      setSelectedSuggestion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Resolution Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    analyzeConflictsMutation.mutate();
  };

  const handleApplySuggestion = (suggestion: ConflictSuggestion) => {
    setSelectedSuggestion(suggestion);
    resolveConflictMutation.mutate(suggestion);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case 'mandatory_conflict':
      case 'attendee_overlap':
        return <Users className="h-4 w-4" />;
      case 'buffer_violation':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Auto-analyze on component mount if requested
  useState(() => {
    if (autoAnalyze) {
      analyzeConflictsMutation.mutate();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Conflict Analysis
          </CardTitle>
          <CardDescription>
            Analyze potential scheduling conflicts and get intelligent suggestions for resolution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || analyzeConflictsMutation.isPending}
              className="flex items-center gap-2"
            >
              {isAnalyzing || analyzeConflictsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {isAnalyzing || analyzeConflictsMutation.isPending ? 'Analyzing...' : 'Analyze Conflicts'}
            </Button>
            
            {analysis && (
              <Badge variant={getSeverityColor(analysis.severity)} className="ml-2">
                {analysis.hasConflicts ? `${analysis.totalConflicts} conflicts` : 'No conflicts'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {analysis && analysis.hasConflicts && (
        <>
          {/* Conflicts Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Detected Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.conflicts.map((conflict) => (
                  <Alert key={conflict.conflictId} className="border-red-200">
                    <div className="flex items-start gap-2">
                      {getConflictTypeIcon(conflict.type)}
                      <div className="flex-1">
                        <AlertTitle className="flex items-center gap-2">
                          {conflict.description}
                          <Badge variant={getSeverityColor(conflict.severity)}>
                            {conflict.severity}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-2">
                          <div className="text-sm space-y-1">
                            <div><strong>Conflicting Meeting:</strong> {conflict.conflictingMeeting.title}</div>
                            <div><strong>Time:</strong> {conflict.conflictingMeeting.startTime} - {conflict.conflictingMeeting.endTime}</div>
                            <div><strong>Scheduler:</strong> {conflict.conflictingMeeting.schedulerName}</div>
                            {conflict.affectedAttendees.length > 0 && (
                              <div><strong>Affected Attendees:</strong> {conflict.affectedAttendees.join(', ')}</div>
                            )}
                            <div><strong>Overlap Duration:</strong> {conflict.conflictDuration} minutes</div>
                          </div>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Suggestions Display */}
          {analysis.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Suggested Resolutions
                </CardTitle>
                <CardDescription>
                  Intelligent suggestions to resolve the detected conflicts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.suggestions.map((suggestion) => (
                    <div key={suggestion.suggestionId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{suggestion.description}</h4>
                            <Badge className={getPriorityColor(suggestion.priority)}>
                              {suggestion.priority} priority
                            </Badge>
                            <Badge variant="outline">
                              {suggestion.feasibilityScore}% feasible
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div><strong>Type:</strong> {suggestion.type.replace('_', ' ')}</div>
                            <div><strong>Impact Level:</strong> {suggestion.impactLevel}</div>
                            
                            {suggestion.newTimeSlot && (
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  <strong>New Time:</strong> {suggestion.newTimeSlot.date} at {suggestion.newTimeSlot.startTime} - {suggestion.newTimeSlot.endTime}
                                </span>
                              </div>
                            )}
                            
                            {suggestion.attendeeChanges && suggestion.attendeeChanges.remove.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                <Users className="h-4 w-4" />
                                <span>
                                  <strong>Remove Attendees:</strong> {suggestion.attendeeChanges.remove.join(', ')}
                                </span>
                              </div>
                            )}
                            
                            {suggestion.durationChange && (
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  <strong>New Duration:</strong> {suggestion.durationChange} minutes
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleApplySuggestion(suggestion)}
                          disabled={resolveConflictMutation.isPending || selectedSuggestion?.suggestionId === suggestion.suggestionId}
                          className="ml-4"
                          variant={suggestion.priority === 'high' ? 'default' : 'outline'}
                        >
                          {selectedSuggestion?.suggestionId === suggestion.suggestionId ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <ArrowRight className="h-4 w-4 mr-2" />
                          )}
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {analysis && !analysis.hasConflicts && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Conflicts Detected</h3>
            <p className="text-gray-600">
              The selected time slot is available for all mandatory attendees with proper buffer time.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}