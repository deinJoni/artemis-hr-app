import { Button } from "~/components/ui/button";
import { Link } from "react-router";

export function Welcome() {
  return (
    <main className="container mx-auto pt-16 pb-8 px-4">
      <section className="max-w-3xl space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Vibe Scaffold</h1>
        <p className="text-muted-foreground">
          A minimal full-stack scaffold powered by React Router, Tailwind CSS, and shadcn/ui.
          It includes routing, theming, and a growing set of ready-to-use components.
        </p>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">What you can do</h2>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Build pages using shadcn components like cards, tables, tabs, charts.</li>
            <li>Toggle light/dark mode using the header theme switcher.</li>
            <li>Extend routes under <code>app/routes</code> with loaders and actions.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Next steps</h2>
          <ol className="list-decimal pl-6 space-y-1 text-muted-foreground">
            <li>Open <code>app/routes/example.tsx</code> to see how data flows from a loader.</li>
            <li>Browse <code>app/components/ui</code> for installed shadcn components.</li>
            <li>Add your own routes in <code>app/routes.ts</code> and pages under <code>app/routes</code>.</li>
          </ol>
        </div>

        <div className="flex gap-4 pt-2">
          <Button asChild>
            <Link to="/example">Open the Example page</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://ui.shadcn.com" target="_blank" rel="noreferrer">shadcn/ui docs</a>
          </Button>
        </div>
      </section>
    </main>
  );
}