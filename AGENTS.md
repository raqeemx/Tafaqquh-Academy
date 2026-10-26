# Repository guidance

- Use TypeScript strict mode, Next.js App Router, and Tailwind CSS.
- All user-facing content is Arabic. Preserve `lang="ar"`, RTL, logical CSS properties, keyboard access, visible focus, and responsive layouts.
- Prefer Server Components. Client components are only for necessary interactions.
- Shared UI lives in `src/components`, feature code in `src/features`, infrastructure in `src/lib`, and routes in `src/app`.
- Never invent teacher credentials, course availability, student data, testimonials, Firebase configuration, or secrets.
- Do not connect to live services, deploy, enable billing, or activate real authentication without explicit authorization.
- Keep Firebase initialization lazy and browser-only. Never put Admin SDK credentials in NEXT_PUBLIC variables. Client configuration does not replace server authorization or security rules.
- Authentication is authorized for the existing tafaqquh-academy project. Never expose restricted content before BOTH verified email and live approved student status. Client writes cannot approve, reject, change roles, or delete admission records. Keep Admin server-only and repeat authorization because Admin bypasses Rules. Run emulator security tests; never use real student accounts for tests.
- Before a PR, run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`. Keep package-lock.json committed; verify mobile RTL and no-config rendering.
- Make changes on a separate feature branch and describe limitations honestly in the PR.
- Restricted content additionally requires current privacy consent and an active enrollment in its published program. Keep administrator registry and audit/private notes inaccessible to client SDKs. Administrative mutations must recheck the live role inside the transaction, preserve immutable audit entries, and handle stale/repeated requests safely.
- Use only the demo-tafaqquh project for emulator tests. Cloud staging must use a separate explicit project, never production data. Privacy policy approval and controller/contact/retention information are required before registration is enabled.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
