import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface DateSettings {
  defaultStartDate: string;
  autoSetToToday: boolean;
}

const STORAGE_KEY = 'dateSettingsCache';

export function triggerDateSettingsUpdate() {
  window.dispatchEvent(new CustomEvent('dateSettingsUpdated'));
  localStorage.setItem('dateSettingsUpdateTrigger', Date.now().toString());
}

export function useDefaultDate() {
  const [defaultDate, setDefaultDate] = useState<Date>(new Date());
  const [localSettings, setLocalSettings] = useState<DateSettings | null>(null);

  // Get cached settings from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setLocalSettings(parsed);
      } catch (e) {
        console.warn('Failed to parse cached date settings');
      }
    }
  }, []);

  // Fetch from API as backup
  const { data: apiSettings, refetch } = useQuery<DateSettings>({
    queryKey: ['/api/date-settings'],
    staleTime: 30000, // 30 seconds
  });

  // Use local settings if available, otherwise API settings
  const effectiveSettings = localSettings || apiSettings;

  // Update localStorage when API settings change
  useEffect(() => {
    if (apiSettings && !localSettings) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiSettings));
      setLocalSettings(apiSettings);
    }
  }, [apiSettings, localSettings]);

  // Listen for updates with immediate state sync
  useEffect(() => {
    const handleUpdate = () => {
      console.log('Date settings update triggered');
      // First check localStorage immediately
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          console.log('Updating local settings from cache:', parsed);
          setLocalSettings(parsed);
        } catch (e) {
          console.warn('Cache parse error:', e);
        }
      }
      
      // Then refetch from API as backup
      refetch().then((result) => {
        if (result.data) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
          setLocalSettings(result.data);
        }
      });
    };

    window.addEventListener('dateSettingsUpdated', handleUpdate);
    
    // More aggressive polling for real-time updates
    const pollInterval = setInterval(() => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Compare with current state to avoid unnecessary updates
          if (JSON.stringify(parsed) !== JSON.stringify(localSettings)) {
            console.log('Polling detected change, updating:', parsed);
            setLocalSettings(parsed);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }, 50); // Very fast polling for immediate response

    return () => {
      window.removeEventListener('dateSettingsUpdated', handleUpdate);
      clearInterval(pollInterval);
    };
  }, [refetch, localSettings]);

  // Calculate default date
  useEffect(() => {
    if (effectiveSettings) {
      console.log('Calculating default date from settings:', effectiveSettings);
      if (effectiveSettings.autoSetToToday) {
        setDefaultDate(new Date());
      } else {
        try {
          const configuredDate = new Date(effectiveSettings.defaultStartDate);
          if (!isNaN(configuredDate.getTime())) {
            setDefaultDate(configuredDate);
          } else {
            setDefaultDate(new Date());
          }
        } catch {
          setDefaultDate(new Date());
        }
      }
    }
  }, [effectiveSettings]);

  return {
    defaultDate,
    dateSettings: effectiveSettings,
    isAutoSetToToday: effectiveSettings?.autoSetToToday ?? true,
  };
}