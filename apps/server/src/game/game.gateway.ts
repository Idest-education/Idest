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

  handleConnection(client: Socket) {
    this.logger.log(`Game client connected: ${client.id}`);
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
    const session = await this.gameSessionService.getActiveSession(data.gameSessionId).catch(() => null);

    if (session) {
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
  async handleQuestionEnded(payload: { gameSessionId: string; correctAnswer: string; questionId: string }) {
    const leaderboard = await this.gameSessionService.buildLeaderboard(payload.gameSessionId);
    this.server.to(payload.gameSessionId).emit('game:question_ended', {
      correctAnswer: payload.correctAnswer,
      pointsBreakdown: leaderboard.map((e) => ({ userId: e.userId, pointsAwarded: e.score })),
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
}
