import { http } from "./http";
import { LiveKitCredentials } from "@/types/meet";

interface LivekitTokenResponse {
  sessionId: string;
  livekit: LiveKitCredentials;
}

export async function getLivekitToken(sessionId: string): Promise<LivekitTokenResponse> {
  const response = await http.get<LivekitTokenResponse>(`/meet/${sessionId}/livekit-token`);
  return response.data;
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
  const response = await http.get<MeetRecordingListResponse>(`/meet/${sessionId}/recordings`);
  return response.data;
}

export async function getRecordingUrl(recordingId: string): Promise<MeetRecordingUrlResponse> {
  const response = await http.get<MeetRecordingUrlResponse>(`/meet/recordings/${recordingId}/url`);
  return response.data;
}




