import * as React from "react";
import { Calendar, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import type { TeamLeaveCalendarEvent, TeamLeaveCalendarResponse, LeaveType } from "@vibe/shared";
import { useApiContext } from "~/lib/api-context";

type TeamLeaveCalendarProps = {
  className?: string;
};

type ViewMode = "month" | "week";

export function TeamLeaveCalendar({ className }: TeamLeaveCalendarProps) {
  const { session, apiBaseUrl } = useApiContext();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [events, setEvents] = React.useState<TeamLeaveCalendarEvent[]>([]);
  const [holidays, setHolidays] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Filters
  const [selectedLeaveTypes, setSelectedLeaveTypes] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [includeHolidays, setIncludeHolidays] = React.useState(true);
  const [showFilters, setShowFilters] = React.useState(false);

  const loadLeaveTypes = React.useCallback(async () => {
    try {
      const token = session?.access_token;
      const res = await fetch(`${apiBaseUrl}/api/leave/types`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data = await res.json();
      if (res.ok) {
        setLeaveTypes(data.leaveTypes || []);
      }
    } catch (err) {
      console.error("Error loading leave types:", err);
    }
  }, [apiBaseUrl, session]);

  const loadCalendarData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = session?.access_token;
      
      // Calculate date range based on view mode
      const startDate = viewMode === "month" 
        ? startOfMonth(currentDate).toISOString().slice(0, 10)
        : format(currentDate, "yyyy-MM-dd");
      
      const endDate = viewMode === "month"
        ? endOfMonth(currentDate).toISOString().slice(0, 10)
        : format(addMonths(currentDate, 1), "yyyy-MM-dd");

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_holidays: includeHolidays.toString(),
      });

      if (selectedLeaveTypes.length > 0) {
        params.append("leave_type_ids", selectedLeaveTypes.join(","));
      }
      if (selectedStatuses.length > 0) {
        params.append("status", selectedStatuses.join(","));
      }

      const res = await fetch(`${apiBaseUrl}/api/leave/team-calendar?${params}`, {
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
      });
      
      const data: TeamLeaveCalendarResponse = await res.json();
      if (res.ok) {
        setEvents(data.events || []);
        setHolidays(data.holidays || []);
        setSummary(data.summary || null);
      } else {
        setError("Failed to load calendar data");
      }
    } catch (err) {
      setError("Failed to load calendar data");
      console.error("Error loading calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [
    apiBaseUrl,
    currentDate,
    includeHolidays,
    selectedLeaveTypes,
    selectedStatuses,
    session,
    viewMode,
  ]);

  // Load data when date or filters change
  React.useEffect(() => {
    if (!session) return;
    
    loadCalendarData();
  }, [session, loadCalendarData]);

  // Load leave types on mount
  React.useEffect(() => {
    if (!session) return;
    
    loadLeaveTypes();
  }, [session, loadLeaveTypes]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => 
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const exportToCSV = () => {
    const csvData = events.map(event => ({
      "Employee": event.employee_name || "",
      "Leave Type": event.leave_type || "",
      "Status": event.status || "",
      "Start Date": event.start,
      "End Date": event.end,
      "Half Day": event.is_half_day ? "Yes" : "No",
      "Notes": event.notes || "",
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-leave-calendar-${format(currentDate, "yyyy-MM")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const startDate = parseISO(event.start);
      const endDate = parseISO(event.end);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  };

  const getHolidaysForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.filter(holiday => holiday.date === dateStr);
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = [];
    
    // Add days from previous month to fill the first week
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // Add days from next month to fill the last week
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayEvents = getEventsForDate(d);
      const dayHolidays = getHolidaysForDate(d);
      const isCurrentMonth = d.getMonth() === currentDate.getMonth();
      const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
      
      days.push(
        <div
          key={d.toISOString()}
          className={cn(
            "min-h-[100px] p-2 border-r border-b border-gray-200",
            !isCurrentMonth && "bg-gray-50 text-gray-400",
            isToday && "bg-blue-50"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-sm font-medium",
              isToday && "text-blue-600"
            )}>
              {format(d, "d")}
            </span>
            {dayHolidays.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Holiday
              </Badge>
            )}
          </div>
          
          <div className="space-y-1">
            {dayEvents.slice(0, 3).map((event, index) => (
              <div
                key={index}
                className={cn(
                  "text-xs p-1 rounded truncate",
                  event.status === "approved" && "bg-green-100 text-green-800",
                  event.status === "pending" && "bg-yellow-100 text-yellow-800",
                  event.status === "denied" && "bg-red-100 text-red-800"
                )}
                style={{ 
                  borderLeft: `3px solid ${event.leave_type_color || "#3B82F6"}` 
                }}
              >
                {event.employee_name}
                {event.is_half_day && " (½)"}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-gray-500">
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="bg-gray-100 p-2 text-center text-sm font-medium">
            {day}
          </div>
        ))}
        {/* Days */}
        {days}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Team Leave Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Team Leave Calendar
            </CardTitle>
            <CardDescription>
              {format(currentDate, "MMMM yyyy")} • {summary?.total_requests || 0} requests
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Leave Types Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Leave Types</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {leaveTypes.map((type) => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={selectedLeaveTypes.includes(type.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLeaveTypes(prev => [...prev, type.id]);
                          } else {
                            setSelectedLeaveTypes(prev => prev.filter(id => id !== type.id));
                          }
                        }}
                      />
                      <label htmlFor={`type-${type.id}`} className="text-sm flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="space-y-2">
                  {["pending", "approved", "denied"].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStatuses(prev => [...prev, status]);
                          } else {
                            setSelectedStatuses(prev => prev.filter(s => s !== status));
                          }
                        }}
                      />
                      <label htmlFor={`status-${status}`} className="text-sm capitalize">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Options</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-holidays"
                      checked={includeHolidays}
                      onCheckedChange={(checked) => setIncludeHolidays(!!checked)}
                    />
                    <label htmlFor="include-holidays" className="text-sm">
                      Include holidays
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.total_requests}</div>
              <div className="text-sm text-blue-600">Total Requests</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{summary.pending_requests}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.approved_requests}</div>
              <div className="text-sm text-green-600">Approved</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summary.total_holidays}</div>
              <div className="text-sm text-purple-600">Holidays</div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === "month" ? renderMonthView() : (
          <div className="text-center py-8 text-muted-foreground">
            Week view coming soon
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-600 text-sm">{error}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
