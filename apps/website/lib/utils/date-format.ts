import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from "date-fns";

/**
 * Format message timestamp with smart relative/absolute time display
 */
export function formatMessageTime(date: Date | string): string {
  const messageDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  // If less than 1 minute ago, show "Just now"
  const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
  if (diffInSeconds < 60) {
    return "Just now";
  }

  // If less than 1 hour ago, show relative time
  if (diffInSeconds < 3600) {
    return formatDistanceToNow(messageDate, { addSuffix: true });
  }

  // If today, show time only
  if (isToday(messageDate)) {
    return format(messageDate, "HH:mm");
  }

  // If yesterday, show "Yesterday HH:mm"
  if (isYesterday(messageDate)) {
    return `Yesterday ${format(messageDate, "HH:mm")}`;
  }

  // If this year, show "MMM DD HH:mm"
  if (isThisYear(messageDate)) {
    return format(messageDate, "MMM dd, HH:mm");
  }

  // Otherwise, show full date
  return format(messageDate, "MMM dd, yyyy HH:mm");
}

/**
 * Format full timestamp for tooltip/hover
 */
export function formatFullTimestamp(date: Date | string): string {
  const messageDate = typeof date === "string" ? new Date(date) : date;
  return format(messageDate, "PPpp"); // Full date and time
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return format(d1, "yyyy-MM-dd") === format(d2, "yyyy-MM-dd");
}

/**
 * Get date separator text for message groups
 */
export function getDateSeparator(date: Date | string): string {
  const messageDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  if (isToday(messageDate)) {
    return "Today";
  }

  if (isYesterday(messageDate)) {
    return "Yesterday";
  }

  if (isThisYear(messageDate)) {
    return format(messageDate, "MMMM dd");
  }

  return format(messageDate, "MMMM dd, yyyy");
}






