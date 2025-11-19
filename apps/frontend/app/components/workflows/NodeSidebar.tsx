import * as React from "react";
import { BookOpenCheck, Search } from "lucide-react";

import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import type { WorkflowNodeTemplate, WorkflowNodeCategory } from "~/lib/workflows/node-types";
import { cn } from "~/lib/utils";

type NodeSidebarProps = {
  categories: WorkflowNodeCategory[];
  onTemplateClick?: (template: WorkflowNodeTemplate) => void;
  className?: string;
};

export function NodeSidebar({ categories, onTemplateClick, className }: NodeSidebarProps) {
  const [query, setQuery] = React.useState("");

  const filteredCategories = React.useMemo(() => {
    if (!query.trim()) return categories;
    const lowercase = query.trim().toLowerCase();
    return categories
      .map((category) => ({
        ...category,
        templates: category.templates.filter((template) => {
          const haystack = [
            template.label,
            template.description,
            ...(template.tags ?? []),
            template.kind,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(lowercase);
        }),
      }))
      .filter((category) => category.templates.length > 0);
  }, [categories, query]);

  return (
    <aside
      className={cn(
        "flex h-full w-80 flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-none">Workflow Blocks</p>
            <p className="text-xs text-muted-foreground">Drag blocks onto the canvas</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks..."
            className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {filteredCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocks match “{query}”.</p>
        ) : null}
        {filteredCategories.map((category) => (
          <div key={category.id} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category.label}
              </p>
              {category.description ? (
                <p className="text-xs text-muted-foreground">{category.description}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {category.templates.map((template) => (
                <SidebarCard
                  key={template.id}
                  template={template}
                  onClick={onTemplateClick}
                />
              ))}
            </div>
            <Separator />
          </div>
        ))}
      </div>
    </aside>
  );
}

type SidebarCardProps = {
  template: WorkflowNodeTemplate;
  onClick?: (template: WorkflowNodeTemplate) => void;
};

function SidebarCard({ template, onClick }: SidebarCardProps) {
  const Icon = template.icon;

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow/template", JSON.stringify(template));
    event.dataTransfer.effectAllowed = "copyMove";
  };

  return (
    <div
      className="group flex cursor-grab flex-col gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 transition hover:border-primary"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick?.(template)}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{template.label}</p>
          {template.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
          ) : null}
        </div>
      </div>
      {template.tags?.length ? (
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

