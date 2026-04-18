# 02 — Database Schema (Prisma + PostgreSQL)

> File này mô tả **toàn bộ schema** cần thêm vào [`apps/server/prisma/schema.prisma`](../../apps/server/prisma/schema.prisma). Chỉ dùng để tham khảo — **không tự chạy `prisma migrate dev`** khi chưa được duyệt.

---

## 1. Sơ đồ ERD

```mermaid
erDiagram
    User ||--o{ GameTemplate : "created_by"
    Class ||--o{ GameTemplate : "class_id"
    GameTemplate ||--o{ GameQuestion : "template_id"
    GameTemplate ||--o{ GameSession : "template_id"
    Session ||--o{ GameSession : "meeting_id"
    User ||--o{ GameSession : "host_id"
    GameSession ||--o{ GameParticipant : ""
    GameSession ||--o{ AnswerSubmission : ""
    GameSession ||--o{ LeaderboardEntry : ""
    GameSession ||--o{ Reward : ""
    GameQuestion ||--o{ AnswerSubmission : ""
    GameParticipant ||--o{ AnswerSubmission : ""
    GameParticipant ||--o| LeaderboardEntry : ""
    GameParticipant ||--o| Reward : ""
    User ||--o{ GameParticipant : "user_id"
    User ||--o{ AnswerSubmission : "validated_by"
```

- `Session`, `User`, `Class` là các model **đã tồn tại** (không thay đổi, chỉ thêm back-relation).
- 7 model mới: `GameTemplate`, `GameQuestion`, `GameSession`, `GameParticipant`, `AnswerSubmission`, `LeaderboardEntry`, `Reward`.
- 3 enum mới: `GameType`, `GameSessionStatus`, `RewardTier`.

---

## 2. Enum

```prisma
enum GameType {
  MCQ
  SHORT_ANSWER
}

enum GameSessionStatus {
  PENDING     // đã tạo, chưa bắt đầu
  ACTIVE      // đang chơi, có câu hỏi đang active
  PAUSED      // teacher tạm dừng
  ENDED       // đã kết thúc (có leaderboard snapshot + rewards)
  CANCELLED   // huỷ trước khi chơi (không tính kết quả)
}

enum RewardTier {
  GOLD
  SILVER
  BRONZE
  PARTICIPATION
}
```

---

## 3. 7 model mới

### 3.1 `GameTemplate`

Bộ câu hỏi chuẩn bị trước, tái sử dụng nhiều lần.

```prisma
model GameTemplate {
  id           String    @id @default(uuid())
  title        String
  description  String?
  game_type    GameType
  class_id     String?   // null = template cá nhân không gắn lớp
  created_by   String
  is_published Boolean   @default(false)
  settings     Json      @default("{}")
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt

  creator   User           @relation("GameTemplateCreator", fields: [created_by], references: [id])
  class     Class?         @relation(fields: [class_id], references: [id])
  questions GameQuestion[]
  sessions  GameSession[]

  @@index([created_by])
  @@index([class_id])
}
```

**Giải thích cột:**

| Cột           | Kiểu      | Ý nghĩa                                                                                                      |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `id`          | uuid      | Khoá chính                                                                                                   |
| `title`       | string    | Tên template (3..120 ký tự, validate ở DTO)                                                                  |
| `description` | string?   | Mô tả (≤ 500 ký tự)                                                                                          |
| `game_type`   | GameType  | Loại game: `MCQ` hoặc `SHORT_ANSWER`. **Tất cả câu hỏi trong template phải cùng loại này.**                  |
| `class_id`    | uuid?     | Nếu gắn với lớp cụ thể thì set. Null = template riêng của giáo viên (dùng cho bất kỳ lớp nào họ dạy).        |
| `created_by`  | uuid      | FK → `User.id`. Chủ sở hữu template.                                                                         |
| `is_published`| bool      | False = bản nháp, không cho phép tạo `GameSession`. True = sẵn sàng chơi.                                    |
| `settings`    | jsonb     | Config mở rộng (màu chủ đề, icon, shuffle order, v.v.). Không enforce schema ở DB.                           |
| `created_at`  | timestamp | Tự set                                                                                                       |
| `updated_at`  | timestamp | Tự cập nhật                                                                                                  |

---

### 3.2 `GameQuestion`

Một câu hỏi thuộc template.

```prisma
model GameQuestion {
  id                 String   @id @default(uuid())
  template_id        String
  order_index        Int
  prompt             String
  question_type      GameType
  options            Json?
  correct_answer     String?
  points             Int      @default(10)
  time_limit_seconds Int      @default(20)
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  template         GameTemplate       @relation(fields: [template_id], references: [id], onDelete: Cascade)
  submissions      AnswerSubmission[]
  activeInSessions GameSession[]      @relation("CurrentQuestion")

  @@unique([template_id, order_index])
  @@index([template_id])
}
```

