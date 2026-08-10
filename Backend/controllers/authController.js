import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400))
  }

  // Find active user
  const user = await User.findOne({ email, isActive: true })
  if (!user) {
    return next(new AppError("Invalid email or password", 401))
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    return next(new AppError("Invalid email or password", 401))
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  )

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  })
})

export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("-passwordHash")
  
  if (!user) {
    return next(new AppError("User not found", 404))
  }
  
  res.json({ user })
})
