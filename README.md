# Dr Sals Patient Portal

Standalone patient portal codebase that lives inside the Dr Sals website workspace but is managed as a separate Git repository.

## Purpose

- Keep portal development decoupled from the marketing website.
- Deploy portal independently (recommended target: `portal.drsals.com`).
- Preserve clean boundaries for auth, PHI handling, and patient workflows.

## Current Scope (MVP)

- Patient sign-in UX shell (demo-only for now)
- Appointment list UI
- Billing summary UI
- Secure messages UI
- Document upload placeholder UI

## Local Dev

Open `index.html` directly in a browser, or run a local static server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Security Note

This starter does **not** implement real authentication or HIPAA-grade controls yet. It is a frontend foundation only.

## Next Build Steps

1. Add real auth (Supabase Auth, Cognito, Clerk, or custom backend).
2. Add server-side API for appointments/messages/documents.
3. Add audit logging + role-based access.
4. Move to production deployment pipeline.