**Giải thích cột:**

| Cột                  | Kiểu      | Ý nghĩa                                                                                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `template_id`        | uuid      | FK → `GameTemplate`. Xoá template cascade xoá hết câu hỏi.                                                                                |
| `order_index`        | int       | Thứ tự câu trong template (bắt đầu từ 0). **Unique theo `(template_id, order_index)`** để không trùng thứ tự.                             |
| `prompt`             | string    | Nội dung câu hỏi (1..1000 ký tự).                                                                                                         |
| `question_type`      | GameType  | Trùng với `game_type` của template (redundant để query nhanh). Validate ở service.                                                        |
| `options`            | jsonb?    | Với MCQ: mảng string 2..6 phần tử, ví dụ `["A", "B", "C", "D"]`. Với SHORT_ANSWER: null.                                                  |
| `correct_answer`     | string?   | Với MCQ: đáp án đúng (match một phần tử trong `options`). Với SHORT_ANSWER: gợi ý đáp án cho giáo viên xem khi chấm (nullable).           |
| `points`             | int       | Điểm cơ bản khi đúng (mặc định 10, range 1..100).                                                                                         |
| `time_limit_seconds` | int       | Thời gian tối đa cho câu hỏi khi chơi (mặc định 20s, range 5..120).                                                                       |

> **Quan trọng:** `options` và `correct_answer` là **kiểu jsonb/string** ở DB để linh hoạt. Service phải validate theo `game_type`. Đừng enforce ở DB bằng CHECK constraint (không cần phức tạp).

---

### 3.3 `GameSession`

Phiên chơi runtime, gắn với 1 meeting.

```prisma
model GameSession {
  id                          String            @id @default(uuid())
  template_id                 String
  meeting_id                  String
  host_id                     String
  status                      GameSessionStatus @default(PENDING)
  current_question_id         String?
  current_question_started_at DateTime?
  reward_config               Json              @default("{\"top_n\":3,\"tiers\":[\"GOLD\",\"SILVER\",\"BRONZE\"]}")
  started_at                  DateTime?
  ended_at                    DateTime?
  created_at                  DateTime          @default(now())
  updated_at                  DateTime          @updatedAt

  template        GameTemplate       @relation(fields: [template_id], references: [id])
  meeting         Session            @relation(fields: [meeting_id], references: [id], onDelete: Cascade)
  host            User               @relation("GameSessionHost", fields: [host_id], references: [id])
  currentQuestion GameQuestion?      @relation("CurrentQuestion", fields: [current_question_id], references: [id])

  participants  GameParticipant[]
  submissions   AnswerSubmission[]
  leaderboard   LeaderboardEntry[]
  rewards       Reward[]

  @@index([meeting_id])
  @@index([status])
  @@index([host_id])
}
```

**Giải thích cột:**

