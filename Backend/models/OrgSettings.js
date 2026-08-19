import mongoose from "mongoose"

// Organisation-wide work calendar. A singleton — there is exactly one office.
// Read through calendarService.getOrgSettings() (which caches it), never directly,
// so every consumer applies the same rules.
const HolidaySchema = new mongoose.Schema(
  {
    // Normalised to start-of-day on write (see calendarController)
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true }
  },
  { _id: true }
)

const OrgSettingsSchema = new mongoose.Schema(
  {
    // 0 = Sunday … 6 = Saturday. Default Mon–Fri.
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
      validate: {
        validator: (days) => Array.isArray(days) && days.every(d => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "workingDays must contain integers between 0 (Sunday) and 6 (Saturday)"
      }
    },
    holidays: { type: [HolidaySchema], default: [] },
    // Used by the daily-provisioning cron. Kept here rather than only in an env var so
    // it's visible and editable alongside the rest of the calendar.
    timezone: { type: String, default: "Asia/Kolkata", trim: true }
  },
  { timestamps: true }
)

// Lazily creates the single document on first read — avoids needing a seed/migration step.
OrgSettingsSchema.statics.getSingleton = async function () {
  const existing = await this.findOne()
  if (existing) return existing
  return this.create({})
}

const OrgSettings = mongoose.model("OrgSettings", OrgSettingsSchema)

export default OrgSettings
