// Manual type stub until react-router typegen picks up this route.

import type { GetInfo, GetAnnotations } from "react-router/internal";

type Module = typeof import("../employees.$employeeId");

type Info = GetInfo<{
  file: "routes/employees.$employeeId.tsx";
  module: Module;
}>;

type Matches = [
  {
    id: "root";
    module: typeof import("../../root");
  },
  {
    id: "routes/employees.$employeeId";
    module: typeof import("../employees.$employeeId");
  },
];

type Annotations = GetAnnotations<Info & { module: Module; matches: Matches }, false>;

export namespace Route {
  export type LinkDescriptors = Annotations["LinkDescriptors"];
  export type LinksFunction = Annotations["LinksFunction"];
  export type MetaArgs = Annotations["MetaArgs"];
  export type MetaDescriptors = Annotations["MetaDescriptors"];
  export type MetaFunction = Annotations["MetaFunction"];
  export type HeadersArgs = Annotations["HeadersArgs"];
  export type HeadersFunction = Annotations["HeadersFunction"];
  export type MiddlewareFunction = Annotations["MiddlewareFunction"];
  export type ClientMiddlewareFunction = Annotations["ClientMiddlewareFunction"];
  export type LoaderArgs = Annotations["LoaderArgs"];
  export type ClientLoaderArgs = Annotations["ClientLoaderArgs"];
  export type ActionArgs = Annotations["ActionArgs"];
  export type ClientActionArgs = Annotations["ClientActionArgs"];
  export type HydrateFallbackProps = Annotations["HydrateFallbackProps"];
  export type ComponentProps = Annotations["ComponentProps"];
  export type ErrorBoundaryProps = Annotations["ErrorBoundaryProps"];
}
