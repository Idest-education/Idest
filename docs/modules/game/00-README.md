# Game Module — Tài liệu bàn giao

> Bộ tài liệu này mô tả **Game Module** bên trong hệ thống lớp học (Meeting + Mini-game kiểu Kahoot). Viết để một dev mid-level đọc xong là có thể tự implement trên stack **NestJS + Prisma + PostgreSQL**.

---

## 1. Stack đã chốt

| Thành phần     | Công nghệ                                    |
| -------------- | -------------------------------------------- |
| Framework      | NestJS (Node.js, TypeScript)                 |
| ORM            | Prisma                                       |
| Database       | PostgreSQL                                   |
| Realtime       | socket.io (namespace riêng `/game`)          |
| Validation     | `class-validator` + `class-transformer`      |
| Auth           | Tái sử dụng `AuthGuard` + `RoleGuard` sẵn có |

> **Quan trọng:** Game Module **KHÔNG** tạo lại auth, meeting hay class — chỉ **tham chiếu** các module đã có. Tách biệt `GameTemplate` (tái sử dụng) vs `GameSession` (runtime gắn với meeting) là bắt buộc.

---

## 2. Thứ tự đọc (bắt buộc theo số)

| Thứ tự | File                                                                 | Mục đích                                             |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------- |
| 0      | [`00-README.md`](./00-README.md)                                     | Bạn đang đọc                                         |
| 1      | [`01-tong-quan-kien-truc.md`](./01-tong-quan-kien-truc.md)           | Bức tranh tổng thể + module structure                |
| 2      | [`02-database-schema.md`](./02-database-schema.md)                   | Schema Prisma + quan hệ + index + ràng buộc          |
| 3      | [`03-api-contract.md`](./03-api-contract.md)                         | Hợp đồng REST API + DTO + ví dụ request/response     |
| 4      | [`04-game-logic.md`](./04-game-logic.md)                             | Scoring, state machine, edge case, authorization     |
| 5      | [`05-websocket-gateway.md`](./05-websocket-gateway.md)               | Gateway `/game` + sự kiện realtime                   |
| 6      | [`06-acceptance-criteria.md`](./06-acceptance-criteria.md)           | Tiêu chí "done" + test case mẫu + yêu cầu perf       |
| 7      | [`07-task-breakdown.md`](./07-task-breakdown.md)                     | Chia 14 task 1–2 ngày + dependencies                 |

Đọc tuần tự 0 → 7. **Không** bắt đầu viết code trước khi đọc hết file 4.

---

## 3. Quy ước đặt tên

| Thứ         | Quy ước                                  | Ví dụ                                       |
| ----------- | ---------------------------------------- | ------------------------------------------- |
| Prisma model| PascalCase, số ít                        | `GameTemplate`, `AnswerSubmission`          |
| Cột DB      | `snake_case`                             | `game_session_id`, `total_stars`            |
| Enum value  | UPPER_SNAKE_CASE                         | `MCQ`, `SHORT_ANSWER`, `PENDING`            |
| DTO class   | PascalCase + hậu tố `Dto`                | `CreateTemplateDto`, `SubmitAnswerDto`      |
| DTO field   | camelCase                                | `questionId`, `selectedOptionIndex`         |
| Route       | kebab-case, số nhiều                     | `/game-templates`, `/game-sessions`         |
| Event WS    | `game:snake_case`                        | `game:question_started`                     |
| File        | kebab-case                               | `game-session.service.ts`                   |
| Biến TS     | camelCase                                | `currentQuestionStartedAt`                  |

> Quy ước này bám sát các module đã có (`Meet`, `Class`, `Session`). Không phá cách.

---

## 4. Các file/helper đã có cần tái sử dụng

| Việc bạn cần                    | Dùng lại từ                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Truy cập Prisma                 | `PrismaService` trong [`apps/server/src/prisma`](../../apps/server/src/prisma)                                               |
| Xác thực JWT                    | `AuthGuard` trong [`apps/server/src/common/guard`](../../apps/server/src/common/guard)                                       |
| Kiểm tra role (TEACHER/STUDENT) | `RoleGuard` + `@Role(...)` trong [`apps/server/src/common/guard`](../../apps/server/src/common/guard) và decorator tương ứng |
| Enum role                       | [`apps/server/src/common/enum/role.enum.ts`](../../apps/server/src/common/enum/role.enum.ts)                                 |
| Lấy user hiện tại               | `@CurrentUser()` trong [`apps/server/src/common/decorator/currentUser.decorator.ts`](../../apps/server/src/common/decorator/currentUser.decorator.ts) |
| Truy vấn meeting                | `SessionService` trong [`apps/server/src/session`](../../apps/server/src/session) (model `Session` = 1 buổi meeting)         |
| Mẫu WebSocket gateway           | [`apps/server/src/meet/meet.gateway.ts`](../../apps/server/src/meet/meet.gateway.ts)                                         |

---

## 5. Quyết định kiến trúc đã chốt (không thay đổi)

1. **`GameSession.meeting_id` là FK** trỏ tới `Session.id` có sẵn trong [`apps/server/prisma/schema.prisma`](../../apps/server/prisma/schema.prisma). Không tạo entity `Meeting` mới.
2. **Nhịp chơi Kahoot-style đồng bộ:** giáo viên điều khiển chuyển câu, mỗi câu có `time_limit_seconds`, submission chỉ được nhận khi câu đang `ACTIVE`.
3. **Phần thưởng rank-based tự động:** kết thúc game, top N (mặc định 3) nhận GOLD / SILVER / BRONZE. Không có catalog.
4. **MCQ tự động chấm** trên server. **SHORT_ANSWER** phải được giáo viên chấm bằng `grant-stars`.
5. **Realtime là secondary.** REST luôn là nguồn tin đúng (authoritative). WS chỉ để push cập nhật đỡ phải poll.

---

## 6. Lưu ý bắt buộc


- **KHÔNG sửa** `MeetModule`, `SessionModule`, hay `ClassModule`. Chỉ import service từ đó.
- **KHÔNG gộp** việc tạo game vào flow tạo meeting. Hai flow tách biệt.
- Commit theo từng task trong file `07-task-breakdown.md`, mỗi task 1 PR.
- Tất cả code mới viết trong `apps/server/src/game/...`.

---

## 7. Bắt đầu từ đâu

1. Đọc xong README này.
2. Mở file [`01-tong-quan-kien-truc.md`](./01-tong-quan-kien-truc.md) để hiểu module structure.
3. Đọc tiếp theo thứ tự.
4. Khi code: làm theo thứ tự task **T1 → T14** trong [`07-task-breakdown.md`](./07-task-breakdown.md).
