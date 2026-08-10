# Architectural Decisions

This document logs key architectural decisions made for the ProgressTracker repository.

---

## 1. Split Client/Server Codebases
* **Decision**: Separate client and server code into standalone directories (`Frontend/` and `Backend/`).
* **Rationale**: Keeps dependencies isolated, makes deployment configuration flexible, and provides a clear boundary between UI presentation and API services.

## 2. Backend ES Modules
* **Decision**: Use ES Modules (`import`/`export`) in the Node.js Express backend via `"type": "module"` in `package.json`.
* **Rationale**: Aligns backend JavaScript syntax with modern frontend React standards, making coding patterns consistent across the whole repository.

## 3. Styling via Vanilla CSS
* **Decision**: Retain Vanilla CSS stylesheet files (`index.css`, `App.css`) for the UI presentation.
* **Rationale**: Keeps the application payload lightweight and flexible without introducing utility styles (Tailwind) or CSS-in-JS compilation overhead unless explicitly requested.

## 4. Choice of Tech Stack
* **Decision**: Adopt the standard MERN stack with Express and Mongoose.
* **Rationale**: Simplifies modeling and route handlers with standard, well-supported libraries (`mongoose`, `express`).

## 5. Centralized Backend Error Handling
* **Decision**: Standardize on `AppError` class, `asyncHandler` route wrapper, and global Express error middleware.
* **Rationale**: Prevents try-catch duplication across controller code, catches unhandled exceptions globally, ensures database/JWT token validation errors are returned as structured JSON, and cleanly intercepts port conflicts.
