import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import OnboardingWalkthrough from "@/components/onboarding-walkthrough";
import CalendarPage from "@/pages/calendar";
import WeekPage from "@/pages/week";
import SettingsPage from "@/pages/settings";
import CategoriesPage from "@/pages/categories";
import AnalyticsPage from "@/pages/analytics";
import ConflictsPage from "@/pages/conflicts";
import MeetingListPage from "@/pages/meeting-list";
import LoginPage from "@/pages/login";
import ChangeLogsPage from "@/pages/change-logs";
import DateSettingsPage from "@/pages/date-settings";
import NotificationOptimizer from "@/pages/notification-optimizer";
import DailySchedulePage from "@/pages/daily-schedule";
import NotFound from "@/pages/not-found";

function AuthenticatedRoutes() {
  const { user, isLoading } = useAuth();
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="relative">
      <Switch>
        <Route path="/" component={WeekPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/week" component={WeekPage} />
        <Route path="/daily-schedule" component={DailySchedulePage} />
        <Route path="/meetings" component={MeetingListPage} />
        <Route path="/conflicts" component={ConflictsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/categories" component={CategoriesPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/notifications" component={NotificationOptimizer} />
        <Route path="/change-logs" component={ChangeLogsPage} />
        <Route path="/date-settings" component={DateSettingsPage} />
        <Route component={NotFound} />
      </Switch>
      
      {showOnboarding && (
        <OnboardingWalkthrough
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="*" component={AuthenticatedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="meeting-scheduler-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
