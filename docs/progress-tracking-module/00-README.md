# Progress Tracking — Tài liệu ngắn gọn

Module **theo dõi tiến độ học viên** trên dashboard:

1. **Timeline:** điểm band theo thời gian (từng kỹ năng + overall).
2. **Dạng câu:** mạnh/yếu theo loại câu **Reading/Listening**.
3. **Rubric Writing:** mạnh/yếu theo **từng tiêu chí** (khi đã lưu `rubric_scores`).

**Nguồn dữ liệu:** Mongo trong [`apps/assignments`](../../apps/assignments). Nộp bài xếp hàng chấm: [`apps/server/src/grade`](../../apps/server/src/grade).

**Nguyên tắc:** Progress **chỉ đọc** (và đề xuất **ghi thêm** field rubric khi chấm); **không** thay luồng nộp bài / queue.

---

## Đọc theo thứ tự

| # | File |
|---|------|
| 0 | [00-README.md](./00-README.md) |
| 1 | [01-tong-quan-kien-truc.md](./01-tong-quan-kien-truc.md) |
| 2 | [02-database-schema.md](./02-database-schema.md) |
| 3 | [03-api-contract.md](./03-api-contract.md) |
| 4 | [04-logic-metrics.md](./04-logic-metrics.md) |
| 5 | [05-luong-tich-hop.md](./05-luong-tich-hop.md) |
| 6 | [06-acceptance-criteria.md](./06-acceptance-criteria.md) |
| 7 | [07-task-breakdown.md](./07-task-breakdown.md) |

---

## Code đã có (tham chiếu nhanh)

| Việc | File |
|------|------|
| Danh sách bài nộp của tôi | [`assignment.controller.ts`](../../apps/assignments/src/assignment/assignment.controller.ts) — `GET /assignments/submissions/me` |
| Gom bài theo user | [`assignment.service.ts`](../../apps/assignments/src/assignment/assignment.service.ts) — `getMySubmissions` |
| Đẩy chấm điểm | [`grade.controller.ts`](../../apps/server/src/grade/grade.controller.ts) |

---

## Lưu ý nhanh

- **User id:** Reading/Listening = `submitted_by`; Writing/Speaking = `user_id` → khi tính **overall** phải gộp thành một `student_id`.
- **Writing hiện tại:** `score` + `feedback`; rubric chi tiết = **bổ sung** (file 02).
- **MVP:** query trực tiếp bài nộp; **sau:** collection / bảng tổng hợp nếu cần tốc độ.
