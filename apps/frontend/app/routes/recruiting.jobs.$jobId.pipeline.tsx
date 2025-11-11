import * as React from "react";
import type { Route } from "./+types/recruiting.jobs.$jobId.pipeline";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { supabase } from "~/lib/supabase";
import { ArrowLeft } from "lucide-react";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant_id");
  if (!tenantId) {
    throw new Response("tenant_id is required", { status: 400 });
  }

  // Fetch job details
  const jobRes = await fetch(`${backendUrl}/api/jobs/${tenantId}/${params.jobId}`, {
    headers: { Authorization: `Bearer ${session.data.session.access_token}` },
  });
  if (!jobRes.ok) throw new Response("Failed to fetch job", { status: jobRes.status });
  const job = await jobRes.json();

  // Fetch candidates for this job
  const candidatesRes = await fetch(
    `${backendUrl}/api/candidates?tenant_id=${tenantId}&job_id=${params.jobId}`,
    {
      headers: { Authorization: `Bearer ${session.data.session.access_token}` },
    }
  );
  const candidates = candidatesRes.ok ? await candidatesRes.json() : { candidates: [] };

  // Fetch pipeline stages
  // Note: In a real implementation, you'd fetch stages from the database
  const stages = [
    { id: "1", name: "Applied", order_index: 1 },
    { id: "2", name: "Screening", order_index: 2 },
    { id: "3", name: "Interview", order_index: 3 },
    { id: "4", name: "Offer", order_index: 4 },
    { id: "5", name: "Hired", order_index: 5 },
    { id: "6", name: "Rejected", order_index: 6 },
  ];

  return { job, candidates: candidates.candidates || [], stages, tenantId };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Pipeline | Recruiting | Artemis" }];
}

export default function Pipeline({ loaderData }: Route.ComponentProps) {
  const { job, candidates, stages, tenantId } = loaderData;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/recruiting/jobs/${job.id}?tenant_id=${tenantId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{job.title} - Pipeline</h1>
          <p className="text-muted-foreground">{candidates.length} candidates</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageCandidates = candidates.filter((c: any) => c.current_stage === stage.id);
          return (
            <Card key={stage.id} className="min-w-[300px] flex-shrink-0">
              <CardHeader>
                <CardTitle className="text-sm">
                  {stage.name} ({stageCandidates.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stageCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No candidates</p>
                ) : (
                  stageCandidates.map((candidate: any) => (
                    <Card key={candidate.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-sm text-muted-foreground">{candidate.email}</div>
                      {candidate.match_score && (
                        <div className="text-xs text-muted-foreground mt-1">Match: {candidate.match_score}%</div>
                      )}
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-muted-foreground text-sm">
        <p>Drag and drop functionality will be implemented in the next phase</p>
      </div>
    </div>
  );
}
