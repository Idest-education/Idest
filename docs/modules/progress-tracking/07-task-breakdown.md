# 07 — Chia việc (gợi ý)


| Bước | Việc                                     | Phụ thuộc | Ghi chú                                                     |
| ---- | ---------------------------------------- | --------- | ----------------------------------------------------------- |
| 1    | `GET /progress/me/timeline`              | —         | Map `submitted_by` / `user_id` → `student_id`; lọc `window` |
| 2    | `GET /progress/me/question-types`        | 1         | Parse `details`; join đề nếu cần `question.type`            |
| 3    | Schema `rubric_scores` + worker ghi đủ   | —         | Có thể làm song song với 1–2                                |
| 4    | `GET /progress/me/writing-rubrics`       | **3**     | TB + delta + gợi ý rule                                     |
| 5    | (Sau) Event + `student_progress_metrics` | 2, 4      | Khi data lớn / cần p95 thấp                                 |


Mỗi bước **1 PR** nếu được; bước 4 **không** chặn timeline (chỉ chặn insight rubric đầy đủ).