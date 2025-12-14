import {
  AudioTrack,
  ConnectionQualityIndicator,
  LockLockedIcon,
  ParticipantName,
  ParticipantTile,
  ScreenShareIcon,
  TrackMutedIndicator,
  VideoTrack,
  useEnsureParticipant,
  useEnsureTrackRef,
  useIsEncrypted,
  useMaybeTrackRefContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { TrackReferenceOrPlaceholder, isTrackReference } from "@livekit/components-core";
import { useMemo } from "react";

interface MeetParticipantTileProps extends React.HTMLAttributes<HTMLDivElement> {
  trackRef?: TrackReferenceOrPlaceholder;
}

export function MeetParticipantTile({ trackRef, ...props }: MeetParticipantTileProps) {
  const contextTrackRef = useMaybeTrackRefContext();
  const effectiveTrackRef = trackRef ?? contextTrackRef;

  if (!effectiveTrackRef) {
    return null;
  }

  return (
    <ParticipantTile trackRef={effectiveTrackRef} {...props}>
      <MeetParticipantTileBody trackRef={effectiveTrackRef} />
    </ParticipantTile>
  );
}

function MeetParticipantTileBody({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const effectiveTrackRef = useEnsureTrackRef(trackRef);
  const participant = useEnsureParticipant(
    isTrackReference(effectiveTrackRef) ? effectiveTrackRef.participant : undefined,
  );

  // Extract dependencies for useMemo
  const isTrackRef = isTrackReference(effectiveTrackRef);
  const trackSid = isTrackRef ? effectiveTrackRef.publication?.trackSid : null;
  const isMuted = isTrackRef ? effectiveTrackRef.publication?.isMuted : false;
  const isSubscribed = isTrackRef ? effectiveTrackRef.publication?.isSubscribed : false;
  const source = isTrackRef ? effectiveTrackRef.source : null;
  const hasTrack = isTrackRef ? !!effectiveTrackRef.publication?.track : false;

  // Extract publication kind for video track check
  const publicationKind = isTrackRef ? effectiveTrackRef.publication?.kind : null;

  // Memoize track state to prevent unnecessary re-renders
  const trackState = useMemo(() => {
    if (!isTrackRef) {
      return {
        isVideoTrack: false,
        isCameraSource: false,
        isScreenShareSource: false,
        isVideoActive: false,
        trackSid: null,
        isMuted: true,
      };
    }

    const isVideoTrack =
      publicationKind === "video" ||
      source === Track.Source.Camera ||
      source === Track.Source.ScreenShare;

    return {
      isVideoTrack,
      isCameraSource: source === Track.Source.Camera,
      isScreenShareSource: source === Track.Source.ScreenShare,
      isVideoActive: isVideoTrack && hasTrack && !isMuted && isSubscribed !== false,
      trackSid,
      isMuted,
    };
  }, [isTrackRef, trackSid, isMuted, isSubscribed, source, hasTrack, publicationKind]);

  const isEncrypted = useIsEncrypted(participant);

  const shouldShowPlaceholder = (trackState.isCameraSource && !trackState.isVideoActive) || !isTrackRef;

  // Get participant name
  const participantName = participant?.name || participant?.identity || "Đang tải...";

  return (
    <div className="relative h-full w-full" style={{ width: "100%", height: "100%" }}>
      {isTrackRef && trackState.isVideoTrack && trackState.isVideoActive ? (
        <VideoTrack trackRef={effectiveTrackRef} />
      ) : isTrackRef && !trackState.isVideoTrack ? (
        <AudioTrack trackRef={effectiveTrackRef} />
      ) : null}

      {shouldShowPlaceholder && (
        <div className="lk-participant-placeholder absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
          <span className="text-white text-4xl font-semibold select-none">
            {participantName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="lk-participant-metadata absolute bottom-0 left-0 right-0">
        <div className="lk-participant-metadata-item">
          {trackState.isScreenShareSource ? (
            <>
              <ScreenShareIcon style={{ marginRight: "0.25rem" }} />
              <ParticipantName>&apos;s screen</ParticipantName>
            </>
          ) : (
            <>
              {isEncrypted && <LockLockedIcon style={{ marginRight: "0.25rem" }} />}
              {isTrackRef && (
                <TrackMutedIndicator
                  trackRef={{
                    participant: participant,
                    source: Track.Source.Microphone,
                  }}
                  show="muted"
                />
              )}
              <ParticipantName />
            </>
          )}
        </div>
        <ConnectionQualityIndicator className="lk-participant-metadata-item" />
      </div>
    </div>
  );
}

