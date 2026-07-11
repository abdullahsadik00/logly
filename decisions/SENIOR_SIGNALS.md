# Senior Signals — how to build Logly so it proves senior-level ability

> Finishing Logly proves you *can build a system*. Building it **this way** proves you have the
> **judgment** interviewers and level-committees actually assess: scope, trade-offs, autonomy, and
> knowing what you'd revisit. This is the checklist that converts the project into a level-up.

---

## The one-line difference between levels

```
 Junior   "I built the feature."                     (executes a spec)
 Mid      "I built it, it works, it's tested."        (owns quality)
 Senior   "I chose this design over these alternatives because [trade-off],
            I accepted [cost], and I'd revisit it when [trigger]."   (owns decisions)
 Staff    "I sequenced the whole effort, kept the invariants intact across teams,
            and made the risky migrations reversible."               (owns direction)
```

Everything below is about moving from *executes* to *owns decisions*.

---

## The five habits (do these while you build)

| # | Habit | Why it's a senior signal | Where |
|---|---|---|---|
| 1 | **Fill in the open ADRs (0005–0007) in your own words.** | Making + defending hard, non-reversible choices *is* the Mid→Senior line. | `decisions/` |
| 2 | **Write a new ADR after each `ACTION_PLAN.md` phase.** | Seniors leave a decision trail; 10 short ADRs is a portfolio. | `decisions/` |
| 3 | **Debug the Phase-0 silent bugs without the checklist.** | Diagnosing a multi-hop pipeline you didn't fully write is the most senior skill on offer here. | `ACTION_PLAN.md` Phase 0 |
| 4 | **Set and defend a latency budget per interaction, in CI.** | "Perf regressions are product regressions" — thinking in budgets, not vibes, is senior. | `LEARNING_GUIDE.md` §15 |
| 5 | **For every design, be able to say what you'd revisit and when.** | Naming the trigger to change a decision shows you understand it's a trade-off, not a truth. | every ADR's "Revisit when" |

---

## Signal map — artifact → level it demonstrates

| If you can show… | You're demonstrating… |
|---|---|
| A page with all four states (loading/empty/error/success) + a unit test | **Mid** — quality ownership |
| The Phase-0 bugs fixed end-to-end, with a note on *root cause* not just the fix | **Mid→Senior** — systems debugging |
| ADR-0005 filled in: you designed the ExplorationState codec + versioning + hash | **Senior** — you own a foundational subsystem |
| ADR-0006 filled in: deterministic Decision Engine with confidence + ranking + tests | **Senior** — you built the moat and can defend it |
| A CI pipeline that fails on a latency-budget regression | **Senior** — you defend non-functional requirements |
| The Postgres→ClickHouse migration plan, made reversible via the rollup seam (ADR-0002) | **Senior→Staff** — reversible risk on a live system |
| You sequenced the whole `ACTION_PLAN.md` and kept the 6 invariants intact across it | **Staff** — you own direction, not just code |

---

## System-design interview cheat-sheet (the 6–8 things to whiteboard about Logly)

Be able to draw and defend each of these cold. This is what makes you *sound* senior regardless of title:

1. **The hot/cold path split** (ADR-0001) — why ingestion and querying are different failure domains;
   Redis buffer → worker → rollups; the ~5s eventual-consistency cost.
2. **Privacy as a shape** (ADR-0003) — the daily-salted, memory-only hash; why compliance is *structural*,
   not policy; what the system *cannot* know.
3. **CQRS / rollups** — why dashboards read `daily_stats`, never scan raw events; idempotent aggregation
   (recompute, not increment) so retries don't double-count.
4. **URL as state** (ADR-0004) — how one decision buys sharing + undo + a stateless backend + a cache key.
5. **The Decision Engine** (ADR-0006) — deterministic rules for trust/speed; how AI plugs in later as a
   *mutation*, never the engine.
6. **The migration seam** (ADR-0002) — how a stable read contract lets you swap Postgres→ClickHouse
   without a rewrite; "don't pay for scale you don't have."
7. **Scaling order** — which component breaks first (worker → events table → SSE → Postgres reads) and
   what you'd do at each step (§19/§15 of the handbook).
8. **Failure philosophy** — degrade in steps, never off a cliff; the queue-down / DB-down / worker-crash
   behaviors (§15).

If you can whiteboard those eight with the trade-offs and the "revisit when," you are interviewing at
senior depth.

---

## The trap that keeps you junior

> Building every screen the brief describes, top-to-bottom, without ever choosing *why*. That's
> execution, not engineering. The brief is a **target**; the senior move is to build to the seams, make
> the open decisions yourself, write them down, and be able to defend every one.

## Related
- `decisions/` — the ADRs (fill in 0005–0007).
- `ACTION_PLAN.md` — the leverage-ordered plan; each phase produces a decision worth recording.
- `LEARNING_GUIDE.md` — the full architecture handbook (the *why* in depth).
