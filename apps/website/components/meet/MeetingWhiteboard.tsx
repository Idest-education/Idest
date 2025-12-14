"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Socket } from "socket.io-client";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

// Import Excalidraw CSS
import "@excalidraw/excalidraw/index.css";

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface MeetingWhiteboardProps {
  sessionId: string;
  socket: Socket | null;
  className?: string;
}

export function MeetingWhiteboard({ sessionId, socket, className }: MeetingWhiteboardProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track last update to prevent loops
  const lastUpdateRef = useRef<number>(0);
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Refresh on mount/resize to ensure correct rendering
  useEffect(() => {
    if (excalidrawAPI) {
      // Force a refresh to ensure UI renders correctly
      setTimeout(() => {
        excalidrawAPI.refresh();
      }, 100);
    }
  }, [excalidrawAPI]);

  // Initial sync
  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleWhiteboardState = (payload: { elements: readonly ExcalidrawElement[], appState: Partial<AppState> }) => {
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({
          elements: payload.elements,
          appState: payload.appState,
        });
        setIsLoading(false);
      }
    };

    socket.emit("get-whiteboard-state", { sessionId });
    socket.on("whiteboard-state", handleWhiteboardState);

    return () => {
      socket.off("whiteboard-state", handleWhiteboardState);
    };
  }, [socket, sessionId, excalidrawAPI]);

  // Listen for remote updates
  useEffect(() => {
    if (!socket || !excalidrawAPI) return;

    const handleWhiteboardUpdate = (payload: { userId: string, elements: readonly ExcalidrawElement[], appState: Partial<AppState> }) => {
      isRemoteUpdateRef.current = true;
      excalidrawAPI.updateScene({
        elements: payload.elements,
        // Only sync relevant app state if needed (e.g., viewBackgroundColor)
        // appState: payload.appState, 
      });
      // Reset flag after a short delay to allow React to process
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 50);
    };

    socket.on("whiteboard-update", handleWhiteboardUpdate);

    return () => {
      socket.off("whiteboard-update", handleWhiteboardUpdate);
    };
  }, [socket, excalidrawAPI]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      // Skip if this change was triggered by a remote update
      if (isRemoteUpdateRef.current) return;

      // Debounce or throttle could be added here if needed
      // For now, we'll send updates directly but with a small check to prevent excessive traffic
      const now = Date.now();
      if (now - lastUpdateRef.current < 50) return; // 50ms throttle
      lastUpdateRef.current = now;

      if (socket && sessionId) {
        socket.emit("whiteboard-update", {
          sessionId,
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
          },
        });
      }
    },
    [socket, sessionId]
  );

  return (
    <div className={`h-full w-full overflow-hidden ${className || ""}`}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
}


