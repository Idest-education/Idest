# 05 — Luồng tích hợp

## 1. Nộp bài & chấm (`apps/server`)

| HTTP | Queue (gợi ý) | Ghi chú |
|------|----------------|---------|
| `POST /grade/:skill` (`reading` \| `listening`) | `grade_queue` | Body có `assignment_id`, `submitted_by`, câu trả lời |
| `POST /grade/writing/submissions` | `writing_grade_queue` | Có `submissionId`, nội dung bài |
| `POST /grade/speaking/submissions` | `grade_queue` | Audio, metadata |

Code: [`grade.controller.ts`](../../apps/server/src/grade/grade.controller.ts). Response thường chỉ là “đã xếp hàng”, **không** có điểm ngay.

## 2. Lưu kết quả (`apps/assignments`)

Worker (trong repo hoặc ngoài) sau khi chấm phải cập nhật Mongo:

- **R/L:** `score`, `details`, v.v.
- **W/S:** `score`, `status = graded` (hoặc `failed`), `feedback`; **nên** thêm **`rubric_scores`** cho Writing để làm insight rubric.

## 3. API Progress

- **MVP:** đọc trực tiếp collections submission, tính theo [04](./04-logic-metrics.md).
- **Sau:** có thể đọc từ `student_progress_metrics` nếu đã có job rollup.

## 4. Rủi ro cần thống nhất

- Worker ngoài repo: format JSON **`rubric_scores`** và thời điểm ghi DB phải **một chuẩn** với team backend assignments.
- Map **dạng câu:** nếu không join được đề → loại ý đó khỏi thống kê theo type hoặc gắn `unknown` (product quyết).
