import * as React from "react";
import type { Route } from "./+types/recruiting.jobs";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Plus, Search, Eye } from "lucide-react";
import { Input } from "~/components/ui/input";
import type { JobListResponse } from "@vibe/shared";
import { getAuthToken } from "~/lib/get-auth-token";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export async function loader({ request }: Route.LoaderArgs) {
  const token = await getAuthToken(request);
  if (!token) {
    console.error("Recruiting jobs loader: No access token found");
    throw new Response("Unauthorized", { status: 401 });
  }

  // Get tenant ID from API
  const tenantRes = await fetch(`${backendUrl}/api/tenants/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!tenantRes.ok) {
    throw new Response("Unable to resolve tenant", { status: 400 });
  }
  const tenantData = await tenantRes.json();
  const tenantId = tenantData.id;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const params = new URLSearchParams({ tenant_id: tenantId });
  if (status) params.append("status", status);
  if (search) params.append("search", search);

  const response = await fetch(`${backendUrl}/api/jobs?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("Failed to fetch jobs:", response.status, errorText);
    throw new Response(`Failed to fetch jobs: ${errorText}`, { status: response.status });
  }

  const data: JobListResponse = await response.json();
  return { jobs: data.jobs, total: data.total, tenantId };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Jobs | Recruiting | Artemis" }];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  pending_approval: "bg-yellow-500",
  active: "bg-green-500",
  paused: "bg-orange-500",
  filled: "bg-blue-500",
  closed: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  active: "Active",
  paused: "Paused",
  filled: "Filled",
  closed: "Closed",
};

export default function RecruitingJobs({ loaderData }: Route.ComponentProps) {
  const { jobs, tenantId } = loaderData;
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filteredJobs = React.useMemo(() => {
    let filtered = jobs;
    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.job_id.toLowerCase().includes(searchLower)
      );
    }
    return filtered;
  }, [jobs, statusFilter, search]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">Manage job postings and track applications</p>
        </div>
        <Link to={`/recruiting/jobs/new?tenant_id=${tenantId}`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Postings</CardTitle>
          <CardDescription>
            {filteredJobs.length} of {jobs.length} jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {["all", "draft", "pending_approval", "active", "paused", "filled", "closed"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All" : statusLabels[s]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No jobs found</p>
                <Link to={`/recruiting/jobs/new?tenant_id=${tenantId}`}>
                  <Button variant="outline" className="mt-4">
                    Create your first job
                  </Button>
                </Link>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{job.title}</h3>
                          <Badge className={statusColors[job.status]}>{statusLabels[job.status]}</Badge>
                          <span className="text-sm text-muted-foreground">#{job.job_id}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{job.description}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {job.employment_type && (
                            <span className="capitalize">{job.employment_type.replace("_", " ")}</span>
                          )}
                          {job.work_location && (
                            <span className="capitalize">{job.work_location.replace("_", " ")}</span>
                          )}
                          {job.salary_min && job.salary_max && (
                            <span>
                              ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/recruiting/jobs/${job.id}?tenant_id=${tenantId}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link to={`/recruiting/jobs/${job.id}/pipeline?tenant_id=${tenantId}`}>
                          <Button variant="outline" size="sm">
                            Pipeline
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
