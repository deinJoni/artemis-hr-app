import * as React from "react";
import type { Route } from "./+types/news";
import { Megaphone, Plus, Loader2, ShieldCheck, CalendarClock, Trash2 } from "lucide-react";
import {
  CompanyNewsCategoryEnum,
  CompanyNewsStatusEnum,
  type CompanyNews,
  type CompanyNewsCategory,
  type CompanyNewsStatus,
} from "@vibe/shared";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { supabase } from "~/lib/supabase";
import { usePermission } from "~/lib/permissions";
import { useToast } from "~/components/toast";
import { cn } from "~/lib/utils";
import { useTranslation } from "~/lib/i18n";

type ComposerMode = "create" | "edit";
type DraftableStatus = Exclude<CompanyNewsStatus, "published">;

type ComposerState = {
  title: string;
  summary: string;
  body: string;
  category: CompanyNewsCategory;
  status: DraftableStatus;
  publishAt: string;
};

const DEFAULT_COMPOSER_STATE: ComposerState = {
  title: "",
  summary: "",
  body: "",
  category: "news",
  status: "draft",
  publishAt: "",
};

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
    { title: "Company News | Artemis" },
    {
      name: "description",
      content: "Publish internal news, mitteilungen, and announcements for your workspace.",
    },
  ];
}

