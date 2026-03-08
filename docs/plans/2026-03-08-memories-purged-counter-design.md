# Memories Purged Counter

## Summary

Global counter showing total completed protocol sessions across all users, displayed in the hero section below the "FUHGEDDABOUDIT" tagline. Visible only to new visitors (not logged-in users).

## Components

### 1. Public API endpoint — `GET /api/stats/purged`

- No auth required (public social proof)
- Query: `SELECT COUNT(*) FROM protocol_sessions WHERE completed = true AND module != 'preparation'`
- Returns `{ count: number }`

### 2. Hero UI

Small monospace text below "FUHGEDDABOUDIT" tagline:

```
> 1,247 memories purged_
```

- Styled: `font-mono text-xs text-gray-500` with blinking cursor
- Number formatted with locale commas
- Fades in with existing staggered animation sequence

### 3. Data fetching

- `useFetch` on homepage, only when hero is shown (`!hasSession`)
- No polling, no caching, no WebSocket — just on page load

## Out of scope

- Per-user counter
- Animated count-up effect
- Caching layer
- New DB tables or schema changes
