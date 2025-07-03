import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dateStore } from '@/lib/date-store';

interface DateSettings {
  defaultStartDate: string;
}

export function useDateStore() {
  const [updateCounter, setUpdateCounter] = useState(0);
  const queryClient = useQueryClient();
  
  // Fetch date settings from database
  const { data: dbSettings, refetch } = useQuery<DateSettings>({
    queryKey: ['/api/date-settings'],
    retry: false,
  });
  
  // Update local store when database settings change
  useEffect(() => {
    if (dbSettings) {
      dateStore.setSettings(dbSettings);
      // Force update all components
      setTimeout(() => dateStore.forceUpdate(), 50);
    }
  }, [dbSettings]);
  
  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = dateStore.subscribe(() => {
      setUpdateCounter(prev => prev + 1);
      // Also invalidate query cache to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/date-settings'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Force refresh when counter changes
  useEffect(() => {
    if (updateCounter > 0) {
      setTimeout(() => refetch(), 100);
    }
  }, [updateCounter, refetch]);

  return {
    settings: dateStore.getSettings() || dbSettings,
    defaultDate: dateStore.getDefaultDate(),
    updateSettings: (settings: DateSettings) => {
      dateStore.setSettings(settings);
      // Force immediate update
      dateStore.forceUpdate();
    },
    _updateCounter: updateCounter // For debugging
  };
}