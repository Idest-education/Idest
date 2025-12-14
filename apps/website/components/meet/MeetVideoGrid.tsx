"use client";

import { GridLayout, RoomAudioRenderer, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useMemo, useState, useEffect } from "react";
import { MeetParticipantTile } from "./MeetParticipantTile";

function getGridConfig(count: number, isMobile: boolean = false) {
  if (isMobile) {
    // Mobile: stack vertically or use 1-2 columns max
    if (count <= 1) return { cols: 1, rows: 1 };
    return { cols: 1, rows: count };
  }

  // Desktop: responsive grid
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  if (count <= 16) return { cols: 4, rows: 4 };
  return { cols: 5, rows: Math.ceil(count / 5) };
}

export function MeetVideoGrid() {
  const cameraTracks = useTracks(
    [
      {
        source: Track.Source.Camera,
        withPlaceholder: true,
      },
    ],
    { onlySubscribed: false },
  );

  const screenTracks = useTracks(
    [
      {
        source: Track.Source.ScreenShare,
        withPlaceholder: false,
      },
    ],
    { onlySubscribed: true },
  );

  // Stable track list to prevent flickering
  const prioritizedCameraTracks = useMemo(() => {
    const byParticipant = new Map<string, (typeof cameraTracks)[number]>();
    cameraTracks.forEach((track) => {
      const participantIdentity = track.participant?.identity || track.participant?.sid || "unknown";
      const key = `${participantIdentity}-${track.source}`;
      const isVideoActive = Boolean(track.publication?.track);
      const current = byParticipant.get(key);
      if (!current || (isVideoActive && !current.publication?.track)) {
        byParticipant.set(key, track);
      }
    });
    return Array.from(byParticipant.values());
  }, [cameraTracks]);

  const screenShareTrack = useMemo(() => screenTracks[0], [screenTracks]);
  const hasCameraTracks = prioritizedCameraTracks.length > 0;
  
  // Detect mobile viewport (you can enhance this with a hook if needed)
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  const gridConfig = useMemo(
    () => getGridConfig(prioritizedCameraTracks.length, isMobile),
    [prioritizedCameraTracks.length, isMobile],
  );

  const renderEmptyState = (message: string) => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ width: "100%", height: "100%" }}>
      {screenShareTrack ? (
        <>
          {/* Screen share takes main area */}
          <div className="screen-share-container relative flex min-h-0 flex-1 overflow-hidden bg-transparent">
            <GridLayout tracks={[screenShareTrack]} className="h-full w-full">
              <MeetParticipantTile />
            </GridLayout>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              {screenShareTrack.participant?.name || "Chia sẻ màn hình"}
            </div>
          </div>

          {/* Camera tiles in horizontal strip */}
          <div className="flex-shrink-0 overflow-hidden py-2 sm:py-3">
            <div className="flex gap-2 overflow-x-auto px-1">
              {hasCameraTracks ? (
                prioritizedCameraTracks.map((track) => {
                  const key = `${track.participant?.identity ?? "participant"}-${track.source}`;
                  return (
                    <div
                      key={key}
                      className="flex-shrink-0"
                      style={{ width: isMobile ? "min(180px, 40vw)" : "min(240px, 30vw)", aspectRatio: "16/9" }}
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-lg bg-black/40">
                        <MeetParticipantTile trackRef={track} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-16 sm:h-20 items-center justify-center text-xs text-muted-foreground">
                  Waiting for participants...
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Camera-only grid */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {hasCameraTracks ? (
            prioritizedCameraTracks.length === 1 ? (
              /* Single participant: fill entire space */
              <div className="relative h-full w-full overflow-hidden single-participant-video" style={{ width: "100%", height: "100%" }}>
                <div style={{ width: "100%", height: "100%", position: "relative" }}>
                  <MeetParticipantTile trackRef={prioritizedCameraTracks[0]} />
                </div>
              </div>
            ) : prioritizedCameraTracks.length === 2 ? (
              /* Two participants: side by side, fill width, maintain aspect ratio */
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
                <div className="grid w-full grid-cols-2 gap-2 two-participants-grid" style={{ height: "fit-content", maxHeight: "100%" }}>
                  {prioritizedCameraTracks.map((track) => {
                    const key = `${track.participant?.identity ?? "participant"}-${track.source}`;
                    return (
                      <div
                        key={key}
                        className="relative flex items-center justify-center overflow-hidden"
                        style={{ aspectRatio: "16/9", width: "100%" }}
                      >
                        <MeetParticipantTile trackRef={track} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Multiple participants (3+): use grid */
              <div
                className="grid h-full w-full multi-participant-grid"
                style={{
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: isMobile
                    ? `repeat(${gridConfig.rows}, minmax(0, 1fr))`
                    : `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
                  gap: prioritizedCameraTracks.length <= 4 ? "0.5rem" : "0.25rem",
                  padding: prioritizedCameraTracks.length <= 4 ? "0.5rem" : "0.25rem",
                }}
              >
                {prioritizedCameraTracks.map((track) => {
                  const key = `${track.participant?.identity ?? "participant"}-${track.source}`;
                  return (
                    <div
                      key={key}
                      className="relative flex min-h-0 items-center justify-center overflow-hidden"
                      style={{ aspectRatio: isMobile ? undefined : "16/9" }}
                    >
                      <MeetParticipantTile trackRef={track} />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            renderEmptyState("Đang chờ người tham gia tham gia...")
          )}
        </div>
      )}

      <RoomAudioRenderer />
    </div>
  );
}

