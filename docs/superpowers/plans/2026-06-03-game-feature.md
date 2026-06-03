# Game Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kahoot-style in-meeting quiz game — game management dashboard, real-time synced gameplay with speed-based scoring, leaderboard, and automatic canvas-based recording capture.

**Architecture:** Separate `/game` WebSocket namespace (EventEmitter2 bridge pattern) alongside `/meet`. `GameService` emits domain events; `MeetGateway` listens with `@OnEvent` to broadcast `game:session_started` to the meet room so the Game tab appears for all participants. Frontend uses `useGameSocket` + `useGameStore` (Zustand) + `useGameCapture` (canvas → LiveKit track).

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, `@nestjs/event-emitter`, Socket.io, Next.js 15, Zustand, LiveKit client SDK, `livekit-client` `LocalVideoTrack`.

**Spec:** `docs/superpowers/specs/2026-06-03-game-feature-design.md`

---

## File Map

### New backend files
```
apps/server/src/game/
  game.module.ts
  game-template.controller.ts
  game-template.service.ts
  game-template.service.spec.ts
  game-session.controller.ts
  game-session.service.ts
  game-session.service.spec.ts
  game.gateway.ts
  dto/
    create-game-template.dto.ts
    update-game-template.dto.ts
    submit-answer.dto.ts
```

### Modified backend files
```
apps/server/src/app.module.ts            — add EventEmitterModule + GameModule
apps/server/prisma/schema.prisma         — add 6 game models + 2 enums
apps/server/src/meet/meet.gateway.ts     — add @OnEvent('game.session.started')
```

### New frontend files
```
apps/website/types/game.ts
apps/website/services/game.service.ts
apps/website/hooks/useGameStore.ts
apps/website/hooks/useGameSocket.ts
apps/website/hooks/useGameCapture.ts
apps/website/lib/game-socket.ts
apps/website/components/game/
  GameLauncher.tsx
  GameActiveTeacher.tsx
  GameActiveStudent.tsx
  GameEnded.tsx
  GameTab.tsx
  GameQuestionEditor.tsx
apps/website/app/(protected)/games/
  page.tsx
  new/page.tsx
  [id]/edit/page.tsx
```

### Modified frontend files
```
apps/website/hooks/useMeetStore.ts       — add activeGameSessionId
apps/website/hooks/useMeetClient.ts      — listen for game:session_started
apps/website/app/(protected)/sessions/[sessionId]/meet/page.tsx  — add 3rd tab
```

---

## Task 1: Register EventEmitterModule in AppModule

**Files:**
- Modify: `apps/server/src/app.module.ts`

`@nestjs/event-emitter` is already installed. It is NOT yet registered in `AppModule`. Add it as a global module so every module can use `EventEmitter2` and `@OnEvent()` without extra imports.

- [ ] **Step 1: Add EventEmitterModule import**

Edit `apps/server/src/app.module.ts`. Add the import at the top and register in the `imports` array:

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';
```

In the `imports` array, add after `ConfigModule.forRoot({ isGlobal: true })`:
```typescript
EventEmitterModule.forRoot({ global: true }),
```

The `imports` array should look like:
```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  EventEmitterModule.forRoot({ global: true }),
  ScheduleModule.forRoot(),
  ...throttleImports,
  UserModule,
  PrismaModule,
  MeetModule,
  ClassModule,
  SessionModule,
  ConversationModule,
  SupabaseModule,
  AiModule,
  RabbitModule,
  GradeModule,
  StripeModule,
],
```

- [ ] **Step 2: Verify server compiles**

```bash
cd apps/server && pnpm run build 2>&1 | tail -5
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/app.module.ts
git commit -m "feat(server): register EventEmitterModule globally"
```

---

## Task 2: Prisma schema — Game models

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1: Append game models to schema**

Add the following to the end of `apps/server/prisma/schema.prisma`:

```prisma
enum QuestionType {
  MULTIPLE_CHOICE
  FILL_BLANK
}

enum GameSessionStatus {
  WAITING
  IN_PROGRESS
  ENDED
}

model GameTemplate {
  id          String         @id @default(cuid())
  title       String
  description String?
  createdBy   String
  questions   GameQuestion[]
  sessions    GameSession[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model GameQuestion {
  id            String       @id @default(cuid())
  templateId    String
  template      GameTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  text          String
  type          QuestionType
  order         Int
  timerSeconds  Int          @default(20)
  correctAnswer String
  options       GameOption[]
  answers       GameAnswer[]
}

model GameOption {
  id         String       @id @default(cuid())
  questionId String
  question   GameQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  label      String
  text       String
}

model GameSession {
  id                   String            @id @default(cuid())
  templateId           String
  template             GameTemplate      @relation(fields: [templateId], references: [id])
  sessionId            String
  startedBy            String
  status               GameSessionStatus @default(WAITING)
  currentQuestionIndex Int               @default(0)
  participants         GameParticipant[]
  answers              GameAnswer[]
  startedAt            DateTime          @default(now())
  endedAt              DateTime?
}

model GameParticipant {
  id                    String      @id @default(cuid())
  sessionId             String
  session               GameSession @relation(fields: [sessionId], references: [id])
  userId                String
  score                 Int         @default(0)
  lastSeenQuestionIndex Int         @default(0)
  joinedAt              DateTime    @default(now())
  lastActiveAt          DateTime    @default(now())
  answers               GameAnswer[]

  @@unique([sessionId, userId])
}

model GameAnswer {
  id             String          @id @default(cuid())
  sessionId      String
  session        GameSession     @relation(fields: [sessionId], references: [id])
  questionId     String
  question       GameQuestion    @relation(fields: [questionId], references: [id])
  participantId  String
  participant    GameParticipant @relation(fields: [participantId], references: [id])
  answer         String
  isCorrect      Boolean
  responseTimeMs Int
  pointsAwarded  Int
  submittedAt    DateTime        @default(now())

  @@unique([participantId, questionId])
}
```

- [ ] **Step 2: Push schema to database**

Run from the repo root:
```bash
pnpm db:push
```
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```
Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/server/prisma/schema.prisma
git commit -m "feat(db): add game models to Prisma schema"
```

---

## Task 3: Frontend TypeScript types

**Files:**
- Create: `apps/website/types/game.ts`

- [ ] **Step 1: Create the types file**

Create `apps/website/types/game.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/types/game.ts
git commit -m "feat(website): add game TypeScript types"
```

---

## Task 4: Backend DTOs

**Files:**
- Create: `apps/server/src/game/dto/create-game-template.dto.ts`
- Create: `apps/server/src/game/dto/update-game-template.dto.ts`
- Create: `apps/server/src/game/dto/submit-answer.dto.ts`

- [ ] **Step 1: Create DTOs directory and files**

Create `apps/server/src/game/dto/create-game-template.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export enum QuestionTypeDto {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  FILL_BLANK = 'FILL_BLANK',
}

export class GameOptionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'Joyful' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateGameQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ enum: QuestionTypeDto })
  @IsEnum(QuestionTypeDto)
  type: QuestionTypeDto;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(5)
  @Max(120)
  timerSeconds: number;

  @ApiProperty({ example: 'Joyful' })
  @IsString()
  @IsNotEmpty()
  correctAnswer: string;

  @ApiPropertyOptional({ type: [GameOptionDto] })
  @ValidateIf((o) => o.type === QuestionTypeDto.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GameOptionDto)
  options?: GameOptionDto[];
}

export class CreateGameTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateGameQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGameQuestionDto)
  questions: CreateGameQuestionDto[];
}
```

Create `apps/server/src/game/dto/update-game-template.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateGameTemplateDto } from './create-game-template.dto';

