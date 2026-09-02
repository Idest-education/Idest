# 05 — WebSocket Gateway (`/game`)

> File này hướng dẫn implement `GameGateway` để push cập nhật real-time cho client. **WS là phụ trợ, không phải nguồn tin.** REST luôn authoritative — khi reconnect, client phải `GET /game-sessions/:id` + `GET /leaderboard` để đồng bộ lại.

---

## 1. Tổng quan

- Namespace: **`/game`** (tách biệt khỏi `/meet`).
- Library: **socket.io** (đã dùng sẵn cho `MeetGateway`).
- Cách tổ chức room: mỗi `GameSession` có 1 room tên `game:<gameSessionId>`.
- Auth: JWT trong `handshake.auth.token` (giống `MeetGateway`).
- Trigger broadcast: **service phát event qua `EventEmitter2`**, `GameGateway` subscribe. Tránh circular dep (service → gateway).

---

## 2. Boilerplate gateway

Tham khảo [`apps/server/src/meet/meet.gateway.ts`](../../apps/server/src/meet/meet.gateway.ts). File mới: `apps/server/src/game/session/game.gateway.ts`.

```ts
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(/* inject services bạn cần */) {}

  async handleConnection(client: Socket) {
    try {
      const user = await verifyJwt(client.handshake.auth.token); // dùng chung helper với MeetGateway
      client.data.user = user;
      this.logger.log(`[${user.id}] connected`);
    } catch {
      client.emit('game:error', { code: 'UNAUTHORIZED' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`[${client.data.user?.id}] disconnected`);
  }

  // ----- Client → Server -----

  @SubscribeMessage('game:join_room')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { gameSessionId: string }) {
    // validate: user có quyền xem session này (host, participant, hoặc teacher class)
    const canView = await this.sessionService.canView(body.gameSessionId, client.data.user.id);
    if (!canView) throw new UnauthorizedException();
    await client.join(`game:${body.gameSessionId}`);
    client.emit('game:joined', { gameSessionId: body.gameSessionId });
  }

  @SubscribeMessage('game:leave_room')
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { gameSessionId: string }) {
    await client.leave(`game:${body.gameSessionId}`);
  }

  // ----- Bridge từ service qua EventEmitter2 -----

  @OnEvent('game.session.started')
  onSessionStarted(payload: { gameSessionId: string; session: SessionResponseDto }) {
    this.server.to(`game:${payload.gameSessionId}`).emit('game:session_started', payload.session);
  }

  @OnEvent('game.question.started')
  onQuestionStarted(payload: { gameSessionId: string; question: PublicQuestionDto; startedAt: string; timeLimitSeconds: number }) {
    this.server.to(`game:${payload.gameSessionId}`).emit('game:question_started', payload);
  }

  @OnEvent('game.question.ended')
  onQuestionEnded(payload: { gameSessionId: string; questionId: string; correctAnswer: string | null }) {
    this.server.to(`game:${payload.gameSessionId}`).emit('game:question_ended', payload);
  }

  @OnEvent('game.submission.received')
  onSubmissionReceived(payload: { gameSessionId: string; hostSocketIds: string[]; submissionSummary: any }) {
    // chỉ gửi riêng cho host
    payload.hostSocketIds.forEach((sid) => this.server.to(sid).emit('game:submission_received', payload.submissionSummary));
  }

  @OnEvent('game.leaderboard.updated')
  onLeaderboardUpdated(payload: { gameSessionId: string; top10: LeaderboardEntryDto[] }) {
    this.server.to(`game:${payload.gameSessionId}`).emit('game:leaderboard_updated', payload.top10);
  }

  @OnEvent('game.session.ended')
  onSessionEnded(payload: { gameSessionId: string; finalLeaderboard: LeaderboardEntryDto[]; rewards: RewardDto[] }) {
    this.server.to(`game:${payload.gameSessionId}`).emit('game:session_ended', payload);
  }
}
```

> `EventEmitter2` đã sẵn trong NestJS (`@nestjs/event-emitter`). Đảm bảo `EventEmitterModule.forRoot()` được import trong `GameModule`.

---

## 3. Danh sách sự kiện

### 3.1 Client → Server

| Event               | Payload                       | Mô tả                                              |
| ------------------- | ----------------------------- | -------------------------------------------------- |
| `game:join_room`    | `{ gameSessionId: string }`   | Tham gia room để nhận broadcast                    |
| `game:leave_room`   | `{ gameSessionId: string }`   | Rời room                                           |

> **Không có** `game:submit` từ client. Submit phải qua REST (để validation + transaction tập trung).

### 3.2 Server → Client (broadcast vào room `game:<id>`)

| Event                         | Payload (shape chính)                                                                  | Ai nhận              | Khi nào                                       |
| ----------------------------- | -------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| `game:joined`                 | `{ gameSessionId }`                                                                    | Chính client         | Ack sau `join_room`                            |
| `game:error`                  | `{ code, message }`                                                                    | Chính client         | Lỗi bất kỳ                                    |
| `game:session_started`        | `SessionResponseDto`                                                                   | Tất cả in room       | Sau `POST /start`                             |
| `game:question_started`       | `{ question: PublicQuestionDto, startedAt, timeLimitSeconds }`                         | Tất cả in room       | Khi câu mới bắt đầu (start, hoặc advance)     |
| `game:question_ended`         | `{ questionId, correctAnswer }`                                                        | Tất cả in room       | Khi teacher `advance` hoặc hết thời gian       |
| `game:submission_received`    | `{ submissionId, participantId, questionId, isPending: bool }`                         | **Chỉ host**          | Sau mỗi lần student submit (để UI chấm SA)   |
| `game:leaderboard_updated`    | `{ top10: LeaderboardEntryDto[] }`                                                     | Tất cả in room       | Sau mỗi submit / grant-stars (debounce 500ms) |
| `game:session_ended`          | `{ session, finalLeaderboard, rewards }`                                               | Tất cả in room       | Sau `POST /end`                               |

