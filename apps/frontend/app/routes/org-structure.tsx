import * as React from "react";
import type { Route } from "./+types/org-structure";
import { supabase } from "~/lib/supabase";
import {
  OrgStructureResponseSchema,
  OrgHierarchyResponseSchema,
  ReportingLinesResponseSchema,
  type OrgStructureNode,
  type OrgHierarchyNode,
} from "@vibe/shared";
import { OrgTreeView } from "~/components/org-structure/OrgTreeView";
import { OrgChartView } from "~/components/org-structure/OrgChartView";
import { OrgMatrixView } from "~/components/org-structure/OrgMatrixView";

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
    { title: "Organizational Structure | Artemis" },
    { name: "description", content: "View and manage organizational hierarchy, reporting lines, and structure" },
  ];
}

type ViewMode = "chart" | "tree" | "matrix";

export default function OrgStructure({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const [viewMode, setViewMode] = React.useState<ViewMode>("chart");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [orgStructure, setOrgStructure] = React.useState<OrgStructureNode[]>([]);
  const [hierarchy, setHierarchy] = React.useState<OrgHierarchyNode | null>(null);
  const [reportingLines, setReportingLines] = React.useState<any[]>([]);
  const [tenantId, setTenantId] = React.useState<string | null>(null);

  // Get tenant ID
  React.useEffect(() => {
    async function getTenantId() {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession?.access_token) return;

        const response = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        });
        if (!response.ok) {
          console.error("Failed to get tenant info:", response.status, response.statusText);
          return;
        }
        const data = await response.json();
        if (data?.id) {
          setTenantId(data.id);
        } else {
          console.error("No tenant ID found in /api/tenants/me response:", data);
        }
      } catch (err) {
        console.error("Failed to get tenant ID:", err);
      }
    }
    void getTenantId();
  }, [apiBaseUrl]);

  // Load org structure data
  React.useEffect(() => {
    if (!tenantId) return;

    async function getSession() {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      return authSession?.access_token;
    }

    let cancelled = false;

    async function loadData() {
      const token = await getSession();
      if (!token || cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const [structureRes, hierarchyRes, reportingRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/org-structure/${tenantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/org-structure/${tenantId}/hierarchy`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/org-structure/${tenantId}/reporting-lines`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;

        if (!structureRes.ok || !hierarchyRes.ok || !reportingRes.ok) {
          throw new Error("Failed to load organizational structure");
        }

        const [structureData, hierarchyData, reportingData] = await Promise.all([
          structureRes.json(),
          hierarchyRes.json(),
          reportingRes.json(),
        ]);

        const parsedStructure = OrgStructureResponseSchema.safeParse(structureData);
        const parsedHierarchy = OrgHierarchyResponseSchema.safeParse(hierarchyData);
        const parsedReporting = ReportingLinesResponseSchema.safeParse(reportingData);

        if (!parsedStructure.success || !parsedHierarchy.success || !parsedReporting.success) {
          throw new Error("Unexpected response shape");
        }

        if (!cancelled) {
          setOrgStructure(parsedStructure.data.nodes);
          setHierarchy(parsedHierarchy.data.root);
          setReportingLines(parsedReporting.data.reporting_lines);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load organizational structure");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [tenantId, apiBaseUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading organizational structure...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Organizational Structure</h1>
        <p className="text-gray-600 mt-2">View and explore your organization's hierarchy and reporting lines</p>
      </div>

      {/* View mode selector */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setViewMode("chart")}
          className={`px-4 py-2 rounded ${viewMode === "chart" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Org Chart
        </button>
        <button
          onClick={() => setViewMode("tree")}
          className={`px-4 py-2 rounded ${viewMode === "tree" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Tree View
        </button>
        <button
          onClick={() => setViewMode("matrix")}
          className={`px-4 py-2 rounded ${viewMode === "matrix" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Matrix View
        </button>
      </div>

      {/* Placeholder for views - will be implemented in next steps */}
      <div className="bg-white rounded-lg shadow p-6">
        {viewMode === "chart" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Org Chart View</h2>
            <OrgChartView
              hierarchy={hierarchy}
              onNodeClick={(nodeId) => {
                window.location.href = `/employees/${nodeId}`;
              }}
            />
          </div>
        )}
        {viewMode === "tree" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Tree View</h2>
            <OrgTreeView
              hierarchy={hierarchy}
              onNodeClick={(nodeId) => {
                window.location.href = `/employees/${nodeId}`;
              }}
            />
          </div>
        )}
        {viewMode === "matrix" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Matrix View</h2>
            <OrgMatrixView reportingLines={reportingLines} orgStructure={orgStructure} />
          </div>
        )}
      </div>
    </div>
  );
}

