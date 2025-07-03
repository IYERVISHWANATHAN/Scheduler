import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Brain, 
  TrendingUp, 
  Bell, 
  Clock, 
  Mail, 
  MessageCircle, 
  Smartphone,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Lightbulb,
  Settings
} from "lucide-react";

interface NotificationInsight {
  userId: number;
  category: string;
  recommendations: SmartRecommendation[];
  currentEffectiveness: number;
  potentialImprovement: number;
  lastAnalyzed: Date;
}

interface SmartRecommendation {
  type: 'timing' | 'channel' | 'frequency';
  current: string;
  recommended: string;
  confidence: number;
  reasoning: string;
  expectedImprovement: string;
}

interface NotificationPreferences {
  id: number;
  userId: number;
  category: string;
  emailEnabled: boolean;
  emailAdvanceMinutes: number;
  whatsappEnabled: boolean;
  whatsappAdvanceMinutes: number;
  smsEnabled: boolean;
  smsAdvanceMinutes: number;
  pushEnabled: boolean;
  pushAdvanceMinutes: number;
  reminderEnabled: boolean;
  reminderAdvanceMinutes: number;
  isOptimized: boolean;
  lastOptimizedAt: Date | null;
}

interface StoredRecommendation {
  id: number;
  userId: number;
  category: string;
  recommendationType: string;
  currentSetting: string;
  recommendedSetting: string;
  confidenceScore: number;
  reasoning: string;
  potentialImprovement: string;
  isApplied: boolean;
  appliedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

export default function NotificationOptimizer() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user ID (you'll need to implement this based on your auth system)
  const userId = 26; // Replace with actual user ID from auth context

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['/api/notifications/analyze-behavior', userId, selectedCategory],
    enabled: selectedCategory !== "all"
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['/api/notifications/recommendations', userId]
  });

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['/api/notifications/preferences', userId]
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      return await fetch(`/api/notifications/generate-insights/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Insights Generated",
        description: "Smart notification recommendations have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    }
  });

  const applyRecommendationMutation = useMutation({
    mutationFn: async (recommendationId: number) => {
      return await fetch(`/api/notifications/apply-recommendation/${recommendationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Recommendation Applied",
        description: "Your notification settings have been optimized.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to apply recommendation. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async ({ category, preferences }: { category: string; preferences: any }) => {
      return await fetch(`/api/notifications/preferences/${userId}/${category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      await generateInsightsMutation.mutateAsync();
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleApplyRecommendation = (recommendationId: number) => {
    applyRecommendationMutation.mutate(recommendationId);
  };

  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 80) return "text-green-600";
    if (effectiveness >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-800";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'timing': return <Clock className="h-4 w-4" />;
      case 'channel': return <MessageCircle className="h-4 w-4" />;
      case 'frequency': return <Bell className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const categories = ["liquor", "tobacco", "pnc", "confectionary", "fashion", "destination"];

  if (insightsLoading || recommendationsLoading || preferencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Brain className="h-12 w-12 animate-pulse text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Analyzing notification patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Smart Notification Optimizer</h1>
          <p className="text-gray-600 mt-2">
            AI-powered insights to optimize your notification preferences for better engagement
          </p>
        </div>
        <Button 
          onClick={handleGenerateInsights}
          disabled={isGeneratingInsights || generateInsightsMutation.isPending}
          className="flex items-center gap-2"
        >
          <Brain className="h-4 w-4" />
          {isGeneratingInsights ? "Analyzing..." : "Generate Insights"}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {insights && Array.isArray(insights) && insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {insights.map((insight: NotificationInsight) => (
                <Card key={insight.category}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">{insight.category}</CardTitle>
                      <Badge variant="outline">
                        {insight.recommendations.length} insights
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span>Current Effectiveness</span>
                        <span className={getEffectivenessColor(insight.currentEffectiveness)}>
                          {insight.currentEffectiveness.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={insight.currentEffectiveness} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span>Potential Improvement</span>
                        <span className="text-green-600">
                          +{insight.potentialImprovement.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={insight.potentialImprovement} className="h-2 bg-green-100" />
                    </div>

                    <div className="pt-2">
                      <p className="text-xs text-gray-500">
                        Last analyzed: {new Date(insight.lastAnalyzed).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Insights Available</h3>
                <p className="text-gray-600 text-center mb-4">
                  Generate insights to see AI-powered recommendations for optimizing your notifications.
                </p>
                <Button onClick={handleGenerateInsights} disabled={isGeneratingInsights}>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Insights
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {recommendations && Array.isArray(recommendations) && recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map((rec: StoredRecommendation) => (
                <Card key={rec.id} className={rec.isApplied ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getRecommendationIcon(rec.recommendationType)}
                        <CardTitle className="text-lg capitalize">
                          {rec.recommendationType} Optimization
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getConfidenceColor(rec.confidenceScore)}>
                          {rec.confidenceScore}% confidence
                        </Badge>
                        {rec.isApplied && (
                          <Badge variant="secondary">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Applied
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="capitalize">{rec.category} category</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Current Setting</Label>
                        <p className="text-sm text-gray-600 mt-1">{rec.currentSetting}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Recommended Setting</Label>
                        <p className="text-sm text-blue-600 mt-1 font-medium">{rec.recommendedSetting}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700">Why This Recommendation?</Label>
                      <p className="text-sm text-gray-600 mt-1">{rec.reasoning}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        {rec.potentialImprovement}
                      </div>
                      {!rec.isApplied && (
                        <Button 
                          size="sm" 
                          onClick={() => handleApplyRecommendation(rec.id)}
                          disabled={applyRecommendationMutation.isPending}
                        >
                          Apply Recommendation
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lightbulb className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recommendations Yet</h3>
                <p className="text-gray-600 text-center mb-4">
                  Generate insights first to receive personalized notification optimization recommendations.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <div className="grid gap-6">
            {categories.map((category) => {
              const categoryPrefs = Array.isArray(preferences) ? preferences.find((p: NotificationPreferences) => p.category === category) : undefined;
              
              return (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="capitalize">{category} Notifications</CardTitle>
                    <CardDescription>
                      Configure notification preferences for {category} meetings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Email Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          <Label htmlFor={`email-${category}`}>Email</Label>
                        </div>
                        <Switch 
                          id={`email-${category}`}
                          checked={categoryPrefs?.emailEnabled ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              category,
                              preferences: { emailEnabled: checked }
                            });
                          }}
                        />
                        {categoryPrefs?.emailEnabled && (
                          <div>
                            <Label className="text-xs">Minutes before</Label>
                            <Input 
                              type="number" 
                              value={categoryPrefs?.emailAdvanceMinutes ?? 30}
                              onChange={(e) => {
                                updatePreferencesMutation.mutate({
                                  category,
                                  preferences: { emailAdvanceMinutes: parseInt(e.target.value) }
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                        )}
                      </div>

                      {/* WhatsApp Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          <Label htmlFor={`whatsapp-${category}`}>WhatsApp</Label>
                        </div>
                        <Switch 
                          id={`whatsapp-${category}`}
                          checked={categoryPrefs?.whatsappEnabled ?? false}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              category,
                              preferences: { whatsappEnabled: checked }
                            });
                          }}
                        />
                        {categoryPrefs?.whatsappEnabled && (
                          <div>
                            <Label className="text-xs">Minutes before</Label>
                            <Input 
                              type="number" 
                              value={categoryPrefs?.whatsappAdvanceMinutes ?? 15}
                              onChange={(e) => {
                                updatePreferencesMutation.mutate({
                                  category,
                                  preferences: { whatsappAdvanceMinutes: parseInt(e.target.value) }
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                        )}
                      </div>

                      {/* Push Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Smartphone className="h-4 w-4 text-purple-600" />
                          <Label htmlFor={`push-${category}`}>Push</Label>
                        </div>
                        <Switch 
                          id={`push-${category}`}
                          checked={categoryPrefs?.pushEnabled ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              category,
                              preferences: { pushEnabled: checked }
                            });
                          }}
                        />
                        {categoryPrefs?.pushEnabled && (
                          <div>
                            <Label className="text-xs">Minutes before</Label>
                            <Input 
                              type="number" 
                              value={categoryPrefs?.pushAdvanceMinutes ?? 5}
                              onChange={(e) => {
                                updatePreferencesMutation.mutate({
                                  category,
                                  preferences: { pushAdvanceMinutes: parseInt(e.target.value) }
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                        )}
                      </div>

                      {/* Reminder Notifications */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Bell className="h-4 w-4 text-orange-600" />
                          <Label htmlFor={`reminder-${category}`}>Reminder</Label>
                        </div>
                        <Switch 
                          id={`reminder-${category}`}
                          checked={categoryPrefs?.reminderEnabled ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              category,
                              preferences: { reminderEnabled: checked }
                            });
                          }}
                        />
                        {categoryPrefs?.reminderEnabled && (
                          <div>
                            <Label className="text-xs">Minutes before</Label>
                            <Input 
                              type="number" 
                              value={categoryPrefs?.reminderAdvanceMinutes ?? 60}
                              onChange={(e) => {
                                updatePreferencesMutation.mutate({
                                  category,
                                  preferences: { reminderAdvanceMinutes: parseInt(e.target.value) }
                                });
                              }}
                              className="h-8"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {categoryPrefs?.isOptimized && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                        <CheckCircle className="h-4 w-4" />
                        Optimized on {categoryPrefs.lastOptimizedAt ? new Date(categoryPrefs.lastOptimizedAt).toLocaleDateString() : 'recently'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}