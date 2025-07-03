import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE, type TimezoneValue } from '@shared/schema';

interface TimezoneSelectorProps {
  value?: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

export function TimezoneSelector({ value = DEFAULT_TIMEZONE, onChange, disabled = false }: TimezoneSelectorProps) {
  const [selectedTimezone, setSelectedTimezone] = useState<string>(value);

  const handleTimezoneChange = (newTimezone: string) => {
    setSelectedTimezone(newTimezone);
    onChange(newTimezone);
  };

  const getCurrentTime = (timezone: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch (error) {
      return '--:--:--';
    }
  };

  const selectedOption = TIMEZONE_OPTIONS.find(option => option.value === selectedTimezone);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Timezone Settings
        </CardTitle>
        <CardDescription>
          Set your preferred timezone for displaying meeting times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Timezone</label>
          <Select
            value={selectedTimezone}
            onValueChange={handleTimezoneChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    <span className="text-muted-foreground ml-2">{option.offset}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedOption && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="text-sm">
              <div className="font-medium">Current Time</div>
              <div className="text-2xl font-mono">
                {getCurrentTime(selectedTimezone)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div>Timezone: {selectedOption.label}</div>
              <div>UTC Offset: {selectedOption.offset}</div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            Changing your timezone will affect how meeting times are displayed throughout the application. 
            All times will be automatically converted to your selected timezone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimezoneDisplay({ timezone }: { timezone: string }) {
  const option = TIMEZONE_OPTIONS.find(opt => opt.value === timezone);
  const currentTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Globe className="h-4 w-4" />
      <span>{option?.label || timezone}</span>
      <span className="font-mono">({currentTime})</span>
    </div>
  );
}