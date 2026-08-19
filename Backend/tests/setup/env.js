// Deterministic environment for every test run.
//
// Runs as a Vitest setupFile, which executes BEFORE the test module (and therefore
// before app.js) is imported — so these values are in place by the time any module
// reads them. `dotenv/config` in app.js never overwrites an already-set variable, so
// a developer's local Backend/.env cannot leak into a test run.

// A fixed, obviously-fake secret. Tests sign their own tokens with it (see
// tests/helpers/auth.js); nothing here is or resembles a real credential.
process.env.JWT_SECRET ??= "test-jwt-secret-not-a-real-secret"

// NODE_ENV=test deliberately puts errorMiddleware.js on its PRODUCTION branch
// (sendErrorProd), so integration tests assert the error contract real users
// actually receive — `{ status, error, code }` with no stack trace — rather than the
// verbose development shape.
process.env.NODE_ENV ??= "test"

// Never let a test read a developer's real client URL into the CORS allow-list.
process.env.CLIENT_URL = "http://localhost:5173"

// The app must never reach a real database. Integration tests connect mongoose to the
// in-memory server themselves (tests/setup/testDb.js); this value exists only so an
// accidental direct connect fails loudly instead of silently hitting a dev database.
process.env.MONGODB_URI = "mongodb://127.0.0.1:0/should-never-be-used"
