# Persistent Workflow Rules for EYE Gharbia Project

## 1. Automatic Platform Build & Verification
- After making any code changes or completing any task, **ALWAYS automatically run `npm run build`** to ensure the platform bundle is fresh, completely compiled, and verified without needing the user to ask for it.

## 2. Proactive Database & SQL Migration Scripts
- Whenever any feature or fix involves database schema updates (tables, columns, indexes, policies, RLS, functions) or data syncing:
  - **ALWAYS generate and provide the exact, copy-paste ready SQL migration script** formatted cleanly for Supabase SQL Editor.
  - Explain the purpose of the SQL script clearly so the user can run it immediately in Supabase.
