# 03 — API (REST)

## Chung

- **Auth:** JWT. `me` = user đăng nhập; chỉ trả dữ liệu của chính user đó.
- **Lỗi thường gặp:** `400` (query sai), `401` (chưa login), `403` (nếu sau này tách quyền).

---

## `GET /progress/me/timeline`

**Query**

| Param    | Bắt buộc | Giá trị                                                                     | Mặc định |
| -------- | -------- | --------------------------------------------------------------------------- | -------- |
| `skill`  | Không    | `reading` \| `listening` \| `writing` \| `speaking` \| `overall`           | Tuỳ BE   |
| `window` | Không    | `7d` \| `30d` \| `90d` \| `all`                                             | `90d`    |

### Mock response — có dữ liệu

```json
{
  "skill": "reading",
  "window": "90d",
  "points": [
    { "timestamp": "2026-04-01T08:30:00.000Z", "score": 6.0, "submissionId": "sub-r-001" },
    { "timestamp": "2026-04-15T09:10:00.000Z", "score": 6.5, "submissionId": "sub-r-002" },
    { "timestamp": "2026-05-01T10:00:00.000Z", "score": 7.0, "submissionId": "sub-r-003" }
  ],
  "trend": {
    "rollingAverage": 6.5,
    "deltaVsPreviousWindow": 0.25,
    "direction": "up"
  }
}
```

### Mock response — không có bài trong `window`

```json
{
  "skill": "writing",
  "window": "7d",
  "points": [],
  "trend": {
    "rollingAverage": null,
    "deltaVsPreviousWindow": null,
    "direction": "unknown"
  }
}
```

`direction`: `up` | `down` | `flat` | `unknown`. Chi tiết tính toán: [04](./04-logic-metrics.md).

---

## `GET /progress/me/question-types`

**Query:** `skill` **bắt buộc** — `reading` hoặc `listening`. `window` giống timeline.

### Mock response — đủ dữ liệu

```json
{
  "skill": "reading",
  "window": "90d",
  "items": [
    {
      "questionType": "true_false_not_given",
      "accuracy": 0.85,
      "correctItems": 17,
      "totalItems": 20,
      "confidence": "medium",
      "classification": "strong",
      "trendDirection": "stable"
    },
    {
      "questionType": "matching_headings",
      "accuracy": 0.55,
      "correctItems": 11,
      "totalItems": 20,
      "confidence": "medium",
      "classification": "weak",
      "trendDirection": "declining"
    },
    {
      "questionType": "multiple_choice_single",
      "accuracy": 0.72,
      "correctItems": 5,
      "totalItems": 7,
      "confidence": "insufficient_data",
      "classification": "insufficient_data",
      "trendDirection": "unknown"
    }
  ]
}
```

### Mock response — lỗi query (skill thiếu / sai)

`400` — body tuỳ convention dự án, ví dụ:

```json
{
  "statusCode": 400,
  "message": "Tham số skill bắt buộc: reading | listening",
  "errorCode": "INVALID_QUERY_SKILL"
}
```

---

## `GET /progress/me/writing-rubrics`

**Query:** `window` (optional), cùng bộ giá trị như timeline.

### Mock response — đã có `rubric_scores`

```json
{
  "window": "90d",
  "items": [
    {
      "criterion": "task_response",
      "averageBand": 6.5,
      "deltaVsPreviousWindow": 0.5,
      "trend": "up",
      "recommendation": "Làm outline 4 đoạn trước khi viết; mỗi đoạn trả lời trực tiếp một phần đề."
    },
    {
      "criterion": "coherence_cohesion",
      "averageBand": 7.0,
      "deltaVsPreviousWindow": 0,
      "trend": "flat",
      "recommendation": "Giữ văn phong mạch lạc; thử đa dạng hoá từ nối."
    },
    {
      "criterion": "lexical_resource",
      "averageBand": 5.5,
      "deltaVsPreviousWindow": -0.25,
      "trend": "down",
      "recommendation": "Ôn từ vựng theo chủ đề; học collocations tránh lặp từ."
    },
    {
      "criterion": "grammar_range_accuracy",
      "averageBand": 6.0,
      "deltaVsPreviousWindow": 0,
      "trend": "flat",
      "recommendation": "Rà soát thì và sự hòa hợp chủ-vị; viết vài câu phức ngắn."
    }
  ]
}
```

### Mock response — chưa có rubric trong DB (`200`)

```json
{
  "window": "90d",
  "items": []
}
```

Hoặc skeleton đủ 4 tiêu chí — mỗi dòng `insufficient_data` (tuỳ product):

```json
{
  "window": "90d",
  "items": [
    { "criterion": "task_response", "averageBand": null, "deltaVsPreviousWindow": null, "trend": "unknown", "recommendation": "" },
    { "criterion": "coherence_cohesion", "averageBand": null, "deltaVsPreviousWindow": null, "trend": "unknown", "recommendation": "" },
    { "criterion": "lexical_resource", "averageBand": null, "deltaVsPreviousWindow": null, "trend": "unknown", "recommendation": "" },
    { "criterion": "grammar_range_accuracy", "averageBand": null, "deltaVsPreviousWindow": null, "trend": "unknown", "recommendation": "" }
  ]
}
```

Nếu DB **chưa** có `rubric_scores`: luôn **200**, không trả **500**.

`recommendation` được hardcode theo mức `averageBand` (chi tiết rule ở [04](./04-logic-metrics.md)).
