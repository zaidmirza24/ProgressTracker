# Architectural Decisions

This document logs key architectural decisions made for the ProgressTracker repository.

---

## 1. Split Client/Server Codebases
* **Decision**: Separate client and server code into standalone directories (`Frontend/` and `Backend/`).
* **Rationale**: Keeps dependencies isolated, makes deployment configuration flexible, and provides a clear boundary between UI presentation and API services.

## 2. Backend ES Modules
* **Decision**: Use ES Modules (`import`/`export`) in the Node.js Express backend via `"type": "module"` in `package.json`.
* **Rationale**: Aligns backend JavaScript syntax with modern frontend React standards, making coding patterns consistent across the whole repository.

## 3. Styling via Tailwind CSS & Vanilla CSS
* **Decision**: Combine Tailwind CSS v4 utility classes with standard Vanilla CSS declarations inside (`index.css`, `App.css`).
* **Rationale**: Tailwind CSS v4 provides rapid utility-first UI development and standardizes responsive layouts, while Vanilla CSS manages global theme variables (e.g., dark theme oklch tokens), custom keyframe animations (floating glows, pulse rings), and custom element scrollbars.

## 4. Choice of Tech Stack
* **Decision**: Adopt the standard MERN stack with Express and Mongoose.
* **Rationale**: Simplifies modeling and route handlers with standard, well-supported libraries (`mongoose`, `express`).

## 5. Centralized Backend Error Handling
* **Decision**: Standardize on `AppError` class, `asyncHandler` route wrapper, and global Express error middleware.
* **Rationale**: Prevents try-catch duplication across controller code, catches unhandled exceptions globally, ensures database/JWT token validation errors are returned as structured JSON, and cleanly intercepts port conflicts.
