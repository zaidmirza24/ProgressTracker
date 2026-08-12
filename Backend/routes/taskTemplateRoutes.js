import express from "express"
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "../controllers/taskTemplateController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)
router.use(requireRole(["super_admin"]))

router.get("/", getTemplates)
router.post("/", createTemplate)
router.put("/:id", updateTemplate)
router.delete("/:id", deleteTemplate)

export default router
