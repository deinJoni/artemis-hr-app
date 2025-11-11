import * as React from "react";
import type { Route } from "./+types/office-locations";
import { 
  Plus, 
  MapPin, 
  Edit, 
  Trash2, 
  Loader2,
  RefreshCw,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  OfficeLocationListResponseSchema,
  type OfficeLocation,
} from "@vibe/shared";

type OfficeLocationState = {
  status: "idle" | "loading" | "ready" | "error";
  locations: OfficeLocation[];
  error: string | null;
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

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Office Locations | Artemis" },
    { name: "description", content: "Manage office locations and time zones" },
  ];
}

export default function OfficeLocations({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [state, setState] = React.useState<OfficeLocationState>({ 
    status: "idle", 
    locations: [], 
    error: null 
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [editingLocation, setEditingLocation] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<{ 
    name: string; 
    address: string; 
    timezone: string;
  }>({
    name: "",
    address: "",
    timezone: "UTC",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadLocations = React.useCallback(async () => {
    setState(prev => ({ ...prev, status: "loading" }));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const locationsRes = await fetch(`${apiBaseUrl}/api/office-locations/${tenantJson.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const locationsJson = await locationsRes.json();
      if (!locationsRes.ok) {
        throw new Error(locationsJson.error || "Unable to load office locations");
      }

      const locationsParsed = OfficeLocationListResponseSchema.safeParse(locationsJson);
      if (!locationsParsed.success) {
        throw new Error("Unexpected locations response shape");
      }

      setState({
        status: "ready",
        locations: locationsParsed.data.locations || [],
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load office locations";
      setState(prev => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const handleSaveLocation = async () => {
    if (!editForm.name.trim()) {
      setError("Location name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const addressObj = editForm.address.trim() 
        ? (() => {
            try {
              return JSON.parse(editForm.address);
            } catch {
              // If not valid JSON, create a simple object with the text
              return { address: editForm.address };
            }
          })()
        : null;

      const url = editingLocation === "new"
        ? `${apiBaseUrl}/api/office-locations/${tenantJson.id}`
        : `${apiBaseUrl}/api/office-locations/${tenantJson.id}/${editingLocation}`;
      
      const method = editingLocation === "new" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantJson.id,
          name: editForm.name.trim(),
          ...(addressObj ? { address: addressObj } : {}),
          timezone: editForm.timezone.trim() || "UTC",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `Failed to ${editingLocation === "new" ? "create" : "update"} location`);
      }

      setEditForm({ name: "", address: "", timezone: "UTC" });
      setEditingLocation(null);
      await loadLocations();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Failed to ${editingLocation === "new" ? "create" : "update"} location`;
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm("Are you sure you want to delete this office location? This action cannot be undone.")) {
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const response = await fetch(`${apiBaseUrl}/api/office-locations/${tenantJson.id}/${locationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to delete location");
      }

      await loadLocations();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete location";
      setError(message);
    }
  };

  const formatAddress = (address: Record<string, any> | null): string => {
    if (!address) return "No address";
    if (typeof address === "string") return address;
    if (address.address) return address.address;
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "No address";
  };

  const filteredLocations = React.useMemo(() => {
    if (!searchTerm.trim()) return state.locations;
    return state.locations.filter(loc =>
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatAddress(loc.address).toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.timezone.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.locations, searchTerm]);

  if (state.status === "error" && state.locations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-base text-muted-foreground">{state.error ?? "Unable to load office locations."}</p>
        <Button type="button" onClick={() => loadLocations()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold text-foreground">Office Locations</h1>
              <p className="text-base text-muted-foreground">Manage office locations and time zones</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadLocations()}
                disabled={state.status === "loading"}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", state.status === "loading" && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setEditingLocation("new");
                  setEditForm({ name: "", address: "", timezone: "UTC" });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
          {/* Locations List */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search locations..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {state.status === "loading" ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No locations found matching your search." : "No office locations yet. Create your first location to get started."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLocations.map(location => (
                    <div
                      key={location.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{location.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatAddress(location.address)}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{location.timezone}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLocation(location.id);
                            setEditForm({
                              name: location.name,
                              address: location.address ? JSON.stringify(location.address, null, 2) : "",
                              timezone: location.timezone,
                            });
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLocation(location.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Form */}
          {editingLocation && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingLocation === "new" ? "Create Location" : "Edit Location"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Office location name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={editForm.timezone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, timezone: e.target.value }))}
                      placeholder="UTC"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use IANA timezone names (e.g., America/New_York, Europe/London)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Address (JSON)</Label>
                    <Textarea
                      id="address"
                      value={editForm.address}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder='{"street": "123 Main St", "city": "New York", "state": "NY", "postal_code": "10001", "country": "USA"}'
                      rows={4}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Enter address as JSON object or plain text
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveLocation}
                      disabled={saving || !editForm.name.trim()}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {editingLocation === "new" ? "Create" : "Update"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingLocation(null);
                        setEditForm({ name: "", address: "", timezone: "UTC" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
