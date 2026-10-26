# Repository guidance

- Use TypeScript strict mode, Next.js App Router, and Tailwind CSS.
- All user-facing content is Arabic. Preserve `lang="ar"`, RTL, logical CSS properties, keyboard access, visible focus, and responsive layouts.
- Prefer Server Components. Client components are only for necessary interactions.
- Shared UI lives in `src/components`, feature code in `src/features`, infrastructure in `src/lib`, and routes in `src/app`.
- Never invent teacher credentials, course availability, student data, testimonials, Firebase configuration, or secrets.
- Do not connect to live services, deploy, enable billing, or activate real authentication without explicit authorization.
- Keep Firebase initialization lazy and browser-only. Never put Admin SDK credentials in NEXT_PUBLIC variables. Client configuration does not replace server authorization or security rules.
- Login is a preview in this milestone: no credential submission, storage, session cookies, or fake successful authentication.
- Before a PR, run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`. Keep package-lock.json committed; verify mobile RTL and no-config rendering.
- Make changes on a separate feature branch and describe limitations honestly in the PR.
