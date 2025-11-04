"use client";

export interface PeerConnection {
  connection: RTCPeerConnection;
  userId: string;
  stream?: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com" },
    ...(process.env.NEXT_PUBLIC_TURN_SERVER_URL ? [{
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ""
    }] : [])
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Create a new RTCPeerConnection for a peer
 */
export function createPeerConnection(userId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  
  // Add connection state monitoring
  pc.addEventListener('connectionstatechange', () => {
    console.log(`Peer connection state for ${userId}: ${pc.connectionState}`);
  });
  
  pc.addEventListener('iceconnectionstatechange', () => {
    console.log(`ICE connection state for ${userId}: ${pc.iceConnectionState}`);
    
    // Handle connection failures
    if (pc.iceConnectionState === 'failed') {
      console.error(`ICE connection failed for ${userId}`);
    }
  });
  
  pc.addEventListener('icegatheringstatechange', () => {
    console.log(`ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
  });
  
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

