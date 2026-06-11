export type QuestionType = 'MULTIPLE_CHOICE' | 'FILL_BLANK' | 'MULTI_CHOICE' | 'MATCH_LR' | 'WORD_CLOUD';
export type GameSessionStatus = 'WAITING' | 'IN_PROGRESS' | 'PAUSED' | 'ENDED';
export type GameStatus = 'idle' | 'active' | 'paused' | 'ended';

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
  correctAnswer?: string; // Only present in teacher-facing template responses
  isMultiAnswer?: boolean;
  matchPairs?: { id: string; leftLabel: string; rightText: string }[];
}

// Distribution entry for answer analytics
export interface DistributionEntry {
  label: string;
  text: string;
  count: number;
  pct: number;
  isCorrect: boolean;
}

// Word cloud entry
export interface WordCloudEntry {
  text: string;
  count: number;
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
  distribution: DistributionEntry[];
  unansweredCount: number;
  pointsBreakdown: { userId: string; pointsAwarded: number }[];
}

export interface GameLeaderboardUpdatedEvent {
  top10: { userId: string; displayName: string; score: number }[];
}

export interface GameSessionEndedEvent {
  leaderboard: LeaderboardEntry[];
}

// New WebSocket event types
export interface GameTimerExtendedEvent {
  newTimerSeconds: number;
  elapsedSeconds: number;
}

export interface GameSessionPausedEvent {
  pausedAt: string;
}

export interface GameSessionResumedEvent {
  elapsedSeconds: number;
}

export interface GameWordCloudUpdatedEvent {
  words: WordCloudEntry[];
}

export interface GameAnswerRevealedEvent {
  correctAnswer: string;
  distribution: DistributionEntry[];
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

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
  answerStreak: number;
  maxAnswerStreak: number;
}

// Phase 2: Medal types
export type MedalCategory = 'WINNING' | 'STREAK' | 'LEADERBOARD' | 'PARTICIPATION' | 'ACCURACY' | 'SPEED';

export interface Medal {
  key: string;
  category: MedalCategory;
  name: string;
  description: string;
  icon: string;
}

export interface MedalAward {
  key: string;
  name: string;
  icon: string;
  awardedAt: string;
}

export interface MedalProgress {
  medalKey: string;
  current: number;
  target: number;
  pct: number;
}

export interface ClassStatsEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  totalWins: number;
  totalGames: number;
}

export interface MyClassStats {
  stats: {
    totalPoints: number;
    weeklyPoints: number;
    monthlyPoints: number;
    totalWins: number;
    totalGames: number;
    correctAnswers: number;
    totalAnswers: number;
    consecutiveWins: number;
    maxConsecWins: number;
  } | null;
  earned: MedalAward[];
  progress: MedalProgress[];
}

// WS event
export interface GameMedalEarnedEvent {
  userId: string;
  classId: string;
  medal: Medal;
}
