// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* SEO */}
        <title>EstimatePro — AI Electrical Estimating & Live Leads</title>
        <meta
          name="description"
          content="AI-powered electrical estimating, live leads in your area, and blueprint vision for licensed electricians. Get free quotes from verified pros."
        />
        <meta name="keywords" content="electrician, electrical contractor, electrical estimate, AI estimating, electrical leads, blueprint analysis, NEC, electrical bid" />
        <meta name="author" content="EstimatePro" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#00ff66" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EstimatePro" />

        {/* Icons */}
        <link rel="icon" type="image/png" href="/icon-192.png" />
        <link rel="shortcut icon" type="image/png" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="EstimatePro" />
        <meta property="og:title" content="EstimatePro — AI Electrical Estimating & Live Leads" />
        <meta property="og:description" content="Get free quotes from licensed electricians in your area. AI-powered estimates in seconds." />
        <meta property="og:image" content="/icon-512.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="EstimatePro — AI Electrical Estimating & Live Leads" />
        <meta name="twitter:description" content="Get free quotes from licensed electricians in your area." />
        <meta name="twitter:image" content="/icon-512.png" />

        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body { background-color: #0a0a0a; }
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
