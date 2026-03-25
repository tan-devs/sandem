**[← Home](./README.md) | [← Previous](./10_Next_Steps.md)**

---

# Testing (2026-03-25)

## Run test suites

- `pnpm run test` (Vitest unit tests)
- `pnpm run test:e2e` (Playwright)
- `pnpm run test:e2e:install-browsers`

## Common test targets

- `src/lib/controllers/**`
- `src/lib/services/**`
- `src/lib/utils/ide/**`
- `src/routes/(app)/[repo]/**`

## Best practices

- Use mocked Convex client for controller tests
- Use temporary WebContainer state for runtime tests
- Ensure flows are idempotent (create+delete must revert state)

---

[← Home](./README.md)
