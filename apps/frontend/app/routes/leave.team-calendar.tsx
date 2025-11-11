import * as React from "react";
import { TeamLeaveCalendar } from "~/components/leave/team-leave-calendar";

export const meta = () => {
  return [
    { title: "Team Leave Calendar | Artemis" },
    { name: "description", content: "View team leave calendar and absence planning" },
  ];
};

export default function TeamLeaveCalendarPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Team Leave Calendar</h1>
        <p className="text-muted-foreground">
          View team absence patterns and plan coverage
        </p>
      </div>

      {/* Team Calendar */}
      <TeamLeaveCalendar />
    </div>
  );
}
