# 06 — Tiêu chí xong

## Chức năng

- [ ] **`GET /progress/me/timeline`:** đúng query + shape như [03](./03-api-contract.md); `skill` sai → 400 (nếu có validate).
- [ ] **Timeline Writing/Speaking:** không đưa `pending` / `failed` vào `points` và không tính vào `rollingAverage`.
- [ ] **Timeline R/L:** mọi bài có `score` hợp lệ trong `window` được tính (trừ khi sau này có rule khác).
- [ ] **`GET /progress/me/question-types`:** `skill` bắt buộc; sai skill → 400; `totalItems < 8` → không xếp strong/weak (`insufficient_data`).
- [ ] **`GET /progress/me/writing-rubrics`:** không có `rubric_scores` trong DB → **200**, không 500; body an toàn (rỗng hoặc insufficient).
- [ ] **Quyền riêng tư:** chỉ dữ liệu của user đang login (`me`).

## Kiểm thử tối thiểu

- [ ] **Case A:** 1 Writing `graded` 6.0 + 1 `pending` → timeline chỉ 1 điểm.
- [ ] **Case B:** Reading một `questionType` có 5 ý → `insufficient_data`, không hiển thị strong/weak cho type đó (theo [04](./04-logic-metrics.md)).
- [ ] **Case C:** Không bài trong `window` → `points` rỗng, `direction` unknown.

Perf, job tổng hợp, E2E full: **sau MVP**.
