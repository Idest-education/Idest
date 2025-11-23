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




