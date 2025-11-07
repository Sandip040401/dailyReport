// src/utils/dateUtils.js

// ============================================================================
// UTILITY FUNCTIONS - Date-only arithmetic (no timezone conversions)
// ============================================================================

const pad2 = (n) => String(n).padStart(2, '0');

// Convert YYYY-MM-DD string to local Date object (for calculations only)
const fromYMD = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Convert Date object to YYYY-MM-DD string (local date, no UTC)
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Get day of week as 1-7 (Monday=1, Sunday=7) from YYYY-MM-DD
const dayOfWeek1to7 = (ymd) => {
  const d = fromYMD(ymd);
  const dow0 = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  return dow0 === 0 ? 7 : dow0;
};

// ============================================================================
// ISO WEEK NUMBER (Monday-based, ISO 8601 standard)
// ============================================================================

/**
 * Get ISO week number for a given date
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {{week: number, year: number}}
 */
export const getWeekNumber = (date) => {
  const d = typeof date === 'string' ? fromYMD(date) : new Date(date);
  const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utcDate.getUTCDay() || 7; // Monday=1, Sunday=7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return { week, year: utcDate.getUTCFullYear() };
};

/**
 * Get date range (Monday-Sunday) for a specific ISO week number
 * @param {number} weekNumber - ISO week number
 * @param {number} year - Year
 * @returns {{startDate: Date, endDate: Date}}
 */
export const getWeekDateRange = (weekNumber, year) => {
  // January 4th is always in week 1 (ISO standard)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Monday=1, Sunday=7
  
  // Find Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  
  // Calculate Monday of target week
  const startDate = new Date(week1Monday);
  startDate.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  
  // Calculate Sunday (6 days after Monday)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  
  return { startDate, endDate };
};

// ============================================================================
// WEEK CALCULATIONS (Date-only, Monday-Sunday, no timezone issues)
// ============================================================================

/**
 * Get Monday of the week for any given date (YYYY-MM-DD)
 * @param {string|Date} date - YYYY-MM-DD string or Date object
 * @returns {string} Monday date in YYYY-MM-DD format
 */
export const getWeekStart = (date) => {
  const ymd = typeof date === 'string' ? date : toYMD(date);
  const d = fromYMD(ymd);
  const dow = dayOfWeek1to7(ymd); // 1=Monday, 7=Sunday
  d.setDate(d.getDate() - (dow - 1)); // Go back to Monday
  return toYMD(d);
};

/**
 * Get Sunday of the week for a given Monday (YYYY-MM-DD)
 * @param {string} mondayYmd - Monday date in YYYY-MM-DD format
 * @returns {string} Sunday date in YYYY-MM-DD format
 */
export const getWeekEnd = (mondayYmd) => {
  const d = fromYMD(mondayYmd);
  d.setDate(d.getDate() + 6); // Add exactly 6 days to get Sunday
  return toYMD(d);
};

/**
 * Get full week range (Monday-Sunday) from any date
 * @param {string|Date} date - YYYY-MM-DD string or Date object
 * @returns {{start: string, end: string}} Week range in YYYY-MM-DD format
 */
export const getWeekRangeFromDate = (date) => {
  const start = getWeekStart(date);
  const end = getWeekEnd(start);
  return { start, end };
};

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format a date for display
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {string} Formatted date (e.g., "07 Nov, 2025")
 */
export const formatDate = (date) => {
  const d = typeof date === 'string' ? fromYMD(date) : new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Format a week range for display
 * @param {string} startYmd - Monday date in YYYY-MM-DD format
 * @param {string} endYmd - Sunday date in YYYY-MM-DD format
 * @returns {string} Formatted range (e.g., "04 Nov, 2025 - 10 Nov, 2025")
 */
export const formatWeekRange = (startYmd, endYmd) => {
  const start = fromYMD(startYmd);
  const end = fromYMD(endYmd);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('en-IN', opts)} - ${end.toLocaleDateString('en-IN', opts)}`;
};

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Get previous week's Monday-Sunday range
 * @param {string} currentMondayYmd - Current Monday in YYYY-MM-DD format
 * @returns {{start: string, end: string}}
 */
export const getPreviousWeek = (currentMondayYmd) => {
  const d = fromYMD(currentMondayYmd);
  d.setDate(d.getDate() - 7);
  const start = toYMD(d);
  const end = getWeekEnd(start);
  return { start, end };
};

/**
 * Get next week's Monday-Sunday range
 * @param {string} currentMondayYmd - Current Monday in YYYY-MM-DD format
 * @returns {{start: string, end: string}}
 */
export const getNextWeek = (currentMondayYmd) => {
  const d = fromYMD(currentMondayYmd);
  d.setDate(d.getDate() + 7);
  const start = toYMD(d);
  const end = getWeekEnd(start);
  return { start, end };
};

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
export const getTodayYMD = () => {
  const today = new Date();
  return toYMD(today);
};

/**
 * Get current week's Monday-Sunday range
 * @returns {{start: string, end: string}}
 */
export const getCurrentWeek = () => {
  const today = getTodayYMD();
  return getWeekRangeFromDate(today);
};
