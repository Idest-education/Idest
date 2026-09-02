# 06 — Acceptance Criteria

> File này định nghĩa **"xong"**. QA và lead review dựa vào đây để pass/fail. Dev tự checklist trước khi mở PR cuối cùng.

---

## 1. API correctness

### 1.1 Status code

| Tình huống                                            | Code mong đợi | Error code (body)          |
| ----------------------------------------------------- | :-----------: | -------------------------- |
| Tạo template OK                                       | 201           | —                          |
| Tạo template thiếu `title` / DTO sai                  | 400           | `VALIDATION_ERROR`         |
| MCQ thiếu `options`                                   | 400           | `INVALID_QUESTION`         |
| `correctAnswer` không thuộc `options`                 | 400           | `INVALID_CORRECT_ANSWER`   |
| Start session từ template chưa publish                | 400           | `TEMPLATE_NOT_PUBLISHED`   |
| Start session từ meeting đã end                       | 409           | `MEETING_NOT_ACTIVE`       |
| Student submit khi không phải participant             | 403           | `NOT_A_PARTICIPANT`        |
| Student submit câu không active                       | 409           | `QUESTION_NOT_ACTIVE`      |
| Student submit lần 2 cùng câu                         | 409           | `DUPLICATE_SUBMISSION`     |
| Student submit quá `time_limit + 2s`                  | 400           | `LATE_SUBMISSION`          |
| Student submit khi session PAUSED                     | 409           | `SESSION_PAUSED`           |
| Non-host gọi start/end/advance                        | 403           | `NOT_SESSION_HOST`         |
| Get final leaderboard khi chưa ENDED                  | 404           | `LEADERBOARD_NOT_FINAL`    |
| End session 2 lần                                     | 200           | — (idempotent)             |

### 1.2 Shape response

- Mọi response tuân **đúng** shape trong file 03. Field không có trong contract → không được trả (dùng `ClassSerializerInterceptor` + `@Expose` nếu cần).
- `GET /game-sessions/:id` với role STUDENT: **không** có `currentQuestion.correctAnswer`. Test assert field này `=== undefined`.
- `LeaderboardEntryDto.totalResponseTimeMs` serialize thành **number** (không phải string), dù DB là BigInt. Dev convert trong DTO.

---

## 2. DB integrity

### 2.1 Unique constraint

- Tạo 2 `AnswerSubmission` cùng `(question_id, participant_id)` → PostgreSQL throw, Prisma ném `P2002`. Service bắt & trả 409.
- Tạo 2 `GameQuestion` cùng `(template_id, order_index)` → 400 `DUPLICATE_ORDER_INDEX`.
- Tạo 2 `GameParticipant` cùng `(game_session_id, user_id)` → service xử lý idempotent, không tạo mới, trả record cũ + unset `left_at`.
- `LeaderboardEntry` có unique `(game_session_id, rank)` và `participant_id` → không thể insert double.

### 2.2 Invariant sau khi `end()`

Test E2E phải assert:

- `GameSession.status === 'ENDED'`.
- `GameSession.ended_at !== null`.
- `GameSession.current_question_id === null`.
- `COUNT(LeaderboardEntry WHERE game_session_id = X) === COUNT(GameParticipant WHERE game_session_id = X)`.
- `COUNT(Reward WHERE game_session_id = X) === min(participantCount, reward_config.top_n)`.
- Với mỗi participant P:
  - `P.total_stars === SUM(AnswerSubmission.stars_awarded WHERE participant_id = P)`
  - `P.total_points === SUM(AnswerSubmission.points_awarded WHERE participant_id = P)`
  - `P.total_response_time_ms === SUM(AnswerSubmission.response_time_ms WHERE participant_id = P)`

### 2.3 Cascade

- Xoá `Session` (meeting) → xoá cascade hết `GameSession`, `GameParticipant`, `AnswerSubmission`, `LeaderboardEntry`, `Reward` liên quan.
- Xoá `GameTemplate` có session → bị chặn (service logic, không phải cascade).

---

## 3. Test cases mẫu (Given/When/Then)

### TC-01: Happy path MCQ

- **Given:** 1 teacher publish template MCQ có 3 câu (time limit 20s, points 10). 5 học sinh đang trong meeting.
- **When:**
  - Teacher tạo session + start.
  - Lần lượt 5 học sinh join, mỗi câu 5 người đều nộp đúng với response time khác nhau (2s, 5s, 10s, 15s, 19s).
  - Teacher advance qua đủ 3 câu.
  - Session tự chuyển ENDED.
- **Then:**
  - 5 `LeaderboardEntry`, rank 1..5 theo total_stars (người 2s cao nhất: 15 sao; người 19s thấp nhất: 6 sao).
  - Rank 1/2/3 có `Reward` tier GOLD/SILVER/BRONZE.
  - Event `game:session_ended` được emit 1 lần.

### TC-02: Short answer cần chấm

- **Given:** template SHORT_ANSWER 1 câu. 3 học sinh join.
- **When:**
  - 3 người submit (text "apple", "Apple", "aple").
  - Teacher chấm: "apple" → 5 sao correct, "Apple" → 5 sao correct, "aple" → 0 sao wrong.
- **Then:**
  - `total_stars` và `total_points` cập nhật đúng sau khi `grant-stars`.
  - Trước khi chấm, leaderboard cả 3 cùng 0 sao nhưng sort theo `total_response_time_ms`.

### TC-03: Late submission

