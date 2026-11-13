import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { Buddy } from "./components/buddy";
import "./app.css";

export const meta: Route.MetaFunction = () => [
  { title: "Reading Buddy" },
  { name: "description", content: "Pick a story, read it out loud to Fig, and talk about it. A reading buddy for kids." },
  { name: "theme-color", content: "#f3efe6" },
  { property: "og:title", content: "Reading Buddy" },
  { property: "og:image", content: "/fig-og.avif" },
];

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const title = isRouteErrorResponse(error)
    ? error.status === 404
      ? "Fig can't find that page"
      : `Something broke (${error.status})`
    : "Something went wrong";
  return (
    <main className="mx-auto grid min-h-svh max-w-md place-items-center p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <Buddy mood="sad" size={160} />
        <h1 className="text-3xl">{title}</h1>
        {error instanceof Error && <p className="text-muted">{error.message}</p>}
        <a href="/read" className="btn btn-leaf">
          Back to reading
        </a>
      </div>
    </main>
  );
}
