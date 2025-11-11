import * as React from "react";
import { Calendar, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { LeaveBalanceManagement } from "~/components/leave/leave-balance-management";
import { HolidayCalendarManager } from "~/components/leave/holiday-calendar-manager";

export const meta = () => {
  return [
    { title: "Leave & Absence Settings | Artemis" },
    { name: "description", content: "Manage leave types, balances, and holiday calendars" },
  ];
};

export default function LeaveAdminPage() {
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
      <Tabs defaultValue="balances" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balances" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Balance Management
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Holiday Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <LeaveBalanceManagement />
        </TabsContent>

        <TabsContent value="holidays">
          <HolidayCalendarManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
