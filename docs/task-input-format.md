# Mission Control task input format

Preferred source format for real tasks: JSON.

Why JSON:
- It preserves subtasks cleanly.
- It maps directly to the TypeScript data model.
- It avoids ambiguity around project, domain, date, quick wins and recurrence.
- It is easy to validate before importing.

## Recommended JSON shape

```json
{
  "tasks": [
    {
      "title": "פולואפ לג׳ק לגבי ייצור ואריזה",
      "projectId": "timeraligner",
      "domainId": "production",
      "bucket": "today",
      "date": "2026-05-07",
      "scheduledTimeLabel": "היום",
      "estimatedDurationMinutes": 15,
      "priority": "high",
      "effort": "quick",
      "isQuickWin": true,
      "isRecurring": false,
      "backlogGroup": null,
      "tags": ["production", "follow-up"],
      "whyNow": "חוסם התקדמות בייצור.",
      "notes": "",
      "subtasks": [
        {
          "title": "לנסח הודעת פולואפ קצרה וברורה",
          "estimatedDurationMinutes": 5,
          "toolsNeeded": "WhatsApp / email"
        },
        {
          "title": "לשלוח ולתעד תשובה כשהיא מגיעה",
          "estimatedDurationMinutes": 10
        }
      ]
    }
  ]
}
```

## Required fields

- title
- projectId
- domainId
- bucket: today | backlog | weekly | recurring
- priority: high | medium | low
- effort: quick | medium | deep
- subtasks: at least one item with title

## Optional but useful fields

- date: YYYY-MM-DD, or null for unscheduled backlog
- scheduledTimeLabel
- estimatedDurationMinutes
- isQuickWin
- isRecurring
- backlogGroup: tomorrow | this_week | waiting | later | null
- tags
- whyNow
- notes

## Simpler format if writing manually

Markdown is acceptable for planning, but it will require conversion before import:

```md
## Today
- [TimerAligner / Apollo] מיפוי Apollo לפי קהלים רלוונטיים | high | deep | 45m
  - להגדיר 3 סגמנטים ראשונים לחיפוש
  - לרשום קריטריונים שמוציאים לידים לא רלוונטיים

## Backlog / this_week
- [AlignersWorld / Shopify] Shopify quantity tiers | medium | medium | 35m
  - להחליט על 3 מדרגות מחיר ראשוניות
```
