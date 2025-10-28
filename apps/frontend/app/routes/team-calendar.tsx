import * as React from "react";
import type { Route } from "./+types/team-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import type { CalendarEvent, CalendarResponse, ManagerCalendarFilter } from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
} from "react-big-calendar";
import type { View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { Download, Filter, Users, Calendar as CalendarIcon, Clock } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";

// eslint-disable-next-line react-refresh/only-export-components
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
  const [view, setView] = React.useState<View>("month");
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
      } catch (e) {
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
        
        // Compute visible range
        const rangeStart = view === "week"
          ? startOfWeek(date)
          : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const rangeEnd = view === "week"
          ? new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000)
          : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

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

      // Compute visible range
      const rangeStart = view === "week"
        ? startOfWeek(date)
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      const rangeEnd = view === "week"
        ? new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

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

  const getEventStyle = (event: any) => {
    const ev = event.resource as CalendarEvent;
    if (ev.kind === 'time_off') {
      return {
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
      };
    } else {
      return {
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
      };
    }
  };

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
                <select
                  id="status-filter"
                  value={filters.status || 'all'}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">All Status</option>
                  <option value="clocked-in">Clocked In</option>
                  <option value="not-clocked-in">Not Clocked In</option>
                  <option value="on-leave">On Leave</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-filter">Team Members</Label>
                <select
                  id="team-filter"
                  multiple
                  value={filters.user_ids || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    handleFilterChange('user_ids', selected);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {teamMembers.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name}
                    </option>
                  ))}
                </select>
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
                event: ({ event }) => (
                  <div className="text-xs p-1">
                    <div className="font-medium truncate">{event.title}</div>
                    {event.resource && (event.resource as any).employeeName && (
                      <div className="text-xs opacity-75 truncate">
                        {(event.resource as any).employeeName}
                      </div>
                    )}
                  </div>
                ),
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


