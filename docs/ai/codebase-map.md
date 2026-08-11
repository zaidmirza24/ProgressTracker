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
  * Responsibilities: Tailwind CSS imports, custom theme color tokens (Fordark theme), custom animations (floating glows, shimmer, pulse), and custom scrollbars/base overlays.

---

---

## 2. Directory Layout and Core Modules

The frontend and backend files are organized as follows:

### Backend Structure
All backend modules are located in the [Backend/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend) directory:
* **[controllers/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/controllers)**: Requests handlers containing core business logic.
  * `authController.js`, `dailyWorkLogController.js`, `departmentController.js`, `taskController.js`, `teamController.js`, `userController.js`, `workSessionController.js`
* **[models/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models)**: Mongoose schemas representing the data layer.
  * `User.js`, `Department.js`, `Team.js`, `Task.js`, `DailyWorkLog.js`, `WorkSession.js`
* **[routes/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes)**: Express routing endpoints.
  * `auth.js`, `dailyWorkLogRoutes.js`, `departmentRoutes.js`, `taskRoutes.js`, `teamRoutes.js`, `userRoutes.js`, `workSessionRoutes.js`
* **[middleware/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/middleware)**: Custom middlewares.
  * `authMiddleware.js` (JWT parsing/protection), `errorMiddleware.js` (global uncaught handlers)
* **[utils/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/utils)**: Global utilities.
  * `appError.js` (operational error helper)
* **[seed.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/seed.js)**: Database seeding script for client demo data.

### Frontend Structure
All frontend files are located in the [Frontend/src/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src) directory:
* **[components/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/components)**: Core and reusable UI components.
  * `Layout.jsx` (main navigation/dashboard shell)
  * `ProtectedRoute.jsx` (role & authentication check wrapper)
  * **[ui/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/components/ui)**: Modular Radix-based UI components (button, card, dialog, select, skeleton, table, tabs, etc.)
* **[context/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/context)**: React Context providers.
  * `AuthContext.jsx` (login, token retention, current user state)
  * `ThemeContext.jsx` (CSS variables-based style themes)
  * `TimerContext.jsx` (global tracking timer events)
* **[pages/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/pages)**: Primary view containers.
  * `Login.jsx` (email/password login panel)
  * `WorkLogs.jsx` (daily log entry and review dashboard)
  * **[dashboards/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/pages/dashboards)**: User-role based entry pages:
    * `SuperAdminDashboard.jsx`, `ManagerDashboard.jsx`, `EmployeeDashboard.jsx`, `Unauthorized.jsx`
* **[index.css](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/index.css)**: Primary CSS rules, color tokens (Fordark theme), skeleton-shimmer keyframes, and utilities.
