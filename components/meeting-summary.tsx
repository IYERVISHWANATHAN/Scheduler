import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Download, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Meeting } from "@shared/schema";
import { format } from "date-fns";

interface MeetingSummaryProps {
  meeting: Meeting;
  onClose: () => void;
}

interface SummaryData {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  nextSteps: string[];
  attendeesPresent: string[];
}

export function MeetingSummary({ meeting, onClose }: MeetingSummaryProps) {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [customNotes, setCustomNotes] = useState("");
  const { toast } = useToast();

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/meetings/generate-summary", {
        meetingId: meeting.id,
        meetingDetails: {
          title: meeting.title,
          category: meeting.category,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          location: meeting.location,
          attendees: [
            ...meeting.ddfsAttendees,
            ...meeting.mandatoryAttendees,
            ...meeting.brandAttendees
          ]
        },
        customNotes
      });
    },
    onSuccess: (data) => {
      setSummaryData(data);
      toast({
        title: "Success",
        description: "Meeting summary generated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to generate meeting summary. Please check your OpenAI API key configuration.",
        variant: "destructive"
      });
    }
  });

  const exportSummaryMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'docx') => {
      const response = await fetch("/api/meetings/export-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          summaryData,
          format
        })
      });

      if (!response.ok) {
        throw new Error("Failed to export summary");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${meeting.title}-summary.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Summary exported successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export summary",
        variant: "destructive"
      });
    }
  });

  const emailSummaryMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/meetings/email-summary", {
        meetingId: meeting.id,
        summaryData,
        recipients: [
          ...meeting.ddfsAttendees,
          ...meeting.mandatoryAttendees,
          ...meeting.brandAttendees
        ]
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Summary emailed to all attendees"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to email summary",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Meeting Summary</h2>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {meeting.title}
              </CardTitle>
              <CardDescription>
                {format(new Date(meeting.date), 'PPP')} • {meeting.startTime} - {meeting.endTime} • {meeting.location}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">{meeting.category}</Badge>
                <Badge variant="outline">{meeting.status}</Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Attendees</h4>
                  
                  {/* DDFS Attendees */}
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-blue-700 mb-3">DDFS Attendees</h5>
                    
                    {/* DDFS Mandatory */}
                    <div className="mb-2">
                      <h6 className="text-xs font-medium text-gray-600 mb-1">Mandatory</h6>
                      <div className="flex flex-wrap gap-1">
                        {meeting.mandatoryAttendees.filter(attendee => 
                          meeting.ddfsAttendees.includes(attendee)
                        ).map(attendee => (
                          <Badge key={attendee} variant="destructive" className="text-xs">{attendee}</Badge>
                        ))}
                        {meeting.mandatoryAttendees.filter(attendee => 
                          meeting.ddfsAttendees.includes(attendee)
                        ).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </div>
                    
                    {/* DDFS Optional */}
                    <div className="mb-2">
                      <h6 className="text-xs font-medium text-gray-600 mb-1">Optional</h6>
                      <div className="flex flex-wrap gap-1">
                        {meeting.ddfsAttendees.filter(attendee => 
                          !meeting.mandatoryAttendees.includes(attendee)
                        ).map(attendee => (
                          <Badge key={attendee} variant="default" className="text-xs">{attendee}</Badge>
                        ))}
                        {meeting.ddfsAttendees.filter(attendee => 
                          !meeting.mandatoryAttendees.includes(attendee)
                        ).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Brand Attendees */}
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-green-700 mb-3">Brand Attendees</h5>
                    
                    {/* Brand Mandatory */}
                    <div className="mb-2">
                      <h6 className="text-xs font-medium text-gray-600 mb-1">Mandatory</h6>
                      <div className="flex flex-wrap gap-1">
                        {meeting.mandatoryAttendees.filter(attendee => 
                          meeting.brandAttendees.includes(attendee)
                        ).map(attendee => (
                          <Badge key={attendee} variant="destructive" className="text-xs">{attendee}</Badge>
                        ))}
                        {meeting.mandatoryAttendees.filter(attendee => 
                          meeting.brandAttendees.includes(attendee)
                        ).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Brand Optional */}
                    <div className="mb-2">
                      <h6 className="text-xs font-medium text-gray-600 mb-1">Optional</h6>
                      <div className="flex flex-wrap gap-1">
                        {meeting.brandAttendees.filter(attendee => 
                          !meeting.mandatoryAttendees.includes(attendee)
                        ).map(attendee => (
                          <Badge key={attendee} variant="secondary" className="text-xs">{attendee}</Badge>
                        ))}
                        {meeting.brandAttendees.filter(attendee => 
                          !meeting.mandatoryAttendees.includes(attendee)
                        ).length === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Additional Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Add any additional context, notes, or specific points to include in the summary..."
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
                  className="w-full"
                >
                  {generateSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Summary...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {summaryData && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Summary</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportSummaryMutation.mutate('pdf')}
                    disabled={exportSummaryMutation.isPending}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportSummaryMutation.mutate('docx')}
                    disabled={exportSummaryMutation.isPending}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Word
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => emailSummaryMutation.mutate()}
                    disabled={emailSummaryMutation.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Email to Attendees
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Executive Summary</h4>
                  <p className="text-gray-700 leading-relaxed">{summaryData.summary}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Key Discussion Points</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {summaryData.keyPoints.map((point, index) => (
                      <li key={index} className="text-gray-700">{point}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Decisions Made</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {summaryData.decisions.map((decision, index) => (
                      <li key={index} className="text-gray-700">{decision}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Action Items</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {summaryData.actionItems.map((item, index) => (
                      <li key={index} className="text-gray-700">{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Next Steps</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {summaryData.nextSteps.map((step, index) => (
                      <li key={index} className="text-gray-700">{step}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Attendees Present</h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryData.attendeesPresent.map(attendee => (
                      <Badge key={attendee} variant="outline">{attendee}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}