/**
 * Bharat Validator — loose date parsing.
 *
 * Packaged-label dates in India are printed in several common formats
 * (DD/MM/YYYY, MM/YYYY, DD MMM YYYY, "MFG 06/2026", etc.). This helper
 * only checks whether a value is a STRUCTURALLY plausible calendar date
 * in one of those common shapes — it never guesses a value, and it never
 * asserts a specific legal date-format requirement (the project does not
 * carry a specific citation for one), only that what the AI extracted is
 * internally consistent as a date.
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const isValidCalendarDate = (day: number, month: number, year: number): boolean => {
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
};

/**
 * Returns true when `value` structurally matches a recognized date (or
 * month/year) format AND resolves to a real calendar date. Strips common
 * label prefixes like "MFG:", "EXP:", "USE BY", "BEST BEFORE" before
 * matching, since those are legitimate label conventions, not part of
 * the date itself.
 */
export const isPlausibleLabelDate = (rawValue: string): boolean => {
  const value = rawValue
    .replace(/^(mfg|mfd|exp|expiry|use by|best before|pkd|packed on|packaging date)[.:]?\s*/i, '')
    .trim();

  if (!value) return false;

  // DD/MM/YYYY or DD-MM-YYYY (also accepts 2-digit year)
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(value);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return isValidCalendarDate(day, month, year);
  }

  // MM/YYYY or MM-YYYY (month/year only, common for "Best Before")
  m = /^(\d{1,2})[/-](\d{4})$/.exec(value);
  if (m) {
    const month = parseInt(m[1], 10);
    const year = parseInt(m[2], 10);
    return isValidCalendarDate(1, month, year);
  }

  // YYYY-MM-DD (ISO-like)
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return isValidCalendarDate(day, month, year);
  }

  // DD MMM YYYY / DD-MMM-YYYY (e.g. "06 Jun 2026", "06-Jun-2026")
  m = /^(\d{1,2})[\s-]([a-zA-Z]{3,4})[\s.-]?(\d{4})$/.exec(value);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTH_NAMES[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (!month) return false;
    return isValidCalendarDate(day, month, year);
  }

  // MMM YYYY (e.g. "Jun 2026")
  m = /^([a-zA-Z]{3,4})[\s.-]?(\d{4})$/.exec(value);
  if (m) {
    const month = MONTH_NAMES[m[1].toLowerCase()];
    const year = parseInt(m[2], 10);
    if (!month) return false;
    return isValidCalendarDate(1, month, year);
  }

  return false;
};
