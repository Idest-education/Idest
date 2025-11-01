"use client";

export interface PeerConnection {
  connection: RTCPeerConnection;
  userId: string;
  stream?: MediaStream;
}

const STUN_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Create a new RTCPeerConnection for a peer
 */
export function createPeerConnection(userId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(STUN_SERVERS);
  return pc;
}

/**
 * Add local stream tracks to peer connection
 */
export function addLocalStreamToPeer(
  pc: RTCPeerConnection,
  stream: MediaStream
): void {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });
}

/**
 * Remove all tracks from peer connection
 */
export function removeAllTracks(pc: RTCPeerConnection): void {
  const senders = pc.getSenders();
  senders.forEach((sender) => {
    pc.removeTrack(sender);
  });
}

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
 */
export function closePeerConnection(pc: RTCPeerConnection): void {
  // Close all tracks
  pc.getSenders().forEach((sender) => {
    const track = sender.track;
    if (track) {
      track.stop();
    }
  });
  
  // Close connection
  pc.close();
}

