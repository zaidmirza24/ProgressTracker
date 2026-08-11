# Architecture Overview

This document describes the high-level architecture of the ProgressTracker application. Since the codebase is in its initial setup phase, the architecture represents a clean MERN (MongoDB, Express, React, Node.js) skeleton.

---

## Architecture Blueprint

```text
React Component (Frontend UI)
       │ (State & Hooks)
       ▼
HTTP Fetch Requests (Frontend Client)
       │ (JSON payload over HTTP)
       ▼
Express API Route (Backend Router)
       │ (Request & Response handling)
       ▼
Express Controller / Handler
       │ (Business logic & Validation)
       ▼
Mongoose Model (Data Mapping)
       │ (Queries & Operations)
       ▼
MongoDB Database (Storage)
```

---

## Subsystems

### 1. Frontend Architecture
* **Technology**: React 19 scaffolded with Vite.
* **Entry Point**: [main.jsx](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/main.jsx) mounts the `<App />` component inside `#root` in `index.html`.
* **State Management**: Local React state (`useState`) is used; no global state management (e.g., Redux, Zustand) or React Router is introduced yet.
* **Styling**: Vanilla CSS is used exclusively. Primary styles are in [App.css](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/App.css) and [index.css](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/index.css).

### 2. Backend Architecture
* **Technology**: Node.js with Express.
* **ES Modules**: Backend uses standard ES import/export syntax (`"type": "module"` in `package.json`).
* **Entry Point**: [index.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/index.js). It initializes the Express app, configures CORS and JSON parsing middlewares, establishes the Mongoose database connection, and starts the HTTP server.
* **Environment Configuration**: Loaded from a `.env` file via the `dotenv` library.

### 3. Database Architecture
* **Technology**: MongoDB via the Mongoose ODM.
* **Current Status**: Mongoose connects to the MongoDB database URL defined in the backend environment variables (`MONGODB_URI`). All primary schemas (User, Department, Team, Task, DailyWorkLog, WorkSession) are defined and active.

### 4. Authentication Architecture
* **Current Status**: Stateless JWT authentication is implemented. Login yields a JSON Web Token that the frontend app attaches as a `Bearer` token in the `Authorization` header of downstream API requests. The token is validated server-side by `authenticateJWT` middleware.

---

## UI/Aesthetic Patterns

* **Form Fields & Navigation**: Native HTML selects are replaced with Radix UI primitives for enhanced styling (colored priority indicators, manager badges, and customizable category inputs).
* **Skeleton Shimmer Loading**: Adaptive CSS loading skeletons (`.skeleton` shimmer animation in `index.css`) render initial layouts during active REST fetches, optimizing perceived speed.

---

## Data Flow

As features are implemented, data flows as follows:
1. **User Interaction**: Triggered in a React component in `Frontend/src/`.
2. **API Call**: Triggered via `axios` pointing to the Express server URI (e.g. `API_BASE` referencing `http://localhost:3000`).
3. **Route Handling**: The backend Express server receives the request, parses the JSON body, runs middleware checks (like authorization), and delegates it to the appropriate route handler.
4. **Data Access**: The handler uses a Mongoose schema to perform CRUD operations on the MongoDB instance.
5. **Response**: Express sends the JSON response back to the client, which updates the React state and re-renders the UI.
