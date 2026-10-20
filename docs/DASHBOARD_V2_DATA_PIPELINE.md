# Dashboard V2 data pipeline

## Inputs and data flow

The only new routing input is the completed `v2_1/runs/v2_1_full_1600` research run. The exporter reads its manifest, validation outcome, 1,600 individual sample files, retained OTP responses, aggregate JSON/CSV, analysis summary, sample CSV, selected-leg CSV, walking decomposition and geometry flags. It preserves the recorded selected candidate and passenger-transfer count; it does not apply a new rule.

Saved research evidence → deterministic Python export → versioned JSON/GeoJSON → static Vite/OpenLayers dashboard.

Optional database reconciliation uses the existing research `src.database.get_connection` configuration, a repeatable-read, read-only transaction and rollback on exit. It compares `el_v2.analysis_runs`, `connectivity_metrics`, `selected_itineraries` and `candidate_itineraries` for the named run. No browser database access, schema changes, imports or writes are involved. Credentials are neither exported nor printed.

## Versioned output

| File | Purpose |
|---|---|
| `public/data/study.json` | Unchanged V1 data, 100 routes / 533 legs / 11 points |
| `public/data/v2_1/index.json` | Run/rule identifiers, dates, frozen pairs, 400 aggregates, compact 1,600 sample metrics, cohort summaries, provenance and diagnostics |
| `public/data/v2_1/routes/{route_id}.json` | Sixteen selected samples for one pair, exact selected legs/geometry and all retained candidate facts/reasons |
| `public/data/v2_1/scenarios/{scenario_id}.geojson` | One representative selected path per pair for the scenario map |
| `public/data/v2_1/selected_geometries.geojson` | Complete selected geometry component for inspection/distribution review |
| `public/data/v2_1/manifest.json` | SHA-256 for each of the 106 data assets, plus source manifest hash |
| `public/data/V2_1_NOTICES.md` | Source attribution, component licences and derivation description |

Export version: `dashboard-v2.1-static-1`. Run: `v2_1_full_1600`. Rule: `duration-window-passenger-transfers-arrival-v2.1`. Existing output files must match byte-for-byte; a conflicting export fails instead of overwriting. A different validated run should receive a new version directory and loader registration, not replace this evidence.

## Definitions and selection

The recorded rule uses a five-minute window above fastest duration, then fewest passenger transfers, shortest duration, least walking, earliest arrival, and the established deterministic fallback. Passenger transfers retain the validated OTP field. Stay-seated trip segmentation is not converted into extra passenger transfers.

Journey duration is actual itinerary arrival minus actual departure. Elapsed time is actual arrival minus requested departure. Initial waiting opportunity is actual departure minus requested departure; it does not imply physically waiting at a stop. For each individual sample, elapsed = duration + initial waiting. Separate medians of these quantities need not add together.

Map, matrix, centre and matched comparison rows use the saved four-sample OD medians. Overview cohort medians pool all 360 outer or 40 CBD samples per scenario. Comparative differences subtract A from B for identical directed OD pairs within one cohort. Mean paired differences are labelled separately from pooled medians. Fractional transfer medians are retained. Indirectness is itinerary distance / direct geographic distance. No composite priority score is calculated.

Map geometry is a selected sample nearest the OD median duration, ties resolved by requested time then request key. Colour is the OD metric; the path is not a median route. Explorer geometry comes from the selected sample itself. Decoded leg polylines are retained without snapping. Missing/invalid geometry fails validation; the interface displays a load error rather than presenting an empty path as valid.

## Scenarios

All times are Australia/Melbourne, UTC+11 on the recorded dates.

| Scenario | Date | Requested times |
|---|---|---|
| `weekday_am` | 13 October 2026 | 07:30, 08:00, 08:30, 09:00 |
| `weekday_interpeak` | 13 October 2026 | 11:30, 12:00, 12:30, 13:00 |
| `weekday_pm` | 13 October 2026 | 16:30, 17:00, 17:30, 18:00 |
| `saturday_midday` | 17 October 2026 | 11:30, 12:00, 12:30, 13:00 |

## Reproduce locally

Run from the V2 worktree. The research virtual environment already provides Python 3.12, polyline and the existing database driver. Existing Node dependencies are unchanged; the local junction is a development convenience, not a portable dependency artifact. A clean approved checkout can use the existing lockfile with `npm ci`.

```powershell
& '..\..\Individual Project\.venv\Scripts\python.exe' -B scripts/export_v2_1.py --research '..\..\Individual Project' --evidence '..\dashboard-v2-validation\export.json' --verify-db
npm.cmd test
npm.cmd run dev -- --port 5177
```

Omit `--verify-db` for a file-only reproduction; use a different evidence filename because the report records whether database verification occurred. Never use `python -O`, which disables validation assertions. The exporter does not download inputs or start OTP.

The existing ignored `.env.local` supplies the browser-authorised CARTO basemap key. Do not put it in source, documentation or command-line output. To build and check the future GitHub Pages layout locally:

```powershell
npm.cmd run build:public
node scripts/check_v2_artifact.mjs
$env:VITE_PUBLICATION_MODE='static'
npm.cmd run preview -- --port 5178
```

Preview: `http://127.0.0.1:5178/melbourne-pt-connectivity-dashboard/`. These commands create local build output only. They do not approve publication or execute the GitHub workflow.

For browser validation, set `PLAYWRIGHT_PACKAGE` to the existing Playwright `index.mjs`, `CHROME_PATH` to the installed Edge/Chromium executable, `QA_OUTPUT_DIR` to an evidence directory outside the checkout and `WEB_MAP_URL` to the preview URL, then run `node scripts/verify_v2_browser.mjs`. No browser package installation is required in the tested environment.
