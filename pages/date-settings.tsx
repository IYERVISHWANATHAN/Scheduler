import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { triggerDateSettingsUpdate } from "@/hooks/use-default-date";

interface DateSettings {
  defaultStartDate: string;
}

export default function DateSettingsPage() {
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [, setLocation] = useLocation();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions } = useAuth();

  // Fetch current date settings
  const { data: dateSettings, isLoading } = useQuery<{
    defaultStartDate: string;
  }>({
    queryKey: ['/api/date-settings'],
    enabled: !!user
  });

  // Initialize form with current settings
  useEffect(() => {
    if (dateSettings) {
      const newDate = dateSettings.defaultStartDate || format(new Date(), 'yyyy-MM-dd');
      console.log('Setting form values:', { newDate });
      setDefaultDate(newDate);
    } else {
      setDefaultDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [dateSettings]);

  // Update preview when local form values change
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => {
    setPreviewKey(prev => prev + 1);
  }, [defaultDate]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: DateSettings) => {
      return apiRequest('POST', '/api/date-settings', settings);
    },
    onSuccess: () => {
      // Immediately update the reactive store
      const updatedSettings = {
        defaultStartDate: defaultDate
      };
      
      // Update localStorage and reactive store
      localStorage.setItem('dateSettingsCache', JSON.stringify(updatedSettings));
      
      // Import and use the date store
      import('@/lib/date-store').then(({ dateStore }) => {
        dateStore.setSettings(updatedSettings);
      });
      
      toast({
        title: "Settings Saved",
        description: "Date settings have been updated successfully",
      });
      
      // Navigate back
      setTimeout(() => {
        setLocation('/');
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    const settings: DateSettings = {
      defaultStartDate: defaultDate
    };
    saveSettingsMutation.mutate(settings);
  };

  const handleSetToday = () => {
    setDefaultDate(format(new Date(), 'yyyy-MM-dd'));
  };

  // Only allow access for authenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to access date settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Settings className="text-blue-600 text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Date Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => setLocation('/')}
                className="flex items-center gap-2 bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Calendar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading settings...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Default Start Date Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  Default Calendar Start Date
                </CardTitle>
                <CardDescription>
                  Set the default date that will be used when opening calendar views (Day View, Week View, and Day-wise Meeting Schedule)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="defaultDate">Default Start Date</Label>
                    <Input
                      id="defaultDate"
                      type="date"
                      value={defaultDate}
                      onChange={(e) => setDefaultDate(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      This date will be used as the starting point for all calendar views
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quick Actions</Label>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        onClick={handleSetToday}
                        className="w-full justify-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Set to Today ({format(new Date(), 'MMM dd, yyyy')})
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Preview</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      Calendar views will start from: <strong>
                        {defaultDate ? format(new Date(defaultDate), 'MMM dd, yyyy') : 'Invalid Date'}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-6 border-t">
                  <Button 
                    onClick={handleSave}
                    disabled={saveSettingsMutation.isPending}
                    className="px-6"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Day View:</strong> Opens to the selected default date instead of today</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Week View:</strong> Shows the week containing the default date</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Day-wise Meeting Schedule:</strong> Lists meetings starting from the default date</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p><strong>Auto-update:</strong> When enabled, always starts with today's date for real-time scheduling</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}