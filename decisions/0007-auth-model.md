# ADR-0007: Auth — bearer+localStorage vs httpOnly cookie vs access+refresh

- **Status:** 🟡 Proposed — **your call to make and defend**
- **Date:** _fill in when you decide_
- **Deciders:** _you_
- **Related:** `LEARNING_GUIDE.md` §14/§12, `backend/README.md` (auth), `ACTION_PLAN.md` Phase 0.4

> The code has a **de-facto** choice today (JWT bearer in `localStorage`), but it was never *decided* —
> it just happened, and it has real trade-offs plus a live bug (the SSE stream can't send a bearer
> header, and `/logout` doesn't exist). Turn the accident into a defended decision. **Write the Decision
> and Consequences yourself.**

## Context

The dashboard is authenticated; the collector is public. Auth must survive reloads, attach to every API
call, and work with the realtime stream. The current implementation stores a JWT in `localStorage` and
sends `Authorization: Bearer <token>`. That's simple and CSRF-resistant, but `localStorage` is readable
by any XSS, tokens are long-lived with no refresh, and `EventSource` (SSE) *cannot send custom headers* —
which is exactly why realtime 401s today.

## Options considered

### Option A — JWT bearer in localStorage (current de-facto)
- **Pros:** dead simple; stateless; naturally CSRF-resistant (no ambient credential).
- **Cons:** XSS can read the token; SSE can't send the header (breaks realtime); no rotation → a leaked
  token is valid until expiry.

### Option B — httpOnly, SameSite session cookie
- **Pros:** JS can't read the token (XSS-resistant); cookies ride SSE/EventSource automatically (fixes
  realtime); the brief's target.
- **Cons:** reintroduces CSRF (needs SameSite + CSRF tokens for state-changing requests); CORS/credentials
  config must be exact; slightly more moving parts.

### Option C — Short-lived access token + refresh token
- **Pros:** limits blast radius of a leaked token; supports rotation/revocation; pairs with A or B.
- **Cons:** more complexity (refresh endpoint, rotation, storage of the refresh token); can be layered
  later rather than up front.

## Decision

> **_Your call._** Pick the model (and note what you'd do *now* vs *later*). A strong senior answer often
> looks like: "httpOnly SameSite cookie (B) as the direction — it fixes the SSE auth bug for free and
> resists XSS — accepting CSRF protection as the cost; layer short-lived access + refresh (C) when
> handling sensitive data. Keep bearer (A) only for programmatic API keys." State *your* reasoning and
> the cost you accept. Also decide the immediate fix for the SSE 401 (query-param token vs a short-lived
> SSE ticket) and whether to add `/logout` (stateful) or stay stateless.

## Consequences

> **_Your call._** Fill in Good / Bad-accepted-cost / Revisit-when. Consider: what's your XSS story
> either way (CSP, escaping)? If cookies, how do you do CSRF + CORS `credentials`? If you keep bearer,
> how does realtime authenticate? What is `JWT_SECRET`'s handling in prod (never the default)?

## Questions to reason through (interview-grade)
- localStorage vs httpOnly cookie for tokens — the precise XSS ↔ CSRF trade-off.
- Why can't `EventSource` authenticate the way `fetch` does, and what are the two clean fixes?
- What does a refresh-token rotation scheme protect against that a single long-lived JWT doesn't?
- Should `/logout` invalidate server-side, and if the JWT is stateless, what does logout even mean?
