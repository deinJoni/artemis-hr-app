import * as React from "react";
import type { Route } from "./+types/time.entries";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Download, Plus, RefreshCw } from "lucide-react";
import { TimeEntriesTable } from "~/components/time/time-entries-table";
import { ManualEntryDialog } from "~/components/time/manual-entry-dialog";
import type { TimeEntry, TimeEntryListQuery, TimeEntryListResponse } from "@vibe/shared";
import type { Session } from "@supabase/supabase-js";
import { useToast } from "~/components/toast";
import { supabase } from "~/lib/supabase";
import { useTranslation } from "~/lib/i18n";

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
    { title: "Time Entries - Artemis" },
    { name: "description", content: "View and manage your time entries" },
  ];
}

export default function TimeEntries({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" });
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [entries, setEntries] = React.useState<TimeEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<TimeEntryListQuery>({
    page: 1,
    page_size: 20,
  });
  const [pagination, setPagination] = React.useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  const [session, setSession] = React.useState<Session | null>(null);
  const [editingEntry, setEditingEntry] = React.useState<TimeEntry | null>(null);

  const loadEntries = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      setSession(authSession);

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(`${key}[]`, v));
          } else {
            params.append(key, String(value));
          }
        }
      });

      const res = await fetch(`${apiBaseUrl}/api/time/entries?${params}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });

      const data: TimeEntryListResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || res.statusText);

      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errors.unableToLoad"));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleFiltersChange = (newFilters: Partial<TimeEntryListQuery>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleEdit = async (entry: TimeEntry) => {
    setEditingEntry(entry);
  };

  const handleEditSuccess = () => {
    setEditingEntry(null);
      toast.showToast(t("time.entryUpdated"), "success");
    void loadEntries();
  };

  const handleEditDialogClose = () => {
    setEditingEntry(null);
  };

  const handleDelete = async (entry: TimeEntry) => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      setSession(authSession);

      const res = await fetch(`${apiBaseUrl}/api/time/entries/${entry.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || res.statusText);
      }

      // Optimistic update
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      toast.showToast(t("time.entryDeleted"), "success", {
        action: {
          label: t("common.back"),
          onClick: async () => {
            // Would need to restore entry here if undo supported
            await loadEntries();
          },
        },
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : t("errors.unableToDelete");
      setError(errorMessage);
      toast.showToast(errorMessage, "error");
      await loadEntries(); // Reload on error
    }
  };

  const handleRefresh = () => {
    void loadEntries();
  };

  const handleExport = React.useCallback(async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Not authenticated");
      }

      setSession(authSession);

      const today = new Date();
      const endDate = filters.end_date ?? today.toISOString().split("T")[0];
      const startDate =
        filters.start_date ??
        new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

      const params = new URLSearchParams({
        format: "csv",
        start_date: startDate,
        end_date: endDate,
        include_breaks: "true",
        include_notes: "true",
      });

      if (filters.user_id) {
        params.append("user_ids[]", filters.user_id);
      }

      const res = await fetch(`${apiBaseUrl}/api/time/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || res.statusText);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `time-entries-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errors.unableToLoad"));
    }
  }, [apiBaseUrl, filters, setError]);

  const handleSuccess = () => {
      toast.showToast(t("time.entryCreated"), "success");
    void loadEntries();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("time.entries")}</h1>
          <p className="text-muted-foreground">
            {t("time.entries")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={() => void handleExport()} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            {t("common.export")} CSV
          </Button>
          <ManualEntryDialog apiBaseUrl={apiBaseUrl} session={session} onSuccess={handleSuccess}>
            <Button disabled={!session}>
              <Plus className="h-4 w-4 mr-2" />
              {t("time.manualEntry")}
            </Button>
          </ManualEntryDialog>
          {editingEntry && (
            <ManualEntryDialog
              apiBaseUrl={apiBaseUrl}
              session={session}
              entry={editingEntry}
              open={Boolean(editingEntry)}
              onOpenChange={(open) => {
                if (!open) {
                  handleEditDialogClose();
                }
              }}
              onSuccess={handleEditSuccess}
            >
              <button type="button" style={{ display: "none" }} />
            </ManualEntryDialog>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("time.entries")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntriesTable
            entries={entries}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </CardContent>
      </Card>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("common.showing")} {((pagination.page - 1) * pagination.page_size) + 1} {t("common.of")} {Math.min(pagination.page * pagination.page_size, pagination.total)} {t("common.of")} {pagination.total} {t("time.entries")}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange({ page: pagination.page - 1 })}
              disabled={pagination.page <= 1}
            >
              {t("common.previous")}
            </Button>
            <span className="text-sm">
              {t("common.page")} {pagination.page} {t("common.of")} {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange({ page: pagination.page + 1 })}
              disabled={pagination.page >= pagination.total_pages}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
