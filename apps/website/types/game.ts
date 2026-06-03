export type QuestionType = 'MULTIPLE_CHOICE' | 'FILL_BLANK';
export type GameSessionStatus = 'WAITING' | 'IN_PROGRESS' | 'ENDED';
export type GameStatus = 'idle' | 'active' | 'ended';

export interface GameOption {
  id: string;
  label: string;
  text: string;
}

export interface GameQuestion {
  id: string;
  text: string;
  type: QuestionType;
  order: number;
  timerSeconds: number;
  options: GameOption[];
}

export interface GameTemplate {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  questions: GameQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface GameSession {
  id: string;
  templateId: string;
  sessionId: string;
  startedBy: string;
  status: GameSessionStatus;
  currentQuestionIndex: number;
  startedAt: string;
  endedAt?: string;
  template: Pick<GameTemplate, 'id' | 'title' | 'questions'>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}

// WebSocket event payloads (server → client)
export interface GameSessionStartedEvent {
  gameSessionId: string;
  title: string;
  questionCount: number;
}

export interface GameQuestionStartedEvent {
  questionIndex: number;
  text: string;
  type: QuestionType;
  options: GameOption[];
  timerSeconds: number;
  elapsedSeconds: number;
}

export interface GameQuestionEndedEvent {
  correctAnswer: string;
  pointsBreakdown: { userId: string; pointsAwarded: number }[];
}

export interface GameLeaderboardUpdatedEvent {
  top10: { userId: string; displayName: string; score: number }[];
}

export interface GameSessionEndedEvent {
  leaderboard: LeaderboardEntry[];
}

// REST DTOs (client → server)
export interface CreateGameTemplateDto {
  title: string;
  description?: string;
  questions: {
    text: string;
    type: QuestionType;
    order: number;
    timerSeconds: number;
    correctAnswer: string;
    options?: { label: string; text: string }[];
  }[];
}

export interface UpdateGameTemplateDto {
  title?: string;
  description?: string;
  questions?: CreateGameTemplateDto['questions'];
}

export interface StartGameSessionDto {
  templateId: string;
  sessionId: string;
}

export interface SubmitAnswerDto {
  answer: string;
}
