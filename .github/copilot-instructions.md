# Agent Instructions

## Tech Stack

- **Runtime:** Node.js 24
- **Frontend:** Next.js 16, Tailwind CSS 4
- **Backend:** Express 5, Prisma 7
- **Database:** PostgreSQL 18, pg 8
- **Language:** TypeScript 5
- **Validation:** Zod 4
- **Linting:** ESLint, Prettier
- **Package Manager:** pnpm 10+

## Project Structure

```
root/
  ├── apps/
  │     ├── client/           # Next.js frontend
  │     └── server/           # Express + WebSocket server
  ├── packages/
  │     ├── schemas/          # Zod schemas + z.infer<> types
  │     └── prettier-config/  # Shared Prettier config
  ├── package.json
  ├── pnpm-workspace.yaml     # Workspace settings
  └── README.md
```

For more detailed structure, use `dir-structure` skill.

## Action Rules

- **No guessing:** State unknowns explicitly. Never assume undocumented behavior.
- **No fabrication:** Never hallucinate APIs, types, signatures, or behaviors.
- **No flattery:** Objective tone. Correct errors directly and immediately.
- **Security-first:** Zod-validate all inputs. Never expose internal errors to clients.
- **Type-safe:** All code TypeScript with `strict: true`. Justify every `any` or it gets removed.
- **Dependency hygiene:** All deps declared via pnpm catalog. No version pinning outside `package.json` catalog block.
- **Clean output:** ESLint + Prettier compliant. No dead code. No `TODO` in committed code.
- **Documentation Updates:** Modify README.md immediately when altering setup instructions, dependencies, or core features.

## Code Quality

- **KISS:** Simplest solution that works; no premature optimization
- **DRY:** Extract common logic; no copy-paste
- **YAGNI:** Don't build features before needed
- **Immutability:** Use spread operators; avoid direct mutation
- **Early returns:** Flatten nested conditionals
- **Named constants:** No magic numbers

## Git Commits

Use git-commit skill for commit format and examples.

### Rules

- Commit after every discrete unit of work. Never batch unrelated changes.
- One migration, one route, one component, one bug fix — one commit each.
- Config/tooling changes go in their own commit, never mixed with feature code.

### Workflow

1. Complete a unit of work
2. Verify it compiles/lints
3. `git add` only relevant files
4. Commit.

## Thinking Framework

When a non-trivial solution is required:

1. **Deconstruct** — Identify all constraints, inputs, outputs, and failure modes.
2. **Diverge** — Propose 3 distinct solution paths.
3. **Critique** — Stress-test each: edge cases, bottlenecks, security holes.
4. **Execute** — Implement the most robust path with explicit reasoning per step.
5. **Verify** — Validate output against every stated constraint. Zero assumptions.
