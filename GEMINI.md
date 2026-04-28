# GEMINI.md

This file provides foundational mandates and operational guidance for Gemini CLI when working in this repository.

## 🎨 Visual Brainstorming

When brainstorming complex UI or architectural designs, use the Visual Companion skill. To start the server with persistence in this project:

```bash
/Users/sandeep/.gemini/extensions/superpowers/skills/brainstorming/scripts/start-server.sh --project-dir $(pwd) --foreground
```

**Note:** Always use `--foreground` and `is_background: true` in `run_shell_command` to ensure the process survives across conversation turns. Mockups are stored in `.superpowers/brainstorm/`.

## 🛠 Troubleshooting & Maintenance

If the application fails to build or run with obscure errors (e.g., `SIGKILL`, `Module not found`, or persistent TypeScript/ESLint errors that seem invalid):

1. **Deep Clean:** Delete `node_modules` and `.next` directories.
2. **Reinstall:** Run `npm install`.
3. **Reset Database (Optional):** If database corruption is suspected, remove `sage.db` and run `npm run bootstrap`.

## 🏗️ Engineering Standards

- **Local-First:** Always assume the application operates on a local SQLite database (`sage.db`).
- **Database Integrity Mandate:** NEVER perform operations that delete, truncate, or corrupt the production database (`sage.db`). All upgrades must be non-destructive schema migrations (using `ensureColumn` in `bootstrap.js`) that preserve existing user data.
- **Pre-Migration Backups:** Always verify that `bootstrap.js` creates a timestamped backup before attempting schema changes.
- **Validation:** Always verify builds with `npm run build` after making structural or configuration changes.

## ✅ Mandatory Process Mandates

1. **Mandatory Pull Requests:** ALL changes to the `main` branch must go through a pull request process. Never commit directly to `main`.
2. **Next.js MCP First:** In this project, `next-devtools` (`nextjs_index`, `nextjs_call`) is the SOLE source of truth for the running application state. 
   - ALWAYS run `nextjs_index` before making any claims about a running server.
   - If multiple servers are detected, identify the one tied to the current project path and use it exclusively for verification.

2. **Empirical UI Verification:** Never claim a UI element has moved or changed based only on a file write. You MUST:
   - Use `nextjs_call` (`get_errors`) to confirm a clean build after the change.
   - Use `browser_eval` (Playwright) to verify the physical presence and relative coordinates (e.g., `getBoundingClientRect`) of moved elements.
   - Attach a `screenshot` if the user is asking for visual confirmation.
   - **MANDATORY:** Every "Success" claim or Task Completion summary MUST include the result of a fresh `nextjs_call(get_errors)` run.

3. **No Assumptions on HMR:** If a change is not appearing, do not assume a "refresh" is needed. Physically verify the dev server's PID and restart it via `run_shell_command` if any discrepancy exists between the disk and the MCP state.

