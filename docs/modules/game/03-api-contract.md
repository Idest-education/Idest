# 03 — API Contract (REST)

> File này là **hợp đồng** giữa backend và frontend. Dev backend phải implement đúng: route, DTO, status code, shape response. Frontend có thể dựa vào đây để viết mock trước.

---

## 1. Quy ước chung

- **Auth:** mọi endpoint yêu cầu JWT qua `AuthGuard` (header `Authorization: Bearer <token>`).
- **Role:** kiểm qua `@Role(Role.TEACHER)` hoặc `@Role(Role.STUDENT)`. Một số endpoint cần thêm `GameSessionHostGuard` hoặc `GameParticipantGuard` (xem file 04).
- **Validation:** dùng `class-validator` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **Content-Type:** `application/json`.
- **Envelope:** theo convention hiện tại của server (xem `interceptors/`). Các response shape bên dưới là **body chưa wrap envelope**.
- **Timestamps:** ISO 8601 (`2026-04-18T10:00:00.000Z`).

### Status code chuẩn

| Code | Khi nào                                                           |
| ---- | ----------------------------------------------------------------- |
| 200  | GET / action thành công                                           |
| 201  | POST tạo resource mới                                             |
| 204  | DELETE thành công (không body)                                    |
| 400  | DTO sai / vi phạm rule nghiệp vụ không tranh chấp                 |
| 401  | Chưa login                                                        |
| 403  | Login rồi nhưng không đủ quyền                                    |
| 404  | Resource không tồn tại                                            |
| 409  | Xung đột trạng thái (ví dụ nộp trùng, state transition sai)       |
| 422  | Không dùng — dùng 400 thay thế                                    |
| 500  | Lỗi hệ thống                                                      |

### Error body (chuẩn Nest filter đang có)

```json
{
  "statusCode": 409,
  "message": "Duplicate submission for this question",
  "errorCode": "DUPLICATE_SUBMISSION",
  "timestamp": "2026-04-18T10:00:00.000Z",
  "path": "game-sessions/.../submit"
}
```

---

## 2. GameTemplate APIs

### 2.1 `POST game-templates` — Tạo template

- **Role:** `TEACHER`

**Request DTO — `CreateTemplateDto`:**

| Field         | Kiểu                   | Bắt buộc | Ràng buộc                                                       |
| ------------- | ---------------------- | :------: | --------------------------------------------------------------- |
| `title`       | string                 |    ✅    | `@IsString`, `@Length(3, 120)`                                  |
| `description` | string                 |    ❌    | `@IsString`, `@MaxLength(500)`                                  |
| `gameType`    | `"MCQ" \| "SHORT_ANSWER"` |  ✅    | `@IsEnum(GameType)`                                             |
| `classId`     | string (uuid)          |    ❌    | `@IsUUID`                                                       |
| `settings`    | object                 |    ❌    | `@IsObject` (free-form JSON)                                    |
| `questions`   | `CreateQuestionDto[]`  |    ✅    | `@ArrayMinSize(1)`, `@ValidateNested({each:true})`              |

**`CreateQuestionDto`:**

| Field                | Kiểu       | Bắt buộc | Ràng buộc                                                                    |
| -------------------- | ---------- | :------: | ---------------------------------------------------------------------------- |
| `orderIndex`         | int        |    ✅    | `@IsInt`, `@Min(0)`                                                          |
| `prompt`             | string     |    ✅    | `@IsString`, `@Length(1, 1000)`                                              |
| `options`            | string[]   | MCQ: ✅  | `@IsArray`, `@ArrayMinSize(2)`, `@ArrayMaxSize(6)`                           |
| `correctAnswer`      | string     | MCQ: ✅ / SHORT: ❌ | Với MCQ: phải là 1 phần tử trong `options`                        |
| `points`             | int        |    ❌    | `@IsInt`, `@Min(1)`, `@Max(100)` — default 10                                |
| `timeLimitSeconds`   | int        |    ❌    | `@IsInt`, `@Min(5)`, `@Max(120)` — default 20                                |

**Rule nghiệp vụ:**

