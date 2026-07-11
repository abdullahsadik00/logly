# ADR-0006: Decision Engine — deterministic rules vs statistical vs ML

- **Status:** 🟡 Proposed — **your call to make and defend**
- **Date:** _fill in when you decide_
- **Deciders:** _you_
- **Related:** ADR-0004, `LEARNING_GUIDE.md` §9, `ACTION_PLAN.md` Phase 3

> This is THE differentiator decision. "Tell me what to do, not what happened" is Logly's moat. How you
> compute insights defines whether users trust and act on them. **Write the Decision and Consequences
> yourself.**

## Context

The Decision Engine turns a resolved result + a baseline into ranked, explained, actionable cards
("Mobile bounce on /pricing climbed to 58% — segment by device"). It runs after query resolution on a
tight budget (< 5ms) and must be **trustworthy**: a founder acting on an insight needs to see exactly
*why*. The tension is between explainability/speed and sophistication.

## Options considered

### Option A — Deterministic rules (delta-vs-baseline + dimensional concentration + deploy correlation)
- **Pros:** fully explainable (every card links to the aggregates that justify it); fast (< 5ms);
  testable (input→card unit tests); never hallucinates a trend that isn't in the data; no training data
  or infra. Matches the brief.
- **Cons:** only catches patterns you encode; thresholds need tuning; can be "obvious"; no novel-pattern
  discovery.

### Option B — Statistical anomaly detection (z-scores, seasonal decomposition, changepoint)
- **Pros:** catches unexpected anomalies; adapts to seasonality; still fairly explainable.
- **Cons:** needs enough history; false positives on sparse/spiky data; harder to phrase as a crisp "do
  this" action; more compute.

### Option C — ML / LLM-generated insights
- **Pros:** flexible natural-language explanations; can synthesize across dimensions.
- **Cons:** non-deterministic; can hallucinate (fatal for a "trust the number and act" product); latency
  + cost; hard to test; opaque "why". Erodes the exact trust the feature must build.

## Decision

> **_Your call._** The brief argues for **A** (deterministic) first, with AI added later *as a new
> mutation* (natural language → an ExplorationState mutation), never as the engine itself. State your
> choice and defend it against the < 5ms budget and the trust requirement. If you'd blend (e.g. A for
> shipping + B for a few high-value anomalies), say why and where the boundary is.
>
> _Skeleton to replace: "Chose A. Trust and speed dominate — an insight a founder acts on must be
> explainable and reproducible, and 5ms rules out an LLM in the hot path. I accept that rules only catch
> encoded patterns; I'll add statistical detection (B) for specific high-value metrics once the rule set
> proves out, and keep any AI strictly at the 'help me ask' layer (NL → state), never the 'decide' layer."_

## Consequences

> **_Your call._** Fill in Good / Bad-accepted-cost / Revisit-when. Consider: how do you compute
> **confidence** deterministically (evidence strength)? How do you **rank** priority (impact × urgency)?
> How do you unit-test each rule? What's the trigger to add statistical methods?

## Questions to reason through (interview-grade)
- Why is determinism a *feature* for this specific product, not a limitation?
- How would you add an AI copilot **without** breaking determinism? (Hint: NL → ExplorationState mutation,
  then the same deterministic rules run on the result.)
- How do you keep insight cards from being noisy/obvious — what earns a card a spot in the top 6?
- How do you correlate a metric change with a deploy marker deterministically?
