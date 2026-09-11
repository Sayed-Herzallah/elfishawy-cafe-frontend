/**
 * Utility functions for central text, date, and number formatting.
 * Enforces English digits (1234567890) inside Arabic layouts.
 */

/**
 * Formats a numeric price into a localized string with English numbers and the currency.
 * Example: 35500 -> "35,500 "
 */
export const formatPrice = (price: number | undefined | null): string => {
  if (price === undefined || price === null || isNaN(Number(price))) {
    return '0 جنيها';
  }
  const formatted = Number(price).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} جنيها`;
};

/**
 * Formats a general number with commas using English digits.
 * Example: 12500 -> "12,500"
 */
export const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(Number(num))) {
    return '0';
  }
  return Number(num).toLocaleString('en-US');
};

/**
 * Formats a date into a clean Arabic-styled date with English digits.
 * Example: "2026-08-21T14:30:00.000Z" -> "21 أغسطس 2026"
 */
export const formatDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const day = date.getDate();
  const monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const month = monthsAr[date.getMonth()];
  const year = date.getFullYear();

  // Return with English numbers (JavaScript string concatenation will use English numbers)
  return `${day} ${month} ${year}`;
};

/**
 * Formats time from an ISO date string with English digits and AM/PM indicators.
 * Example: "2026-08-21T14:30:00.000Z" -> "02:30 PM" (or "02:30 م")
 * We use PM/AM or م/ص as per user-facing layout. The prompt specified PM/AM.
 */
export const formatTime = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Combines date and time into a single unified format.
 * Example: "2026-08-21T14:30:00.000Z" -> "21 أغسطس 2026 • 02:30 م"
 */
export const formatDateTime = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '';
  return `${formatDate(dateInput)} • ${formatTime(dateInput)}`;
};
