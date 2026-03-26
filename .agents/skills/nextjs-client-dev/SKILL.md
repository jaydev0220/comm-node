---
name: nextjs-client-dev
description: Next.js App Router development for the client app. Use this skill whenever making ANY changes to apps/client, including components, routes, layouts, data fetching, styling, or configuration. This ensures agents read the correct documentation first, as this Next.js version has breaking changes from standard releases.
compatibility:
  required_tools:
    - view
    - edit
    - create
---

# Next.js Client Development

**CRITICAL**: This is NOT the standard Next.js you may know from training data. This version has breaking changes to APIs, conventions, and file structure. You MUST read the relevant documentation before making any changes.

## Documentation Location

All Next.js documentation is located at:
```
apps/client/node_modules/next/dist/docs/
```

## Workflow

### Step 1: Read the Index

Before doing ANYTHING else, read the index to understand the documentation structure:

```
apps/client/node_modules/next/dist/docs/index.md
```

This file contains important hints about breaking changes (look for `{/* AI agent hint: ... */}` comments) and the overall structure.

### Step 2: Identify the Relevant Documentation

Based on the user's request, determine which documentation section(s) to read:

| Task Type | Documentation Path |
|-----------|-------------------|
| Routing, layouts, pages, navigation | `01-app/02-guides/` and `01-app/03-api-reference/file-conventions/` |
| Data fetching (Server Components, fetch, caching) | `01-app/02-guides/data-fetching.mdx` and related guides |
| Client Components, hooks, interactivity | `01-app/02-guides/client-components.mdx` |
| Server Actions, mutations | `01-app/02-guides/server-actions.mdx` |
| Styling (CSS, Tailwind) | `01-app/02-guides/styling.mdx` |
| Image optimization | `01-app/03-api-reference/components/image.mdx` |
| Configuration (next.config.ts) | `01-app/03-api-reference/config/` |
| Metadata, SEO | `01-app/02-guides/metadata.mdx` |
| Error handling | `01-app/02-guides/error-handling.mdx` |
| Loading states, Suspense | `01-app/02-guides/loading.mdx` |
| Environment variables | `01-app/02-guides/environment-variables.mdx` |

If you're unsure which docs to read, explore the structure:
```bash
# List available guides
ls apps/client/node_modules/next/dist/docs/01-app/02-guides/
```

### Step 3: Read the Relevant Documentation

Use the `view` tool to read the specific documentation files you identified. Pay special attention to:

- API signatures and parameter types
- Breaking changes from previous versions
- Deprecation notices
- AI agent hints in comments
- File naming conventions
- Export requirements (e.g., `export const dynamic = ...`)

### Step 4: Verify Current Implementation

Before making changes, understand the current state:

1. Check the existing file structure in `apps/client/src/`
2. Look for any existing patterns or conventions
3. Check `apps/client/next.config.ts` for relevant configuration
4. Review `apps/client/package.json` for the Next.js version

### Step 5: Implement with Documentation in Mind

Apply what you learned from the documentation:

- Follow the exact API signatures
- Use the correct file naming conventions
- Export the required constants/functions
- Handle both server and client components correctly
- Apply proper TypeScript types

### Step 6: Cross-Check with Related Skills

After implementing, consider whether related skills should review your changes:

- **vercel-react-best-practices**: For React/Next.js performance patterns
- **vercel-composition-patterns**: If building reusable component APIs
- **zod-validation**: If handling external data (forms, API responses, search params)
- **web-design-guidelines**: For UI/accessibility review

## Common Gotchas

### Router Differences

This project uses the **App Router** (not Pages Router). Key differences:

- Routes are defined by folder structure in `app/` directory
- `page.tsx` exports the page component (not `index.tsx`)
- `layout.tsx` wraps nested routes
- Server Components are the default (use `"use client"` for client components)

### React Version

The App Router uses React canary releases with React 19 features built-in. Standard React patterns may need adjustments.

### Breaking Changes

Always check for AI agent hints in `index.md` and related docs. Example from index.md:
```
{/* AI agent hint: If fixing slow client-side navigations, 
    Suspense alone is not enough. You must also export 
    `unstable_instant` from the route. Read 
    docs/01-app/02-guides/instant-navigation.mdx before 
    making changes. */}
```

## Avoid These Mistakes

❌ **Don't** assume standard Next.js patterns work without checking docs
❌ **Don't** use Pages Router conventions (pages/, getServerSideProps, etc.)
❌ **Don't** forget to add `"use client"` when using hooks or browser APIs
❌ **Don't** skip reading docs for "simple" changes - APIs may have changed

✅ **Do** read the index.md first for hints about breaking changes
✅ **Do** check API reference for exact signatures
✅ **Do** verify file naming conventions in the docs
✅ **Do** look for deprecation notices and recommended alternatives

## When This Skill Should NOT Trigger

This skill is specific to `apps/client`. Do NOT use it for:

- Changes to `apps/server` (Express backend)
- Changes to `packages/*` (shared packages)
- Non-Next.js questions
- General React questions (use `vercel-react-best-practices` instead)

## Example Workflow

**User request**: "Add a new route for user profiles"

1. ✅ Read `apps/client/node_modules/next/dist/docs/index.md`
2. ✅ Identify relevant docs: routing, layouts, dynamic routes
3. ✅ Read `01-app/02-guides/routing.mdx` (or similar)
4. ✅ Read `01-app/03-api-reference/file-conventions/page.mdx`
5. ✅ Check current `apps/client/src/app/` structure
6. ✅ Create route following documented conventions
7. ✅ Consider if `vercel-react-best-practices` should review

---

## Related Skills

- vercel-react-best-practices
- vercel-composition-patterns
- zod-validation
- web-design-guidelines

---

**Remember**: The documentation is your source of truth. When in doubt, read the docs. This Next.js version is different from your training data.
