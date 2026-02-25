"use client";

import { io } from "socket.io-client";

/**
 * Get WebSocket URL for conversation socket
 * Uses NEXT_PUBLIC_CONVERSATION_URL if available, otherwise falls back to NEXT_PUBLIC_API_WS_URL
 */
function getConversationWebSocketUrl(): string {
  // Use dedicated CONVERSATION_URL if available
  if (process.env.NEXT_PUBLIC_CONVERSATION_URL) {
    const conversationUrl = process.env.NEXT_PUBLIC_CONVERSATION_URL;
    // Convert http/https to ws/wss
    if (conversationUrl.startsWith("http://")) {
      return conversationUrl.replace("http://", "ws://");
    } else if (conversationUrl.startsWith("https://")) {
      return conversationUrl.replace("https://", "wss://");
    } else if (conversationUrl.startsWith("ws://") || conversationUrl.startsWith("wss://")) {
      return conversationUrl;
    }
    // If no protocol, assume https and convert to wss
    return `wss://${conversationUrl}`;
  }
  
  // Fallback to old API_WS_URL
  const apiWsUrl = process.env.NEXT_PUBLIC_API_WS_URL || "http://localhost:8001";
  
  // Convert http/https to ws/wss
  if (apiWsUrl.startsWith("http://")) {
    return apiWsUrl.replace("http://", "ws://");
  } else if (apiWsUrl.startsWith("https://")) {
    return apiWsUrl.replace("https://", "wss://");
  } else if (apiWsUrl.startsWith("ws://") || apiWsUrl.startsWith("wss://")) {
    return apiWsUrl;
  }
  
  return `ws://${apiWsUrl}`;
}

const CONVERSATION_WS_URL = getConversationWebSocketUrl();

// URL already includes /conversation path from NEXT_PUBLIC_CONVERSATION_URL
// If it ends with /conversation, use as-is, otherwise append /conversation namespace
const socketUrl = CONVERSATION_WS_URL.endsWith("/conversation") 
  ? CONVERSATION_WS_URL 
  : `${CONVERSATION_WS_URL}/conversation`;

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket"],
  withCredentials: true,
});

/**
 * Kết nối lại socket khi người dùng có token
 */
export function connectSocket(token: string) {
  if (!socket.connected) {
    socket.auth = { token };
    socket.connect();
  }
}

/**
 * Ngắt kết nối khi user logout hoặc rời app
 */
export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
