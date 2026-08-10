import Team from "../models/Team.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

export const getTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ isActive: true })
    .populate("department", "name")
    .sort({ name: 1 })
  res.json({ teams })
})

export const createTeam = asyncHandler(async (req, res) => {
  const { name, department, description } = req.body
  const team = await Team.create({ name, department, description })
  await team.populate("department", "name")
  res.status(201).json({ team })
})

export const updateTeam = asyncHandler(async (req, res, next) => {
  const { name, department, description } = req.body
  const team = await Team.findByIdAndUpdate(
    req.params.id,
    { name, department, description },
    { new: true }
  ).populate("department", "name")
  if (!team) return next(new AppError("Team not found", 404))
  res.json({ team })
})
