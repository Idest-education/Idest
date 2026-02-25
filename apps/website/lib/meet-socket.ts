"use client";

import { io, Socket } from "socket.io-client";

function toWebSocketUrl(url: string) {
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  return `wss://${url}`;
}

function getMeetBaseUrl() {
  const meetUrl = process.env.NEXT_PUBLIC_MEET_WS_URL || process.env.NEXT_PUBLIC_MEET_URL;
  if (meetUrl) return meetUrl;
  return process.env.NEXT_PUBLIC_API_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
}

export function getMeetSocketUrl() {
  const base = toWebSocketUrl(getMeetBaseUrl());
  return base.endsWith("/meet") ? base : `${base}/meet`;
}

export function createMeetSocket(token: string): Socket {
  const socket = io(getMeetSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
  });

  socket.auth = { token };
  return socket;
}