- **Given:** session ACTIVE, câu có `time_limit_seconds = 10`, mở từ 10:00:00.
- **When:** student submit tại 10:00:12.5 (12.5s > 10 + 2s grace).
- **Then:** response 400 `LATE_SUBMISSION`. Không tạo `AnswerSubmission` row.

### TC-04: Duplicate submission

- **Given:** student đã submit cho câu X.
- **When:** student submit lần 2 cho câu X.
- **Then:** 409 `DUPLICATE_SUBMISSION`. Vẫn chỉ có 1 row DB.

### TC-05: Tie-break

- **Given:** 2 student cùng `total_stars = 10`; A: `total_response_time_ms = 15000`, B: `20000`.
- **When:** gọi `GET /leaderboard`.
- **Then:** A rank trên B. Khi distribute reward, chỉ A nhận GOLD, B nhận SILVER.

### TC-06: Re-grading idempotent

- **Given:** short-answer submission đã được chấm 4 sao, đúng → participant có `total_stars = 4, total_points = 10`.
- **When:**
  - Teacher sửa thành 2 sao, sai.
  - Tiếp tục sửa thành 5 sao, đúng.
- **Then:**
  - Sau lần 1: participant `total_stars = 2, total_points = 0`.
  - Sau lần 2: participant `total_stars = 5, total_points = 10`. **Không cộng dồn.**

### TC-07: Non-host gọi end

- **Given:** session có `host_id = T1`. User T2 cũng là teacher khác.
- **When:** T2 gọi `POST /game-sessions/:id/end`.
- **Then:** 403 `NOT_SESSION_HOST`. Session giữ nguyên trạng thái.

### TC-08: Student join giữa chừng

- **Given:** session ACTIVE đang chơi câu thứ 2 (trong tổng 4 câu).
- **When:** student mới join và submit đúng cả câu 2, 3, 4.
- **Then:** chỉ có 3 submission (không có cho câu 1). Điểm tương ứng tích luỹ. Xếp hạng so với những người chơi đủ 4 câu — có thể thấp hơn.

### TC-09: End khi 0 participant

- **Given:** session ACTIVE không ai join.
- **When:** teacher gọi end.
- **Then:** status = ENDED, `LeaderboardEntry` = 0 rows, `Reward` = 0 rows. Không throw.

### TC-10: Publish template rỗng

- **Given:** template đã tạo nhưng không có câu hỏi nào (edge case).
- **When:** gọi `/publish`.
- **Then:** 400 `EMPTY_TEMPLATE`.

---

## 4. Performance

### 4.1 Mục tiêu

| Kịch bản                                                                 | Target                        |
| ------------------------------------------------------------------------ | ----------------------------- |
| `GET /leaderboard` với 200 participant × 20 câu đã submit                | < 50ms (p95)                  |
| `POST /submit` MCQ với 50 học sinh bấm cùng thời điểm                    | p95 < 150ms, 0 lỗi            |
| `POST /end` với 200 participant                                          | < 500ms                       |
| WS `game:leaderboard_updated` broadcast khi 50 người submit cùng lúc     | ≤ 2 event/s/session (debounce) |

### 4.2 Cách đo

- Dev viết 1 script `k6` hoặc `autocannon` đơn giản, đưa kết quả vào PR description.
- Không bắt buộc 100% đạt target ngay v1 — nhưng phải có số liệu đo và nếu vượt target thì giải thích.

### 4.3 Điều kiện DB

- Đảm bảo các index trong file 02 đã tồn tại sau migration.
- `EXPLAIN ANALYZE` cho query leaderboard phải dùng `Index Scan` trên `(game_session_id, total_stars)`, **không** `Seq Scan`.

---

## 5. Code quality

### 5.1 Bắt buộc

- [ ] Không có `any` trong code (trừ khi bắt buộc cho Prisma raw query — phải có comment giải thích).
- [ ] Mọi DTO có `class-validator` decorator đầy đủ.
- [ ] Mọi service method có JSDoc ngắn 1–2 dòng mô tả + throw gì.
- [ ] ESLint pass (`pnpm --filter @idest/server lint`).
- [ ] Prisma format pass (`pnpm --filter @idest/server prisma format`).
- [ ] Build TS không lỗi (`pnpm --filter @idest/server build`).
- [ ] Unit test cho `GameSessionService` (submit / grant-stars / end flow).
- [ ] E2E test ít nhất 3 TC: TC-01, TC-04, TC-07.

### 5.2 Khuyến khích

- [ ] Code coverage ≥ 70% cho thư mục `src/game/`.
- [ ] Swagger decorator (`@ApiOperation`, `@ApiResponse`) cho mọi endpoint.
- [ ] Postman / Insomnia collection export kèm PR.

---

## 6. Security

- [ ] JWT bắt buộc cho mọi REST + WS. Request không token → 401.
- [ ] Role check bằng `@Role(...)`, không dựa vào client input.
- [ ] `correctAnswer` không bao giờ lộ ra student qua REST hay WS.
- [ ] Rate limit `POST /submit` — 3 req / 10s / user. Vượt → 429.
- [ ] Không log `answer_text` của student ở INFO level (chỉ DEBUG nếu cần).

---

## 7. Deliverables

Khi mở PR cuối, cần có:

1. Code đã merge theo 14 task (file 07).
2. Unit test + E2E test passing trong CI.
3. Postman collection / Swagger JSON.
4. Ghi chú test manual: "Đã test happy path TC-01 → TC-10 manual với 5 tài khoản".
5. Screenshot 1 phiên chơi end-to-end (ảnh UI giả lập cũng OK).

---

Bước kế tiếp: đọc [`07-task-breakdown.md`](./07-task-breakdown.md).
