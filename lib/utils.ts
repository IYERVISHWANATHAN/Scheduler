import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parse } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string): string {
  try {
    if (!time || typeof time !== 'string') return '';
    const parsed = parse(time, 'HH:mm', new Date());
    if (isNaN(parsed.getTime())) return time;
    return format(parsed, 'h:mm a');
  } catch {
    return time;
  }
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 20 && minute > 0) break; // Stop at 8:00 PM
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    liquor: '#d85a51',
    confectionary: '#FFE799',
    pnc: '#ffa4c6',
    tobacco: '#b18d00',
    fashion: '#9f438d',
    destination: '#e6a27e'
  };
  return colors[category] || '#95A5A6';
}

export function formatDate(date: Date): string {
  return format(date, 'EEEE, MMMM d, yyyy');
}
