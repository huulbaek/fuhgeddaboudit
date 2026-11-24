# Contributing

Thanks for taking an interest. Bug reports, fixes and well-argued improvements are welcome.

## Getting set up

Follow [Getting started](README.md#getting-started) in the README. Before opening a pull request, both of these must pass:

```bash
bun run test        # Vitest; plain `bun test` runs Bun's own runner and fails
bun run typecheck
```

To run one test file: `npx vitest run tests/unit/login.test.ts`.

## Rules that are not negotiable

These exist because a session that mistimes a stimulus, or leaks what a memory is about, does harm.

- **Memory content stays on the device.** Nothing that describes a memory may be sent to the server or written to the database: no descriptions, cue associations, narration audio or camera frames. The server stores scores, timestamps and progress flags only.
- **Timing-critical code uses `performance.now()` and `requestAnimationFrame`,** through `usePrecisionTimer`. Do not time a stimulus with `setTimeout` or `setInterval`.
- **Session audio uses the Web Audio API,** not `<audio>` elements.
- **The Content Security Policy in `nuxt.config.ts` stays strict.** No third-party scripts, no new remote origins without a reason stated in the pull request.
- **Auth, rate limiting and input validation stay in place.** Every server route validates its input with Zod.

## Changes to the protocols

The modules implement published procedures. If a change alters what a user is asked to do, how long a phase lasts, a screening threshold, or when grounding triggers, say why in the pull request and cite the source. "It felt better" is not enough for this kind of change.

## Code style

- TypeScript and Vue single-file components, 2-space indentation, single quotes, no semicolons.
- Components are PascalCase files grouped by module (`app/components/emdr/BilateralDot.vue`); composables are `useX`.
- Server routes follow Nitro naming: `*.get.ts`, `*.post.ts`, `*.patch.ts`.
- New behaviour ships with tests in `tests/unit/`. Test what the user or caller observes, not class names or internal structure.
- Commit subjects are short and imperative: `Add ...`, `Fix ...`.

## Pull requests

Keep them focused. Describe what changes for the user, include the test output, and add a screenshot or recording for anything visual.

## Security issues

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## Licence

By contributing you agree that your contribution is licensed under [GPL-3.0-or-later](LICENSE), the licence of the project.