| Cột                             | Kiểu               | Ý nghĩa                                                                                                                                                              |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template_id`                   | uuid               | FK → `GameTemplate`. **Không cascade xoá** — giữ lịch sử phiên chơi kể cả khi template bị xoá (service phải chặn xoá template có session).                           |
| `meeting_id`                    | uuid               | FK → `Session.id` (meeting đã có). `onDelete: Cascade` — meeting bị xoá thì game cũng xoá theo. Để "kết thúc meeting mềm" thì dùng endpoint `POST .../end`.          |
| `host_id`                       | uuid               | FK → `User`. Phải == `Session.host_id` khi tạo.                                                                                                                      |
| `status`                        | enum               | State machine: `PENDING → ACTIVE ↔ PAUSED → ENDED`, hoặc `PENDING → CANCELLED`.                                                                                      |
| `current_question_id`           | uuid?              | Câu đang active khi `status = ACTIVE`. Null ở các trạng thái khác.                                                                                                   |
| `current_question_started_at`   | timestamp?         | Thời điểm server mở câu hiện tại. Dùng để tính `response_time_ms` và chặn bài nộp muộn.                                                                              |
| `reward_config`                 | jsonb              | `{"top_n": 3, "tiers": ["GOLD","SILVER","BRONZE"]}`. Độ dài `tiers` phải bằng `top_n`.                                                                               |
| `started_at`                    | timestamp?         | Set khi chuyển từ `PENDING → ACTIVE`.                                                                                                                                |
| `ended_at`                      | timestamp?         | Set khi `ENDED` hoặc `CANCELLED`.                                                                                                                                    |

> **Không** tạo unique constraint `(meeting_id, template_id)` — giáo viên có thể chơi đi chơi lại cùng template trong 1 meeting.

---

### 3.4 `GameParticipant`

Bản ghi học sinh tham gia phiên.

```prisma
model GameParticipant {
  id                     String    @id @default(uuid())
  game_session_id        String
  user_id                String
  joined_at              DateTime  @default(now())
  left_at                DateTime?
  total_stars            Int       @default(0)
  total_points           Int       @default(0)
  total_response_time_ms BigInt    @default(0)

  gameSession      GameSession        @relation(fields: [game_session_id], references: [id], onDelete: Cascade)
  user             User               @relation("GameParticipantUser", fields: [user_id], references: [id])
  submissions      AnswerSubmission[]
  leaderboardEntry LeaderboardEntry?
  reward           Reward?

  @@unique([game_session_id, user_id])
  @@index([game_session_id, total_stars])
}
```

| Cột                      | Kiểu     | Ý nghĩa                                                                                                           |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `game_session_id`        | uuid     | FK → `GameSession`. Cascade khi session bị xoá.                                                                   |
| `user_id`                | uuid     | FK → `User`.                                                                                                      |
| `joined_at`              | timestamp| Mặc định `now()`.                                                                                                 |
| `left_at`                | timestamp?| Set khi gọi `/leave`.                                                                                            |
| `total_stars`            | int      | Tổng sao tích luỹ. Update atomic trong cùng transaction với `AnswerSubmission`.                                   |
| `total_points`           | int      | Tổng điểm.                                                                                                        |
| `total_response_time_ms` | bigint   | Tổng thời gian phản hồi, dùng để tie-break trên leaderboard.                                                      |

**Index quan trọng:** `@@index([game_session_id, total_stars])` — phục vụ query leaderboard.

---

### 3.5 `AnswerSubmission`

Mỗi bài nộp của học sinh cho 1 câu hỏi.

```prisma
model AnswerSubmission {
  id                    String    @id @default(uuid())
  game_session_id       String
  question_id           String
  participant_id        String
  answer_text           String?
  selected_option_index Int?
  is_correct            Boolean?
  stars_awarded         Int       @default(0)
  points_awarded        Int       @default(0)
  response_time_ms      Int
  submitted_at          DateTime  @default(now())
  validated_by          String?
  validated_at          DateTime?

  gameSession GameSession     @relation(fields: [game_session_id], references: [id], onDelete: Cascade)
  question    GameQuestion    @relation(fields: [question_id], references: [id])
  participant GameParticipant @relation(fields: [participant_id], references: [id], onDelete: Cascade)
  validator   User?           @relation("SubmissionValidator", fields: [validated_by], references: [id])

  @@unique([question_id, participant_id])
  @@index([game_session_id])
  @@index([participant_id])
}
```

| Cột                      | Kiểu      | Ý nghĩa                                                                                                        |
| ------------------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| `question_id`            | uuid      | FK → `GameQuestion`.                                                                                           |
| `participant_id`         | uuid      | FK → `GameParticipant`.                                                                                        |
| `answer_text`            | string?   | Với SHORT_ANSWER. Với MCQ thì null.                                                                            |
| `selected_option_index`  | int?      | Với MCQ (0-based). Với SHORT_ANSWER thì null.                                                                  |
| `is_correct`             | bool?     | MCQ set ngay. SHORT_ANSWER: null cho tới khi giáo viên chấm.                                                   |
| `stars_awarded`          | int       | 0..5. Tính theo công thức ở file 04. Re-grading = tính delta.                                                  |
| `points_awarded`         | int       | = `question.points` nếu đúng, 0 nếu sai.                                                                       |
| `response_time_ms`       | int       | Server tính = `submitted_at - current_question_started_at`. **Không** tin client.                              |
| `validated_by`           | uuid?     | FK → `User`. Null = auto (MCQ). Set = teacher đã grant-stars.                                                  |
| `validated_at`           | timestamp?| Thời điểm giáo viên chấm.                                                                                      |

**Ràng buộc quan trọng:** `@@unique([question_id, participant_id])` — **1 học sinh chỉ nộp được 1 lần cho 1 câu**. DB sẽ throw `P2002` nếu nộp trùng → service bắt và trả `409 DUPLICATE_SUBMISSION`.

---

### 3.6 `LeaderboardEntry`

Snapshot bảng xếp hạng **cuối game**. Live leaderboard không dùng bảng này (tính on-the-fly từ `GameParticipant`).

```prisma
model LeaderboardEntry {
  id                     String   @id @default(uuid())
  game_session_id        String
  participant_id         String   @unique
  rank                   Int
  total_stars            Int
  total_points           Int
  total_response_time_ms BigInt
  computed_at            DateTime @default(now())

  gameSession GameSession     @relation(fields: [game_session_id], references: [id], onDelete: Cascade)
  participant GameParticipant @relation(fields: [participant_id], references: [id], onDelete: Cascade)

  @@unique([game_session_id, rank])
  @@index([game_session_id, rank])
}
```

| Cột                      | Kiểu  | Ý nghĩa                                                                                                           |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `participant_id`         | uuid  | Unique — một participant có đúng 1 entry.                                                                         |
| `rank`                   | int   | Hạng 1-based. Dùng `ROW_NUMBER()` khi snapshot (không để hoà hạng trong bản chính thức).                          |
| `total_stars/points/rt`  | -     | Copy từ `GameParticipant` tại thời điểm end.                                                                      |
| `computed_at`            | ts    | Khi tính snapshot.                                                                                                |

**Unique `(game_session_id, rank)`** đảm bảo không có 2 người cùng rank trong bản snapshot.

---

### 3.7 `Reward`

```prisma
model Reward {
  id              String     @id @default(uuid())
  game_session_id String
  participant_id  String     @unique
  tier            RewardTier
  rank            Int
  awarded_at      DateTime   @default(now())
  metadata        Json       @default("{}")

  gameSession GameSession     @relation(fields: [game_session_id], references: [id], onDelete: Cascade)
  participant GameParticipant @relation(fields: [participant_id], references: [id], onDelete: Cascade)

  @@unique([game_session_id, rank])
  @@index([game_session_id])
}
```

| Cột             | Kiểu     | Ý nghĩa                                                                               |
| --------------- | -------- | ------------------------------------------------------------------------------------- |
| `participant_id`| uuid     | Unique — mỗi participant nhận tối đa 1 reward/session.                                |
| `tier`          | enum     | `GOLD`/`SILVER`/`BRONZE`/`PARTICIPATION`.                                             |
| `rank`          | int      | Hạng tương ứng (1..N). Unique theo `(game_session_id, rank)`.                         |
| `metadata`      | jsonb    | Tuỳ biến (ví dụ: `{"label":"Vàng","iconUrl":"..."}`) — không enforce schema.          |

---

## 4. Back-relation cần thêm vào model có sẵn

### 4.1 `User` (thêm vào model `User` trong schema hiện tại)

```prisma
model User {
  // ... các field cũ ...

  GameTemplatesCreated GameTemplate[]     @relation("GameTemplateCreator")
  GameSessionsHosted   GameSession[]      @relation("GameSessionHost")
  GameParticipations   GameParticipant[]  @relation("GameParticipantUser")
  SubmissionsValidated AnswerSubmission[] @relation("SubmissionValidator")
}
```

### 4.2 `Session` (meeting đã có)

```prisma
model Session {
  // ... các field cũ ...

  gameSessions GameSession[]
}
```

### 4.3 `Class`

```prisma
model Class {
  // ... các field cũ ...

  gameTemplates GameTemplate[]
}
```

---

## 5. Tổng hợp index & ràng buộc

| Model              | Unique                               | Index                                    | Lý do                                     |
| ------------------ | ------------------------------------ | ---------------------------------------- | ----------------------------------------- |
| `GameTemplate`     | —                                    | `(created_by)`, `(class_id)`             | List template theo owner / class          |
| `GameQuestion`     | `(template_id, order_index)`         | `(template_id)`                          | Không trùng thứ tự; load theo template    |
| `GameSession`      | —                                    | `(meeting_id)`, `(status)`, `(host_id)`  | List theo meeting, lọc ACTIVE, theo host  |
| `GameParticipant`  | `(game_session_id, user_id)`         | `(game_session_id, total_stars)`         | Leaderboard query nhanh                   |
| `AnswerSubmission` | `(question_id, participant_id)`      | `(game_session_id)`, `(participant_id)`  | Chặn trùng; list theo session/participant |
| `LeaderboardEntry` | `(game_session_id, rank)`, `participant_id` | `(game_session_id, rank)`         | Đọc snapshot theo thứ tự                  |
| `Reward`           | `(game_session_id, rank)`, `participant_id` | `(game_session_id)`                | Đọc rewards                               |

---

## 6. Lưu ý về `onDelete`

| FK                                   | onDelete  | Lý do                                                                   |
| ------------------------------------ | --------- | ----------------------------------------------------------------------- |
| `GameQuestion.template_id`           | `Cascade` | Xoá template → xoá câu hỏi.                                             |
| `GameSession.meeting_id`             | `Cascade` | Xoá meeting → xoá game. Dùng "end session" để kết thúc mềm.             |
| `GameSession.template_id`            | *(mặc định Restrict)* | Giữ lịch sử: service chặn xoá template nếu còn session.     |
| `GameParticipant.game_session_id`    | `Cascade` |                                                                         |
| `AnswerSubmission.game_session_id`   | `Cascade` |                                                                         |
| `AnswerSubmission.participant_id`    | `Cascade` |                                                                         |
| `LeaderboardEntry.*`                 | `Cascade` |                                                                         |
| `Reward.*`                           | `Cascade` |                                                                         |

---

Bước kế tiếp: đọc [`03-api-contract.md`](./03-api-contract.md).
