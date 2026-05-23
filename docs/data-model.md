# Data Model

Core data is persisted in IndexedDB through Dexie.

Tables:

- tasks
- subtasks
- dailyPlans
- recurringDefinitions
- reports
- logs
- settings
- snapshots

Task progress is derived from subtasks. Task status is not duplicated unless a task is cancelled or moved through `statusOverride`.