export default function CompanyNewsRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [newsItems, setNewsItems] = React.useState<CompanyNews[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<CompanyNewsStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<CompanyNewsCategory | "all">("all");
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerMode, setComposerMode] = React.useState<ComposerMode>("create");
  const [composerState, setComposerState] = React.useState<ComposerState>(DEFAULT_COMPOSER_STATE);
  const [submitting, setSubmitting] = React.useState(false);
  const [activeNewsId, setActiveNewsId] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const {
    allowed: canManageNews,
    loading: checkingManage,
  } = usePermission("communications.news.manage", {
    tenantId,
    skip: !tenantId,
  });
  const {
    allowed: canPublishNews,
    loading: checkingPublish,
  } = usePermission("communications.news.publish", {
    tenantId,
    skip: !tenantId,
  });

  const loadingPermissions = checkingManage || checkingPublish;

  // Resolve tenant once
  React.useEffect(() => {
    let cancelled = false;
    async function resolveTenant() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.id) {
          throw new Error(
            typeof payload?.error === "string" ? payload.error : t("errors.unableToLoadWorkspace")
          );
        }
        if (!cancelled) {
          setTenantId(payload.id);
        }
      } catch (err) {
        if (!cancelled) {
          setTenantId(null);
          setError(err instanceof Error ? err.message : t("errors.unableToLoadWorkspace"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resolveTenant();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, t]);

  // Load news whenever filters or tenant change
  React.useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing access token");

        const params = new URLSearchParams();
        if (tenantId) params.set("tenantId", tenantId);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (categoryFilter !== "all") params.set("category", categoryFilter);

        const response = await fetch(`${apiBaseUrl}/api/news?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (typeof payload?.error === "string" && payload.error) || t("news.errors.loadFailed");
          throw new Error(message);
        }
        if (!cancelled) {
          setNewsItems(Array.isArray(payload.news) ? (payload.news as CompanyNews[]) : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("news.errors.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNews();
    return () => {
      cancelled = true;
    };
  }, [tenantId, statusFilter, categoryFilter, apiBaseUrl, refreshIndex, t]);

  const resetComposer = React.useCallback((mode: ComposerMode, current?: CompanyNews) => {
    setComposerMode(mode);
    if (mode === "edit" && current) {
      setComposerState({
        title: current.title,
        summary: current.summary ?? "",
        body: current.body,
        category: current.category,
        status: current.status as ComposerState["status"],
        publishAt: current.publish_at ?? "",
      });
      setActiveNewsId(current.id);
    } else {
      setComposerState(DEFAULT_COMPOSER_STATE);
      setActiveNewsId(null);
    }
  }, []);

  const handleComposerChange = <Key extends keyof ComposerState>(key: Key, value: ComposerState[Key]) => {
    setComposerState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = React.useCallback(async () => {
    if (!tenantId) return;
    if (!canManageNews) {
      toast.showToast(t("news.errors.noPermission"), "error");
      return;
    }
    if (!composerState.title.trim() || !composerState.body.trim()) {
      toast.showToast(t("news.errors.missingFields"), "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Missing access token");

      const payload = {
        tenantId,
        title: composerState.title.trim(),
        summary: composerState.summary.trim() || null,
        body: composerState.body.trim(),
        category: composerState.category,
        status: composerState.status,
        publishAt: composerState.publishAt ? new Date(composerState.publishAt).toISOString() : null,
      };

      const endpoint =
        composerMode === "create"
          ? `${apiBaseUrl}/api/news`
          : `${apiBaseUrl}/api/news/${activeNewsId}?tenantId=${tenantId}`;
      const method = composerMode === "create" ? "POST" : "PUT";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          composerMode === "create"
            ? payload
            : {
                title: payload.title,
                summary: payload.summary,
                body: payload.body,
                category: payload.category,
                status: payload.status,
                publishAt: payload.publishAt,
              }
        ),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (typeof result?.error === "string" && result.error) || t("news.errors.saveFailed");
        throw new Error(message);
      }

      toast.showToast(
        composerMode === "create" ? t("news.notifications.created") : t("news.notifications.updated"),
        "success"
      );
      setComposerOpen(false);
      setRefreshIndex((prev) => prev + 1);
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : t("news.errors.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    activeNewsId,
    apiBaseUrl,
    canManageNews,
    composerMode,
    composerState.body,
    composerState.category,
    composerState.publishAt,
    composerState.status,
    composerState.summary,
    composerState.title,
    t,
    tenantId,
    toast,
  ]);

  const handlePublish = React.useCallback(
    async (item: CompanyNews) => {
      if (!tenantId) return;
      if (!canPublishNews) {
        toast.showToast(t("news.errors.noPublishPermission"), "error");
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(
          `${apiBaseUrl}/api/news/${item.id}/publish?tenantId=${tenantId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ publishAt: item.publish_at }),
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (typeof payload?.error === "string" && payload.error) || t("news.errors.publishFailed");
          throw new Error(message);
        }

        toast.showToast(t("news.notifications.published"), "success");
        setRefreshIndex((prev) => prev + 1);
      } catch (err) {
        toast.showToast(err instanceof Error ? err.message : t("news.errors.publishFailed"), "error");
      }
    },
    [apiBaseUrl, canPublishNews, t, tenantId, toast]
  );

  const handleUnpublish = React.useCallback(
    async (item: CompanyNews) => {
      if (!tenantId) return;
      if (!canPublishNews) {
        toast.showToast(t("news.errors.noPublishPermission"), "error");
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(
          `${apiBaseUrl}/api/news/${item.id}/unpublish?tenantId=${tenantId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (typeof payload?.error === "string" && payload.error) || t("news.errors.unpublishFailed");
          throw new Error(message);
        }

        toast.showToast(t("news.notifications.unpublished"), "success");
        setRefreshIndex((prev) => prev + 1);
      } catch (err) {
        toast.showToast(
          err instanceof Error ? err.message : t("news.errors.unpublishFailed"),
          "error"
        );
      }
    },
    [apiBaseUrl, canPublishNews, t, tenantId, toast]
  );

  const handleDelete = React.useCallback(
    async (item: CompanyNews) => {
      if (!tenantId || !canManageNews) return;
      const confirmed = window.confirm(t("news.confirmations.deleteMessage"));
      if (!confirmed) return;

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(
          `${apiBaseUrl}/api/news/${item.id}?tenantId=${tenantId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (typeof payload?.error === "string" && payload.error) || t("news.errors.deleteFailed");
          throw new Error(message);
        }

        toast.showToast(t("news.notifications.deleted"), "success");
        setRefreshIndex((prev) => prev + 1);
      } catch (err) {
        toast.showToast(err instanceof Error ? err.message : t("news.errors.deleteFailed"), "error");
      }
    },
    [apiBaseUrl, canManageNews, t, tenantId, toast]
  );

  const openCreateComposer = React.useCallback(() => {
    resetComposer("create");
    setComposerOpen(true);
  }, [resetComposer]);

  const openEditComposer = React.useCallback(
    (item: CompanyNews) => {
      resetComposer("edit", item);
      setComposerOpen(true);
    },
    [resetComposer]
  );

  const filteredNews = React.useMemo(() => {
    if (statusFilter === "all" && categoryFilter === "all") return newsItems;
    return newsItems.filter((item) => {
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;
      return matchesStatus && matchesCategory;
    });
  }, [categoryFilter, newsItems, statusFilter]);

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "scheduled":
        return "outline";
      case "published":
        return "default";
      case "archived":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const categoryLabel = (category: string) => t(`news.categories.${category}`);
  const statusLabel = (status: string) => t(`news.status.${status}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t("news.pageTitle")}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {t("news.pageSubtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("news.filters.status")}</p>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as CompanyNewsStatus | "all")}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("news.statusFilters.all")}</SelectItem>
                  {CompanyNewsStatusEnum.options.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("news.filters.category")}
              </p>
              <Select
                value={categoryFilter}
                onValueChange={(value) =>
                  setCategoryFilter(value as CompanyNewsCategory | "all")
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("news.categories.all")}</SelectItem>
                  {CompanyNewsCategoryEnum.options.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="secondary"
              className={cn(
                "gap-1",
                !canManageNews && "border-border text-muted-foreground"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {canManageNews ? t("news.permissions.canManage") : t("news.permissions.viewOnly")}
            </Badge>
            {canManageNews ? (
              <Button onClick={openCreateComposer} disabled={loadingPermissions}>
                <Plus className="mr-2 h-4 w-4" />
                {t("news.actions.newAnnouncement")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("news.states.loading")}</span>
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-destructive">{error}</div>
          ) : filteredNews.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/60" />
              <h3 className="mt-4 text-lg font-medium">{t("news.states.emptyTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("news.states.emptyDescription")}</p>
              {canManageNews ? (
                <Button className="mt-6" onClick={openCreateComposer}>
                  {t("news.actions.newAnnouncement")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNews.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant(item.status)}>{statusLabel(item.status)}</Badge>
                      <Badge variant="outline">{categoryLabel(item.category)}</Badge>
                      {item.publish_at ? (
                        <div className="inline-flex items-center rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                          <CalendarClock className="mr-1 h-3 w-3" />
                          {new Date(item.publish_at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    {item.summary ? (
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canManageNews ? (
                      <Button variant="outline" size="sm" onClick={() => openEditComposer(item)}>
                        {t("news.actions.edit")}
                      </Button>
                    ) : null}
                    {canPublishNews && item.status !== "published" ? (
                      <Button size="sm" onClick={() => handlePublish(item)}>
                        {t("news.actions.publish")}
                      </Button>
                    ) : null}
                    {canPublishNews && item.status === "published" ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnpublish(item)}>
                        {t("news.actions.unpublish")}
                      </Button>
                    ) : null}
                    {canManageNews ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t("news.actions.delete")}</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) {
            setActiveNewsId(null);
            setComposerState(DEFAULT_COMPOSER_STATE);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {composerMode === "create" ? t("news.composer.createTitle") : t("news.composer.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {composerMode === "create"
                ? t("news.composer.createDescription")
                : t("news.composer.editDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="news-title">{t("news.fields.title")}</Label>
              <Input
                id="news-title"
                value={composerState.title}
                maxLength={180}
                onChange={(event) => handleComposerChange("title", event.target.value)}
                placeholder={t("news.placeholders.title")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-summary">{t("news.fields.summary")}</Label>
              <Textarea
                id="news-summary"
                value={composerState.summary}
                maxLength={500}
                onChange={(event) => handleComposerChange("summary", event.target.value)}
                placeholder={t("news.placeholders.summary")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-body">{t("news.fields.body")}</Label>
              <Textarea
                id="news-body"
                value={composerState.body}
                rows={8}
                onChange={(event) => handleComposerChange("body", event.target.value)}
                placeholder={t("news.placeholders.body")}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("news.fields.category")}</Label>
                <Select
                  value={composerState.category}
                  onValueChange={(value) =>
                    handleComposerChange("category", value as CompanyNewsCategory)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CompanyNewsCategoryEnum.options.map((category) => (
                      <SelectItem key={category} value={category}>
                        {categoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("news.fields.status")}</Label>
                <Select
                  value={composerState.status}
                  onValueChange={(value) => handleComposerChange("status", value as DraftableStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CompanyNewsStatusEnum.options
                      .filter((status): status is DraftableStatus => status !== "published")
                      .map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="news-publish-at">{t("news.fields.publishAt")}</Label>
                <Input
                  id="news-publish-at"
                  type="datetime-local"
                  value={composerState.publishAt}
                  onChange={(event) => handleComposerChange("publishAt", event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("news.help.publishWindow")}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {composerMode === "create" ? t("news.actions.saveDraft") : t("news.actions.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
