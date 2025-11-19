import * as React from "react";
import type { Route } from "./+types/profile";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Phone,
  ShieldCheck,
  UserCheck2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { useToast } from "~/components/toast";
import { useApiContext } from "~/lib/api-context";
import {
  SelfServiceProfileResponseSchema,
  type SelfServiceProfileResponse,
  type SelfServiceProfileFields,
} from "@vibe/shared";

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
    { title: "My Profile | Artemis" },
    { name: "description", content: "Review and update your personal contact information." },
  ];
}

type AddressFormState = {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type FormState = {
  phone_personal: string;
  phone_work: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  home_address: AddressFormState;
};

const EMPTY_ADDRESS: AddressFormState = {
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

const EMPTY_FORM: FormState = {
  phone_personal: "",
  phone_work: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  home_address: EMPTY_ADDRESS,
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function SelfServiceProfile({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const { session } = useApiContext();
  const toast = useToast();

  const [profile, setProfile] = React.useState<SelfServiceProfileResponse | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [justification, setJustification] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/self-service/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(json?.error || "Unable to load profile");
        }
        const parsed = SelfServiceProfileResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error("Unexpected response shape");
        }
        setProfile(parsed.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, session?.access_token]);

  React.useEffect(() => {
    if (!profile) return;
    const sourceFields: SelfServiceProfileFields =
      profile.request && (profile.request.status === "draft" || profile.request.status === "pending")
        ? profile.request.fields
        : {
            phone_personal: profile.employee.phone_personal,
            phone_work: profile.employee.phone_work,
            emergency_contact_name: profile.employee.emergency_contact_name,
            emergency_contact_phone: profile.employee.emergency_contact_phone,
            home_address: profile.employee.home_address,
          };

    const nextAddress: AddressFormState = {
      street: sourceFields.home_address?.street ?? "",
      city: sourceFields.home_address?.city ?? "",
      state: sourceFields.home_address?.state ?? "",
      postal_code: sourceFields.home_address?.postal_code ?? "",
      country: sourceFields.home_address?.country ?? "",
    };

    setForm({
      phone_personal: sourceFields.phone_personal ?? "",
      phone_work: sourceFields.phone_work ?? "",
      emergency_contact_name: sourceFields.emergency_contact_name ?? "",
      emergency_contact_phone: sourceFields.emergency_contact_phone ?? "",
      home_address: nextAddress,
    });
    setJustification(profile.request?.justification ?? "");
  }, [profile]);

  const officialFields = React.useMemo(() => {
    if (!profile) return EMPTY_FORM;
    return {
      phone_personal: profile.employee.phone_personal ?? "",
      phone_work: profile.employee.phone_work ?? "",
      emergency_contact_name: profile.employee.emergency_contact_name ?? "",
      emergency_contact_phone: profile.employee.emergency_contact_phone ?? "",
      home_address: {
        street: profile.employee.home_address?.street ?? "",
        city: profile.employee.home_address?.city ?? "",
        state: profile.employee.home_address?.state ?? "",
        postal_code: profile.employee.home_address?.postal_code ?? "",
        country: profile.employee.home_address?.country ?? "",
      },
    };
  }, [profile]);

  const addressHasValues = React.useMemo(() => {
    return Object.values(form.home_address).some((value) => value.trim().length > 0);
  }, [form.home_address]);

  const hasChanges = React.useMemo(() => {
    if (!profile) return false;
    const compareAddress = (a: AddressFormState, b: AddressFormState) => {
      return (
        a.street === b.street &&
        a.city === b.city &&
        a.state === b.state &&
        a.postal_code === b.postal_code &&
        a.country === b.country
      );
    };
    const normalizedOfficial = officialFields;
    return (
      form.phone_personal !== normalizedOfficial.phone_personal ||
      form.phone_work !== normalizedOfficial.phone_work ||
      form.emergency_contact_name !== normalizedOfficial.emergency_contact_name ||
      form.emergency_contact_phone !== normalizedOfficial.emergency_contact_phone ||
      !compareAddress(form.home_address, normalizedOfficial.home_address)
    );
  }, [form, officialFields, profile]);

  const buildPayload = React.useCallback(() => {
    const normalizeString = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    };

    const addressPayload = addressHasValues
      ? Object.fromEntries(
          Object.entries(form.home_address).map(([key, value]) => [key, normalizeString(value) ?? undefined])
        )
      : null;

    return {
      fields: {
        phone_personal: normalizeString(form.phone_personal),
        phone_work: normalizeString(form.phone_work),
        emergency_contact_name: normalizeString(form.emergency_contact_name),
        emergency_contact_phone: normalizeString(form.emergency_contact_phone),
        home_address: addressPayload,
      },
      justification: normalizeString(justification),
    };
  }, [addressHasValues, form, justification]);

  const mutateProfile = React.useCallback(
    async (action: "draft" | "submit") => {
      if (!session?.access_token) {
        throw new Error("Missing access token");
      }
      const response = await fetch(`${apiBaseUrl}/api/self-service/profile/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload()),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Unable to process request");
      }
      const parsed = SelfServiceProfileResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Unexpected response shape");
      }
      setProfile(parsed.data);
    },
    [apiBaseUrl, buildPayload, session?.access_token]
  );

  const handleSaveDraft = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await mutateProfile("draft");
      toast.showToast("Draft saved", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save draft");
    } finally {
      setSaving(false);
    }
  }, [mutateProfile, toast]);

  const handleSubmit = React.useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await mutateProfile("submit");
      toast.showToast("Request submitted for approval", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to submit request");
    } finally {
      setSubmitting(false);
    }
  }, [mutateProfile, toast]);

  const disabledDueToPending = profile?.request?.status === "pending";
  const requestStatus = profile?.request?.status ?? null;

  let statusBanner: React.ReactNode = null;
  if (requestStatus === "pending") {
    statusBanner = (
      <div className="flex items-center gap-3 rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-amber-900">
        <Clock className="h-4 w-4" />
        <span>Pending manager approval since {formatDateTime(profile?.request?.submitted_at)}</span>
      </div>
    );
  } else if (requestStatus === "approved") {
    statusBanner = (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/80 px-4 py-3 text-emerald-900">
        <CheckCircle2 className="h-4 w-4" />
        <span>Changes approved {formatDateTime(profile?.request?.decided_at)}</span>
      </div>
    );
  } else if (requestStatus === "denied") {
    statusBanner = (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <div>
          <p className="font-medium">Request denied</p>
          {profile?.request?.decision_reason ? (
            <p className="text-sm">{profile.request.decision_reason}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container mx-auto space-y-4 py-8">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const officialAddress = officialFields.home_address;
  const officialAddressString =
    Object.values(officialAddress)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(", ") || "No address on file";

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          Update your personal contact details. We’ll route changes to your manager for approval.
        </p>
      </div>

      {statusBanner}

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only HR and your manager can see changes until they are approved.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Personal phone</Label>
                <Input
                  type="tel"
                  value={form.phone_personal}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone_personal: event.target.value }))
                  }
                  disabled={disabledDueToPending}
                  placeholder="+49 ..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Work phone</Label>
                <Input
                  type="tel"
                  value={form.phone_work}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone_work: event.target.value }))
                  }
                  disabled={disabledDueToPending}
                  placeholder="+49 ..."
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Emergency contact</Label>
                <Input
                  value={form.emergency_contact_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, emergency_contact_name: event.target.value }))
                  }
                  disabled={disabledDueToPending}
                  placeholder="Name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Emergency phone</Label>
                <Input
                  type="tel"
                  value={form.emergency_contact_phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, emergency_contact_phone: event.target.value }))
                  }
                  disabled={disabledDueToPending}
                  placeholder="+49 ..."
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" /> Home address
                </p>
                <p className="text-sm text-muted-foreground">
                  Provide your current residential address for payroll and emergency notifications.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Street</Label>
                  <Input
                    value={form.home_address.street}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        home_address: { ...prev.home_address, street: event.target.value },
                      }))
                    }
                    disabled={disabledDueToPending}
                    placeholder="Street and number"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Postal code</Label>
                  <Input
                    value={form.home_address.postal_code}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        home_address: { ...prev.home_address, postal_code: event.target.value },
                      }))
                    }
                    disabled={disabledDueToPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">City</Label>
                  <Input
                    value={form.home_address.city}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        home_address: { ...prev.home_address, city: event.target.value },
                      }))
                    }
                    disabled={disabledDueToPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">State</Label>
                  <Input
                    value={form.home_address.state}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        home_address: { ...prev.home_address, state: event.target.value },
                      }))
                    }
                    disabled={disabledDueToPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Country</Label>
                  <Input
                    value={form.home_address.country}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        home_address: { ...prev.home_address, country: event.target.value },
                      }))
                    }
                    disabled={disabledDueToPending}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">
                Why are you updating these fields?
              </Label>
              <Textarea
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                disabled={disabledDueToPending}
                placeholder="Provide context for your manager"
                className="min-h-[120px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleSaveDraft}
                disabled={disabledDueToPending || saving || submitting || !hasChanges}
                type="button"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save draft
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={disabledDueToPending || submitting || !hasChanges}
                type="button"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit for approval
              </Button>
              {!hasChanges && !disabledDueToPending ? (
                <p className="text-sm text-muted-foreground">Make a change to enable actions.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current state</span>
                <Badge variant="secondary" className="capitalize">
                  {requestStatus ?? "not submitted"}
                </Badge>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Last submitted</p>
                <p className="font-medium">
                  {formatDateTime(profile.request?.submitted_at ?? profile.request?.updated_at)}
                </p>
              </div>
              {profile.request?.decision_reason ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Manager notes</p>
                  <p>{profile.request.decision_reason}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Official profile snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{officialFields.phone_personal || "No personal phone on file"}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {officialFields.emergency_contact_name || "No emergency contact"} •{" "}
                  {officialFields.emergency_contact_phone || "—"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{officialAddressString}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Need help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Only HR and your manager can see your request.</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>Contact People Ops if you need to change additional fields.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