> `PublicQuestionDto` **không có** `correctAnswer`. Chỉ `game:question_ended` mới gửi `correctAnswer`.

---

## 4. Mẫu payload

### `game:question_started`

```json
{
  "gameSessionId": "uuid",
  "question": {
    "id": "uuid",
    "orderIndex": 2,
    "prompt": "She ___ to school every day.",
    "questionType": "MCQ",
    "options": ["go", "goes", "going", "gone"],
    "points": 10
  },
  "startedAt": "2026-04-18T10:06:20.000Z",
  "timeLimitSeconds": 20
}
```

### `game:leaderboard_updated`

```json
{
  "gameSessionId": "uuid",
  "top10": [
    {
      "rank": 1,
      "participantId": "uuid",
      "userId": "uuid",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": "...",
      "totalStars": 20,
      "totalPoints": 40,
      "totalResponseTimeMs": 45320
    }
  ]
}
```

### `game:session_ended`

```json
{
  "gameSessionId": "uuid",
  "session": { /* SessionResponseDto, status = ENDED */ },
  "finalLeaderboard": [ /* LeaderboardEntryDto[] */ ],
  "rewards": [ /* RewardDto[] */ ]
}
```

---

## 5. Cách service trigger broadcast

Ví dụ trong `GameSessionService.submitAnswer(...)`:

```ts
await this.prisma.$transaction(async (tx) => { /* ... */ });

// sau transaction, emit:
this.eventEmitter.emit('game.submission.received', {
  gameSessionId,
  hostSocketIds: await this.resolveHostSockets(session.host_id),
  submissionSummary: { submissionId, participantId, questionId, isPending: isShortAnswer },
});

this.scheduleLeaderboardBroadcast(gameSessionId); // debounce 500ms
```

### 5.1 Debounce leaderboard broadcast

Dùng `Map<gameSessionId, Timeout>` trong service:

```ts
private readonly lbDebouncers = new Map<string, NodeJS.Timeout>();

private scheduleLeaderboardBroadcast(gameSessionId: string) {
  if (this.lbDebouncers.has(gameSessionId)) {
    clearTimeout(this.lbDebouncers.get(gameSessionId)!);
  }
  const t = setTimeout(async () => {
    const top10 = await this.leaderboardService.getLive(gameSessionId, { limit: 10 });
    this.eventEmitter.emit('game.leaderboard.updated', { gameSessionId, top10 });
    this.lbDebouncers.delete(gameSessionId);
  }, 500);
  this.lbDebouncers.set(gameSessionId, t);
}
```

> 500ms debounce bảo đảm max 2 event/s/session khi 50 học sinh nộp cùng lúc.

---

## 6. Auth JWT cho socket

Tái sử dụng helper `verifyJwt` đã có trong module `supabase` hoặc `auth`. Trong `MeetGateway` hiện tại đã có pattern — copy nguyên xi.

Kết quả lưu vào `client.data.user = { id, role, ... }`.

Nếu verify fail → emit `game:error` + `disconnect`.

---

## 7. Resolve host socket IDs

Để gửi riêng cho host (sự kiện `game:submission_received`):

```ts
// trong GameGateway, lưu map userId → Set<socketId>:
private userSockets = new Map<string, Set<string>>();

handleConnection(client) {
  // ... verify ...
  const userId = client.data.user.id;
  if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
  this.userSockets.get(userId)!.add(client.id);
}

handleDisconnect(client) {
  const userId = client.data.user?.id;
  if (userId) this.userSockets.get(userId)?.delete(client.id);
}

// expose public getter cho service:
getSocketIdsForUser(userId: string): string[] {
  return Array.from(this.userSockets.get(userId) ?? []);
}
```

Service gọi `gateway.getSocketIdsForUser(hostId)` khi emit event.

---

## 8. Scale (v1 không cần, lưu ý cho v2)

Nếu sau này chạy nhiều instance Nest:

- Dùng **Redis adapter** cho socket.io: `@socket.io/redis-adapter`.
- `EventEmitter2` chỉ trong 1 process → đổi sang cơ chế pub/sub qua Redis hoặc RabbitMQ (repo đã có `RabbitModule`).

---

## 9. Checklist gateway

- [ ] Namespace `/game` không đụng `/meet`.
- [ ] Auth JWT bắt buộc, verify ở `handleConnection`.
- [ ] Không có logic nghiệp vụ trong gateway — chỉ broadcast.
- [ ] Debounce `leaderboard_updated` ≤ 2 event/s/session.
- [ ] `correctAnswer` không bao giờ gửi trong `game:question_started`.
- [ ] `game:submission_received` chỉ gửi riêng cho host.
- [ ] Gateway emit qua `@OnEvent` subscriber, service emit qua `EventEmitter2`.

---

Bước kế tiếp: đọc [`06-acceptance-criteria.md`](./06-acceptance-criteria.md).
