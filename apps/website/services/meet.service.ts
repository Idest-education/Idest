import { http, unwrapResponse } from "./http";
import { LiveKitCredentials } from "@/types/meet";

interface LivekitTokenResponse {
  sessionId: string;
  livekit: LiveKitCredentials;
}

export async function getLivekitToken(sessionId: string): Promise<LivekitTokenResponse> {
  const response = await http.get(`/meet/${sessionId}/livekit-token`);
  return unwrapResponse<LivekitTokenResponse>(response.data);
}

export interface MeetRecordingListItem {
  recordingId: string | null;
  egressId: string | null;
  url: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
}

export interface MeetRecordingListResponse {
  sessionId: string;
  items: MeetRecordingListItem[];
}

export interface MeetRecordingUrlResponse {
  recordingId: string;
  url: string | null;
  location: string | null;
}

export async function listSessionRecordings(sessionId: string): Promise<MeetRecordingListResponse> {
  const response = await http.get(`/meet/${sessionId}/recordings`);
  return unwrapResponse<MeetRecordingListResponse>(response.data);
}

export async function getRecordingUrl(recordingId: string): Promise<MeetRecordingUrlResponse> {
  const response = await http.get(`/meet/recordings/${recordingId}/url`);
  return unwrapResponse<MeetRecordingUrlResponse>(response.data);
}

export async function startRecording(sessionId: string): Promise<{ sessionId: string; egressId: string }> {
  const response = await http.post(`/meet/${sessionId}/recordings/start`);
  return unwrapResponse<{ sessionId: string; egressId: string }>(response.data);
}

export async function stopRecording(sessionId: string): Promise<{ sessionId: string; stopped: boolean }> {
  const response = await http.post(`/meet/${sessionId}/recordings/stop`);
  return unwrapResponse<{ sessionId: string; stopped: boolean }>(response.data);
}




