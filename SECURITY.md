# Security

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

Use GitHub's private reporting form: [Report a vulnerability](https://github.com/huulbaek/fuhgeddaboudit/security/advisories/new). Include what you found, how to reproduce it, and what an attacker could do with it.

This is a solo-maintained project. You will get a reply as soon as the maintainer can manage, and credit in the fix unless you prefer otherwise. There is no bug bounty.

## What matters most here

The app deals with distressing memories, so these are treated as the most serious classes of bug:

- anything that makes the server receive or store what a memory is about (memory descriptions, cue associations, narration audio, camera frames). By design these never leave the browser.
- anything that lets one user read or change another user's screening results, sessions or ratings
- session forgery or authentication bypass
- a way around the Content Security Policy that lets third-party script run

## Supported versions

Only the latest commit on `main` is supported.

## If you run your own instance

- Set `JWT_SECRET` to a long random value. The server refuses to start in production without one, because the development fallback is public.
- Set a real `POSTGRES_PASSWORD`; `changeme` is for local development only.
- Serve it over HTTPS. Sessions are carried in a cookie.
- The login rate limiter keeps its counters in memory, per process. Behind several instances, add rate limiting at the proxy.
