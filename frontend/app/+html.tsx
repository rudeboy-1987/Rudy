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

        {/* Schema.org LocalBusiness — tells Google your business info for rich search results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Electrician",
              name: "Done Right Electric Ltd.",
              alternateName: "Done Right Electric",
              description:
                "San Antonio's trusted electrical contractor — panel upgrades, EV chargers, GFCI, recessed lighting, commercial & residential. 18+ years experience.",
              url: "https://donerightelectricltd.com",
              telephone: "+1-210-393-4239",
              image: "https://donerightelectricltd.com/icon-512.png",
              priceRange: "$$",
              address: {
                "@type": "PostalAddress",
                addressLocality: "San Antonio",
                addressRegion: "TX",
                addressCountry: "US",
              },
              areaServed: [
                { "@type": "City", name: "San Antonio" },
                { "@type": "City", name: "Stone Oak" },
                { "@type": "City", name: "Alamo Heights" },
                { "@type": "City", name: "Boerne" },
                { "@type": "City", name: "Helotes" },
                { "@type": "City", name: "Schertz" },
                { "@type": "City", name: "Cibolo" },
                { "@type": "City", name: "Live Oak" },
                { "@type": "City", name: "New Braunfels" },
              ],
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                  opens: "07:00",
                  closes: "19:00",
                },
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: ["Saturday"],
                  opens: "08:00",
                  closes: "17:00",
                },
              ],
              sameAs: [],
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Electrical Services",
                itemListElement: [
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Electrical panel upgrades (100A, 200A, 400A)" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "EV charger installation (Level-2)" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Recessed LED lighting installation" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "GFCI and AFCI outlet replacement" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Whole-home rewiring & knob-and-tube removal" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Commercial electrical services" } },
                ],
              },
            }),
          }}
        />

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
