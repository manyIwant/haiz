# HAIZ Pocket Daily Notes B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the HAIZ home page a genuinely fast, calm campus to-do tool, with reliable immediate task completion, compact layout and opt-in dates.

**Architecture:** Keep `PocketStore` and `PersonalSnapshot` as the only persistent source of truth. UI-only exit snapshots animate after a synchronous completion write; the new date detector is pure Dart with explicit user acceptance. Reuse existing task editor, filters and account generation boundaries.

**Tech Stack:** Flutter 3.47.8, Dart 3.13, Material/Cupertino, existing SharedPreferencesAsync/Supabase user scope, flutter_test.

**Spec:** `docs/superpowers/specs/2026-11-01-haiz-quick-todo-design.md`

## Global Constraints

- Retain `PersonalSnapshot` version 1, task IDs/notes/original notices and existing RLS scope.
- Task checkbox remains at the right with a >=44×44 dp hit region, in every theme.
- The completed bit must update immediately, before any 250–360ms visual effect; never defer persistent writes.
- Never silently infer a date: show optional suggestion and let the user dismiss it.
- Keep existing notice inbox, academic assignments, course and focus navigation available; no new network service, calendar write or native widget.
- No merged production code before the repository's Flutter, backend, Android QA, iOS compile and Web checks pass.

## Review Focus

- User clicks checkbox twice quickly -> one completion, not two toggles; see Task 1.
- User changes account during an exit animation -> no old-account writes or visual ghosts; see Task 1.
- User closes app immediately after checking -> stored completion bit already changed; see Task 1.
- User enters ambiguous/invalid or multiple dates -> suggestion absent and full original title persisted; see Task 3.
- User enlarges text/navigates with keyboard -> no cramped tap targets or inaccessible task menu; see Task 2.

---

### Task 1: Immediate persisted completion and animated list exit

**Files:**
- Modify: `app/lib/ui/today_page.dart` (state, check-off action, task list rendering)
- Test: `app/test/quick_memo_widget_test.dart`

**Interfaces:**
- Consumes: `PocketStore.toggleTask(String id)`, `PocketStore.generation`, `TaskView`.
- Produces: a UI-only `Map<String, TaskItem> _exitingTasks` visual snapshot, separately animated collapse, with no delayed persistent writes.

- [ ] **Step 1: Write failing widget tests**: After tap and a `pump()` (without 370ms), `store.tasks.single.completed == true`; task remains as a short-lived visual row, then disappears after a 350ms pump; immediate account swap clears snapshots; rapidly tapping the disabled checkbox does not restore the task.
- [ ] **Step 2: Run red tests**: `cd app && flutter test test/quick_memo_widget_test.dart` -> at least the immediate-completion assertion fails against the old implementation.
- [ ] **Step 3: Change check-off to commit first**: after verifying writable/store generation, mark exit snapshot then call `store.toggleTask(id)` immediately; trigger visual collapse next frame, remove only the UI snapshot after animation. Keep the existing 4s undo, scope guard and `reducedMotion` bypass.
- [ ] **Step 4: Run green tests**: `cd app && flutter test test/quick_memo_widget_test.dart test/today_workflow_widget_test.dart` -> all pass.
- [ ] **Step 5: Commit**: `git commit -am "feat(pocket): persist checkoff before row exit animation"`.

### Task 2: Quick capture and compact home layout

**Files:**
- Modify: `app/lib/ui/today_page.dart` (hero location, task row menu)
- Test: `app/test/quick_memo_widget_test.dart`

**Interfaces:**
- Consumes: the current `TodayPage`, `TaskEditorSheet`, `PocketCard`, `TaskView`.
- Produces: input, summary and the first task card near the top, with an overflow menu for editing, source, focus and delete.

- [ ] **Step 1: Add widget test**: at 390×844 verify input, task list section and first task card are all above the photo; tap task menu to access focus; verify check-control width >=44dp.
- [ ] **Step 2: Run red test**: `cd app && flutter test test/quick_memo_widget_test.dart` -> order assertion fails.
- [ ] **Step 3: Reorder Today children**: move large `CampusPhotoPanel` below the task list/summary, keep schedule and Academic widgets intact. Put focus action into the row menu to avoid three icons consuming narrow-screen width.
- [ ] **Step 4: Run green tests**: `cd app && flutter test test/quick_memo_widget_test.dart test/today_workflow_widget_test.dart`.
- [ ] **Step 5: Commit**: `git commit -am "feat(pocket): prioritize quick memo and task list on home"`.

### Task 3: Opt-in local date suggestions

**Files:**
- Create: `app/lib/domain/quick_task_date_parser.dart`
- Create: `app/test/quick_task_date_parser_test.dart`
- Modify: `app/lib/ui/today_page.dart` (input suggestion widget and addTask call)

**Interfaces:**
- Produces: `QuickTaskDateSuggestion? QuickTaskDateParser.suggest(String text, DateTime now)`; `QuickTaskDateSuggestion` holds `DateTime date` and `String label`.
- Consumes: `PocketStore.addTask(String title, String subject, {DateTime? due})` plus existing `_quickText`.
- Date grammar: Today/tomorrow/day after tomorrow, 周一..周日, 下周一..下周日, YYYY-MM-DD. Multiple/conflicting/invalid matches -> null. Full user title unchanged. The suggestion is shown visually and is **not automatically selected**.

- [ ] **Step 1: Add red parser tests**: fixed `2026-10-31` Saturday baseline for 今天/明天/后天, 下周五, bare 周五 = next Friday, `2026-12-31` year rollover, invalid Feb 31, conflicting expressions and no date.
- [ ] **Step 2: Run red tests**: `cd app && flutter test test/quick_task_date_parser_test.dart` -> missing class failure.
- [ ] **Step 3: Implement pure parsing and suggestion chip**: calculate dates using local-midnight arithmetic, allow explicit opt-in/opt-out; on enter, no selection means undated task; on accepted suggestion, pass `due` but retain raw title. Reset selection on text change/account change/save.
- [ ] **Step 4: Run green tests**: `cd app && flutter test test/quick_task_date_parser_test.dart test/quick_memo_widget_test.dart`.
- [ ] **Step 5: Commit**: `git commit -m "feat(pocket): add opt-in date suggestions to quick capture"`.

### Task 4: Whole-branch verification and main release gate

**Files:** No additional runtime file required.

- [ ] **Step 1: Run** `cd app && flutter analyze`; expected exit 0.
- [ ] **Step 2: Run** `cd app && flutter test --reporter expanded`; expected exit 0, including isolated guest/cloud session tests.
- [ ] **Step 3: Open PR against `main`** and confirm GitHub CI passes Flutter, backend, Android QA APK, unsigned iOS and Web; avoid forced merges and reconcile concurrent `main` changes.
- [ ] **Step 4: Squash merge only after checks are green**, verify main commit SHA and file content. Separately inspect downstream release workflow; do not call a source merge an APK/IPA release.

## Self-review

Coverage: persistent completion (Task 1), layout/tap ergonomics (Task 2), optional date suggestions (Task 3), test and release requirements (Task 4). Types: `QuickTaskDateParser.suggest` returns a suggestion or null and does not mutate task model. No schema changes. Android widgets/system reminders remain out of scope per approved B.
