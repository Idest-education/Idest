import { http, unwrapResponse } from "./http";
import {
  GameTemplate,
  GameSession,
  LeaderboardEntry,
  CreateGameTemplateDto,
  UpdateGameTemplateDto,
  StartGameSessionDto,
  SubmitAnswerDto,
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

export async function submitAnswer(gameSessionId: string, dto: SubmitAnswerDto): Promise<{
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
}> {
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
