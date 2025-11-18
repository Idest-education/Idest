"use client";

import { io, Socket } from "socket.io-client";

/**
 * Get WebSocket URL from environment variable
 * Uses NEXT_PUBLIC_MEET_URL if available, otherwise constructs from API URL
 */
function getWebSocketUrl(): string {
  // Use dedicated MEET_URL if available
  if (process.env.NEXT_PUBLIC_MEET_URL) {
    const meetUrl = process.env.NEXT_PUBLIC_MEET_URL;
    // Convert http/https to ws/wss
    if (meetUrl.startsWith("http://")) {
      return meetUrl.replace("http://", "ws://");
    } else if (meetUrl.startsWith("https://")) {
      return meetUrl.replace("https://", "wss://");
    } else if (meetUrl.startsWith("ws://") || meetUrl.startsWith("wss://")) {
      return meetUrl;
    }
    // If no protocol, assume https and convert to wss
    return `wss://${meetUrl}`;
  }
  
  // Fallback: Construct from API URL (for backwards compatibility)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  try {
    const url = new URL(apiUrl);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const hostname = url.hostname;
    const port = "3002";
    
    return `${protocol}//${hostname}:${port}`;
  } catch {
    // Fallback if URL parsing fails
    const isSecure = apiUrl.startsWith("https://");
    const protocol = isSecure ? "wss:" : "ws:";
    const hostname = apiUrl.replace(/^https?:\/\//, "").split(":")[0];
    
    return `${protocol}//${hostname}:3002`;
  }
}

const MEET_WS_URL = getWebSocketUrl();

// Debug: Log the WebSocket URL
console.log("Meet WebSocket URL:", MEET_WS_URL);

let meetSocket: Socket | null = null;
let isInitialized = false;

/**
 * Get or create the Meet socket instance
 */
export function getMeetSocket(): Socket {
  if (!meetSocket || !isInitialized) {
    // MEET_WS_URL already includes the /meet path from NEXT_PUBLIC_MEET_URL
    // If it ends with /meet, use as-is, otherwise append /meet namespace
    const socketUrl = MEET_WS_URL.endsWith("/meet") 
      ? MEET_WS_URL 
      : `${MEET_WS_URL}/meet`;
    
    if (!isInitialized) {
      console.log("Initializing Socket.IO connection to:", socketUrl);
      isInitialized = true;
    }
    
    meetSocket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"], // Allow fallback to polling
      withCredentials: true,
      reconnection: true, // Enable auto-reconnection
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    });
    
    // Add connection error logging (only once)
    meetSocket.on("connect_error", (error) => {
      console.error("Meet socket connection error:", error.message, error);
    });
    
    // Log all disconnect events (only once)
    meetSocket.on("disconnect", (reason, details) => {
      console.log("Meet socket disconnected:", reason, details);
    });
  }
  return meetSocket;
}

let connectionAttempts = 0;
let isConnecting = false;

/**
 * Connect to Meet WebSocket with JWT token
 */
export function connectMeetSocket(token: string): Socket {
  const socket = getMeetSocket();
  
  // Early returns to prevent duplicate connections
  if (socket.connected) {
    return socket;
  }
  
  if (isConnecting) {
    console.log("Connection already in progress, skipping...");
    return socket;
  }
  
  isConnecting = true;
  connectionAttempts++;
  
  // Validate token before connecting
  if (!token || token.trim() === "") {
    console.error("Invalid token provided");
    isConnecting = false;
    throw new Error("Invalid authentication token");
  }
  
  // Set auth before connecting (Socket.IO v4+ uses auth for middleware)
  socket.auth = { token };
  
  // Log token length only in development (no token content)
  if (process.env.NODE_ENV === 'development') {
    console.log("Token length:", token.length);
  }
  
  // Clean up any existing once listeners before adding new ones
  socket.removeAllListeners("connect");
  socket.removeAllListeners("disconnect");
  
  // Add event listeners for debugging (only once per connection attempt)
  socket.once("connect", () => {
    isConnecting = false;
    console.log("Meet socket connected successfully, ID:", socket.id);
  });
  
  socket.once("disconnect", (reason) => {
    isConnecting = false;
    if (reason === "io client disconnect") {
      console.log("Socket disconnected by client");
    } else {
      console.log("Meet socket disconnected:", reason);
    }
  });
  
  socket.once("connect_error", () => {
    isConnecting = false;
  });
  
  console.log(`Connecting to Meet socket (attempt ${connectionAttempts})`);
  socket.connect();
  
  return socket;
}

/**
 * Disconnect from Meet WebSocket
 */
export function disconnectMeetSocket(): void {
  const socket = getMeetSocket();
  
  if (socket.connected) {
    socket.disconnect();
  }
}

/**
 * Check if Meet socket is connected
 */
export function isMeetSocketConnected(): boolean {
  const socket = getMeetSocket();
  return socket.connected;
}

