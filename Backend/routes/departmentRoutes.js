import express from "express"
import { getDepartments, createDepartment, updateDepartment, deactivateDepartment } from "../controllers/departmentController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/", getDepartments)
router.post("/", requireRole(["super_admin"]), createDepartment)
router.put("/:id", requireRole(["super_admin"]), updateDepartment)
router.patch("/:id/deactivate", requireRole(["super_admin"]), deactivateDepartment)

export default router