- Tất cả `questions[i].orderIndex` phải **duy nhất** (service tự kiểm, trả 400 nếu trùng).
- `question_type` được gán = `gameType` của template (không nhận từ client).
- Nếu `gameType = MCQ`: từng câu phải có `options` và `correctAnswer`.
- Nếu `gameType = SHORT_ANSWER`: `options` phải null/không có; `correctAnswer` optional (gợi ý chấm).

**Request body mẫu:**

```json
{
  "title": "Ôn tập thì hiện tại đơn",
  "description": "Quiz 10 câu MCQ cho lớp 7A",
  "gameType": "MCQ",
  "classId": "a1b2c3d4-...",
  "questions": [
    {
      "orderIndex": 0,
      "prompt": "She ___ to school every day.",
      "options": ["go", "goes", "going", "gone"],
      "correctAnswer": "goes",
      "points": 10,
      "timeLimitSeconds": 20
    }
  ]
}
```

**Response 201 — `TemplateResponseDto`:**

```json
{
  "id": "uuid",
  "title": "Ôn tập thì hiện tại đơn",
  "description": "Quiz 10 câu MCQ cho lớp 7A",
  "gameType": "MCQ",
  "classId": "a1b2c3d4-...",
  "createdBy": "user-uuid",
  "isPublished": false,
  "settings": {},
  "questionCount": 1,
  "questions": [
    {
      "id": "q-uuid",
      "orderIndex": 0,
      "prompt": "She ___ to school every day.",
      "questionType": "MCQ",
      "options": ["go", "goes", "going", "gone"],
      "correctAnswer": "goes",
      "points": 10,
      "timeLimitSeconds": 20
    }
  ],
  "createdAt": "2026-04-18T10:00:00.000Z",
  "updatedAt": "2026-04-18T10:00:00.000Z"
}
```

**Status code:**

| Code | Khi nào                                                      |
| ---- | ------------------------------------------------------------ |
| 201  | Tạo thành công                                               |
| 400  | DTO sai (trùng `orderIndex`, `correctAnswer` không trong `options`, MCQ thiếu `options`, v.v.) |
| 403  | Không phải TEACHER                                           |

---

### 2.2 `GET game-templates` — List templates

- **Role:** `TEACHER`
- Mặc định trả về template có `created_by = currentUser.id`.
- Query params:
  - `classId` (uuid, optional) — filter theo lớp
  - `gameType` (`MCQ|SHORT_ANSWER`, optional)
  - `isPublished` (bool, optional)
  - `page` (int, default 1), `pageSize` (int, default 20, max 100)

**Response 200:**

