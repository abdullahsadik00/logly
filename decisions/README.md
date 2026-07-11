# Architecture Decision Records (ADRs)

> **Why this folder exists — and why it makes you senior-leaning.**
> Junior engineers write code. Mid engineers write code that works. **Senior engineers write down
> *why*** — the options they weighed, the trade-offs they accepted, and what they'd revisit. This
> folder is where Logly's load-bearing decisions live. Filling it in (especially the `proposed` ones)
> is the highest-leverage thing you can do to demonstrate senior judgment — in this repo and in
> interviews.

An **ADR** captures a single architectural decision: the context that forced it, the options you
considered, the choice you made, and the consequences you accepted. It is short, dated, and
**immutable** — you don't edit a decision, you supersede it with a new ADR.

---

## How to use this folder

- **Read the `accepted` ADRs first.** They explain *why* Logly is shaped the way it is. Study the
  format — that reasoning style *is* the senior skill.
- **Own the `proposed` ADRs.** Each one is a real, open decision you must make while building (see
  `ACTION_PLAN.md`). Don't just pick an option — fill in the **Decision** and **Consequences** in your
  own words, and be able to defend it out loud. *That* is the level-up.
- **Write a new ADR whenever you make a non-obvious, hard-to-reverse choice.** Copy `0000-template.md`,
  give it the next number, and add it to the index below.

### The one habit that converts this project into a level-up
> After every phase in `ACTION_PLAN.md`, write (or update) the ADR for the biggest decision you made.
> Ten short ADRs at the end of the build is a portfolio that interviews at senior depth.

---

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-hot-cold-path-split.md) | Separate the write path from the read path | ✅ Accepted |
| [0002](0002-postgres-now-clickhouse-later.md) | Postgres now, columnar-shaped for later | ✅ Accepted |
| [0003](0003-privacy-as-a-shape.md) | Privacy as a property of the schema (daily-salted hash) | ✅ Accepted |
| [0004](0004-url-as-exploration-state.md) | The URL is the single source of exploration state | ✅ Accepted |
| [0005](0005-exploration-state-format.md) | ExplorationState serialization format | 🟡 Proposed — **your call** |
| [0006](0006-decision-engine-approach.md) | Decision Engine: deterministic rules vs statistical/ML | 🟡 Proposed — **your call** |
| [0007](0007-auth-model.md) | Auth: bearer+localStorage vs httpOnly cookie | 🟡 Proposed — **your call** |

**Statuses:** `Proposed` (open, needs a decision) · `Accepted` (in force) · `Superseded by NNNN` (replaced) · `Deprecated`.

> 📈 See [`SENIOR_SIGNALS.md`](SENIOR_SIGNALS.md) — how to build Logly so it demonstrates senior-level
> ability (the five habits, the signal map, and a system-design interview cheat-sheet).

---

## What "senior-leaning" looks like in an ADR

A mid-level ADR says *what* was chosen. A senior ADR shows the **judgment**:

```
✗ Mid:     "We use Redis to buffer events."
✓ Senior:  "We buffer events in a Redis list because ingestion latency and DB
            throughput are different failure domains; we accept ~5s eventual
            consistency and a second process to run, and we'll revisit when
            replay/durability forces a move to Streams. Alternatives (write-through
            to Postgres, Kafka) were rejected for [these specific reasons]."
```

The senior version names: the **forcing tension**, the **rejected alternatives with reasons**, the
**cost you knowingly accepted**, and the **trigger to revisit**. Aim for that in every ADR you write.

---

## Related docs
- `ACTION_PLAN.md` — the leverage-ordered build plan (each phase produces ADRs).
- `LEARNING_GUIDE.md` — the full architecture handbook (the *why* in depth).
- `GUIDE.md` — the ideal PR-by-PR build order.
