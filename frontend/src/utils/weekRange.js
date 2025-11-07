// src/utils/weekRange.js
import { addDays } from 'date-fns';

export function getIsoWeekBoundsFromDate(date) {
  const d = new Date(date);
  const jsDow = d.getDay();             // Sun=0..Sat=6
  const offsetToMonday = (jsDow + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - offsetToMonday);
  const sunday = addDays(monday, 6);
  // normalize to local midnight for cleaner ISO strings
  monday.setHours(0,0,0,0);
  sunday.setHours(23,59,59,999);
  return { weekStart: monday, weekEnd: sunday };
}

// ✨ NEW: Helper to get ISO date string (YYYY-MM-DD)
export function toISODate(date) {
  return new Date(date).toISOString().split('T')[0];
}

// ✨ NEW: Format week range for display
export function formatWeekRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${s.toLocaleDateString('en-IN', opts)} - ${e.toLocaleDateString('en-IN', opts)}`;
}
