# About

This `backend/` directory is a TypeScript rewrite of the Pterodactyl Panel API, transitioning away from the original Laravel/PHP implementation. It runs on Bun + Express with Prisma against the same MySQL schema the Laravel app uses, so both stacks can point at the same database during the cutover.

## Tests

Three test suites exist, each targeting a different layer of confidence in the port:

- **`tests/integration/`** — Integration tests that run against a real MariaDB instance (port 3307). They exercise the TS backend end-to-end: auth, CRUD, pagination, filtering, includes, and soft deletes. This is the primary suite for verifying the TS implementation works in isolation.

- **`tests/compatibility/`** — Schema and snapshot tests that validate TS responses against the expected JSON:API shapes (resource types, field types, RFC 3339 timestamps). These lock in the response contract so the TS API stays wire-compatible with what Laravel clients expect.

- **`tests/mirror/`** — Side-by-side differential test harness. It spins up both stacks (PHP+MySQL and TS+MySQL) via `podman compose`, seeds identical data into each, fires the same requests at both, and diffs responses field-by-field plus DB state after mutations. This is the definitive check that the TS rewrite behaves like Laravel — any diff is a bug in the port (or an intentional deviation to document).

Together: integration tests prove the TS backend works, compatibility tests pin the contract, and mirror tests prove parity with the Laravel API we're replacing.
