# AI Agent Instructions - ProgressTracker

Welcome! This document provides core context, repository structure, and guidelines for AI coding agents working on the **ProgressTracker** project.

---

## Project Overview

* **Frontend Technology**: React 19 (scaffolded with Vite, using JS/JSX)
* **Backend Technology**: Node.js with Express (using ES modules via `"type": "module"`)
* **Database**: MongoDB (via Mongoose)
* **Authentication**: None implemented yet (scaffold phase)
* **API Style**: REST API
* **Important Libraries**: 
  * Frontend: `react`, `react-dom`
  * Backend: `express`, `cors`, `dotenv`, `mongoose`
* **Package Manager**: `npm`
* **Development Commands**:
  * **Frontend**: `npm run dev` (run from the [Frontend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend) directory)
  * **Backend**: `node index.js` (run from the [Backend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend) directory)

---

## Repository Structure

A concise map of the codebase and its directories:

* **[Backend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend)**: Contains the Express backend server.
  * `index.js`: Server entry point. Sets up Express, middleware (CORS, body parser), and registers API routes.
* **[Frontend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend)**: Contains the Vite React frontend application.
  * `src/`: The React source code.
    * `main.jsx`: Application mount point.
    * `App.jsx`: Main application layout and view logic.
    * `App.css` & `index.css`: Vanilla CSS styles.
* **[docs](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs)**: Documentation directory.
  * **[docs/ai](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai)**: Lightweight documentation targeted at helping AI coding agents understand the system efficiently.

---

## AI Working Rules

To maximize efficiency and maintain code quality, adhere to these rules:

* **Do NOT read the entire repository for every task.**
* **First identify which subsystem the task affects** (Frontend, Backend, or both).
* **Inspect only relevant files.** Do not open files that have no relation to the task.
* **Follow existing project patterns.** Maintain styling with Vanilla CSS and use standard ES module syntax.
* **Reuse existing utilities/components/services** where possible. Do not write duplicate utility functions.
* **Do not perform unrelated refactoring.** Fix the problem at hand without cleanups in adjacent modules.
* **Do not rename or restructure things** unless explicitly requested or necessary.
* **Preserve existing APIs and behavior** unless the task specifically requires changing them.
* **Verify dependencies and imports** before modifying code. Make sure packages are listed in `package.json` before importing them.
* **Treat the current source code as the source of truth.**
* **Never invent existing functions, routes, models, components, or utilities.**
* **Search the repository** using tools before creating new functionality to check if it already exists.

---

## Task Investigation Workflow

Follow these steps for every new task:

1. **Understand the request**: Clarify intent and scope before acting.
2. **Identify affected subsystem**: Decide whether it's frontend-only, backend-only, database-level, or full-stack.
3. **Search for relevant files/symbols**: Use search tools to locate files related to the features.
4. **Read only the necessary files**: Focus on the specific controllers, routes, or components.
5. **Trace dependencies only when necessary**: Follow import statements only if you need to understand data shapes or side-effects.
6. **Plan the smallest required change**: Make clean, targeted edits.
7. **Implement**: Code the changes.
8. **Verify**: Test the changes locally (compile/build/run unit tests).
9. **Summarize changes**: Provide a concise summary to the user.
10. **Update AI documentation ONLY if architecture changed**: (See [Documentation Update Policy](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/decisions.md) or the rules below).

---

## Token-Efficiency Rules

Every token counts. To reduce context usage:

* **Do not read every file** before starting a task.
* **Do not dump large source files** into the conversation context unnecessarily.
* **Do not repeatedly rediscover the architecture**; trust the maps in the `docs/ai/` directory.
* **Do not inspect unrelated features** (e.g., if debugging backend CORS, do not read frontend React layout files).
* **Do not rewrite complete files** when a small edit is sufficient.

Instead, follow this navigation path:
```text
AGENTS.md (Rules/Entry)
      ↓
docs/ai/codebase-map.md (Locate Feature Files)
      ↓
Targeted repository search (Find Symbols)
      ↓
Relevant source files (Read & Edit)
```

---

## Documentation Update Policy

Only update documentation under [docs/ai](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai) if an important architectural change has occurred:
* New major feature introduction
* New API domain
* New database model/schema
* Changes to authentication/authorization
* Major folder restructuring
* New state-management architecture or database flow

Do **NOT** update the documentation for minor bug fixes, stylesheet adjustments, UI text changes, or styling updates.

---

## Source of Truth

The repository source code is always the final source of truth.

```text
Current source code > AI documentation > AI assumptions
```

If there is a conflict between what is written in the documentation and what is written in the code:
1. Trust the code.
2. Correct the documentation if necessary.
3. Proceed with the task.
