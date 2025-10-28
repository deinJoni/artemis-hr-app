import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Make Dashboard the index (landing page)
  index("routes/dashboard.tsx"),
  route("/login", "routes/login.tsx"),
  route("/register", "routes/register.tsx"),
  route("/reset-password", "routes/reset-password.tsx"),
  route("/onboarding", "routes/onboarding.tsx"),
  route("/settings", "routes/settings.tsx"),
  route("/members", "routes/members.tsx"),
  route("/my-team", "routes/my-team.tsx"),
  route("/my-team/check-ins/:checkInId", "routes/my-team.check-ins.$checkInId.tsx"),
  route("/calendar", "routes/team-calendar.tsx"),
  route("/workflows", "routes/workflows.tsx"),
  route("/departments", "routes/departments.tsx"),
  route("/employees", "routes/employees.tsx"),
  route("/employees/:employeeId", "routes/employees.$employeeId.tsx"),
  route("/employees/:employeeId/growth", "routes/employees.$employeeId.growth.tsx"),
  // Time & Attendance routes
  route("/time/entries", "routes/time.entries.tsx"),
  route("/time/approvals", "routes/time.approvals.tsx"),
  route("/time/overtime", "routes/time.overtime.tsx"),
] satisfies RouteConfig;
