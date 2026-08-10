# Codebase Map

This document outlines the layout of the repository to help AI agents find and edit the correct files quickly. Since this is an initial scaffold, we document the existing setup and establish the structural patterns for future feature development.

---

## 1. Existing Core Modules

### Server Setup & Entry
* **Backend Entry Point**: [index.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/index.js)
  * Responsibilities: Express configuration, CORS management, JSON body parser initialization, server listen port selection.
* **Environment Variables**: [.env](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/.env)
  * Responsibilities: Environment variables (e.g., `PORT`, `MONGODB_URI` once set up).
* **Package Configuration**: [package.json](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/package.json)
  * Responsibilities: Backend dependencies and ES Modules flag (`"type": "module"`).

### Client UI Setup & Entry
* **Mounting Root**: [main.jsx](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/main.jsx)
  * Responsibilities: Mounts React application inside index.html.
* **Main App Page**: [App.jsx](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/App.jsx)
  * Responsibilities: Home page structure, counter state, and links.
* **Global Styling**: [index.css](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/index.css) & [App.css](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/App.css)
  * Responsibilities: Pure CSS rules for the app.

---

## 2. Directory Layout for New Features

When creating new features (e.g., authentication, progress tracking, user statistics), future AI agents **MUST** organize files using the following structures:

### Backend Structure Guide
All new backend files should be placed under modular subdirectories in `Backend/`:
```text
Backend/
├── controllers/      # Route logic / request handlers
│   ├── authController.js
│   └── progressController.js
├── models/           # Mongoose schemas
│   ├── User.js
│   └── Progress.js
├── routes/           # Express router endpoints
│   ├── authRoutes.js
│   └── progressRoutes.js
├── middleware/       # Custom Express middlewares (e.g., auth, validation)
│   └── authMiddleware.js
└── index.js          # Core app bootstrap & routing register
```

### Frontend Structure Guide
All new frontend components and services should be placed under modular subdirectories in `Frontend/src/`:
```text
Frontend/src/
├── components/       # Reusable UI components
├── context/          # React contexts / global state managers
├── hooks/            # Custom React hooks (e.g., useAuth)
├── services/         # API fetch/axios wrappers (e.g., apiService.js)
├── main.jsx          # Entry point
└── App.jsx           # Main layout/routing container
```
