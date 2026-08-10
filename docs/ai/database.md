# Database Documentation

This document describes the database layer of the application.

---

## Configuration & Connection

* **Database Engine**: MongoDB
* **ODM (Object Document Mapper)**: Mongoose (v9.x)
* **Status**: Installed and imported, but connection logic is not yet implemented.

---

## Future Schema Guidelines

When creating new Mongoose models:
1. Put models inside `Backend/models/`.
2. Name model files using singular casing (e.g., `User.js`, `Progress.js`).
3. Explicitly define validation rules on schema fields (e.g. `required`, `trim`, `minlength`).
4. Enable timestamps option (`{ timestamps: true }`) for automated creation and update tracking.

### Expected Future Models

Here are the anticipated schemas for a progress tracker application:

#### User Schema (Proposed)
* **Model Name**: `User`
* **Collection**: `users`
* **Fields**:
  * `username` (String, required, unique, trimmed)
  * `email` (String, required, unique, trimmed, lowercase)
  * `password` (String, required, minlength)
  * Timestamps (`createdAt`, `updatedAt`)

#### Progress/Task Schema (Proposed)
* **Model Name**: `Progress`
* **Collection**: `progresses`
* **Fields**:
  * `userId` (ObjectId, ref: `'User'`, required)
  * `title` (String, required)
  * `status` (String, enum: `['pending', 'in-progress', 'completed']`, default: `'pending'`)
  * `score` / `percentage` (Number, default: 0)
  * Timestamps (`createdAt`, `updatedAt`)
