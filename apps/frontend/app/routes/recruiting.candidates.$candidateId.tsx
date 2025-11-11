import * as React from "react";
import type { Route } from "./+types/recruiting.candidates.$candidateId";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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

  const response = await fetch(`${backendUrl}/api/candidates/${tenantId}/${params.candidateId}`, {
    headers: {
      Authorization: `Bearer ${session.data.session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Response("Failed to fetch candidate", { status: response.status });
  }

  const candidate = await response.json();
  return { candidate, tenantId };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Candidate Details | Recruiting | Artemis" }];
}

export default function CandidateDetail({ loaderData }: Route.ComponentProps) {
  const { candidate, tenantId } = loaderData;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/recruiting/jobs?tenant_id=${tenantId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{candidate.name}</h1>
          <p className="text-muted-foreground">{candidate.email}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Email: </span>
                {candidate.email}
              </div>
              {candidate.phone && (
                <div>
                  <span className="font-medium">Phone: </span>
                  {candidate.phone}
                </div>
              )}
              {candidate.linkedin_url && (
                <div>
                  <span className="font-medium">LinkedIn: </span>
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                    {candidate.linkedin_url}
                  </a>
                </div>
              )}
              {candidate.portfolio_url && (
                <div>
                  <span className="font-medium">Portfolio: </span>
                  <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                    {candidate.portfolio_url}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {candidate.cover_letter && (
            <Card>
              <CardHeader>
                <CardTitle>Cover Letter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap">{candidate.cover_letter}</div>
              </CardContent>
            </Card>
          )}

          {candidate.resume_url && (
            <Card>
              <CardHeader>
                <CardTitle>Resume</CardTitle>
              </CardHeader>
              <CardContent>
                <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                  View Resume
                </a>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {candidate.applications && candidate.applications.length > 0 ? (
            candidate.applications.map((app: any) => (
              <Card key={app.id}>
                <CardHeader>
                  <CardTitle>{app.job_title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Status: </span>
                      {app.status}
                    </div>
                    {app.match_score && (
                      <div>
                        <span className="font-medium">Match Score: </span>
                        {app.match_score}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No applications found</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Communications will be displayed here
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
