import * as React from "react";

import { useFeatureFlag } from "~/lib/feature-flags";

export type FeatureSlug =
  | "core_hr"
  | "time_attendance"
  | "leave_management"
  | "recruiting"
  | "workflows"
  | "company_news";

const FEATURE_METADATA: Record<FeatureSlug, { title: string; description: string }> = {
  core_hr: {
    title: "Core HR module is unavailable",
    description:
      "Your workspace does not currently have Core HR enabled. Ask a superadmin to turn on employee management to access this page.",
  },
  time_attendance: {
    title: "Time & Attendance is unavailable",
    description:
      "Clocking, overtime, and approvals are disabled for this tenant. Contact a superadmin to enable Time & Attendance.",
  },
  leave_management: {
    title: "Leave & Absence is unavailable",
    description:
      "Leave tracking is disabled for this workspace. Please reach out to a superadmin if you need access.",
  },
  recruiting: {
    title: "Recruiting & ATS is unavailable",
    description:
      "Recruiting features are currently turned off. Enable Recruiting to manage jobs, candidates, and pipelines.",
  },
  workflows: {
    title: "Workflows are unavailable",
    description:
      "Workflow automation has not been activated for this tenant. Ask a superadmin to enable workflows to continue.",
  },
  company_news: {
    title: "Company news is unavailable",
    description:
      "Enable the Company News feature to share internal announcements and HR mitteilungen.",
  },
};

type FeatureGateProps = {
  slug: FeatureSlug;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  defaultEnabled?: boolean;
};

export function FeatureGate({
  slug,
  fallback,
  children,
  defaultEnabled = slug === "recruiting" || slug === "workflows" ? false : true,
}: FeatureGateProps) {
  // Safely get feature flag, falling back to defaultEnabled if context is not available
  // This handles cases where components are rendered in portals outside the FeatureFlagProvider
  let enabled = defaultEnabled;
  try {
    enabled = useFeatureFlag(slug, defaultEnabled);
  } catch (error) {
    // If FeatureFlagProvider context is not available (e.g., in a portal),
    // use the defaultEnabled value
    console.warn(`FeatureFlagProvider context not available for ${slug}, using default: ${defaultEnabled}`);
    enabled = defaultEnabled;
  }

  if (!enabled) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const meta = FEATURE_METADATA[slug];

    return (
      <div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">{meta.title}</h2>
        <p className="mt-2 leading-relaxed">{meta.description}</p>
      </div>
    );
  }

  return <>{children}</>;
}
