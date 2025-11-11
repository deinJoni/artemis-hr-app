import { LeaveReportsDashboard } from "~/components/leave/leave-reports-dashboard";
import { useApiContext } from "~/lib/api-context";

export const meta = () => {
  return [
    { title: "Leave Reports & Analytics | Artemis" },
    { name: "description", content: "View leave utilization, trends, and analytics" },
  ];
};

export default function LeaveReportsPage() {
  const { session } = useApiContext();

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Leave Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Analyze leave utilization, trends, and generate reports
        </p>
      </div>

      <LeaveReportsDashboard />
    </div>
  );
}