export class UpdateGameTemplateDto extends PartialType(CreateGameTemplateDto) {}
```

Create `apps/server/src/game/dto/submit-answer.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'Option label (A/B/C/D) for MCQ, or free text for FILL_BLANK' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/game/dto/
git commit -m "feat(game): add backend DTOs for game templates and answers"
```

---

## Task 5: GameTemplateService (TDD)

**Files:**
- Create: `apps/server/src/game/game-template.service.ts`
- Create: `apps/server/src/game/game-template.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/game/game-template.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GameTemplateService } from './game-template.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrisma = {
  gameTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('GameTemplateService', () => {
  let service: GameTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameTemplateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<GameTemplateService>(GameTemplateService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns only templates owned by the caller', async () => {
      const templates = [{ id: '1', createdBy: 'user-1', title: 'Quiz', questions: [] }];
      mockPrisma.gameTemplate.findMany.mockResolvedValue(templates);
      const result = await service.findAll('user-1');
      expect(mockPrisma.gameTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdBy: 'user-1' } }),
      );
      expect(result).toEqual(templates);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when template not found', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller does not own the template', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: '1',
        createdBy: 'other-user',
        questions: [],
      });
      await expect(service.findOne('user-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('returns template when caller owns it', async () => {
      const template = { id: '1', createdBy: 'user-1', questions: [] };
      mockPrisma.gameTemplate.findUnique.mockResolvedValue(template);
      const result = await service.findOne('user-1', '1');
      expect(result).toEqual(template);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when caller does not own the template', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({
        id: '1',
        createdBy: 'other-user',
        questions: [],
      });
      await expect(service.remove('user-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes the template when caller owns it', async () => {
      mockPrisma.gameTemplate.findUnique.mockResolvedValue({ id: '1', createdBy: 'user-1', questions: [] });
      mockPrisma.gameTemplate.delete.mockResolvedValue({ id: '1' });
      await service.remove('user-1', '1');
      expect(mockPrisma.gameTemplate.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm run test -- --testPathPattern="game-template.service" --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `Cannot find module './game-template.service'`

- [ ] **Step 3: Implement GameTemplateService**

Create `apps/server/src/game/game-template.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGameTemplateDto } from './dto/create-game-template.dto';
import { UpdateGameTemplateDto } from './dto/update-game-template.dto';

@Injectable()
export class GameTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.gameTemplate.findMany({
      where: { createdBy: userId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.gameTemplate.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: true },
        },
      },
    });
    if (!template) throw new NotFoundException('Game template not found');
    if (template.createdBy !== userId) throw new ForbiddenException('Access denied');
    return template;
  }

  create(userId: string, dto: CreateGameTemplateDto) {
    return this.prisma.gameTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        createdBy: userId,
        questions: {
          create: dto.questions.map((q) => ({
            text: q.text,
            type: q.type,
            order: q.order,
            timerSeconds: q.timerSeconds,
            correctAnswer: q.correctAnswer,
            options: q.options
              ? { create: q.options.map((o) => ({ label: o.label, text: o.text })) }
              : undefined,
          })),
        },
      },
      include: {
        questions: { include: { options: true } },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateGameTemplateDto) {
    await this.findOne(userId, id);
    return this.prisma.gameTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        questions: dto.questions
          ? {
              deleteMany: {},
              create: dto.questions.map((q) => ({
                text: q.text,
                type: q.type,
                order: q.order,
                timerSeconds: q.timerSeconds,
                correctAnswer: q.correctAnswer,
                options: q.options
                  ? { create: q.options.map((o) => ({ label: o.label, text: o.text })) }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: { questions: { include: { options: true } } },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.gameTemplate.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm run test -- --testPathPattern="game-template.service" --no-coverage 2>&1 | tail -10
```
Expected: `Tests: 5 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/game-template.service.ts apps/server/src/game/game-template.service.spec.ts
git commit -m "feat(game): add GameTemplateService with ownership checks"
```

---

## Task 6: GameTemplateController

**Files:**
- Create: `apps/server/src/game/game-template.controller.ts`

- [ ] **Step 1: Create controller**

Create `apps/server/src/game/game-template.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { GameTemplateService } from './game-template.service';
import { CreateGameTemplateDto } from './dto/create-game-template.dto';
import { UpdateGameTemplateDto } from './dto/update-game-template.dto';

@Controller('game-templates')
@ApiTags('Game Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GameTemplateController {
  constructor(private readonly service: GameTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List own game templates' })
  findAll(@CurrentUser() user: userPayload) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game template' })
  findOne(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a game template' })
  @ApiCreatedResponse({ description: 'Template created' })
  create(@CurrentUser() user: userPayload, @Body() dto: CreateGameTemplateDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a game template' })
  update(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGameTemplateDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a game template' })
  remove(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/game/game-template.controller.ts
git commit -m "feat(game): add GameTemplateController"
```

---

## Task 7: GameSessionService — scoring and fuzzy match (TDD)

**Files:**
- Create: `apps/server/src/game/game-session.service.ts` (partial — scoring helpers first)
- Create: `apps/server/src/game/game-session.service.spec.ts`

These two pure functions are the most testable logic in the feature.

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/game/game-session.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GameSessionService } from './game-session.service';
import { PrismaService } from 'src/prisma/prisma.service';

const mockPrisma = {
  gameSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gameTemplate: { findUnique: jest.fn() },
  gameParticipant: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  gameAnswer: { findUnique: jest.fn(), create: jest.fn() },
};
const mockEventEmitter = { emit: jest.fn() };

describe('GameSessionService', () => {
  let service: GameSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get<GameSessionService>(GameSessionService);
    jest.clearAllMocks();
  });

  describe('computeScore', () => {
    it('returns 1000 for an instant correct answer', () => {
      expect(service.computeScore(0, 20, true)).toBe(1000);
    });

    it('returns 500 for a correct answer submitted at the last millisecond', () => {
      expect(service.computeScore(20000, 20, true)).toBe(500);
    });

    it('returns 750 for a correct answer at half time', () => {
      expect(service.computeScore(10000, 20, true)).toBe(750);
    });

    it('returns 0 for a wrong answer regardless of speed', () => {
      expect(service.computeScore(0, 20, false)).toBe(0);
      expect(service.computeScore(5000, 20, false)).toBe(0);
    });

    it('clamps to 500 minimum for correct answers even if slightly over timer', () => {
      expect(service.computeScore(25000, 20, true)).toBe(500);
    });
  });

  describe('checkAnswer', () => {
    it('exact match returns true for MULTIPLE_CHOICE', () => {
      expect(service.checkAnswer('MULTIPLE_CHOICE', 'B', 'B')).toBe(true);
    });

    it('wrong option returns false for MULTIPLE_CHOICE', () => {
      expect(service.checkAnswer('MULTIPLE_CHOICE', 'B', 'C')).toBe(false);
    });

    it('case-insensitive exact match for FILL_BLANK', () => {
      expect(service.checkAnswer('FILL_BLANK', 'Joyful', 'joyful')).toBe(true);
    });

    it('1 typo accepted for 6-char word (tolerance = 1)', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'joyfull')).toBe(true);
    });

    it('2 typos rejected for 6-char word (tolerance = 1)', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'joyfully')).toBe(false);
    });

    it('completely wrong answer rejected', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', 'happy')).toBe(false);
    });

    it('leading/trailing whitespace is trimmed before matching', () => {
      expect(service.checkAnswer('FILL_BLANK', 'joyful', '  joyful  ')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm run test -- --testPathPattern="game-session.service" --no-coverage 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module './game-session.service'`

- [ ] **Step 3: Implement scoring and fuzzy match in GameSessionService**

Create `apps/server/src/game/game-session.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GameSessionService {
  // Tracks when the current question started: gameSessionId → Date
  private questionStartedAt = new Map<string, Date>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Pure helpers (public for testability) ──────────────────────────────

  computeScore(responseTimeMs: number, timerSeconds: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    const ratio = Math.min(1, responseTimeMs / (timerSeconds * 1000));
    return Math.min(1000, Math.max(500, Math.round(500 + 500 * (1 - ratio))));
  }

  checkAnswer(type: 'MULTIPLE_CHOICE' | 'FILL_BLANK', correct: string, submitted: string): boolean {
    if (type === 'MULTIPLE_CHOICE') {
      return correct.trim().toUpperCase() === submitted.trim().toUpperCase();
    }
    const a = correct.toLowerCase().trim();
    const b = submitted.toLowerCase().trim();
    const tolerance = Math.floor(a.length / 5);
    return this.levenshtein(a, b) <= tolerance;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // ── Session lifecycle ──────────────────────────────────────────────────

  async startSession(templateId: string, meetingSessionId: string, startedBy: string) {
    const template = await this.prisma.gameTemplate.findUnique({
      where: { id: templateId },
      include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
    });
    if (!template) throw new NotFoundException('Game template not found');
    if (template.createdBy !== startedBy) throw new ForbiddenException('Not your template');
    if (template.questions.length === 0) throw new BadRequestException('Template has no questions');

    const session = await this.prisma.gameSession.create({
      data: {
        templateId,
        sessionId: meetingSessionId,
        startedBy,
        status: 'IN_PROGRESS',
        currentQuestionIndex: 0,
      },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });

    // Record question start time
    this.questionStartedAt.set(session.id, new Date());

    // Notify MeetGateway to broadcast to /meet room
    this.eventEmitter.emit('game.session.started', {
      meetingSessionId,
      gameSessionId: session.id,
      title: template.title,
      questionCount: template.questions.length,
    });

    // Emit first question to /game room (GameGateway listens)
    const firstQuestion = template.questions[0];
    this.eventEmitter.emit('game.question.started', {
      gameSessionId: session.id,
      questionIndex: 0,
      text: firstQuestion.text,
      type: firstQuestion.type,
      options: firstQuestion.options,
      timerSeconds: firstQuestion.timerSeconds,
      elapsedSeconds: 0,
    });

    return session;
  }

  async nextQuestion(gameSessionId: string, requesterId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.startedBy !== requesterId) throw new ForbiddenException('Only the teacher can advance questions');
    if (session.status === 'ENDED') throw new BadRequestException('Game has already ended');

    const questions = session.template.questions;
    const currentQuestion = questions[session.currentQuestionIndex];

    // Reveal answer for current question
    this.eventEmitter.emit('game.question.ended', {
      gameSessionId,
      correctAnswer: currentQuestion.correctAnswer,
      questionId: currentQuestion.id,
    });

    const nextIndex = session.currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // End game
      const updated = await this.prisma.gameSession.update({
        where: { id: gameSessionId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      this.questionStartedAt.delete(gameSessionId);

      const leaderboard = await this.buildLeaderboard(gameSessionId);
      this.eventEmitter.emit('game.session.ended', { gameSessionId, leaderboard });
      return updated;
    }

    // Advance to next question
    const updated = await this.prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { currentQuestionIndex: nextIndex },
    });
    this.questionStartedAt.set(gameSessionId, new Date());

    const nextQuestion = questions[nextIndex];
    this.eventEmitter.emit('game.question.started', {
      gameSessionId,
      questionIndex: nextIndex,
      text: nextQuestion.text,
      type: nextQuestion.type,
      options: nextQuestion.options,
      timerSeconds: nextQuestion.timerSeconds,
      elapsedSeconds: 0,
    });

    return updated;
  }

  async submitAnswer(gameSessionId: string, userId: string, answer: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.status !== 'IN_PROGRESS') throw new BadRequestException('No active question');

    const currentQuestion = session.template.questions[session.currentQuestionIndex];

    // Upsert participant (handles late joiners)
    const participant = await this.prisma.gameParticipant.upsert({
      where: { sessionId_userId: { sessionId: gameSessionId, userId } },
      create: {
        sessionId: gameSessionId,
        userId,
        lastSeenQuestionIndex: session.currentQuestionIndex,
      },
      update: {
        lastSeenQuestionIndex: session.currentQuestionIndex,
        lastActiveAt: new Date(),
      },
    });

    // Duplicate check
    const existing = await this.prisma.gameAnswer.findUnique({
      where: { participantId_questionId: { participantId: participant.id, questionId: currentQuestion.id } },
    });
    if (existing) throw new ConflictException('Answer already submitted for this question');

    // Compute response time + correctness + score
    const startedAt = this.questionStartedAt.get(gameSessionId) ?? new Date();
    const responseTimeMs = Date.now() - startedAt.getTime();
    const isCorrect = this.checkAnswer(currentQuestion.type as 'MULTIPLE_CHOICE' | 'FILL_BLANK', currentQuestion.correctAnswer, answer);
    const pointsAwarded = this.computeScore(responseTimeMs, currentQuestion.timerSeconds, isCorrect);

    await this.prisma.gameAnswer.create({
      data: {
        sessionId: gameSessionId,
        questionId: currentQuestion.id,
        participantId: participant.id,
        answer,
        isCorrect,
        responseTimeMs,
        pointsAwarded,
      },
    });

    // Update participant score
    await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: { score: { increment: pointsAwarded } },
    });

    // Emit debounced leaderboard update
    this.eventEmitter.emit('game.leaderboard.update_requested', { gameSessionId });

    return { isCorrect, pointsAwarded, responseTimeMs };
  }

  async getActiveSession(meetingSessionId: string) {
    return this.prisma.gameSession.findFirst({
      where: { sessionId: meetingSessionId, status: 'IN_PROGRESS' },
      include: {
        template: { include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } } },
      },
    });
  }

  async getLeaderboard(gameSessionId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId } });
    if (!session) throw new NotFoundException('Game session not found');
    if (session.status !== 'ENDED') throw new BadRequestException('Leaderboard only available after game ends');
    return this.buildLeaderboard(gameSessionId);
  }

  async buildLeaderboard(gameSessionId: string) {
    const participants = await this.prisma.gameParticipant.findMany({
      where: { sessionId: gameSessionId },
      orderBy: { score: 'desc' },
    });
    return participants.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      displayName: p.userId, // resolved to displayName by gateway via userService
      score: p.score,
    }));
  }

  getQuestionElapsedSeconds(gameSessionId: string): number {
    const startedAt = this.questionStartedAt.get(gameSessionId);
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt.getTime()) / 1000);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm run test -- --testPathPattern="game-session.service" --no-coverage 2>&1 | tail -10
```
Expected: `Tests: 10 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/game/game-session.service.ts apps/server/src/game/game-session.service.spec.ts
git commit -m "feat(game): add GameSessionService with scoring and fuzzy match"
```

---

## Task 8: GameSessionController

**Files:**
- Create: `apps/server/src/game/game-session.controller.ts`

- [ ] **Step 1: Create controller**

Create `apps/server/src/game/game-session.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { GameSessionService } from './game-session.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

