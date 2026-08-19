import cron from "node-cron"
import { provisionDailyTasksForAllEmployees } from "./dailyTaskService.js"
import { getOrgSettings } from "./calendarService.js"

let scheduledTask = null

const runProvisioning = () => {
  console.log("Running scheduled daily task provisioning...")
  provisionDailyTasksForAllEmployees().catch(err =>
    console.error("Scheduled daily task provisioning failed:", err.message)
  )
}

// Schedules (or re-schedules) the midnight daily-task provisioning job against
// OrgSettings.timezone — the same source of truth calendarService/dailyTaskService
// already use for "what day is it for this org." Previously the cron only ever read
// the DAILY_TASK_CRON_TZ env var, so changing the timezone in Settings had no effect
// on when the job actually ran; that env var is no longer read anywhere.
//
// Called once at startup (after the DB connects) and again whenever an admin saves a
// new timezone via PUT /api/calendar/settings, so the change takes effect immediately
// rather than requiring a server restart.
export const scheduleDailyTaskCron = async () => {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }

  const settings = await getOrgSettings({ force: true })
  scheduledTask = cron.schedule("0 0 * * *", runProvisioning, { timezone: settings.timezone })
  console.log(`Daily task cron scheduled for timezone: ${settings.timezone}`)
}
