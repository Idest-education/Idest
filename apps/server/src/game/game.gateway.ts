import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { GameSessionService } from './game-session.service';
import { verifyTokenAsync } from 'src/common/guard/auth.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // gameSessionId → Set<socketId>
  private readonly roomSockets = new Map<string, Set<string>>();
  // socketId → gameSessionId
  private readonly socketRoom = new Map<string, string>();
  // gameSessionId → debounce timer
  private readonly lbDebouncers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly gameSessionService: GameSessionService) {}

  afterInit() {
    this.logger.log('Game Gateway initialized on /game namespace');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      await verifyTokenAsync(token, process.env.JWT_SECRET!);
      this.logger.log(`Game client connected: ${client.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const gameSessionId = this.socketRoom.get(client.id);
    if (gameSessionId) {
      const sockets = this.roomSockets.get(gameSessionId);
      sockets?.delete(client.id);
      this.socketRoom.delete(client.id);
    }
  }

  @SubscribeMessage('game:join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameSessionId: string; userId: string },
  ) {
    await client.join(data.gameSessionId);

    if (!this.roomSockets.has(data.gameSessionId)) {
      this.roomSockets.set(data.gameSessionId, new Set());
    }
    this.roomSockets.get(data.gameSessionId)!.add(client.id);
    this.socketRoom.set(client.id, data.gameSessionId);

    // Send current question state for reconnect/late-join
    const session = await this.gameSessionService.getSessionById(data.gameSessionId).catch(() => null);

    if (session && session.status === 'IN_PROGRESS') {
      const questions = session.template.questions;
      const currentQuestion = questions[session.currentQuestionIndex];
      if (currentQuestion) {
        const elapsedSeconds = this.gameSessionService.getQuestionElapsedSeconds(session.id);
        client.emit('game:question_started', {
          questionIndex: session.currentQuestionIndex,
          text: currentQuestion.text,
          type: currentQuestion.type,
          options: currentQuestion.options,
          timerSeconds: currentQuestion.timerSeconds,
          elapsedSeconds,
        });
      }
    }
  }

  @SubscribeMessage('game:leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameSessionId: string },
  ) {
    await client.leave(data.gameSessionId);
    this.roomSockets.get(data.gameSessionId)?.delete(client.id);
    this.socketRoom.delete(client.id);
  }

  // ── EventEmitter2 bridge ──────────────────────────────────────────────

  @OnEvent('game.question.started')
  handleQuestionStarted(payload: {
    gameSessionId: string;
    questionIndex: number;
    text: string;
    type: string;
    options: { id: string; label: string; text: string }[];
    timerSeconds: number;
    elapsedSeconds: number;
  }) {
    this.server.to(payload.gameSessionId).emit('game:question_started', {
      questionIndex: payload.questionIndex,
      text: payload.text,
      type: payload.type,
      options: payload.options,
      timerSeconds: payload.timerSeconds,
      elapsedSeconds: payload.elapsedSeconds,
    });
  }

  @OnEvent('game.question.ended')
  handleQuestionEnded(payload: {
    gameSessionId: string;
    correctAnswer: string;
    questionId: string;
    distribution: { label: string; text: string; count: number; pct: number; isCorrect: boolean }[];
    unansweredCount: number;
    questionPoints: { userId: string; pointsAwarded: number }[];
  }) {
    this.server.to(payload.gameSessionId).emit('game:question_ended', {
      correctAnswer: payload.correctAnswer,
      distribution: payload.distribution,
      unansweredCount: payload.unansweredCount,
      pointsBreakdown: payload.questionPoints,
    });
  }

  @OnEvent('game.leaderboard.update_requested')
  handleLeaderboardUpdateRequested(payload: { gameSessionId: string }) {
    const existing = this.lbDebouncers.get(payload.gameSessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.lbDebouncers.delete(payload.gameSessionId);
      const top10 = await this.gameSessionService.buildLeaderboard(payload.gameSessionId);
      this.server.to(payload.gameSessionId).emit('game:leaderboard_updated', {
        top10: top10.slice(0, 10),
      });
    }, 500);

    this.lbDebouncers.set(payload.gameSessionId, timer);
  }

  @OnEvent('game.session.ended')
  handleSessionEnded(payload: { gameSessionId: string; leaderboard: unknown[] }) {
    this.server.to(payload.gameSessionId).emit('game:session_ended', {
      leaderboard: payload.leaderboard,
    });
    const timer = this.lbDebouncers.get(payload.gameSessionId);
    if (timer) {
      clearTimeout(timer);
      this.lbDebouncers.delete(payload.gameSessionId);
    }
  }

  @OnEvent('game.session.paused')
  handleSessionPaused(payload: { gameSessionId: string; pausedAt: Date }) {
    this.server.to(payload.gameSessionId).emit('game:session_paused', {
      pausedAt: payload.pausedAt,
    });
  }

  @OnEvent('game.session.resumed')
  handleSessionResumed(payload: { gameSessionId: string; elapsedSeconds: number }) {
    this.server.to(payload.gameSessionId).emit('game:session_resumed', {
      elapsedSeconds: payload.elapsedSeconds,
    });
  }

  @OnEvent('game.timer.extended')
  handleTimerExtended(payload: {
    gameSessionId: string;
    newTimerSeconds: number;
    elapsedSeconds: number;
  }) {
    this.server.to(payload.gameSessionId).emit('game:timer_extended', {
      newTimerSeconds: payload.newTimerSeconds,
      elapsedSeconds: payload.elapsedSeconds,
    });
  }

  @OnEvent('game.word_cloud.updated')
  handleWordCloudUpdated(payload: { gameSessionId: string; words: { text: string; count: number }[] }) {
    this.server.to(payload.gameSessionId).emit('game:word_cloud_updated', {
      words: payload.words,
    });
  }

  @OnEvent('game.answer.revealed')
  handleAnswerRevealed(payload: {
    gameSessionId: string;
    correctAnswer: string;
    distribution: { label: string; text: string; count: number; pct: number; isCorrect: boolean }[];
  }) {
    this.server.to(payload.gameSessionId).emit('game:answer_revealed', {
      correctAnswer: payload.correctAnswer,
      distribution: payload.distribution,
    });
  }

  // TODO: Implement game.medal.earned handler in Phase 2
}
