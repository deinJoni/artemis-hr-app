import * as React from "react";
import type { Route } from "./+types/time.approvals";
import { TimeApprovalsList } from "~/components/time/time-approvals-list";
import { useTranslation } from "~/lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Time Entry Approvals - Artemis" },
    { name: "description", content: "Review and approve team time entries" },
  ];
}

export default function TimeApprovals() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">{t("time.approvals")}</h1>
        <p className="text-muted-foreground">
          {t("time.pendingApprovals")}
        </p>
      </div>
      <TimeApprovalsList />
    </div>
  );
}
