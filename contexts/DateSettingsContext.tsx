import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

interface DateSettings {
  defaultStartDate: string;
  autoSetToToday: boolean;
}

interface DateSettingsContextType {
  defaultDate: Date;
  dateSettings: DateSettings | undefined;
  isAutoSetToToday: boolean;
  isLoading: boolean;
  updateDateSettings: (settings: DateSettings) => void;
  forceRefresh: () => void;
}

const DateSettingsContext = createContext<DateSettingsContextType | undefined>(undefined);

export function DateSettingsProvider({ children }: { children: ReactNode }) {
  const [localSettings, setLocalSettings] = useState<DateSettings | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Fetch from API
  const { data: apiSettings, isLoading, refetch } = useQuery<DateSettings>({
    queryKey: ['/api/date-settings'],
    staleTime: 0,
    gcTime: 0,
  });

  // Use local settings if available, otherwise use API settings
  const effectiveSettings = localSettings || apiSettings;

  // Calculate default date
  const defaultDate = React.useMemo(() => {
    if (!effectiveSettings) return new Date();
    
    if (effectiveSettings.autoSetToToday) {
      return new Date();
    } else {
      try {
        const date = new Date(effectiveSettings.defaultStartDate);
        return isNaN(date.getTime()) ? new Date() : date;
      } catch {
        return new Date();
      }
    }
  }, [effectiveSettings]);

  // Update local settings and trigger refresh
  const updateDateSettings = (settings: DateSettings) => {
    console.log('Updating date settings in context:', settings);
    setLocalSettings(settings);
    setLastUpdate(Date.now());
  };

  const forceRefresh = () => {
    console.log('Force refreshing date settings');
    setLastUpdate(Date.now());
    refetch();
  };

  // Listen for external updates
  useEffect(() => {
    const handleStorageChange = () => {
      const trigger = localStorage.getItem('dateSettingsUpdateTrigger');
      if (trigger) {
        const triggerTime = parseInt(trigger);
        if (triggerTime > lastUpdate) {
          console.log('External date settings update detected');
          setLastUpdate(triggerTime);
          refetch();
        }
      }
    };

    const handleWindowEvent = () => {
      console.log('Window event date settings update');
      forceRefresh();
    };

    window.addEventListener('dateSettingsUpdated', handleWindowEvent);
    window.addEventListener('storage', handleStorageChange);

    const pollInterval = setInterval(handleStorageChange, 300);

    return () => {
      window.removeEventListener('dateSettingsUpdated', handleWindowEvent);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [lastUpdate, refetch]);

  // Sync local settings with API settings when API data changes
  useEffect(() => {
    if (apiSettings && !localSettings) {
      setLocalSettings(apiSettings);
    }
  }, [apiSettings, localSettings]);

  const value: DateSettingsContextType = {
    defaultDate,
    dateSettings: effectiveSettings,
    isAutoSetToToday: effectiveSettings?.autoSetToToday ?? true,
    isLoading,
    updateDateSettings,
    forceRefresh,
  };

  return (
    <DateSettingsContext.Provider value={value}>
      {children}
    </DateSettingsContext.Provider>
  );
}

export function useDateSettings() {
  const context = useContext(DateSettingsContext);
  if (context === undefined) {
    throw new Error('useDateSettings must be used within a DateSettingsProvider');
  }
  return context;
}