# Melbourne PT Connectivity System

This university research dashboard examines scheduled public transport connections between selected outer Melbourne activity centres. It presents 100 directed origin–destination pairs across four departure periods, using 1,600 saved routing requests, 4,755 returned itinerary candidates and 400 pair–period summaries. The maps and journey details are fixed research outputs, not live travel advice.

The application also includes a separately labelled Melton → Ringwood access-point experiment (96 requests across six point combinations) and exploratory 2021 ABS area-level context. The access points are research modelling proxies rather than verified pedestrian entrances. Population, workplace and equity context is not observed origin–destination demand or an approved investment priority.

The public application reads checked JSON and GeoJSON files under `public/data/`. It does not require OpenTripPlanner, PostGIS or GeoServer to view the saved results. Research methods and source provenance are retained in the separate local research project; this repository contains only the static dashboard and its reviewed public data.

## Run locally

Install Node.js 24, then:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
# Add a CARTO browser key authorised for localhost to .env.local.
npm.cmd test
$env:VITE_PUBLICATION_MODE = 'static'
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 5182 --strictPort
```

Open the URL printed by Vite. The `.env.local` file and `dist/` are ignored by Git. A public build uses the repository's `CARTO_BASEMAP_KEY` Actions secret and embeds the browser-restricted key in client JavaScript; the key is therefore not a private server credential. The public workflow will be enabled only after the final interface release is tested.

## Sources and interpretation

Transport Victoria GTFS supplied historical scheduled services; OpenStreetMap supplied walking-network information; Plan Melbourne supplied the original centre points. The completed scenario dates are 13 and 17 October 2026 in Australia/Melbourne. The headline travel-time measure is scheduled itinerary duration. Waiting from the requested departure to actual departure and requested-to-arrival time are separate diagnostics. Four-sample variation is timetable variation, not observed reliability.

Source-specific attribution, licence scope and derivation are in [`public/data/README.md`](public/data/README.md), [`public/data/V2_1_NOTICES.md`](public/data/V2_1_NOTICES.md) and [`docs/LICENSING_REVIEW.md`](docs/LICENSING_REVIEW.md). OpenStreetMap-derived selected geometry is available as a complete machine-readable component at `public/data/v2_1/selected_geometries.geojson` under ODbL 1.0. Visible map attribution credits OpenStreetMap contributors and CARTO. No raw GTFS, OSM extract, OTP graph or database credentials are included.

The original V1 public site is a separate project and is not modified by this repository.
