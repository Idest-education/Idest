# 02 — Dữ liệu

## Giải thích db đã có (Mongo, `apps/assignments`)


| Loại      | Collection / schema (tham chiếu)                                                                                     | Field quan trọng cho progress                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Reading   | `[reading-submission.schema.ts](../../apps/assignments/src/assignment/schemas/reading-submission.schema.ts)`         | `submitted_by`, `assignment_id`, `created_at`, `score`, `details`       |
| Listening | schema tương tự Reading trong cùng app                                                                               | Giống Reading                                                           |
| Writing   | `[writing-submission.schema.ts](../../apps/assignments/src/assignment/writing/schemas/writing-submission.schema.ts)` | `user_id`, `assignment_id`, `created_at`, `score`, `feedback`, `status` |
| Speaking  | schema trong `speaking/…`                                                                                            | Giống Writing (`user_id`, `score`, `status`)                            |


`**details` (R/L):** cấu trúc section → câu → part; dùng để đếm đúng/sai theo **part hoặc câu** (tùy dữ liệu thực tế).

`**status` (W/S):** chỉ dùng `graded` + có `score` cho timeline và rubric trung bình.

