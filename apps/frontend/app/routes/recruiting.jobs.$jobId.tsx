import * as React from "react";
import type { Route } from "./+types/recruiting.jobs.$jobId";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { getAuthToken } from "~/lib/get-auth-token";
import type { JobDetailResponse } from "@vibe/shared";
import { ArrowLeft, Eye } from "lucide-react";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export async function loader({ params, request }: Route.LoaderArgs) {
  const token = await getAuthToken(request);
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant_id");
  if (!tenantId) {
    throw new Response("tenant_id is required", { status: 400 });
  }

  const response = await fetch(`${backendUrl}/api/jobs/${tenantId}/${params.jobId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Response("Failed to fetch job", { status: response.status });
  }

  const job: JobDetailResponse = await response.json();
  return { job, tenantId };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Job Details | Recruiting | Artemis" }];
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

export default function JobDetail({ loaderData }: Route.ComponentProps) {
  const { job, tenantId } = loaderData;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/recruiting/jobs?tenant_id=${tenantId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">{job.title}</h1>
            <Badge className={statusColors[job.status]}>{statusLabels[job.status]}</Badge>
            <span className="text-sm text-muted-foreground">#{job.job_id}</span>
          </div>
          <p className="text-muted-foreground">
            {job.department_name && <span>{job.department_name}</span>}
            {job.location_name && <span className="ml-2">{job.location_name}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/recruiting/jobs/${job.id}/pipeline?tenant_id=${tenantId}`}>
            <Button>
              <Eye className="h-4 w-4 mr-2" />
              View Pipeline
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{job.application_count}</div>
            <p className="text-sm text-muted-foreground">Total applications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Postings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{job.postings.length}</div>
            <p className="text-sm text-muted-foreground">Active channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusColors[job.status]}>{statusLabels[job.status]}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">{job.description}</div>
        </CardContent>
      </Card>

      {job.salary_min && job.salary_max && (
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {job.salary_currency} {job.salary_min.toLocaleString()} - {job.salary_max.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
