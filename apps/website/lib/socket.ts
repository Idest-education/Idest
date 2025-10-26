"use client";

import { io } from "socket.io-client";

const API_WS_URL = process.env.NEXT_PUBLIC_API_WS_URL || "http://localhost:8001";

export const socket = io(`${API_WS_URL}/conversation`, {
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
