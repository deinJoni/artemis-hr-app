import * as React from "react";
import type { Route } from "./+types/recruiting.jobs.new";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { JobCreateInputSchema } from "@vibe/shared";
import { useToast } from "~/components/toast";
import { Loader2 } from "lucide-react";
import { getAuthToken } from "~/lib/get-auth-token";
import { supabase } from "~/lib/supabase";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export async function loader({ request }: Route.LoaderArgs) {
  const token = await getAuthToken(request);
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  let tenantId = url.searchParams.get("tenant_id");

  if (!tenantId) {
    const tenantRes = await fetch(`${backendUrl}/api/tenants/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!tenantRes.ok) {
      throw new Response("Unable to resolve tenant", { status: tenantRes.status });
    }
    const tenantJson = (await tenantRes.json().catch(() => ({}))) as { id?: string };
    if (typeof tenantJson.id !== "string") {
      throw new Response("Unable to resolve tenant", { status: 400 });
    }
    tenantId = tenantJson.id;
  }

  // Fetch departments and locations for dropdowns
  const [deptsRes, locsRes] = await Promise.all([
    fetch(`${backendUrl}/api/departments?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${backendUrl}/api/office-locations?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const departmentsJson = deptsRes.ok ? await deptsRes.json().catch(() => ({})) : {};
  const locationsJson = locsRes.ok ? await locsRes.json().catch(() => ({})) : {};

  return {
    tenantId,
    departments: Array.isArray(departmentsJson.departments) ? departmentsJson.departments : [],
    locations: Array.isArray(locationsJson.locations) ? locationsJson.locations : [],
  };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create Job | Recruiting | Artemis" }];
}

export default function CreateJob({ loaderData }: Route.ComponentProps) {
  const { tenantId, departments, locations } = loaderData;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    department_id: "",
    location_id: "",
    description: "",
    employment_type: "",
    work_location: "",
    salary_min: "",
    salary_max: "",
    salary_currency: "USD",
    salary_hidden: false,
    application_deadline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error("Not authenticated");
      }

      const input = JobCreateInputSchema.parse({
        tenant_id: tenantId,
        title: formData.title,
        department_id: formData.department_id || null,
        location_id: formData.location_id || null,
        description: formData.description,
        employment_type: formData.employment_type || null,
        work_location: formData.work_location || null,
        salary_min: formData.salary_min ? parseFloat(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseFloat(formData.salary_max) : null,
        salary_currency: formData.salary_currency,
        salary_hidden: formData.salary_hidden,
        application_deadline: formData.application_deadline || null,
      });

      const response = await fetch(`${backendUrl}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create job");
      }

      const job = await response.json();
      showToast("Job created successfully", "success");
      navigate(`/recruiting/jobs/${job.id}?tenant_id=${tenantId}`);
    } catch (error: any) {
      showToast(error.message || "Failed to create job", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Create New Job</CardTitle>
          <CardDescription>Fill in the details to create a new job posting</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={formData.department_id} onValueChange={(v) => setFormData({ ...formData, department_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={formData.location_id} onValueChange={(v) => setFormData({ ...formData, location_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Job Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={8}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employment_type">Employment Type</Label>
                <Select
                  value={formData.employment_type}
                  onValueChange={(v) => setFormData({ ...formData, employment_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_location">Work Location</Label>
                <Select value={formData.work_location} onValueChange={(v) => setFormData({ ...formData, work_location: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="on_site">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary_min">Salary Min</Label>
                <Input
                  id="salary_min"
                  type="number"
                  value={formData.salary_min}
                  onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary_max">Salary Max</Label>
                <Input
                  id="salary_max"
                  type="number"
                  value={formData.salary_max}
                  onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary_currency">Currency</Label>
                <Select
                  value={formData.salary_currency}
                  onValueChange={(v) => setFormData({ ...formData, salary_currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="application_deadline">Application Deadline</Label>
              <Input
                id="application_deadline"
                type="date"
                value={formData.application_deadline}
                onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Job
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
