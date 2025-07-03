// Enhanced reactive store for date settings with immediate synchronization
interface DateSettings {
  defaultStartDate: string;
}

class DateStore {
  private settings: DateSettings | null = null;
  private listeners: Set<() => void> = new Set();

  getSettings(): DateSettings | null {
    if (!this.settings) {
      // Try localStorage first
      const cached = localStorage.getItem('dateSettingsCache');
      if (cached) {
        try {
          this.settings = JSON.parse(cached);
        } catch (e) {
          console.warn('Failed to parse cached date settings');
        }
      }
    }
    return this.settings;
  }

  setSettings(settings: DateSettings) {
    this.settings = settings;
    localStorage.setItem('dateSettingsCache', JSON.stringify(settings));
    // Force immediate notification to all listeners
    setTimeout(() => this.notifyListeners(), 0);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.warn('Error in date store listener:', error);
      }
    });
  }

  getDefaultDate(): Date {
    const settings = this.getSettings();
    if (!settings) return new Date();
    
    try {
      const date = new Date(settings.defaultStartDate);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch {
      return new Date();
    }
  }

  // Force refresh of all components
  forceUpdate() {
    this.notifyListeners();
  }
}

export const dateStore = new DateStore();