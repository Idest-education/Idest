"use client";

// DEPRECATED: Legacy WebRTC utilities for custom P2P signaling
// The application now uses LiveKit Cloud for media routing
// These functions are retained for reference only

/**
 * Get user media (camera and microphone)
 */
export async function getUserMedia(
  constraints: MediaStreamConstraints = {
    video: true,
    audio: true,
  }
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error("Error getting user media:", error);
    throw error;
  }
}

/**
 * Get display media (screen sharing)
 * DEPRECATED: Use LiveKit's screen share APIs instead
 */
export async function getDisplayMedia(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch (error) {
    console.error("Error getting display media:", error);
    throw error;
  }
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Replace audio/video track in a stream
 * DEPRECATED: Utility function, not currently used
 */
export function replaceTrack(
  stream: MediaStream,
  newTrack: MediaStreamTrack,
  kind: "audio" | "video"
): void {
  const oldTrack = stream.getTracks().find((t) => t.kind === kind);
  if (oldTrack) {
    stream.removeTrack(oldTrack);
    oldTrack.stop();
  }
  stream.addTrack(newTrack);
}

/**
 * Toggle audio track (mute/unmute)
 */
export function toggleAudioTrack(
  stream: MediaStream,
  enabled: boolean
): void {
  const audioTrack = stream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = enabled;
  }
}

/**
 * Toggle video track (on/off)
 */
export function toggleVideoTrack(
  stream: MediaStream,
  enabled: boolean
): void {
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = enabled;
  }
}

/**
 * Close peer connection and cleanup
 * DEPRECATED: Utility function for legacy WebRTC, not currently used
 */
export function closePeerConnection(pc: RTCPeerConnection): void {
  // Remove all senders from the peer connection without stopping tracks
  // Stopping tracks here would kill the shared local camera/mic for all peers
  try {
    const senders = pc.getSenders();
    senders.forEach((sender) => {
      try {
        pc.removeTrack(sender);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  // Finally, close the RTCPeerConnection
  try {
    pc.close();
  } catch {
    // ignore
  }
}
