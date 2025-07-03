import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  lastOnboardingVersion: string;
  onboardingSkippedAt?: string;
  firstLoginCompleted?: boolean;
}

const CURRENT_ONBOARDING_VERSION = "1.0.0";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user's onboarding state
  const { data: onboardingState, isLoading } = useQuery({
    queryKey: ["/api/user/onboarding"],
    retry: false,
  });

  // Update onboarding state
  const updateOnboardingMutation = useMutation({
    mutationFn: async (state: Partial<OnboardingState>) => {
      return await apiRequest("PATCH", "/api/user/onboarding", state);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding"] });
    },
  });

  // Check if user should see onboarding - only on first login
  useEffect(() => {
    if (!isLoading && onboardingState) {
      const shouldShowOnboarding = 
        !(onboardingState as any).hasCompletedOnboarding && 
        !(onboardingState as any).firstLoginCompleted;
      
      setShowOnboarding(shouldShowOnboarding);
    }
  }, [onboardingState, isLoading]);

  const completeOnboarding = () => {
    updateOnboardingMutation.mutate({
      hasCompletedOnboarding: true,
      lastOnboardingVersion: CURRENT_ONBOARDING_VERSION,
      firstLoginCompleted: true,
    });
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    updateOnboardingMutation.mutate({
      hasCompletedOnboarding: true,
      lastOnboardingVersion: CURRENT_ONBOARDING_VERSION,
      onboardingSkippedAt: new Date().toISOString(),
      firstLoginCompleted: true,
    });
    setShowOnboarding(false);
  };

  const restartOnboarding = () => {
    // Reset onboarding state to trigger walkthrough
    updateOnboardingMutation.mutate({
      hasCompletedOnboarding: false,
      lastOnboardingVersion: "",
      firstLoginCompleted: false,
    });
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    isLoading,
    completeOnboarding,
    skipOnboarding,
    restartOnboarding,
    onboardingState,
  };
}