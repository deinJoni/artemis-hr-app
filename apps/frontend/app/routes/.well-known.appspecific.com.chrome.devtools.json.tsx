// Silence Chrome DevTools probe in dev by responding with empty JSON
import type { Route } from "./+types/.well-known.appspecific.com.chrome.devtools.json";

export async function loader() {
  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  });
}

export default function DevtoolsWellKnown(_: Route.ComponentProps) {
  return null;
}


