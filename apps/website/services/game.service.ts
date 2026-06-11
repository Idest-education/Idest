import { http, unwrapResponse } from "./http";
import {
  GameTemplate,
  GameSession,
  LeaderboardEntry,
  CreateGameTemplateDto,
  UpdateGameTemplateDto,
  StartGameSessionDto,
  SubmitAnswerDto,
  SubmitAnswerResponse,
} from "@/types/game";

// ── Templates ──────────────────────────────────────────────────────────

export async function listGameTemplates(): Promise<GameTemplate[]> {
  const res = await http.get("/game-templates");
  return unwrapResponse<GameTemplate[]>(res.data);
}

export async function getGameTemplate(id: string): Promise<GameTemplate> {
  const res = await http.get(`/game-templates/${id}`);
  return unwrapResponse<GameTemplate>(res.data);
}

export async function createGameTemplate(dto: CreateGameTemplateDto): Promise<GameTemplate> {
  const res = await http.post("/game-templates", dto);
  return unwrapResponse<GameTemplate>(res.data);
}

export async function updateGameTemplate(id: string, dto: UpdateGameTemplateDto): Promise<GameTemplate> {
  const res = await http.patch(`/game-templates/${id}`, dto);
  return unwrapResponse<GameTemplate>(res.data);
}

export async function deleteGameTemplate(id: string): Promise<void> {
  await http.delete(`/game-templates/${id}`);
}

// ── Sessions ───────────────────────────────────────────────────────────

export async function startGameSession(dto: StartGameSessionDto): Promise<GameSession> {
  const res = await http.post("/game-sessions", dto);
  return unwrapResponse<GameSession>(res.data);
}

export async function nextQuestion(gameSessionId: string): Promise<GameSession> {
  const res = await http.post(`/game-sessions/${gameSessionId}/next`);
  return unwrapResponse<GameSession>(res.data);
}

export async function submitAnswer(gameSessionId: string, dto: SubmitAnswerDto): Promise<SubmitAnswerResponse> {
  const res = await http.post(`/game-sessions/${gameSessionId}/submit`, dto);
  return unwrapResponse(res.data);
}

export async function getLeaderboard(gameSessionId: string): Promise<LeaderboardEntry[]> {
  const res = await http.get(`/game-sessions/${gameSessionId}/leaderboard`);
  return unwrapResponse<LeaderboardEntry[]>(res.data);
}

export async function getActiveGameSession(meetingSessionId: string): Promise<GameSession | null> {
  const res = await http.get(`/game-sessions/active?sessionId=${meetingSessionId}`);
  return unwrapResponse<GameSession | null>(res.data);
}

// ── Teacher Controls ────────────────────────────────────────────────────

export async function pauseGame(gameSessionId: string): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/pause`);
  return unwrapResponse(res.data);
}

export async function resumeGame(gameSessionId: string): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/resume`);
  return unwrapResponse(res.data);
}

export async function extendTimer(gameSessionId: string, extraSeconds: number): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/extend`, { extraSeconds });
  return unwrapResponse(res.data);
}

export async function skipQuestion(gameSessionId: string): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/skip`);
  return unwrapResponse(res.data);
}

export async function revealAnswer(gameSessionId: string): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/reveal`);
  return unwrapResponse(res.data);
}

export async function hideWord(gameSessionId: string, word: string): Promise<void> {
  const res = await http.post(`/game-sessions/${gameSessionId}/hide-word`, { word });
  return unwrapResponse(res.data);
}
