"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { MeetVideoGrid } from "@/components/meet/MeetVideoGrid";
import { MeetControls } from "@/components/meet/MeetControls";
import { MeetParticipantsPanel } from "@/components/meet/MeetParticipantsPanel";
import { MeetChatPanel } from "@/components/meet/MeetChatPanel";
import { MeetStatusBanner } from "@/components/meet/MeetStatusBanner";
import { useMeetStore } from "@/hooks/useMeetStore";
import { useMeetClient } from "@/hooks/useMeetClient";
import { getSessionById } from "@/services/session.service";
import { SessionData } from "@/types/session";

export default function SessionMeetPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params?.sessionId ?? null;
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const livekitCredentials = useMeetStore((state) => state.livekitCredentials);
  const showChat = useMeetStore((state) => state.showChat);
  const showParticipants = useMeetStore((state) => state.showParticipants);
  const toggleChat = useMeetStore((state) => state.toggleChat);
  const toggleParticipants = useMeetStore((state) => state.toggleParticipants);
  const setLiveKitConnected = useMeetStore((state) => state.setLiveKitConnected);

  const { 
    sendChatMessage, 
    loadMessageHistory, 
    emitToggleMedia, 
    emitScreenShareEvent, 
    leaveSession,
    startRecording,
    stopRecording,
    kickParticipant,
    stopParticipantMedia
  } = useMeetClient({
      sessionId,
      autoJoin: Boolean(sessionId),
    });

  useEffect(() => {
    if (!sessionId) return;
    let ignore = false;

    (async () => {
      setLoadingSession(true);
      setSessionError(null);
      try {
        const response = await getSessionById(sessionId);
        if (!ignore) {
          setSession(response?.data || response);
        }
      } catch (error: unknown) {
        if (!ignore) {
          const message = error instanceof Error ? error.message : "Session not found.";
          setSessionError(message);
        }
      } finally {
        if (!ignore) {
          setLoadingSession(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const leaveAndNavigate = () => {
    leaveSession();
    router.back();
  };

  const headerTitle = session?.class?.name
    ? `${session.class.name} — ${session.metadata?.topic ?? "Live session"}`
    : "Live session";

  return (
    <div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Compact header */}
      <div className="flex-shrink-0 border-b border-border/40 bg-background px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold leading-tight">{headerTitle}</h1>
            {session && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(session.start_time), "PPpp")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status banner - only show if needed */}
      <div className="flex-shrink-0 px-4 py-2">
        <MeetStatusBanner />
        {sessionError && (
          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {sessionError}
          </div>
        )}
      </div>

      {/* Main meeting area - takes remaining space */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 sm:px-4 pb-2 sm:pb-4 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent" style={{ width: "100%", height: "100%" }}>
          {loadingSession ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : livekitCredentials ? (
            <LiveKitRoom
              token={livekitCredentials.accessToken}
              serverUrl={livekitCredentials.url}
              connect
              video
              audio
              data-lk-theme="default"
              className="flex h-full flex-col"
              onConnected={() => setLiveKitConnected(true)}
              onDisconnected={() => setLiveKitConnected(false)}
            >
              <div className="flex h-full min-h-0 flex-col">
                <MeetVideoGrid />
                <MeetControls
                  sessionId={sessionId}
                  onLeave={leaveAndNavigate}
                  emitToggleMedia={emitToggleMedia}
                  emitScreenShareEvent={emitScreenShareEvent}
                  startRecording={startRecording}
                  stopRecording={stopRecording}
                  toggleChat={toggleChat}
                  toggleParticipants={toggleParticipants}
                />
              </div>
            </LiveKitRoom>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Waiting for join approval...
            </div>
          )}
        </div>

        {showParticipants && (
          <div className="flex-shrink-0">
            <MeetParticipantsPanel 
              kickParticipant={kickParticipant}
              stopParticipantMedia={stopParticipantMedia}
            />
          </div>
        )}

        {showChat && (
          <div className="flex-shrink-0">
            <MeetChatPanel
              onSendMessage={sendChatMessage}
              onLoadMore={(before) => loadMessageHistory(before ? { before } : undefined)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
