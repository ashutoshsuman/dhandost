import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { CoachProvider } from "@/components/coach/CoachContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { TourProvider } from "@/components/Tour";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DhanDost — Your Personal Finance Friend" },
      { name: "description", content: "AI powered personal finance assistant" },
      { property: "og:title", content: "DhanDost — Your Personal Finance Friend" },
      { name: "twitter:title", content: "DhanDost — Your Personal Finance Friend" },
      { property: "og:description", content: "AI powered personal finance assistant" },
      { name: "twitter:description", content: "AI powered personal finance assistant" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c68eef3f-1358-4669-9d94-2f7bac0ab91f/id-preview-667efe6d--8c8dba9e-3134-4569-b878-913cb4f97ae2.lovable.app-1780000197479.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c68eef3f-1358-4669-9d94-2f7bac0ab91f/id-preview-667efe6d--8c8dba9e-3134-4569-b878-913cb4f97ae2.lovable.app-1780000197479.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: "(function(apiKey){(function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');})('846df8b0-e708-4fde-876d-e7797f2b317d');" }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    pendo.initialize({ visitor: { id: '' } });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <TourProvider>
          <CoachProvider>
            <Outlet />
          </CoachProvider>
        </TourProvider>
      </AuthGate>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