class StartSessionDto {
  templateId: string;
  sessionId: string;
}

@Controller('game-sessions')
@ApiTags('Game Sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GameSessionController {
  constructor(private readonly service: GameSessionService) {}

  @Post()
  @ApiOperation({ summary: 'Start a game session in a meeting' })
  start(@CurrentUser() user: userPayload, @Body() dto: StartSessionDto) {
    return this.service.startSession(dto.templateId, dto.sessionId, user.id);
  }

  @Post(':id/next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance to the next question or end the game' })
  next(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.nextQuestion(id, user.id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer for the current question' })
  submit(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.service.submitAnswer(id, user.id, dto.answer);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get final leaderboard (only after game ends)' })
  leaderboard(@Param('id') id: string) {
    return this.service.getLeaderboard(id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active game session for a meeting' })
  @ApiQuery({ name: 'sessionId', required: true })
  getActive(@Query('sessionId') sessionId: string) {
    return this.service.getActiveSession(sessionId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/game/game-session.controller.ts
git commit -m "feat(game): add GameSessionController"
```

---

## Task 9: GameGateway

**Files:**
- Create: `apps/server/src/game/game.gateway.ts`

- [ ] **Step 1: Create the gateway**

Create `apps/server/src/game/game.gateway.ts`:

```typescript
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

  // gameSessionId → Set<socketId>: track who is in each game room
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
    const session = await this.gameSessionService.getActiveSession(
      data.gameSessionId,
    ).catch(() => null);

    if (session) {
      const questions = session.template.questions;
      const currentQuestion = questions[session.currentQuestionIndex];
      if (currentQuestion) {
        const elapsedSeconds = this.gameSessionService.getQuestionElapsedSeconds(
          session.id,
        );
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
    // Cleanup debouncer
    const timer = this.lbDebouncers.get(payload.gameSessionId);
    if (timer) {
      clearTimeout(timer);
      this.lbDebouncers.delete(payload.gameSessionId);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/game/game.gateway.ts
git commit -m "feat(game): add GameGateway with EventEmitter2 bridge"
```

---

## Task 10: GameModule + register in AppModule

**Files:**
- Create: `apps/server/src/game/game.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Create GameModule**

Create `apps/server/src/game/game.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameTemplateController } from './game-template.controller';
import { GameTemplateService } from './game-template.service';
import { GameSessionController } from './game-session.controller';
import { GameSessionService } from './game-session.service';
import { GameGateway } from './game.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [GameTemplateController, GameSessionController],
  providers: [GameTemplateService, GameSessionService, GameGateway],
  exports: [GameSessionService],
})
export class GameModule {}
```

- [ ] **Step 2: Register GameModule in AppModule**

In `apps/server/src/app.module.ts`, add:

```typescript
import { GameModule } from './game/game.module';
```

And add `GameModule` to the `imports` array:
```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  EventEmitterModule.forRoot({ global: true }),
  ScheduleModule.forRoot(),
  ...throttleImports,
  UserModule,
  PrismaModule,
  MeetModule,
  ClassModule,
  SessionModule,
  ConversationModule,
  SupabaseModule,
  AiModule,
  RabbitModule,
  GradeModule,
  StripeModule,
  GameModule,
],
```

- [ ] **Step 3: Build and verify**

```bash
cd apps/server && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/game/game.module.ts apps/server/src/app.module.ts
git commit -m "feat(game): register GameModule in AppModule"
```

---

## Task 11: MeetGateway — broadcast game:session_started to /meet room

**Files:**
- Modify: `apps/server/src/meet/meet.gateway.ts`

- [ ] **Step 1: Add @OnEvent handler**

In `apps/server/src/meet/meet.gateway.ts`, add the import at the top:

```typescript
import { OnEvent } from '@nestjs/event-emitter';
```

Add this method inside the `MeetGateway` class, after the `handleGetWhiteboardState` method (before the deprecated section):

```typescript
@OnEvent('game.session.started')
handleGameSessionStarted(payload: {
  meetingSessionId: string;
  gameSessionId: string;
  title: string;
  questionCount: number;
}) {
  this.server.to(payload.meetingSessionId).emit('game:session_started', {
    gameSessionId: payload.gameSessionId,
    title: payload.title,
    questionCount: payload.questionCount,
  });
  this.logger.log(
    `Game session ${payload.gameSessionId} started in meeting ${payload.meetingSessionId}`,
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
cd apps/server && pnpm run build 2>&1 | tail -5
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/meet/meet.gateway.ts
git commit -m "feat(meet): broadcast game:session_started via EventEmitter2"
```

---

## Task 12: Frontend game service (axios)

**Files:**
- Create: `apps/website/services/game.service.ts`

- [ ] **Step 1: Create service**

Create `apps/website/services/game.service.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/services/game.service.ts
git commit -m "feat(website): add game API service"
```

---

## Task 13: useGameStore

**Files:**
- Create: `apps/website/hooks/useGameStore.ts`

- [ ] **Step 1: Create store**

Create `apps/website/hooks/useGameStore.ts`:

```typescript
"use client";

import { create } from "zustand";
import {
  GameSession,
  GameQuestionStartedEvent,
  GameQuestionEndedEvent,
  LeaderboardEntry,
  GameStatus,
} from "@/types/game";

interface RoundResult {
  isCorrect: boolean;
  pointsAwarded: number;
  correctAnswer: string;
}

interface GameStore {
  activeSession: GameSession | null;
  currentQuestion: GameQuestionStartedEvent | null;
  questionStartedAt: number | null;
  myScore: number;
  myRank: number | null;
  leaderboard: LeaderboardEntry[];
  gameStatus: GameStatus;
  hasSubmitted: boolean;
  roundResult: RoundResult | null;

  setActiveSession: (session: GameSession | null) => void;
  setCurrentQuestion: (q: GameQuestionStartedEvent | null) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setMyScore: (score: number) => void;
  setMyRank: (rank: number | null) => void;
  setGameStatus: (status: GameStatus) => void;
  setHasSubmitted: (v: boolean) => void;
  setRoundResult: (result: RoundResult | null) => void;
  reset: () => void;
}

const initial = {
  activeSession: null,
  currentQuestion: null,
  questionStartedAt: null,
  myScore: 0,
  myRank: null,
  leaderboard: [],
  gameStatus: 'idle' as GameStatus,
  hasSubmitted: false,
  roundResult: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  setActiveSession: (activeSession) => set({ activeSession }),
  setCurrentQuestion: (currentQuestion) =>
    set({ currentQuestion, questionStartedAt: currentQuestion ? Date.now() : null }),
  setLeaderboard: (leaderboard) =>
    set((state) => {
      const myUserId = state.activeSession?.startedBy; // approximation; real userId from useMeetStore
      const myEntry = leaderboard.find((e) => e.userId === myUserId);
      return {
        leaderboard,
        myRank: myEntry?.rank ?? state.myRank,
        myScore: myEntry?.score ?? state.myScore,
      };
    }),
  setMyScore: (myScore) => set({ myScore }),
  setMyRank: (myRank) => set({ myRank }),
  setGameStatus: (gameStatus) => set({ gameStatus }),
  setHasSubmitted: (hasSubmitted) => set({ hasSubmitted }),
  setRoundResult: (roundResult) => set({ roundResult }),
  reset: () => set({ ...initial }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/hooks/useGameStore.ts
git commit -m "feat(website): add useGameStore Zustand store"
```

---

## Task 14: game-socket factory + useGameSocket

**Files:**
- Create: `apps/website/lib/game-socket.ts`
- Create: `apps/website/hooks/useGameSocket.ts`

- [ ] **Step 1: Create game-socket factory**

Create `apps/website/lib/game-socket.ts`:

```typescript
"use client";

import { io, Socket } from "socket.io-client";

function getGameSocketUrl() {
  const base = process.env.NEXT_PUBLIC_MEET_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const normalized = base.replace(/\/$/, "");
  return normalized.endsWith("/game") ? normalized : `${normalized}/game`;
}

export function createGameSocket(token: string): Socket {
  const socket = io(getGameSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
  });
  socket.auth = { token };
  return socket;
}
```

- [ ] **Step 2: Create useGameSocket**

Create `apps/website/hooks/useGameSocket.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { createGameSocket } from "@/lib/game-socket";
import { useGameStore } from "./useGameStore";
import { useMeetStore } from "./useMeetStore";
import {
  GameQuestionStartedEvent,
  GameQuestionEndedEvent,
  GameLeaderboardUpdatedEvent,
  GameSessionEndedEvent,
} from "@/types/game";

export function useGameSocket(gameSessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const localUserId = useMeetStore((state) => state.localUserId);

  const setCurrentQuestion = useGameStore((state) => state.setCurrentQuestion);
  const setLeaderboard = useGameStore((state) => state.setLeaderboard);
  const setGameStatus = useGameStore((state) => state.setGameStatus);
  const setHasSubmitted = useGameStore((state) => state.setHasSubmitted);
  const setRoundResult = useGameStore((state) => state.setRoundResult);
  const setMyScore = useGameStore((state) => state.setMyScore);
  const setMyRank = useGameStore((state) => state.setMyRank);
  const reset = useGameStore((state) => state.reset);

  const connect = useCallback(
    async (id: string) => {
      const supabase = createSupabaseClient();
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const socket = createGameSocket(token);
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("game:join_room", { gameSessionId: id, userId: localUserId });
      });

      socket.on("game:question_started", (payload: GameQuestionStartedEvent) => {
        setCurrentQuestion(payload);
        setGameStatus("active");
        setHasSubmitted(false);
        setRoundResult(null);
      });

      socket.on("game:question_ended", (payload: GameQuestionEndedEvent) => {
        const myPoints = payload.pointsBreakdown.find((p) => p.userId === localUserId);
        setRoundResult({
          isCorrect: (myPoints?.pointsAwarded ?? 0) > 0,
          pointsAwarded: myPoints?.pointsAwarded ?? 0,
          correctAnswer: payload.correctAnswer,
        });
      });

      socket.on("game:leaderboard_updated", (payload: GameLeaderboardUpdatedEvent) => {
        const myEntry = payload.top10.find((e) => e.userId === localUserId);
        if (myEntry) {
          setMyScore(myEntry.score);
          setMyRank(payload.top10.indexOf(myEntry) + 1);
        }
        setLeaderboard(
          payload.top10.map((e, i) => ({ rank: i + 1, userId: e.userId, displayName: e.displayName, score: e.score })),
        );
      });

      socket.on("game:session_ended", (payload: GameSessionEndedEvent) => {
        setLeaderboard(payload.leaderboard);
        setGameStatus("ended");
        setCurrentQuestion(null);
      });

      socket.connect();
    },
    [localUserId, setCurrentQuestion, setGameStatus, setHasSubmitted, setLeaderboard, setMyRank, setMyScore, setRoundResult],
  );

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      if (gameSessionId) socket.emit("game:leave_room", { gameSessionId });
      socket.removeAllListeners();
      socket.disconnect();
    }
    socketRef.current = null;
    reset();
  }, [gameSessionId, reset]);

  useEffect(() => {
    if (!gameSessionId) return;
    connect(gameSessionId);
    return () => disconnect();
  }, [gameSessionId, connect, disconnect]);

  return { socket: socketRef.current };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/lib/game-socket.ts apps/website/hooks/useGameSocket.ts
git commit -m "feat(website): add game socket factory and useGameSocket hook"
```

---

## Task 15: useMeetStore + useMeetClient — game:session_started event

**Files:**
- Modify: `apps/website/hooks/useMeetStore.ts`
- Modify: `apps/website/hooks/useMeetClient.ts`

- [ ] **Step 1: Add activeGameSessionId to useMeetStore**

In `apps/website/hooks/useMeetStore.ts`, add `activeGameSessionId` to the `MeetStore` interface:

```typescript
activeGameSessionId: string | null;
setActiveGameSessionId: (id: string | null) => void;
```

Add it to `initialState`:
```typescript
activeGameSessionId: null,
```

Add the action in `create<MeetStore>(...)`:
```typescript
setActiveGameSessionId: (activeGameSessionId) => set({ activeGameSessionId }),
```

Also add `activeGameSessionId: null` to the `MeetState` type in `apps/website/types/meet.ts` if it exists, or add it directly.

- [ ] **Step 2: Listen for game:session_started in useMeetClient**

In `apps/website/hooks/useMeetClient.ts`, inside the `bindSocketEvents` function, add the following after the `recording-stopped` listener (before the error handlers):

```typescript
import { GameSessionStartedEvent } from "@/types/game";
```

Add the import at the top of the file, and inside `bindSocketEvents`:

```typescript
socket.on("game:session_started", (payload: GameSessionStartedEvent) => {
  const { setActiveGameSessionId } = useMeetStore.getState();
  setActiveGameSessionId(payload.gameSessionId);
});
```

Also add `setActiveGameSessionId` to the destructuring in `bindSocketEvents` dependencies array.

- [ ] **Step 3: Build and check**

```bash
cd apps/website && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/hooks/useMeetStore.ts apps/website/hooks/useMeetClient.ts
git commit -m "feat(website): handle game:session_started in meet store and client"
```

---

## Task 16: Game UI components

**Files:**
- Create: `apps/website/components/game/GameLauncher.tsx`
- Create: `apps/website/components/game/GameActiveTeacher.tsx`
- Create: `apps/website/components/game/GameActiveStudent.tsx`
- Create: `apps/website/components/game/GameEnded.tsx`
- Create: `apps/website/components/game/GameTab.tsx`

- [ ] **Step 1: Create GameLauncher**

Create `apps/website/components/game/GameLauncher.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGameTemplates, startGameSession } from "@/services/game.service";
import { GameTemplate } from "@/types/game";

interface GameLauncherProps {
  meetingSessionId: string;
}

export function GameLauncher({ meetingSessionId }: GameLauncherProps) {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    listGameTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (templateId: string) => {
    setStarting(templateId);
    try {
      await startGameSession({ templateId, sessionId: meetingSessionId });
    } catch {
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p style={{ color: "rgba(255,250,245,0.5)", fontSize: 14 }}>
          No games yet. Create one in the Games dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p style={{ color: "rgba(255,250,245,0.5)", fontSize: 13, marginBottom: 4 }}>
        Start a Game
      </p>
      {templates.map((t) => (
        <div
          key={t.id}
          style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fffaf5" }}>{t.title}</p>
            <p style={{ fontSize: 11, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>
              {t.questions.length} questions
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => handleStart(t.id)}
            disabled={!!starting}
            style={{ background: "#7c3aed", color: "white", fontSize: 12 }}
          >
            {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
            Start
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create GameActiveTeacher**

Create `apps/website/components/game/GameActiveTeacher.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, ChevronRight, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/hooks/useGameStore";
import { nextQuestion } from "@/services/game.service";

interface GameActiveTeacherProps {
  gameSessionId: string;
  questionCount: number;
}

export function GameActiveTeacher({ gameSessionId, questionCount }: GameActiveTeacherProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const [advancing, setAdvancing] = useState(false);

  const handleNext = async () => {
    setAdvancing(true);
    try {
      await nextQuestion(gameSessionId);
    } finally {
      setAdvancing(false);
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 13, color: "rgba(255,250,245,0.5)" }}>
          Question {currentQuestion.questionIndex + 1} of {questionCount}
        </p>
        <Button size="sm" onClick={handleNext} disabled={advancing} style={{ background: "#7c3aed", color: "white", fontSize: 12 }}>
          {advancing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
          Next Question
        </Button>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5", lineHeight: 1.5 }}>
        {currentQuestion.text}
      </p>

      <div className="flex flex-col gap-2 mt-2">
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>
          Leaderboard
        </p>
        {leaderboard.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,250,245,0.35)" }}>Waiting for answers...</p>
        ) : (
          leaderboard.slice(0, 10).map((entry, i) => (
            <div
              key={entry.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: i === 0 ? "#2d1f5e" : "#1e1e1e",
                borderRadius: 6,
              }}
            >
              <span style={{ width: 20, fontWeight: 700, color: i === 0 ? "#fbbf24" : "#9ca3af", fontSize: 13 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "#fffaf5" }}>{entry.displayName}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>{entry.score.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create GameActiveStudent**

Create `apps/website/components/game/GameActiveStudent.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/hooks/useGameStore";
import { submitAnswer } from "@/services/game.service";

const OPTION_COLORS = ["#1e3a5f", "#3b1f6b", "#1a3a1a", "#3a1a1a"] as const;

interface GameActiveStudentProps {
  gameSessionId: string;
}

export function GameActiveStudent({ gameSessionId }: GameActiveStudentProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const hasSubmitted = useGameStore((s) => s.hasSubmitted);
  const roundResult = useGameStore((s) => s.roundResult);
  const myScore = useGameStore((s) => s.myScore);
  const myRank = useGameStore((s) => s.myRank);
  const setHasSubmitted = useGameStore((s) => s.setHasSubmitted);
  const [fillText, setFillText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const questionStartedAt = useGameStore((s) => s.questionStartedAt);

  useEffect(() => {
    if (!currentQuestion) return;
    const total = currentQuestion.timerSeconds - (currentQuestion.elapsedSeconds ?? 0);
    setTimeLeft(total);
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const handleSubmit = async (answer: string) => {
    if (hasSubmitted || submitting) return;
    setSubmitting(true);
    try {
      await submitAnswer(gameSessionId, { answer });
      setHasSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  const timerPercent = currentQuestion.timerSeconds > 0
    ? (timeLeft / currentQuestion.timerSeconds) * 100
    : 0;

  if (roundResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div style={{ fontSize: 40 }}>{roundResult.isCorrect ? "✓" : "✗"}</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: roundResult.isCorrect ? "#86efac" : "#f87171" }}>
          {roundResult.isCorrect ? "Correct!" : "Incorrect"}
        </p>
        <p style={{ fontSize: 28, fontWeight: 700, color: "#a78bfa" }}>
          {roundResult.isCorrect ? `+${roundResult.pointsAwarded}` : "0"} pts
        </p>
        {roundResult.correctAnswer && (
          <p style={{ fontSize: 13, color: "rgba(255,250,245,0.5)" }}>
            Answer: <strong style={{ color: "#fffaf5" }}>{roundResult.correctAnswer}</strong>
          </p>
        )}
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)" }}>Total Score</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#fffaf5" }}>{myScore.toLocaleString()}</p>
          {myRank && (
            <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>Rank #{myRank}</p>
          )}
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", fontStyle: "italic" }}>
          Waiting for next question...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      {/* Timer bar */}
      <div style={{ height: 6, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${timerPercent}%`,
            background: timerPercent > 30 ? "#7c3aed" : "#ef4444",
            borderRadius: 3,
            transition: "width 1s linear",
          }}
        />
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5", lineHeight: 1.5 }}>
        {currentQuestion.text}
      </p>

      {currentQuestion.type === "MULTIPLE_CHOICE" ? (
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.options.map((opt, i) => (
            <button
              key={opt.id}
              disabled={hasSubmitted || submitting}
              onClick={() => handleSubmit(opt.label)}
              style={{
                padding: "14px 10px",
                background: OPTION_COLORS[i % 4],
                borderRadius: 8,
                border: "none",
                cursor: hasSubmitted ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "#fffaf5",
                opacity: hasSubmitted ? 0.6 : 1,
              }}
            >
              {opt.label} · {opt.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            value={fillText}
            onChange={(e) => setFillText(e.target.value)}
            placeholder="Type your answer..."
            disabled={hasSubmitted}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(fillText)}
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />
          <Button
            onClick={() => handleSubmit(fillText)}
            disabled={hasSubmitted || submitting || !fillText.trim()}
            style={{ background: "#7c3aed", color: "white" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </div>
      )}

      {hasSubmitted && !roundResult && (
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.5)", fontStyle: "italic", textAlign: "center" }}>
          Answer submitted! Waiting for results...
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create GameEnded**

Create `apps/website/components/game/GameEnded.tsx`:

```tsx
"use client";

import { useGameStore } from "@/hooks/useGameStore";

export function GameEnded() {
  const leaderboard = useGameStore((s) => s.leaderboard);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <p style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", textAlign: "center" }}>
        Final Results 🏆
      </p>

      <div className="flex justify-center items-end gap-4 my-2">
        {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry, idx) => {
          const originalIdx = top3.indexOf(entry!);
          return (
            <div key={entry!.userId} style={{ textAlign: "center" }}>
              <div style={{ fontSize: idx === 1 ? 32 : 22 }}>{medals[originalIdx]}</div>
              <p style={{ fontSize: idx === 1 ? 13 : 12, fontWeight: idx === 1 ? 700 : 500, color: "#fffaf5", marginTop: 4 }}>
                {entry!.displayName}
              </p>
              <p style={{ fontSize: 11, color: "#a78bfa" }}>{entry!.score.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      {rest.map((entry) => (
        <div
          key={entry.userId}
          style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e1e1e", borderRadius: 6 }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,250,245,0.5)" }}>
            {entry.rank}. {entry.displayName}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,250,245,0.5)" }}>
            {entry.score.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create GameTab**

Create `apps/website/components/game/GameTab.tsx`:

```tsx
"use client";

import { useMeetStore } from "@/hooks/useMeetStore";
import { useGameStore } from "@/hooks/useGameStore";
import { useGameSocket } from "@/hooks/useGameSocket";
import { GameLauncher } from "./GameLauncher";
import { GameActiveTeacher } from "./GameActiveTeacher";
import { GameActiveStudent } from "./GameActiveStudent";
import { GameEnded } from "./GameEnded";

interface GameTabProps {
  meetingSessionId: string;
  isTeacher: boolean;
}

export function GameTab({ meetingSessionId, isTeacher }: GameTabProps) {
  const activeGameSessionId = useMeetStore((s) => s.activeGameSessionId);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const activeSession = useGameStore((s) => s.activeSession);

  useGameSocket(activeGameSessionId);

  if (!activeGameSessionId || gameStatus === "idle") {
    if (!isTeacher) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p style={{ fontSize: 14, color: "rgba(255,250,245,0.35)" }}>
            Wait for your teacher to start a game.
          </p>
        </div>
      );
    }
    return <GameLauncher meetingSessionId={meetingSessionId} />;
  }

  if (gameStatus === "ended") {
    return <GameEnded />;
  }

  const questionCount = activeSession?.template?.questions?.length ?? 0;

  if (isTeacher) {
    return (
      <GameActiveTeacher
        gameSessionId={activeGameSessionId}
        questionCount={questionCount}
      />
    );
  }

  return <GameActiveStudent gameSessionId={activeGameSessionId} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/website/components/game/
git commit -m "feat(website): add game UI components (launcher, active, ended, tab)"
```

---

## Task 17: meet/page.tsx — add Game as 3rd tab

**Files:**
- Modify: `apps/website/app/(protected)/sessions/[sessionId]/meet/page.tsx`

The tab trigger should be hidden until `activeGameSessionId` is set. The tab content uses `forceMount` + `data-[state=inactive]:hidden` (same pattern as whiteboard).

- [ ] **Step 1: Add imports to meet/page.tsx**

At the top of `apps/website/app/(protected)/sessions/[sessionId]/meet/page.tsx`, add:

```typescript
import { GameTab } from "@/components/game/GameTab";
```

- [ ] **Step 2: Read activeGameSessionId from store**

Inside `SessionMeetPage`, after the existing `useMeetStore` reads, add:

```typescript
const activeGameSessionId = useMeetStore((state) => state.activeGameSessionId);
```

Also read the session role. The `session` object has `class` and `metadata`. You need to know if the current user is the teacher. Add:

```typescript
const localUserId = useMeetStore((state) => state.localUserId);
// Determine teacher role: session.hostId or session.metadata?.hostId matches localUserId
const isTeacher = session ? (session as any).hostId === localUserId || (session as any).metadata?.role === 'teacher' : false;
```

> Note: The actual field depends on the `SessionData` type. Use `session?.hostId === localUserId` as the primary check and adjust after reading the type definition in `apps/website/types/session.ts`.

- [ ] **Step 3: Change TabsList from grid-cols-2 to grid-cols-3**

In `meet/page.tsx`, change:
```tsx
className="grid w-full max-w-[400px] grid-cols-2 p-1"
```
to:
```tsx
className="grid w-full max-w-[500px] grid-cols-3 p-1"
```

Wait — the Game tab trigger should be hidden when no game is active. Instead of a 3-column grid that always shows 3 tabs, use a dynamic approach. Replace the `TabsList` block with:

```tsx
<TabsList
  className="flex w-full max-w-[500px] p-1 gap-1"
  style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: 9999 }}
>
  <TabsTrigger
    value="video"
    style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999, flex: 1 }}
    className="!rounded-full data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
  >
    Cuộc gọi video
  </TabsTrigger>
  <TabsTrigger
    value="whiteboard"
    style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999, flex: 1 }}
    className="!rounded-full data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
  >
    Bảng trắng
  </TabsTrigger>
  {activeGameSessionId && (
    <TabsTrigger
      value="game"
      style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999, flex: 1 }}
      className="!rounded-full data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
    >
      🎮 Game
    </TabsTrigger>
  )}
</TabsList>
```

- [ ] **Step 4: Add Game TabsContent and auto-switch**

After the whiteboard `TabsContent`, add:

```tsx
<TabsContent value="game" forceMount className="flex-1 min-h-0 data-[state=inactive]:hidden mt-0">
  {sessionId && (
    <GameTab
      meetingSessionId={sessionId}
      isTeacher={isTeacher}
    />
  )}
</TabsContent>
```

To auto-switch to game tab when a game starts, add a `useEffect` that watches `activeGameSessionId`. You'll need a `useState` for the active tab value and control `Tabs` with `value` + `onValueChange`:

```typescript
const [activeTab, setActiveTab] = useState("video");

useEffect(() => {
  if (activeGameSessionId) setActiveTab("game");
}, [activeGameSessionId]);
```

Change `<Tabs defaultValue="video"` to:
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col min-h-0">
```

- [ ] **Step 5: Build and verify**

```bash
cd apps/website && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/website/app/'(protected)'/sessions/'[sessionId]'/meet/page.tsx
git commit -m "feat(website): add Game tab to meeting page"
```

---

## Task 18: useGameCapture — canvas → LiveKit track

**Files:**
- Create: `apps/website/hooks/useGameCapture.ts`

- [ ] **Step 1: Create the hook**

Create `apps/website/hooks/useGameCapture.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { LocalVideoTrack, Track } from "livekit-client";
import type { Room } from "livekit-client";
import { useMeetStore } from "./useMeetStore";
import { useGameStore } from "./useGameStore";

export function useGameCapture(room: Room | null) {
  const isRecording = useMeetStore((s) => s.isRecording);
  const activeGameSessionId = useMeetStore((s) => s.activeGameSessionId);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const gameStatus = useGameStore((s) => s.gameStatus);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRecording || !activeGameSessionId || !room) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;

    const stream = canvas.captureStream(10);
    streamRef.current = stream;

    const videoTrackNative = stream.getVideoTracks()[0];
    const lkTrack = new LocalVideoTrack(videoTrackNative, undefined, false);
    trackRef.current = lkTrack;

    room.localParticipant.publishTrack(lkTrack, {
      name: "game-view",
      source: Track.Source.ScreenShare,
    });

    const ctx = canvas.getContext("2d")!;

    const render = () => {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, 1280, 720);

      ctx.font = "bold 28px sans-serif";
      ctx.fillStyle = "#fffaf5";
      ctx.textAlign = "center";

      if (gameStatus === "ended") {
        ctx.fillText("Game Over — Final Leaderboard", 640, 80);
        leaderboard.slice(0, 10).forEach((entry, i) => {
          ctx.font = i < 3 ? "bold 22px sans-serif" : "18px sans-serif";
          ctx.fillStyle = i === 0 ? "#fbbf24" : "#fffaf5";
          ctx.fillText(`${entry.rank}. ${entry.displayName} — ${entry.score}`, 640, 140 + i * 50);
        });
      } else if (currentQuestion) {
        ctx.fillText(`Q${currentQuestion.questionIndex + 1}: ${currentQuestion.text}`, 640, 80);

        if (currentQuestion.type === "MULTIPLE_CHOICE") {
          currentQuestion.options.forEach((opt, i) => {
            const x = i % 2 === 0 ? 320 : 960;
            const y = i < 2 ? 260 : 460;
            ctx.font = "bold 22px sans-serif";
            ctx.fillStyle = "#a78bfa";
            ctx.fillText(`${opt.label}: ${opt.text}`, x, y);
          });
        }

        ctx.font = "18px sans-serif";
        ctx.fillStyle = "rgba(255,250,245,0.5)";
        ctx.fillText("Live Leaderboard", 640, 560);
        leaderboard.slice(0, 5).forEach((entry, i) => {
          ctx.font = "16px sans-serif";
          ctx.fillStyle = "#fffaf5";
          ctx.fillText(`${entry.rank}. ${entry.displayName}: ${entry.score}`, 640, 595 + i * 25);
        });
      }
    };

    intervalRef.current = setInterval(render, 100); // 10fps

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (trackRef.current) {
        room.localParticipant.unpublishTrack(trackRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      canvasRef.current = null;
      trackRef.current = null;
      streamRef.current = null;
    };
  }, [isRecording, !!activeGameSessionId, room]);

  // Re-render when content changes (the interval handles this automatically)
}
```

- [ ] **Step 2: Wire up in meet/page.tsx**

In `meet/page.tsx`, inside the `LiveKitRoom` body, add the `useRoomContext` hook and wire `useGameCapture`:

```typescript
import { useGameCapture } from "@/hooks/useGameCapture";
```

Create an inner component `GameCaptureSync` (similar to `TrackStateSync`) that calls the hook with room context:

```tsx
function GameCaptureSync() {
  const room = useRoomContext();
  useGameCapture(room);
  return null;
}
```

Add `<GameCaptureSync />` alongside `<TrackStateSync />` inside `LiveKitRoom`.

- [ ] **Step 3: Build and verify**

```bash
cd apps/website && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/hooks/useGameCapture.ts apps/website/app/'(protected)'/sessions/'[sessionId]'/meet/page.tsx
git commit -m "feat(website): add canvas-based game capture for LiveKit recording"
```

---

## Task 19: GameQuestionEditor component

**Files:**
- Create: `apps/website/components/game/GameQuestionEditor.tsx`

This is used by both the create and edit pages.

- [ ] **Step 1: Create GameQuestionEditor**

Create `apps/website/components/game/GameQuestionEditor.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateGameTemplateDto, QuestionType } from "@/types/game";
import { Plus, Trash2 } from "lucide-react";

type QuestionDraft = CreateGameTemplateDto["questions"][number];

interface GameQuestionEditorProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
}

const emptyQuestion = (order: number): QuestionDraft => ({
  text: "",
  type: "MULTIPLE_CHOICE",
  order,
  timerSeconds: 20,
  correctAnswer: "",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
});

export function GameQuestionEditor({ questions, onChange }: GameQuestionEditorProps) {
  const update = (index: number, patch: Partial<QuestionDraft>) => {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  };

  const addQuestion = () => {
    onChange([...questions, emptyQuestion(questions.length + 1)]);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })));
  };

  return (
    <div className="flex flex-col gap-6">
      {questions.map((q, i) => (
        <div key={i} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,250,245,0.5)" }}>
              Question {i + 1}
            </span>
            <button onClick={() => removeQuestion(i)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder="Question text"
            value={q.text}
            onChange={(e) => update(i, { text: e.target.value })}
            className="mb-3"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />

          <div className="flex gap-3 mb-3">
            <select
              value={q.type}
              onChange={(e) => update(i, {
                type: e.target.value as QuestionType,
                options: e.target.value === "MULTIPLE_CHOICE"
                  ? [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]
                  : undefined,
              })}
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="FILL_BLANK">Fill in the Blank</option>
            </select>

            <Input
              type="number"
              min={5}
              max={120}
              value={q.timerSeconds}
              onChange={(e) => update(i, { timerSeconds: Number(e.target.value) })}
              placeholder="Timer (s)"
              style={{ width: 100, background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
            />
          </div>

          {q.type === "MULTIPLE_CHOICE" && (
            <div className="flex flex-col gap-2 mb-3">
              {(q.options ?? []).map((opt, oi) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <span style={{ width: 20, fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>{opt.label}</span>
                  <Input
                    placeholder={`Option ${opt.label}`}
                    value={opt.text}
                    onChange={(e) => {
                      const opts = (q.options ?? []).map((o) =>
                        o.label === opt.label ? { ...o, text: e.target.value } : o,
                      );
                      update(i, { options: opts });
                    }}
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
                  />
                </div>
              ))}
            </div>
          )}

          <Input
            placeholder={q.type === "MULTIPLE_CHOICE" ? "Correct option label (A/B/C/D)" : "Correct answer"}
            value={q.correctAnswer}
            onChange={(e) => update(i, { correctAnswer: e.target.value })}
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
        style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/components/game/GameQuestionEditor.tsx
git commit -m "feat(website): add GameQuestionEditor reusable component"
```

---

## Task 20: Games Dashboard pages

**Files:**
- Create: `apps/website/app/(protected)/games/page.tsx`
- Create: `apps/website/app/(protected)/games/new/page.tsx`
- Create: `apps/website/app/(protected)/games/[id]/edit/page.tsx`

- [ ] **Step 1: Create games list page**

Create `apps/website/app/(protected)/games/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listGameTemplates, deleteGameTemplate } from "@/services/game.service";
import { GameTemplate } from "@/types/game";
import { toast } from "sonner";

export default function GamesPage() {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await listGameTemplates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this game template?")) return;
    setDeleting(id);
    try {
      await deleteGameTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Game deleted");
    } catch {
      toast.error("Failed to delete game");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fffaf5" }}>My Games</h1>
        <Link href="/games/new">
          <Button style={{ background: "#7c3aed", color: "white" }}>
            <Plus className="h-4 w-4 mr-2" />
            New Game
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12" style={{ color: "rgba(255,250,245,0.35)", fontSize: 14 }}>
          No games yet. Create your first game!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5" }}>{t.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>
                  {t.questions.length} questions
                  {t.description && ` · ${t.description}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/games/${t.id}/edit`}>
                  <Button variant="outline" size="sm" style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  style={{ borderColor: "#2a2a2a", color: "#f87171", background: "transparent" }}
                >
                  {deleting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create new game page**

Create `apps/website/app/(protected)/games/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameQuestionEditor } from "@/components/game/GameQuestionEditor";
import { createGameTemplate } from "@/services/game.service";
import { CreateGameTemplateDto } from "@/types/game";
import { toast } from "sonner";

export default function NewGamePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<CreateGameTemplateDto["questions"]>([
    { text: "", type: "MULTIPLE_CHOICE", order: 1, timerSeconds: 20, correctAnswer: "",
      options: [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }] },
  ]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || questions.length === 0) {
      toast.error("Title and at least one question are required");
      return;
    }
    setSaving(true);
    try {
      await createGameTemplate({ title, description: description || undefined, questions });
      toast.success("Game created!");
      router.push("/games");
    } catch {
      toast.error("Failed to create game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fffaf5", marginBottom: 24 }}>New Game</h1>

      <div className="flex flex-col gap-4 mb-6">
        <Input
          placeholder="Game title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
        />
      </div>

      <GameQuestionEditor questions={questions} onChange={setQuestions} />

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} disabled={saving} style={{ background: "#7c3aed", color: "white" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Game
        </Button>
        <Button variant="outline" onClick={() => router.back()} style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create edit game page**

Create `apps/website/app/(protected)/games/[id]/edit/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameQuestionEditor } from "@/components/game/GameQuestionEditor";
import { getGameTemplate, updateGameTemplate } from "@/services/game.service";
import { CreateGameTemplateDto, GameTemplate } from "@/types/game";
import { toast } from "sonner";

export default function EditGamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<GameTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<CreateGameTemplateDto["questions"]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGameTemplate(params.id)
      .then((t) => {
        setTemplate(t);
        setTitle(t.title);
        setDescription(t.description ?? "");
        setQuestions(
          t.questions.map((q) => ({
            text: q.text,
            type: q.type,
            order: q.order,
            timerSeconds: q.timerSeconds,
            correctAnswer: q.correctAnswer,
            options: q.options?.map((o) => ({ label: o.label, text: o.text })),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await updateGameTemplate(params.id, { title, description: description || undefined, questions });
      toast.success("Game updated!");
      router.push("/games");
    } catch {
      toast.error("Failed to update game");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fffaf5", marginBottom: 24 }}>Edit Game</h1>

      <div className="flex flex-col gap-4 mb-6">
        <Input
          placeholder="Game title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
        />
      </div>

      <GameQuestionEditor questions={questions} onChange={setQuestions} />

      <div className="flex gap-3 mt-6">
        <Button onClick={handleSave} disabled={saving} style={{ background: "#7c3aed", color: "white" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
        <Button variant="outline" onClick={() => router.back()} style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Final build check**

```bash
cd apps/website && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

```bash
cd apps/server && pnpm run build 2>&1 | tail -10
```
Expected: no TypeScript errors.

- [ ] **Step 5: Run all backend tests**

```bash
cd apps/server && pnpm run test --no-coverage 2>&1 | tail -15
```
Expected: all existing tests plus game-template and game-session tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/website/app/'(protected)'/games/
git commit -m "feat(website): add games dashboard pages (list, create, edit)"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Prisma schema → Task 2
  - REST API (templates + sessions) → Tasks 5–8
  - `/game` WebSocket gateway → Task 9
  - EventEmitter2 → Task 1, Task 10, Task 11
  - MeetGateway bridge → Task 11
  - Frontend types → Task 3
  - Game service (axios) → Task 12
  - useGameStore → Task 13
  - useGameSocket → Task 14
  - useMeetStore + useMeetClient → Task 15
  - Game UI components → Task 16
  - 3rd tab in meet/page.tsx → Task 17
  - useGameCapture → Task 18
  - Games dashboard pages → Tasks 19–20
  - Speed-based scoring (TDD) → Task 7
  - Fuzzy match (TDD) → Task 7
  - Reconnect / late-join logic → Task 9 (`game:join_room` handler) + Task 7 (`getActiveSession`)
  - Duplicate answer → Task 7 (`ConflictException`)
  - Recording capture → Task 18
  - Tab hidden until game starts → Task 17

- [x] **Types consistent across tasks:** `GameQuestionStartedEvent` defined in Task 3, used in Task 13 and 16. `LeaderboardEntry` defined in Task 3, used in Tasks 13, 16. `GameSessionService.buildLeaderboard` returns `{rank, userId, displayName, score}[]`, consistent with `LeaderboardEntry`.

- [x] **No placeholders:** All code blocks are complete.
