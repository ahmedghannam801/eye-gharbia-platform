# Persistent Workflow Rules for EYE Gharbia Platform

## 1. Automatic Build & Verification (`npm run build`)
- After making any code changes, bug fixes, or new features, **ALWAYS automatically run `npm run build`** to ensure the production bundle compiles cleanly and is up-to-date.

## 2. Automatic GitHub Sync (`git push origin main`)
- Immediately after building and verifying the code, **ALWAYS automatically commit and push to GitHub**:
  ```powershell
  git add .
  git commit -m "<descriptive message>"
  git push origin main
  ```
- Do not wait for the user to ask to push to GitHub; do it proactively after every completed task.

## 3. Proactive Database & SQL Migration Scripts
- Whenever any feature, table, column, RLS policy, function, or data change in Supabase is required:
  - **ALWAYS generate and provide the exact, copy-paste ready SQL script** for the Supabase SQL Editor.
  - Provide a clear explanation of what the SQL script accomplishes.