```json
{
  "items": [ /* TemplateResponseDto không có questions[] (hoặc chỉ có questionCount) */ ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### 2.3 `GET game-templates/:id` — Get template

- **Role:** `TEACHER`
- Chỉ trả về nếu `created_by = currentUser.id` hoặc currentUser là teacher của `classId` (nếu có).

**Response 200:** `TemplateResponseDto` đầy đủ (có `questions[]`).

**Status code:**

| Code | Khi nào                 |
| ---- | ----------------------- |
| 200  | OK                      |
| 403  | Không có quyền xem      |
| 404  | Không tìm thấy          |

---

### 2.4 `PATCH game-templates/:id` — Update template

- **Role:** `TEACHER` (owner)

**Request DTO — `UpdateTemplateDto`:** `PartialType(CreateTemplateDto)`. Khi update `questions`: **thay thế toàn bộ** (xoá câu cũ → tạo mới trong cùng transaction). Đơn giản cho v1.

**Quy tắc:**

- Không cho update template đã có `GameSession` với `status != CANCELLED` (chặn nếu có ít nhất 1 session đã/đang chơi). Trả 409 `TEMPLATE_IN_USE`.

**Response 200:** `TemplateResponseDto`.

---

### 2.5 `DELETE game-templates/:id` — Xoá template

- **Role:** `TEACHER` (owner)

**Quy tắc:**

- Chặn nếu template có bất kỳ `GameSession` nào (kể cả `CANCELLED`). Trả 409 `TEMPLATE_HAS_SESSIONS`.

**Response 204.**

---

### 2.6 `POST game-templates/:id/publish` — Publish

- **Role:** `TEACHER` (owner)

**Quy tắc:**

- Kiểm mỗi câu hỏi hợp lệ (đủ options/correctAnswer với MCQ).
- Kiểm có ít nhất 1 câu.
- Set `is_published = true`. Idempotent.

**Response 200:** `TemplateResponseDto`.

**Status code:**

| Code | Khi nào                                              |
| ---- | ---------------------------------------------------- |
| 200  | OK                                                   |
| 400  | Template không hợp lệ (ví dụ không có câu hỏi nào)   |
| 403  | Không phải owner                                     |

---

## 3. GameSession APIs

### 3.1 `POST game-sessions` — Tạo session từ template

- **Role:** `TEACHER`

**Request DTO — `StartSessionDto`:**

| Field           | Kiểu                                        | Bắt buộc | Ghi chú                                                                   |
| --------------- | ------------------------------------------- | :------: | ------------------------------------------------------------------------- |
| `templateId`    | uuid                                        |    ✅    |                                                                           |
| `meetingId`     | uuid                                        |    ✅    | FK → `Session.id`; currentUser phải là host của meeting                   |
| `rewardConfig`  | `{ topN: int, tiers: RewardTier[] }`        |    ❌    | Default `{ topN: 3, tiers: ["GOLD","SILVER","BRONZE"] }`; `tiers.length == topN` |

**Rule nghiệp vụ:**

- Template phải `is_published = true`, trả 400 `TEMPLATE_NOT_PUBLISHED` nếu không.
- Meeting (`Session`) phải tồn tại và còn `end_time = null` (đang diễn ra) — hoặc ít nhất không `ENDED`. Trả 409 `MEETING_NOT_ACTIVE` nếu không.
- `currentUser.id === meeting.host_id`, ngược lại 403.
- Trạng thái khởi tạo = `PENDING`.

**Response 201 — `SessionResponseDto`:**

```json
{
  "id": "uuid",
  "templateId": "uuid",
  "meetingId": "uuid",
  "hostId": "user-uuid",
  "status": "PENDING",
  "currentQuestion": null,
  "currentQuestionStartedAt": null,
  "rewardConfig": { "topN": 3, "tiers": ["GOLD", "SILVER", "BRONZE"] },
  "participantCount": 0,
  "template": {
    "id": "uuid",
    "title": "Ôn tập thì hiện tại đơn",
    "gameType": "MCQ",
    "questionCount": 10
  },
  "startedAt": null,
  "endedAt": null,
  "createdAt": "2026-04-18T10:00:00.000Z"
}
```

> **Lưu ý:** `currentQuestion` nếu có sẽ **KHÔNG chứa `correctAnswer`** (giấu với học sinh). Chỉ endpoint nội bộ của teacher (grading) mới được xem.

---

### 3.2 `POST game-sessions/:id/start` — Bắt đầu chơi

- **Role:** `TEACHER` (host)
- **Guard:** `GameSessionHostGuard`

**Quy tắc:**

- Chỉ chấp nhận khi `status = PENDING` → `ACTIVE`. Ngược lại 409 `INVALID_STATE`.
- Set `started_at = now()`, `current_question_id = <câu có order_index nhỏ nhất>`, `current_question_started_at = now()`.
- Phát event `game:session_started` + `game:question_started` qua gateway.

**Response 200:** `SessionResponseDto`.

---

### 3.3 `POST game-sessions/:id/advance` — Qua câu tiếp theo

- **Role:** `TEACHER` (host)

**Request DTO:** không cần body.

**Quy tắc:**

- Chỉ chấp nhận khi `status = ACTIVE`.
- Phát `game:question_ended` (với `correctAnswer` của câu vừa xong) → có thể dừng tạm.
- Nếu còn câu tiếp theo → cập nhật `current_question_id`, `current_question_started_at = now()`. Phát `game:question_started`.
- Nếu hết câu → tự gọi nội bộ flow `end()` (chuyển sang `ENDED`, snapshot leaderboard, distribute rewards).

**Response 200:** `SessionResponseDto`.

---

### 3.4 `POST game-sessions/:id/pause` & `/resume`

- **Role:** `TEACHER` (host)

**Quy tắc:**

- `pause`: `ACTIVE → PAUSED`. Khi pause, `response_time_ms` vẫn tính **theo giờ đã trôi qua thật** — service ghi lại thời gian pause và trừ ra khi tính. *(Đơn giản hoá v1: khi pause, học sinh không được submit — check `status = ACTIVE` trong `submit`. Khi resume, cập nhật `current_question_started_at += (now - paused_at)` để giữ đúng thời gian còn lại.)*
- `resume`: `PAUSED → ACTIVE`.

**Response 200:** `SessionResponseDto`.

---

### 3.5 `POST game-sessions/:id/end` — Kết thúc

- **Role:** `TEACHER` (host)

**Quy tắc:**

- Cho phép từ `ACTIVE | PAUSED | PENDING` → `ENDED`. (Từ `PENDING` tương đương huỷ nhưng giữ `ENDED` để hiển thị lịch sử.)
- Thực hiện trong **1 transaction**:
  1. Set `status = ENDED`, `ended_at = now()`, `current_question_id = null`.
  2. Snapshot `LeaderboardEntry` bằng `ROW_NUMBER() OVER (ORDER BY total_stars DESC, total_response_time_ms ASC, joined_at ASC)`.
  3. Distribute `Reward` cho top `reward_config.topN`.
- Phát event `game:session_ended` kèm `finalLeaderboard` + `rewards`.
- Idempotent: gọi lại khi đã `ENDED` → trả về dữ liệu hiện có (200), không throw.

**Response 200:**

```json
{
  "session": { /* SessionResponseDto */ },
  "finalLeaderboard": [ /* LeaderboardEntryDto[] */ ],
  "rewards": [ /* RewardDto[] */ ]
}
```

---

### 3.6 `POST game-sessions/:id/join` — Student join

- **Role:** `STUDENT`

**Quy tắc:**

- Chỉ join được khi session `status ∈ {PENDING, ACTIVE}`.
- Student phải là thành viên lớp (`ClassMember`) hoặc đã là participant của meeting (`SessionAttendance`). Service tự check qua `SessionService`.
- Idempotent: nếu đã có `GameParticipant` thì return record cũ (200) + set `left_at = null` nếu đã rời trước đó.

**Response 200/201:**

```json
{
  "participantId": "uuid",
  "gameSessionId": "uuid",
  "userId": "uuid",
  "joinedAt": "2026-04-18T10:05:00.000Z",
  "totalStars": 0,
  "totalPoints": 0
}
```

---

### 3.7 `POST game-sessions/:id/leave`

- **Role:** `STUDENT` (participant)

**Quy tắc:** set `left_at = now()`. Điểm đã tích vẫn được giữ. Có thể join lại.

**Response 204.**

---

### 3.8 `GET game-sessions/:id` — Lấy trạng thái

- **Role:** bất kỳ (student participant hoặc teacher của class/meeting)

**Response 200:** `SessionResponseDto`. `currentQuestion` được trả với:
- Teacher (host): có `correctAnswer`.
- Student: **không có** `correctAnswer`.

---

### 3.9 `GET game-sessions/by-meeting/:meetingId` — List theo meeting

- **Role:** bất kỳ member của meeting.

**Response 200:** mảng `SessionResponseDto` sắp xếp theo `created_at DESC`.

---

## 4. Gameplay APIs

### 4.1 `POST game-sessions/:id/submit` — Nộp bài

- **Role:** `STUDENT`
- **Guard:** `GameParticipantGuard`

**Request DTO — `SubmitAnswerDto`:**

| Field                 | Kiểu     | Bắt buộc         | Ràng buộc                                                      |
| --------------------- | -------- | :--------------: | -------------------------------------------------------------- |
| `questionId`          | uuid     |       ✅         | Phải == `session.current_question_id`                          |
| `answerText`          | string   | SHORT_ANSWER: ✅ | `@MaxLength(500)`                                              |
| `selectedOptionIndex` | int      | MCQ: ✅          | `@Min(0)`, `@Max(options.length - 1)` (service kiểm runtime)   |
| `clientSubmittedAt`   | string   |       ✅         | ISO 8601; chỉ để logging/audit, **không** dùng chấm điểm       |

**Quy tắc:**

- Session phải `ACTIVE` (chứ không `PAUSED`).
- `questionId === session.current_question_id`, ngược lại 409 `QUESTION_NOT_ACTIVE`.
- Server tính `response_time_ms = now() - session.current_question_started_at`.
- Nếu `response_time_ms > (time_limit_seconds * 1000 + 2000)` (grace 2s) → 400 `LATE_SUBMISSION`.
- Nếu đã có submission cho `(question_id, participant_id)` → 409 `DUPLICATE_SUBMISSION` (nhờ unique DB).
- MCQ: chấm ngay — set `is_correct`, `stars_awarded`, `points_awarded`. Cập nhật `GameParticipant.total_*` trong cùng transaction.
- SHORT_ANSWER: set `is_correct = null`, `stars = 0`, `points = 0`; chờ giáo viên chấm.
- Phát event `game:submission_received` tới host, và `game:leaderboard_updated` tới cả room (debounce 500ms).

**Response 201:**

```json
{
  "id": "submission-uuid",
  "questionId": "q-uuid",
  "isCorrect": true,
  "starsAwarded": 4,
  "pointsAwarded": 10,
  "responseTimeMs": 6400,
  "submittedAt": "2026-04-18T10:06:30.000Z"
}
```

> **Chú ý:** với SHORT_ANSWER, response sẽ có `"isCorrect": null, "starsAwarded": 0, "pointsAwarded": 0`.

---

### 4.2 `POST game-sessions/:id/grant-stars` — Giáo viên chấm

- **Role:** `TEACHER` (host)

**Request DTO — `GrantStarsDto`:**

| Field          | Kiểu    | Bắt buộc | Ràng buộc                         |
| -------------- | ------- | :------: | --------------------------------- |
| `submissionId` | uuid    |    ✅    |                                   |
| `isCorrect`    | bool    |    ✅    |                                   |
| `stars`        | int     |    ✅    | `@Min(0)`, `@Max(10)`             |

**Quy tắc:**

- Submission phải thuộc session `:id` (validate). Ngược lại 400 `SUBMISSION_NOT_IN_SESSION`.
- Dùng **delta accounting**:
  - `deltaStars = stars - existing.stars_awarded`
  - `deltaPoints = (isCorrect ? question.points : 0) - existing.points_awarded`
  - Update submission + `GameParticipant.total_stars += deltaStars`, `total_points += deltaPoints` trong 1 transaction.
- Set `validated_by = currentUser.id`, `validated_at = now()`.
- Phát `game:leaderboard_updated`.

**Response 200:** `AnswerSubmission` đã update (shape như 4.1).

---

### 4.3 `GET game-sessions/:id/questions/:questionId/submissions` — List bài nộp

- **Role:** `TEACHER` (host)

Dùng cho UI chấm SHORT_ANSWER.

**Query params:**

- `onlyUnvalidated` (bool, default false) — chỉ trả submission có `validated_at = null`.

**Response 200:**

```json
{
  "items": [
    {
      "id": "uuid",
      "participant": {
        "id": "uuid",
        "userId": "uuid",
        "fullName": "Nguyễn Văn A",
        "avatarUrl": "..."
      },
      "answerText": "play",
      "selectedOptionIndex": null,
      "isCorrect": null,
      "starsAwarded": 0,
      "pointsAwarded": 0,
      "responseTimeMs": 5200,
      "submittedAt": "2026-04-18T10:06:30.000Z",
      "validatedBy": null,
      "validatedAt": null
    }
  ],
  "total": 28
}
```

---

## 5. Leaderboard APIs

### 5.1 `GET game-sessions/:id/leaderboard` — Live

- **Role:** participant hoặc host.

Tính on-the-fly bằng raw SQL với `RANK()` (xem file 04 mục 4.4). Luôn dùng được, cả khi session chưa `ENDED`.

**Response 200 — `LeaderboardResponseDto`:**

```json
{
  "gameSessionId": "uuid",
  "status": "ACTIVE",
  "entries": [
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
  ],
  "generatedAt": "2026-04-18T10:10:00.000Z"
}
```

---

### 5.2 `GET game-sessions/:id/leaderboard/final`

- **Role:** như trên.

Đọc từ `LeaderboardEntry` (snapshot).

**Response 200:** `LeaderboardResponseDto`.

**Status code:**

| Code | Khi nào                                    |
| ---- | ------------------------------------------ |
| 200  | OK                                         |
| 404  | Session chưa `ENDED` (chưa có snapshot)    |

---

## 6. Reward APIs

### 6.1 `GET game-sessions/:id/rewards`

- **Role:** participant hoặc host.

**Response 200:**

```json
{
  "gameSessionId": "uuid",
  "rewards": [
    {
      "id": "uuid",
      "participantId": "uuid",
      "userId": "uuid",
      "fullName": "Nguyễn Văn A",
      "avatarUrl": "...",
      "tier": "GOLD",
      "rank": 1,
      "awardedAt": "2026-04-18T10:30:00.000Z",
      "metadata": {}
    }
  ]
}
```

---

### 6.2 `POST game-sessions/:id/rewards/distribute`

- **Role:** `TEACHER` (host)

Dùng để **retry** phân phát reward nếu có lỗi trong flow `end()`. Idempotent.

**Quy tắc:**

- Chỉ chạy nếu `status = ENDED`. Ngược lại 409 `SESSION_NOT_ENDED`.
- Xoá `Reward` cũ của session → tạo lại từ `LeaderboardEntry` theo `reward_config`.

**Response 200:** body giống 6.1.

---

## 7. Summary bảng endpoint

| Method | Route                                                       | Role         | Guard bổ sung              |
| ------ | ----------------------------------------------------------- | ------------ | -------------------------- |
| POST   | `/game-templates`                                           | TEACHER      | —                          |
| GET    | `/game-templates`                                           | TEACHER      | —                          |
| GET    | `/game-templates/:id`                                       | TEACHER      | TemplateOwnerGuard         |
| PATCH  | `/game-templates/:id`                                       | TEACHER      | TemplateOwnerGuard         |
| DELETE | `/game-templates/:id`                                       | TEACHER      | TemplateOwnerGuard         |
| POST   | `/game-templates/:id/publish`                               | TEACHER      | TemplateOwnerGuard         |
| POST   | `/game-sessions`                                            | TEACHER      | —                          |
| POST   | `/game-sessions/:id/start`                                  | TEACHER      | GameSessionHostGuard       |
| POST   | `/game-sessions/:id/advance`                                | TEACHER      | GameSessionHostGuard       |
| POST   | `/game-sessions/:id/pause`                                  | TEACHER      | GameSessionHostGuard       |
| POST   | `/game-sessions/:id/resume`                                 | TEACHER      | GameSessionHostGuard       |
| POST   | `/game-sessions/:id/end`                                    | TEACHER      | GameSessionHostGuard       |
| POST   | `/game-sessions/:id/join`                                   | STUDENT      | —                          |
| POST   | `/game-sessions/:id/leave`                                  | STUDENT      | GameParticipantGuard       |
| GET    | `/game-sessions/:id`                                        | any member   | —                          |
| GET    | `/game-sessions/by-meeting/:meetingId`                      | any member   | —                          |
| POST   | `/game-sessions/:id/submit`                                 | STUDENT      | GameParticipantGuard       |
| POST   | `/game-sessions/:id/grant-stars`                            | TEACHER      | GameSessionHostGuard       |
| GET    | `/game-sessions/:id/questions/:questionId/submissions`      | TEACHER      | GameSessionHostGuard       |
| GET    | `/game-sessions/:id/leaderboard`                            | any member   | —                          |
| GET    | `/game-sessions/:id/leaderboard/final`                      | any member   | —                          |
| GET    | `/game-sessions/:id/rewards`                                | any member   | —                          |
| POST   | `/game-sessions/:id/rewards/distribute`                     | TEACHER      | GameSessionHostGuard       |

---

Bước kế tiếp: đọc [`04-game-logic.md`](./04-game-logic.md).
