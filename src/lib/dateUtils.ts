/**
 * Unified Date & Time Utilities for EYE Gharbia Platform
 * 
 * Ensures 100% consistent date/time handling across Egypt (Africa/Cairo timezone, UTC+3 summer / UTC+2 winter).
 * Fixes timezone drift between <input type="datetime-local">, Supabase TIMESTAMPTZ, and UI displays.
 */

export const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * Parses any date input safely into a valid Date object.
 * Returns null if invalid or missing.
 */
export function parseAnyDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Handle naive "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm" without timezone
    if (!trimmed.includes('Z') && !/[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(/[T ]/);
      if (parts.length >= 2) {
        const [y, m, d] = parts[0].split('-').map(Number);
        const timeSub = parts[1].split(':').map(Number);
        const hours = timeSub[0] || 0;
        const minutes = timeSub[1] || 0;
        const seconds = timeSub[2] || 0;
        const localDate = new Date(y, m - 1, d, hours, minutes, seconds);
        if (!isNaN(localDate.getTime())) return localDate;
      }
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Converts a string from <input type="datetime-local"> (e.g. "2026-09-05T20:00")
 * into an accurate UTC ISO-8601 string (e.g. "2026-09-05T17:00:00.000Z") for Supabase / database storage.
 * If the input already contains timezone info or is already an ISO string, preserves it safely.
 */
export function localInputToIso(datetimeLocalValue: string | null | undefined): string {
  if (!datetimeLocalValue || typeof datetimeLocalValue !== 'string') return '';
  const trimmed = datetimeLocalValue.trim();
  if (!trimmed) return '';

  // If already an ISO string with timezone offset, just normalize
  if (trimmed.includes('Z') || /[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return !isNaN(parsed.getTime()) ? parsed.toISOString() : trimmed;
  }

  // Parse as local browser date (Egypt time)
  const parts = trimmed.split(/[T ]/);
  if (parts.length >= 2) {
    const [y, m, d] = parts[0].split('-').map(Number);
    const [h, min, s] = parts[1].split(':').map(Number);
    const localDate = new Date(y, m - 1, d, h || 0, min || 0, s || 0);
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString();
    }
  }

  const fallback = new Date(trimmed);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : trimmed;
}

/**
 * Converts any stored date/time (UTC ISO string or Date) into a value suitable for
 * <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") WITHOUT any timezone shift!
 */
export function dateToLocalInputValue(dateInput: string | number | Date | null | undefined): string {
  const d = parseAnyDate(dateInput);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Formats time in Egyptian standard format: e.g. "09:45 م" or "09:45 PM".
 */
export function formatTime(
  dateInput: string | number | Date | null | undefined,
  locale: 'ar' | 'en' = 'ar',
  includeSeconds = false
): string {
  const d = parseAnyDate(dateInput);
  if (!d) return locale === 'ar' ? 'غير محدد' : 'N/A';

  try {
    const loc = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return d.toLocaleTimeString(loc, {
      timeZone: CAIRO_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
  } catch {
    return d.toLocaleTimeString();
  }
}

/**
 * Formats full date in Egyptian format: e.g. "الأربعاء، 2 سبتمبر 2026" or "Wednesday, 2 September 2026".
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  locale: 'ar' | 'en' = 'ar',
  options?: { showWeekday?: boolean; shortMonth?: boolean }
): string {
  const d = parseAnyDate(dateInput);
  if (!d) return locale === 'ar' ? 'غير محدد' : 'N/A';

  const showWeekday = options?.showWeekday ?? true;
  try {
    const loc = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
    return d.toLocaleDateString(loc, {
      timeZone: CAIRO_TIMEZONE,
      weekday: showWeekday ? 'long' : undefined,
      year: 'numeric',
      month: options?.shortMonth ? 'short' : 'long',
      day: 'numeric',
    });
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Combined Date & Time display:
 * Arabic: "الأربعاء، 2 سبتمبر 2026 — 09:45 م"
 * English: "Wednesday, 2 September 2026 — 09:45 PM"
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  locale: 'ar' | 'en' = 'ar'
): string {
  const d = parseAnyDate(dateInput);
  if (!d) return locale === 'ar' ? 'غير محدد' : 'N/A';

  const dateStr = formatDate(d, locale);
  const timeStr = formatTime(d, locale);
  return `${dateStr} — ${timeStr}`;
}

/**
 * Accurate countdown calculation for task deadlines or meeting starts.
 */
export interface CountdownResult {
  text: string;
  className: string;
  isOverdue: boolean;
  totalMsRemaining: number;
}

export function getAccurateCountdown(
  deadlineInput: string | number | Date | null | undefined,
  locale: 'ar' | 'en' = 'ar'
): CountdownResult {
  const isAr = locale === 'ar';
  if (!deadlineInput) {
    return {
      text: isAr ? 'غير محدد' : 'No deadline',
      className: 'text-slate-400',
      isOverdue: false,
      totalMsRemaining: 0,
    };
  }

  const d = parseAnyDate(deadlineInput);
  if (!d) {
    return {
      text: isAr ? 'غير محدد' : 'Invalid date',
      className: 'text-slate-400',
      isOverdue: false,
      totalMsRemaining: 0,
    };
  }

  const diff = d.getTime() - Date.now();
  if (diff <= 0) {
    return {
      text: isAr ? 'انتهى الوقت! ⚠️' : 'Time ended! ⚠️',
      className: 'text-red-500 font-black',
      isOverdue: true,
      totalMsRemaining: diff,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 2) {
    return {
      text: isAr ? `متبقي ${days} يوم` : `${days} days left`,
      className: 'text-slate-500 font-semibold',
      isOverdue: false,
      totalMsRemaining: diff,
    };
  }
  if (days > 0) {
    return {
      text: isAr ? `متبقي ${days} يوم و ${hours} ساعة` : `${days}d ${hours}h left`,
      className: 'text-amber-600 font-bold',
      isOverdue: false,
      totalMsRemaining: diff,
    };
  }
  if (hours > 2) {
    return {
      text: isAr ? `متبقي ${hours} ساعة` : `${hours} hours left`,
      className: 'text-orange-500 font-black',
      isOverdue: false,
      totalMsRemaining: diff,
    };
  }
  return {
    text: isAr ? `متبقي ${hours} س و ${minutes} د!` : `${hours}h ${minutes}m left!`,
    className: 'text-red-600 font-black animate-pulse',
    isOverdue: false,
    totalMsRemaining: diff,
  };
}
