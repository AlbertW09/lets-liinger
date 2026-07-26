import { ThemeColor } from '@/constants/theme';
import { createElement } from 'react';

interface DateTimeFieldProps {
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  colors: Record<ThemeColor, string>;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toInputValue(mode: 'date' | 'time', value: Date | null): string {
  if (!value) return '';
  return mode === 'date'
    ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

// Web has no native RN date/time picker, so fall back to the browser's
// built-in <input type="date"/"time">, which renders its own OS picker.
export function DateTimeField({ mode, value, onChange, colors }: DateTimeFieldProps) {
  function handleChange(event: any) {
    const raw: string = event.target.value;
    if (!raw) return;
    const next = value ? new Date(value.getTime()) : new Date();
    if (mode === 'date') {
      const [y, m, d] = raw.split('-').map(Number);
      next.setFullYear(y, m - 1, d);
    } else {
      const [h, min] = raw.split(':').map(Number);
      next.setHours(h, min, 0, 0);
    }
    onChange(next);
  }

  return createElement('input', {
    type: mode,
    value: toInputValue(mode, value),
    onChange: handleChange,
    style: {
      backgroundColor: colors.backgroundElement,
      color: colors.text,
      border: `2px solid ${colors.border}`,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
    },
  });
}
