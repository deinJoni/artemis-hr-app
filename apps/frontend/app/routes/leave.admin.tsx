import * as React from "react";
import { Calendar, Settings, Users } from "lucide-react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { LeaveTypeManager } from "~/components/leave/leave-type-manager";
import { LeaveBalanceManagement } from "~/components/leave/leave-balance-management";
import { HolidayCalendarManager } from "~/components/leave/holiday-calendar-manager";

export const meta = () => {
  return [
    { title: "Leave & Absence Settings | Artemis" },
    { name: "description", content: "Manage leave types, balances, and holiday calendars" },
  ];
};

export default function LeaveAdminPage() {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const tabs = (
    <Tabs defaultValue="leave-types" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="leave-types" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Leave Types
        </TabsTrigger>
        <TabsTrigger value="balances" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Balance Management
        </TabsTrigger>
        <TabsTrigger value="holidays" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Holiday Calendar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="leave-types">
        <LeaveTypeManager />
      </TabsContent>

      <TabsContent value="balances">
        <LeaveBalanceManagement />
      </TabsContent>

      <TabsContent value="holidays">
        <HolidayCalendarManager />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Leave & Absence Settings</h1>
        <p className="text-muted-foreground">
          Configure leave types, manage balances, and set up holiday calendars
        </p>
      </div>

      {/* Admin Tabs */}
      {isClient ? <DirectionProvider dir="ltr">{tabs}</DirectionProvider> : tabs}
    </div>
  );
}
