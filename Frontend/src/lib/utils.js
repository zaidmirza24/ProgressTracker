import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function extractErrorMessage(error, defaultMsg = "An unexpected error occurred") {
  if (!error) return defaultMsg
  
  if (typeof error === "string") return error
  
  if (error.response && error.response.data) {
    const data = error.response.data
    if (typeof data.error === "string") return data.error
    if (typeof data.message === "string") return data.message
    if (data.error && typeof data.error === "object" && typeof data.error.message === "string") {
      return data.error.message
    }
  }
  
  return error.message || defaultMsg
}
