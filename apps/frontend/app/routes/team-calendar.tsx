import * as React from "react";
import type { Route } from "./+types/team-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { CalendarEvent, CalendarResponse } from "@vibe/shared";
import { supabase } from "~/lib/supabase";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
} from "react-big-calendar";
import type { View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
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

        const res = await fetch(
          `${apiBaseUrl}/api/calendar?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = (await res.json().catch(() => ({}))) as Partial<CalendarResponse> & { error?: string };
        if (!res.ok) throw new Error(payload.error || res.statusText);
        const list = (payload.events ?? []) as CalendarEvent[];
        if (cancelled) return;
        setEvents(
          list.map((ev) => ({
            id: ev.id,
            title: ev.kind === "time_off" ? (ev.leaveType ? `Time Off (${ev.leaveType})` : "Time Off") : "Worked Time",
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
  }, [apiBaseUrl, date, view]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/60 bg-muted/40">
        <CardHeader>
          <CardTitle>Team Calendar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
              style={{ height: '100%' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


