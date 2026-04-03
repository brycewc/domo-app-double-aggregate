---
description: Always-on high-level Domo App Platform guardrails and skill routing.
alwaysApply: true
---

# Domo App Platform Core Rule

## Platform constraints (always apply)
- Domo custom apps are client-side only static apps.
- Do not use SSR patterns (`getServerSideProps`, Remix loaders/actions, SvelteKit server files, Nuxt server routes, `pages/api`, `app/api`, `"use server"`).
- If SSR is detected, stop and explicitly recommend client-side refactor (React + Vite) or Code Engine for server logic.
- **Exception — Embed host applications:** The embed skills (`cap-de-programmatic-filters`, `cap-de-edit-embed`) target the *host* application that embeds Domo content, not a Domo custom app. These require server-side code (API routes for OAuth token exchange, JWT signing) and use the Domo public API (`api.domo.com`) and Identity Broker — this is expected and correct. The client-only constraint does not apply to embed host apps.

## API boundary
- Use Domo App Platform APIs (`domo.js`, `@domoinc/query`, `@domoinc/toolkit`).
- Do not confuse with Domo public/product APIs unless explicitly requested.
- **Exception — Embed skills:** `cap-de-programmatic-filters` and `cap-de-edit-embed` use the Domo public API and Identity Broker by design. When these skills are active, public API usage (`api.domo.com/oauth/token`, `api.domo.com/v1/stories/embed/auth`, Identity Broker URLs) is expected.

## Build/routing non-negotiables
- Use relative asset base for Domo hosting (`base: './'`).
- Prefer `HashRouter` unless rewrite behavior is known and intentional.

## API index
- Data API
- AppDB
- AI Service Layer
- Code Engine
- Workflows
- Embed (Programmatic Filters, Dataset Switching, Edit Embed / Identity Broker)
- Files / Filesets / Groups / User / Task Center

## Skill routing
- New app build playbook -> `skills/pb-apps-initial-build/SKILL.md`
- Dataset querying -> `skills/cap-apps-dataset-query/SKILL.md`
- Data API overview -> `skills/cap-apps-data-api/SKILL.md`
- domo.js usage -> `skills/cap-apps-domo-js/SKILL.md`
- Toolkit usage -> `skills/cap-apps-toolkit/SKILL.md`
- AppDB -> `skills/cap-apps-appdb/SKILL.md`
- AI services -> `skills/cap-apps-ai-service-layer/SKILL.md`
- Code Engine -> `skills/cap-apps-code-engine/SKILL.md`
- Workflows -> `skills/cap-apps-workflow/SKILL.md`
- SQL queries -> `skills/cap-apps-sql-query/SKILL.md`
- Manifest wiring -> `skills/cap-apps-manifest/SKILL.md`
- Build/publish -> `skills/cap-apps-publish/SKILL.md`
- DA CLI -> `skills/cap-apps-da-cli/SKILL.md`
- Performance -> `skills/cap-apps-performance/SKILL.md`
- Migration from Lovable/v0 -> `skills/wf-apps-migrate-lovable/SKILL.md`
- Migration from Google AI Studio -> `skills/wf-apps-migrate-googleai/SKILL.md`
- Connector IDE -> `skills/cap-connector-dev/SKILL.md`
- Programmatic embed filters / dataset switching -> `skills/cap-de-programmatic-filters/SKILL.md`
- JS API filters -> `skills/cap-de-jsapi-filters/SKILL.md`
- Edit embed / Identity Broker -> `skills/cap-de-edit-embed/SKILL.md`
