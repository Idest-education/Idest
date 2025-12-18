import type { MessageDto } from "@/types/conversation";
import { isSameDay } from "./date-format";

const GROUP_TIME_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

export interface GroupedMessage {
  message: MessageDto;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showDateSeparator: boolean;
  showSenderInfo: boolean;
}

/**
 * Group consecutive messages from the same sender
 * and determine what UI elements to show for each message
 */
export function groupMessages(messages: MessageDto[]): GroupedMessage[] {
  if (messages.length === 0) return [];

  const grouped: GroupedMessage[] = [];
  let prevMessage: MessageDto | null = null;

  messages.forEach((message, index) => {
    const isFirst = index === 0;
    const isLast = index === messages.length - 1;

    // Check if we need a date separator
    const showDateSeparator =
      isFirst ||
      (!!prevMessage && !isSameDay(prevMessage.sentAt, message.sentAt));

    // Check if this message starts a new group
    const isNewGroup =
      !prevMessage ||
      prevMessage.senderId !== message.senderId ||
      new Date(message.sentAt).getTime() -
        new Date(prevMessage.sentAt).getTime() >
        GROUP_TIME_THRESHOLD_MS;

    const isFirstInGroup = isNewGroup;
    const isLastInGroup =
      isLast ||
      (messages[index + 1] &&
        (messages[index + 1].senderId !== message.senderId ||
          new Date(messages[index + 1].sentAt).getTime() -
            new Date(message.sentAt).getTime() >
            GROUP_TIME_THRESHOLD_MS));

    // Show sender info for first message in group (only for received messages)
    const currentUserId =
      typeof window !== "undefined"
        ? localStorage.getItem("user_id")
        : null;
    const showSenderInfo =
      isFirstInGroup && message.senderId !== currentUserId;

    grouped.push({
      message,
      isFirstInGroup,
      isLastInGroup,
      showDateSeparator,
      showSenderInfo,
    });

    prevMessage = message;
  });

  return grouped;
}




