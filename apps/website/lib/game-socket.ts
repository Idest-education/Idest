"use client";

import { io, Socket } from "socket.io-client";

function getGameSocketUrl() {
  const base = process.env.NEXT_PUBLIC_MEET_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const normalized = base.replace(/\/$/, "");
  return normalized.endsWith("/game") ? normalized : `${normalized}/game`;
}

export function createGameSocket(token: string): Socket {
  const socket = io(getGameSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
  });
  socket.auth = { token };
  return socket;
}
