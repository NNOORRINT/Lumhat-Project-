# Lumhat

A bilingual English/Khmer olympiad mathematics practice experience inspired by the calm, product-led feel of modern learning platforms. The brand, components, illustration, copy, and information architecture are original.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Use the header to explore competitions, a working practice question, the student dashboard, authentication, and the admin workspace. The globe button switches English/Khmer.

## Production build

```bash
npm run build
npm run preview
```

## What is implemented

- Responsive landing page and original Lumhat visual identity
- English/Khmer UI switching and Khmer-aware typography
- Searchable, level-filtered competition library
- Interactive practice flow with answer feedback, hint, and proof
- Student progress dashboard
- Sign-in/sign-up interface
- Admin competition/problem tables and creation form
- KaTeX-powered mathematical notation in problem titles, statements, choices, hints, answers, and solutions
- Production-oriented PostgreSQL schema with roles and row-level security

## Writing mathematics

Problem authors can write in either English or Khmer and mix prose with LaTeX in the contributor form. Use `$x^2 + y^2$` for inline notation and `$$\\sum_{k=1}^{n} k$$` for a centered display equation. The shared fields support Noto Sans Khmer alongside KaTeX, and every mathematical field has a live preview and validator that reports unmatched delimiters and KaTeX parse errors before submission.

## Connect a real backend

The current UI uses realistic local sample content, so no credentials are needed to review it. For deployment, create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql), followed by [`supabase/competition_workflow_migration.sql`](supabase/competition_workflow_migration.sql) and [`supabase/problem_diagrams_migration.sql`](supabase/problem_diagrams_migration.sql). Then configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Keep the service-role key server-side only. For an existing project, run [`supabase/admin_permissions_migration.sql`](supabase/admin_permissions_migration.sql) before the competition workflow migration, then use [`supabase/make_admin.sql`](supabase/make_admin.sql) to assign the administrator role. Contributor accounts use the `contributor` profile role.

The schema separates English and Khmer fields so Khmer translations can be added by an editor after the English version, and only `published` content is publicly readable. Admin/contributor permissions are enforced in the database, not only hidden in the UI.

Problem diagrams are uploaded to the Supabase `problem-diagrams` storage bucket, while their URLs and descriptions are kept in the existing problem answer metadata. Run [`supabase/problem_diagrams_migration.sql`](supabase/problem_diagrams_migration.sql) after the other migrations to create the bucket and storage policies.

If you deploy migrations with the Supabase CLI, the same idempotent setup is available as [`supabase/migrations/20260829000000_create_problem_diagrams_bucket.sql`](supabase/migrations/20260829000000_create_problem_diagrams_bucket.sql). A `Bucket not found` upload error means this migration has not yet been applied to the Supabase project used by the deployment.

For a public launch, deploy the static app to Vercel or Cloudflare Pages, and add email verification plus abuse/rate limits.
