import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ExternalLink, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Meeting } from "@shared/schema";

interface CalendarIntegrationProps {
  meeting: Meeting;
  onClose: () => void;
}

export function CalendarIntegration({ meeting, onClose }: CalendarIntegrationProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch calendar links for the meeting
  const { data: calendarLinks, isLoading } = useQuery({
    queryKey: [`/api/meetings/${meeting.id}/calendar-links`],
    enabled: !!meeting.id
  });

  const handleAddToCalendar = async (provider: string, url: string) => {
    if (provider === 'ics') {
      // Download iCal file
      setIsGenerating(true);
      try {
        const response = await fetch(`/api/meetings/${meeting.id}/ical`);
        if (response.ok) {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `meeting-${meeting.id}.ics`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
          
          toast({
            title: "Calendar File Downloaded",
            description: "The meeting has been saved as an iCal file. You can import it into any calendar application."
          });
        }
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Failed to generate calendar file. Please try again.",
          variant: "destructive"
        });
      }
      setIsGenerating(false);
    } else {
      // Open external calendar link
      window.open(url, '_blank', 'noopener,noreferrer');
      toast({
        title: "Calendar Opened",
        description: `Opening ${provider} calendar in a new window.`
      });
    }
  };

  const calendarProviders = [
    { 
      name: 'Google Calendar', 
      key: 'google',
      icon: '📅',
      description: 'Add to your Google Calendar',
      ariaLabel: 'Add meeting to Google Calendar'
    },
    { 
      name: 'Outlook', 
      key: 'outlook',
      icon: '📧',
      description: 'Add to your Outlook calendar',
      ariaLabel: 'Add meeting to Outlook calendar'
    },
    { 
      name: 'Yahoo Calendar', 
      key: 'yahoo',
      icon: '💜',
      description: 'Add to your Yahoo calendar',
      ariaLabel: 'Add meeting to Yahoo calendar'
    },
    { 
      name: 'Download iCal', 
      key: 'ics',
      icon: '📁',
      description: 'Download .ics file for any calendar app',
      ariaLabel: 'Download iCal file for calendar import'
    }
  ];

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground" aria-live="polite">
              Loading calendar options...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Add to Calendar
        </CardTitle>
        <CardDescription>
          Add "{meeting.title}" to your preferred calendar application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meeting Details Summary */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">{meeting.title}</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>Date:</strong> {new Date(meeting.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <p><strong>Time:</strong> {meeting.startTime} - {meeting.endTime}</p>
            <p><strong>Location:</strong> {meeting.location}</p>
            <p><strong>Category:</strong> <Badge variant="outline">{meeting.category}</Badge></p>
          </div>
        </div>

        {/* Calendar Provider Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {calendarProviders.map((provider) => (
            <Button
              key={provider.key}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/5 focus:bg-primary/5 transition-colors"
              onClick={() => handleAddToCalendar(provider.name, calendarLinks?.[provider.key as keyof typeof calendarLinks])}
              disabled={!calendarLinks?.[provider.key as keyof typeof calendarLinks] || (provider.key === 'ics' && isGenerating)}
              aria-label={provider.ariaLabel}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-lg" role="img" aria-hidden="true">
                  {provider.icon}
                </span>
                <span className="font-medium text-left">{provider.name}</span>
                {provider.key === 'ics' ? (
                  <Download className="h-4 w-4 ml-auto" aria-hidden="true" />
                ) : (
                  <ExternalLink className="h-4 w-4 ml-auto" aria-hidden="true" />
                )}
              </div>
              <span className="text-xs text-muted-foreground text-left">
                {provider.description}
              </span>
            </Button>
          ))}
        </div>

        {/* Accessibility Note */}
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded border-l-4 border-blue-200 dark:border-blue-800">
          <p>
            <strong>Accessibility:</strong> All calendar links will open in new windows. 
            The iCal file can be imported into any calendar application that supports the standard format.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}