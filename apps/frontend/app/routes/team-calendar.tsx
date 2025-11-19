import React from "react";
import type { Route } from "./+types/team-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import type { CalendarEvent, CalendarResponse, ManagerCalendarFilter } from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
} from "react-big-calendar";
import type { View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { Download, Filter, Calendar as CalendarIcon, Clock, CalendarDays, Calendar, Grid3x3 } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Team Calendar | Artemis" },
    { name: "description", content: "Team time-off and worked time overview." },
  ];
}

const locales = {} as Record<string, any>;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function TeamCalendar({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [events, setEvents] = React.useState<Array<{ id: string; title: string; start: Date; end: Date; resource?: CalendarEvent }>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [date, setDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<View>("week");
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState<Partial<ManagerCalendarFilter>>({
    status: 'all',
    include_breaks: false,
  });
  const [teamMembers, setTeamMembers] = React.useState<Array<{ id: string; name: string; user_id: string }>>([]);

  // Load team members for filter dropdown
  React.useEffect(() => {
    let cancelled = false;
    async function loadTeamMembers() {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`${apiBaseUrl}/api/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && !cancelled) {
          setTeamMembers(data.employees || []);
        }
      } catch {
        // Ignore errors for team members
      }
    }
    void loadTeamMembers();
    return () => { cancelled = true };
  }, [apiBaseUrl]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        
        // Compute visible range based on view
        let rangeStart: Date;
        let rangeEnd: Date;
        
        if (view === "day") {
          rangeStart = startOfDay(date);
          rangeEnd = endOfDay(date);
        } else if (view === "week") {
          rangeStart = startOfWeek(date);
          rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (view === "month") {
          rangeStart = startOfMonth(date);
          rangeEnd = endOfMonth(date);
        } else {
          // Default to week
          rangeStart = startOfWeek(date);
          rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        // Build query parameters
        const params = new URLSearchParams({
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
          status: filters.status || 'all',
          include_breaks: String(filters.include_breaks || false),
          format: 'json',
        });

        if (filters.user_ids && filters.user_ids.length > 0) {
          filters.user_ids.forEach(id => params.append('user_ids[]', id));
        }

        const res = await fetch(
          `${apiBaseUrl}/api/calendar?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = (await res.json().catch(() => ({}))) as Partial<CalendarResponse> & { error?: string };
        if (!res.ok) throw new Error(payload.error || res.statusText);
        const list = (payload.events ?? []) as CalendarEvent[];
        if (cancelled) return;
        setEvents(
          list.map((ev) => ({
            id: ev.id,
            title: ev.kind === "time_off" 
              ? (ev.leaveType ? `Time Off (${ev.leaveType})` : "Time Off") 
              : `Worked Time - ${(ev as any).employeeName || 'Unknown'}`,
            start: new Date(ev.start),
            end: new Date(ev.end),
            resource: ev,
          })),
        );
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true };
  }, [apiBaseUrl, date, view, filters]);

  const handleExport = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      // Compute visible range based on view
      let rangeStart: Date;
      let rangeEnd: Date;
      
      if (view === "day") {
        rangeStart = startOfDay(date);
        rangeEnd = endOfDay(date);
      } else if (view === "week") {
        rangeStart = startOfWeek(date);
        rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (view === "month") {
        rangeStart = startOfMonth(date);
        rangeEnd = endOfMonth(date);
      } else {
        // Default to week
        rangeStart = startOfWeek(date);
        rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      // Build query parameters for CSV export
      const params = new URLSearchParams({
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
        status: filters.status || 'all',
        include_breaks: String(filters.include_breaks || false),
        format: 'csv',
      });

      if (filters.user_ids && filters.user_ids.length > 0) {
        filters.user_ids.forEach(id => params.append('user_ids[]', id));
      }

      const res = await fetch(
        `${apiBaseUrl}/api/calendar?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) throw new Error("Export failed");

      // Download the CSV
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-calendar-${rangeStart.toISOString().split('T')[0]}-to-${rangeEnd.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const handleFilterChange = (key: keyof ManagerCalendarFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const selectedTeamMemberIds = React.useMemo(() => filters.user_ids ?? [], [filters.user_ids]);
  const selectedTeamMembers = React.useMemo(
    () => teamMembers.filter((member) => selectedTeamMemberIds.includes(member.user_id)),
    [teamMembers, selectedTeamMemberIds]
  );
  const teamMemberLabel = selectedTeamMembers.length
    ? `${selectedTeamMembers.length} selected`
    : "All team members";

  const getEventStyle = (event: any) => {
    const ev = event.resource as CalendarEvent;
    if (ev.kind === 'time_off') {
      return {
        style: {
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
        }
      };
    } else {
      return {
        style: {
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
        }
      };
    }
  };

  const renderEvent = React.useCallback(({ event }: { event: any }) => {
    const resource = event.resource as (CalendarEvent & {
      employeeName?: string;
      approvalStatus?: string;
      netDuration?: number;
      breakMinutes?: number;
      leaveType?: string;
    });
    const startDate = event.start instanceof Date ? event.start : new Date(event.start);
    const endDate = event.end instanceof Date ? event.end : new Date(event.end);
    const sameTime = endDate.getTime() === startDate.getTime();
    const timeRange = sameTime ? format(startDate, "HH:mm") : `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`;
    const isTimeEntry = resource?.kind === "time_entry";
    const approval = resource?.approvalStatus;
    const approvalVariant: "outline" | "secondary" | "destructive" =
      approval === "approved"
        ? "outline"
        : approval === "pending"
          ? "secondary"
          : "destructive";
    const formatMinutes = (minutes: number) => {
      if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
      const hrs = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    return (
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">
            {resource?.employeeName || event.title}
          </span>
          {isTimeEntry && approval ? (
            <Badge variant={approvalVariant} className="text-[10px] uppercase">
              {approval}
            </Badge>
          ) : null}
        </div>
        {isTimeEntry ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] leading-tight">
            <span>{timeRange}</span>
            {sameTime ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3 w-3" />
                Active
              </span>
            ) : null}
            {typeof resource?.netDuration === "number" ? (
              <span className="text-muted-foreground">
                Net {formatMinutes(resource.netDuration)}
              </span>
            ) : null}
            {resource?.breakMinutes ? (
              <span className="text-muted-foreground">
                Break {formatMinutes(resource.breakMinutes)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-muted-foreground text-[11px] leading-tight">
            Time Off{resource?.leaveType ? ` (${resource.leaveType})` : ""}
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/60 bg-muted/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Team Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={view === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("day")}
                  className="h-8 px-3"
                >
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Day
                </Button>
                <Button
                  variant={view === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                  className="h-8 px-3"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={view === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("month")}
                  className="h-8 px-3"
                >
                  <Grid3x3 className="h-4 w-4 mr-1" />
                  Month
                </Button>
              </div>
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
                onClick={handleExport}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) =>
                    handleFilterChange("status", value === "all" ? "all" : (value as ManagerCalendarFilter["status"]))
                  }
                >
                  <SelectTrigger id="status-filter" className="h-10 w-full">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="clocked-in">Clocked In</SelectItem>
                    <SelectItem value="not-clocked-in">Not Clocked In</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-filter">Team Members</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 w-full justify-between px-3 text-sm font-normal"
                      id="team-filter"
                    >
                      <span className="truncate">{teamMemberLabel}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
                      <span>Select members</span>
                      {selectedTeamMemberIds.length ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs"
                          onClick={() => handleFilterChange("user_ids", [])}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2">
                      {teamMembers.length ? (
                        teamMembers.map((member) => {
                          const isChecked = selectedTeamMemberIds.includes(member.user_id);
                          return (
                            <label
                              key={member.user_id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const next = checked === true
                                    ? [...selectedTeamMemberIds, member.user_id]
                                    : selectedTeamMemberIds.filter((id) => id !== member.user_id);
                                  handleFilterChange("user_ids", Array.from(new Set(next)));
                                }}
                              />
                              <span className="truncate">{member.name}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="px-2 py-3 text-sm text-muted-foreground">No team members available.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.include_breaks || false}
                    onChange={(e) => handleFilterChange('include_breaks', e.target.checked)}
                    className="rounded border-input"
                  />
                  Include Break Times
                </Label>
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          ) : null}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : null}
          
          <div className="h-[70vh] min-h-[500px] w-full rounded-md border border-border/60 bg-background p-2">
            <RBCalendar
              localizer={localizer}
              date={date}
              view={view}
              onView={(v: View) => setView(v)}
              onNavigate={(d: Date) => setDate(d)}
              events={events}
              startAccessor="start"
              endAccessor="end"
              eventPropGetter={getEventStyle}
              style={{ height: '100%' }}
              components={{
                event: renderEvent,
              }}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Time Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Worked Time</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
