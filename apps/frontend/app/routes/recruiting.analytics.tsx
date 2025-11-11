import * as React from "react";
import type { Route } from "./+types/recruiting.analytics";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getAuthToken } from "~/lib/get-auth-token";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export async function loader({ request }: Route.LoaderArgs) {
  const token = await getAuthToken(request);
  if (!token) {
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

  const [funnelRes, sourcesRes] = await Promise.all([
    fetch(`${backendUrl}/api/recruiting/analytics/funnel?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${backendUrl}/api/recruiting/analytics/sources?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  const funnel = funnelRes.ok ? await funnelRes.json() : {};
  const sources = sourcesRes.ok ? await sourcesRes.json() : {};

  return { funnel, sources, tenantId };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Analytics | Recruiting | Artemis" }];
}

export default function RecruitingAnalytics({ loaderData }: Route.ComponentProps) {
  const { funnel, sources } = loaderData;

  const totalApplications = Object.values(funnel).reduce((sum: number, val: any) => sum + val, 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recruiting Analytics</h1>
        <p className="text-muted-foreground">Track your recruiting performance</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalApplications}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Screening</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{funnel.screening || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Interview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{funnel.interview || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{funnel.hired || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(funnel).map(([stage, count]: [string, any]) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="capitalize">{stage.replace("_", " ")}</span>
                <div className="flex items-center gap-4">
                  <div className="w-64 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${totalApplications > 0 ? (count / totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.keys(sources).length === 0 ? (
              <p className="text-muted-foreground">No source data available</p>
            ) : (
              Object.entries(sources).map(([source, data]: [string, any]) => (
                <div key={source} className="flex items-center justify-between p-2 border rounded">
                  <span className="capitalize">{source.replace("_", " ")}</span>
                  <div className="flex gap-4">
                    <span>Applications: {data.applications || 0}</span>
                    <span>Hires: {data.hires || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
