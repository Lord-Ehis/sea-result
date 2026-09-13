# SEA (Sophie Educational Assistant) — Project Brief

## What this is

Sophie Educational Assistant (SEA) is an AI-powered EdTech platform for
African institutions, under Unicorn Starlight Limited (Port Harcourt,
Nigeria). The full vision (curriculum planning, AI personalization,
analytics, gamification, digital library, multi-language support) is
long-term. **This build is SEA's first shipping module: a multi-tenant
school results management SaaS** — not a separate product or sub-brand.
It carries the SEA name from day one and grows into the rest of the
platform over time.

Domain: **sophie-ea.app**

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js (App Router, TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth / Auth.js (or Clerk) |
| Payments | Paystack |
| SMS | Termii or Africa's Talking |
| Email | Resend or Postmark |
| Hosting | Vercel + managed Postgres (Neon or Supabase) |
| Custom domains | Vercel domain API |

## Multi-tenancy

Shared database, `tenant_id` (School) column on every tenant-scoped
table — not separate schemas or databases per school.

## Roles

1. **Platform Owner** — manages schools, subscriptions, deletion
   approvals, global provider settings (payment/SMS/email keys)
2. **School Admin** — manages campuses, students, teachers, result
   templates, approves/publishes results, billing, notification settings
3. **Teacher** — manual result entry and CSV import for their assigned
   classes only; submits for admin approval
4. **Parent/Student** — either a full account (multi-child support) or
   a no-login lookup by student code + name, depending on the school's
   choice; both paths available per school

## Core entities

- `School` (tenant root — plan, billing cycle, custom domain, result
  format config as JSON)
- `Campus` (belongs to School; one subscription can cover multiple
  campuses; no campus-level admin role in v1)
- `User` (role-based: platform_owner / school_admin / teacher / parent)
- `Student` (belongs to Campus)
- `ResultTemplate` (per-school configurable fields, stored as JSON —
  fields are not one fixed format across schools)
- `Result` (student + term + subject scores, matched against the
  school's ResultTemplate)
- `Subscription` / `Payment` (Paystack references, term/session,
  discount logic)
- `Notification` (SMS/email log for result-ready alerts)

## Business rules

- Pricing: **₦50,000 per term**
- Full-session (3 terms) subscription: **20% discount**
- New subscribers: **₦10,000 off** their first term — applies to
  per-term billing only, not full-session signups
- No free trial period
- Onboarding: hybrid — self-signup available, with assisted setup option
- Result entry: mix of bulk import (CSV/Excel) and manual entry, by
  either Teacher or School Admin
- Result workflow: Teacher submits → School Admin reviews/approves →
  publish triggers SMS + email notification to parents
- Custom domain support: included in v1, not deferred
- Data retention: cancelled school data retained indefinitely unless
  the school requests deletion
- Deletion: requires School Admin request **plus** Platform Owner
  manual approval — no self-service permanent deletion
- No Super Admin impersonation of School Admin — support works through
  the school's own admin account instead
- Priority for now: features that help close/retain schools (sales-
  facing) over features that reduce internal support burden

## Build order

1. Project scaffold + multi-tenant auth (Platform Owner, School Admin
   roles first)
2. School/Campus/Student CRUD + configurable ResultTemplate builder
3. Result entry — manual form + CSV/Excel import
4. Public result lookup (code+name) + optional parent/student accounts
5. Paystack subscription billing (per-term, discounts)
6. SMS/email notifications on result publish
7. Custom domain mapping per school

## Design

26 screens have been designed and reviewed for consistency (see
`design-tokens.css` and the `UI_UX_complete_reviewed.zip` screen set):

- **Platform Owner:** Schools list, School detail & deletion approval,
  Global settings, Analytics & reports
- **School Admin:** Dashboard, Students & campuses, Result template
  builder, Result approval review, Billing & subscription, Teacher
  management, Deletion request submission, Notification settings,
  Custom domain setup
- **Teacher:** My classes, Result entry
- **Parent/Student:** Result lookup (no account), Result view &
  dashboard (with account), Link another child
- **Shared:** Login, School self-signup wizard, Forgot/reset password,
  Empty states, Error/failure states, Confirmation modals

Design system decisions: Inter typeface throughout (no exceptions),
SEA brand mark shown alongside the current tenant school's name on
every authenticated screen, semantic colors (blue `#185FA5`, teal
`#0F6E56`, amber `#BA7517`, red `#A32D2D`) reconciled into
`design-tokens.css` as the single source of truth — do not reintroduce
one-off hex values from the original mockup HTML.

## Known open items

- Domain `sophie-ea.app` not yet registered
- Visual/spacing QA on the 26 screens was reviewed structurally
  (branding, fonts, color tokens) but not pixel-checked visually —
  worth a final eyeball pass during implementation
