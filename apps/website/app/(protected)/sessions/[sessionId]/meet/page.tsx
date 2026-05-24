"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Track, LocalTrackPublication, RemoteTrackPublication, Participant } from "livekit-client";
import { MeetVideoGrid } from "@/components/meet/MeetVideoGrid";
import { MeetControls } from "@/components/meet/MeetControls";
import { MeetParticipantsPanel } from "@/components/meet/MeetParticipantsPanel";
import { MeetChatPanel } from "@/components/meet/MeetChatPanel";
import { MeetStatusBanner } from "@/components/meet/MeetStatusBanner";
import { MeetingWhiteboard } from "@/components/meet/MeetingWhiteboard";
import { MeetRecordingsDialog } from "@/components/meet/MeetRecordingsDialog";
import { useMeetStore } from "@/hooks/useMeetStore";
import { useMeetClient } from "@/hooks/useMeetClient";
import { getSessionById } from "@/services/session.service";
import { SessionData } from "@/types/session";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MEET_RECORDING_ENABLED =
  process.env.NEXT_PUBLIC_MEET_RECORDING_ENABLED === "true";

// Component to sync LiveKit track events with store state
function TrackStateSync() {
  const room = useRoomContext();
  const localUserId = useMeetStore((state) => state.localUserId);
  const setAudioEnabled = useMeetStore((state) => state.setAudioEnabled);
  const setVideoEnabled = useMeetStore((state) => state.setVideoEnabled);
  const setScreenSharing = useMeetStore((state) => state.setScreenSharing);
  const setParticipantMediaState = useMeetStore((state) => state.setParticipantMediaState);
  const getStoreState = useMeetStore.getState;

  useEffect(() => {
    if (!room || !localUserId) return;

    // Helper to find participant by LiveKit identity (uses latest state)
    const findParticipantByIdentity = (identity: string) => {
      const currentParticipants = getStoreState().participants;
      return Object.values(currentParticipants).find(
        (p) => p.userId === identity || p.socketId === identity
      );
    };

    // Sync local participant track states (only update if changed)
    const syncLocalTracks = () => {
      const currentState = getStoreState();
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

      // Sync microphone state (only if changed)
      const micEnabled = micPub ? (micPub.isMuted === false && micPub.track !== null) : false;
      if (currentState.isAudioEnabled !== micEnabled) {
        setAudioEnabled(micEnabled);
      }

      // Sync camera state (only if changed)
      const cameraEnabled = cameraPub ? (cameraPub.isMuted === false && cameraPub.track !== null) : false;
      if (currentState.isVideoEnabled !== cameraEnabled) {
        setVideoEnabled(cameraEnabled);
      }

      // Sync screen share state (only if changed)
      const screenSharing = screenPub ? (screenPub.track !== null) : false;
      if (currentState.isScreenSharing !== screenSharing) {
        setScreenSharing(screenSharing);
      }
    };

    // Sync all remote participant tracks (only update if changed)
    const syncRemoteTracks = () => {
      const currentState = getStoreState();
      room.remoteParticipants.forEach((participant) => {
        const participantData = findParticipantByIdentity(participant.identity);
        if (!participantData) return;

        const currentParticipant = currentState.participants[participantData.userId];
        if (!currentParticipant) return;

        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        const cameraPub = participant.getTrackPublication(Track.Source.Camera);
        const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);

        const updates: {
          isAudioEnabled?: boolean;
          isVideoEnabled?: boolean;
          isScreenSharing?: boolean;
        } = {};

        // Only update if value actually changed
        if (micPub) {
          const micEnabled = micPub.isMuted === false && micPub.track !== null;
          if (currentParticipant.isAudioEnabled !== micEnabled) {
            updates.isAudioEnabled = micEnabled;
          }
        }

        if (cameraPub) {
          const cameraEnabled = cameraPub.isMuted === false && cameraPub.track !== null;
          if (currentParticipant.isVideoEnabled !== cameraEnabled) {
            updates.isVideoEnabled = cameraEnabled;
          }
        }

        if (screenPub) {
          const screenSharing = screenPub.track !== null;
          if (currentParticipant.isScreenSharing !== screenSharing) {
            updates.isScreenSharing = screenSharing;
          }
        }

        // Only update if there are actual changes
        if (Object.keys(updates).length > 0) {
          setParticipantMediaState(participantData.userId, updates);
        }
      });
    };

    // Full sync function
    const syncAllTracks = () => {
      syncLocalTracks();
      syncRemoteTracks();
    };

    // Handle local track published (only update if changed)
    const handleLocalTrackPublished = (publication: LocalTrackPublication) => {
      if (!publication?.track) return;

      const currentState = getStoreState();
      const source = publication.source;
      if (source === Track.Source.Microphone && !currentState.isAudioEnabled) {
        setAudioEnabled(true);
      } else if (source === Track.Source.Camera && !currentState.isVideoEnabled) {
        setVideoEnabled(true);
      } else if (source === Track.Source.ScreenShare && !currentState.isScreenSharing) {
        setScreenSharing(true);
      }
    };

    // Handle local track unpublished (only update if changed)
    const handleLocalTrackUnpublished = (publication: LocalTrackPublication) => {
      if (!publication) return;

      const currentState = getStoreState();
      const source = publication.source;
      if (source === Track.Source.Microphone && currentState.isAudioEnabled) {
        setAudioEnabled(false);
      } else if (source === Track.Source.Camera && currentState.isVideoEnabled) {
        setVideoEnabled(false);
      } else if (source === Track.Source.ScreenShare && currentState.isScreenSharing) {
        setScreenSharing(false);
      }
    };

    // Handle remote track published (only update if changed)
    const handleTrackPublished = (publication: RemoteTrackPublication, participant: Participant) => {
      if (!publication?.track || !participant) return;

      const participantData = findParticipantByIdentity(participant.identity);
      if (!participantData) return;

      const currentState = getStoreState();
      const currentParticipant = currentState.participants[participantData.userId];
      if (!currentParticipant) return;

      const source = publication.source;
      if (source === Track.Source.Microphone && currentParticipant.isAudioEnabled !== true) {
        setParticipantMediaState(participantData.userId, { isAudioEnabled: true });
      } else if (source === Track.Source.Camera && currentParticipant.isVideoEnabled !== true) {
        setParticipantMediaState(participantData.userId, { isVideoEnabled: true });
      } else if (source === Track.Source.ScreenShare && currentParticipant.isScreenSharing !== true) {
        setParticipantMediaState(participantData.userId, { isScreenSharing: true });
      }
    };

    // Handle remote track unpublished (only update if changed)
    const handleTrackUnpublished = (publication: RemoteTrackPublication, participant: Participant) => {
      if (!publication || !participant) return;

      const participantData = findParticipantByIdentity(participant.identity);
      if (!participantData) return;

      const currentState = getStoreState();
      const currentParticipant = currentState.participants[participantData.userId];
      if (!currentParticipant) return;

      const source = publication.source;
      if (source === Track.Source.Microphone && currentParticipant.isAudioEnabled !== false) {
        setParticipantMediaState(participantData.userId, { isAudioEnabled: false });
      } else if (source === Track.Source.Camera && currentParticipant.isVideoEnabled !== false) {
        setParticipantMediaState(participantData.userId, { isVideoEnabled: false });
      } else if (source === Track.Source.ScreenShare && currentParticipant.isScreenSharing !== false) {
        setParticipantMediaState(participantData.userId, { isScreenSharing: false });
      }
    };

    // Initial sync (only once on mount, with small delay to let room fully initialize)
    const initialSyncTimeout = setTimeout(() => {
      syncAllTracks();
    }, 500);

    // Periodic sync to ensure state consistency (every 10 seconds, less aggressive)
    // This acts as a safety net to catch any state drift
    const syncInterval = setInterval(() => {
      syncAllTracks();
    }, 10000);

    // Subscribe to local participant events
    room.localParticipant.on("localTrackPublished", handleLocalTrackPublished);
    room.localParticipant.on("localTrackUnpublished", handleLocalTrackUnpublished);

    // Subscribe to remote participant events
    room.on("trackPublished", handleTrackPublished);
    room.on("trackUnpublished", handleTrackUnpublished);

    // Also listen to participant updates
    const handleParticipantConnected = () => {
      // Sync all tracks when participant connects
      syncRemoteTracks();
    };

    const handleParticipantDisconnected = () => {
      // Sync after participant disconnects
      syncRemoteTracks();
    };

    room.on("participantConnected", handleParticipantConnected);
    room.on("participantDisconnected", handleParticipantDisconnected);

    // Cleanup
    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(syncInterval);
      room.localParticipant.off("localTrackPublished", handleLocalTrackPublished);
      room.localParticipant.off("localTrackUnpublished", handleLocalTrackUnpublished);
      room.off("trackPublished", handleTrackPublished);
      room.off("trackUnpublished", handleTrackUnpublished);
      room.off("participantConnected", handleParticipantConnected);
      room.off("participantDisconnected", handleParticipantDisconnected);
    };
  }, [room, localUserId, setAudioEnabled, setVideoEnabled, setScreenSharing, setParticipantMediaState, getStoreState]);

  return null;
}

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
    socket,
    sendChatMessage, 
    loadMessageHistory, 
    emitToggleMedia, 
    emitScreenShareEvent, 
    leaveSession,
    startRecording,
    stopRecording,
    kickParticipant,
    stopParticipantMedia,
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
        const response = (await getSessionById(sessionId)) as SessionData;
        if (!ignore) {
          setSession(response);
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
    <div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden" style={{ background: "#0b0b0b" }}>
      {/* Compact header */}
      <div
        className="flex-shrink-0 px-4 py-2.5"
        style={{ background: "#151515", borderBottom: "1px solid #2a2a2a" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: "#fffaf5",
                lineHeight: 1.3,
              }}
            >
              {headerTitle}
            </h1>
            {session && (
              <p
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "rgba(255,250,245,0.35)",
                }}
              >
                {format(new Date(session.start_time), "PPpp")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {MEET_RECORDING_ENABLED && (
              <MeetRecordingsDialog sessionId={sessionId} />
            )}
          </div>
        </div>
      </div>

      {/* Status banner - only show if needed */}
      <div className="flex-shrink-0 px-4 py-2">
        <MeetStatusBanner />
        {sessionError && (
          <div
            className="mt-2 rounded-lg p-3 text-sm"
            style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", color: "#fca5a5" }}
          >
            {sessionError}
          </div>
        )}
      </div>

      {/* Main meeting area - takes remaining space */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 sm:px-4 pb-2 sm:pb-4 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent" style={{ width: "100%", height: "100%" }}>
          {loadingSession ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
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
              <TrackStateSync />
              
              <Tabs defaultValue="video" className="flex h-full flex-col min-h-0">
                <div className="flex-shrink-0 px-2 pb-2">
                  <TabsList
                    className="grid w-full max-w-[400px] grid-cols-2 p-1"
                    style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: 9999 }}
                  >
                    <TabsTrigger
                      value="video"
                      style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999 }}
                      className="!rounded-full data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
                    >
                      Cuộc gọi video
                    </TabsTrigger>
                    <TabsTrigger
                      value="whiteboard"
                      style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999 }}
                      className="!rounded-full data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
                    >
                      Bảng trắng
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="relative flex-1 min-h-0 flex flex-col">
                  <TabsContent value="video" forceMount className="flex-1 min-h-0 data-[state=inactive]:hidden mt-0">
                    <MeetVideoGrid />
                  </TabsContent>
                  
                  <TabsContent value="whiteboard" forceMount className="flex-1 min-h-0 data-[state=inactive]:hidden mt-0">
                    {sessionId && (
                      <div className="h-full w-full rounded-md overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
                        <MeetingWhiteboard
                          sessionId={sessionId}
                          socket={socket}
                          className="rounded-md"
                        />
                      </div>
                    )}
                  </TabsContent>
                </div>

                <div className="flex-shrink-0 pt-2">
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
              </Tabs>
            </LiveKitRoom>
          ) : (
            <div
              className="flex h-full items-center justify-center text-center text-sm"
              style={{ color: "rgba(255,250,245,0.35)" }}
            >
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
