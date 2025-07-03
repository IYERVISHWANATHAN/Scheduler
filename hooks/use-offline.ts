import { useState, useEffect } from 'react';

// Hook for managing offline functionality and data persistence
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Store data for offline access
  const storeOfflineData = (key: string, data: any) => {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to store offline data:', error);
    }
  };

  // Retrieve offline data
  const getOfflineData = (key: string) => {
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data;
      }
    } catch (error) {
      console.warn('Failed to retrieve offline data:', error);
    }
    return null;
  };

  // Queue operations for when back online
  const queueOperation = (operation: any) => {
    try {
      const queue = JSON.parse(localStorage.getItem('operation_queue') || '[]');
      queue.push({
        ...operation,
        timestamp: Date.now()
      });
      localStorage.setItem('operation_queue', JSON.stringify(queue));
    } catch (error) {
      console.warn('Failed to queue operation:', error);
    }
  };

  // Process queued operations when back online
  const processQueue = async () => {
    if (!isOnline) return;

    try {
      const queue = JSON.parse(localStorage.getItem('operation_queue') || '[]');
      
      for (const operation of queue) {
        try {
          // Process each queued operation
          await fetch(operation.url, {
            method: operation.method,
            headers: operation.headers,
            body: operation.body
          });
        } catch (error) {
          console.warn('Failed to process queued operation:', error);
        }
      }

      // Clear the queue after processing
      localStorage.setItem('operation_queue', '[]');
    } catch (error) {
      console.warn('Failed to process operation queue:', error);
    }
  };

  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline]);

  return {
    isOnline,
    storeOfflineData,
    getOfflineData,
    queueOperation,
    processQueue
  };
}