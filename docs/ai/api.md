# API Reference

This document lists the existing API endpoints for the ProgressTracker backend.

---

## Base Configuration
* **Server Protocol**: HTTP (or HTTPS in production)
* **Base URL**: Set via `process.env.PORT` on the backend (e.g. `http://localhost:5000` or the configured port).
* **Format**: All payloads and responses are formatted as JSON.

---

## 1. System Endpoints

### Health Check / Status

* **Method**: `GET`
* **Path**: `/`
* **Purpose**: Verifies that the API server is online and running.
* **Authentication Required**: No
* **Request Headers**: None
* **Request Body**: None
* **Response Shape**:
  ```json
  {
    "message": "API is running"
  }
  ```
* **Relevant Code**: [index.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/index.js) (inline handler)
* **Frontend Consumer**: None (currently not fetched by client)

---

## 2. API Design Guidelines for Future Routes

When building new routes, adhere to these RESTful conventions:

* **Prefixing**: All routes should be prefixed with `/api` (e.g., `/api/auth`, `/api/tasks`).
* **HTTP Methods**:
  * `GET` for fetching resources.
  * `POST` for creating resources.
  * `PUT`/`PATCH` for updating resources.
  * `DELETE` for removing resources.
* **Response Format**: Always return consistent JSON payloads. Use proper HTTP status codes:
  * `200 OK` or `201 Created` for successes.
  * `400 Bad Request` for client input validation failures.
  * `401 Unauthorized` for missing/invalid auth tokens.
  * `403 Forbidden` for insufficient privileges.
  * `404 Not Found` for missing resources.
  * `500 Internal Server Error` for unexpected server issues.
