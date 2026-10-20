# V2.1 data component notices

Independent student research publication. Results describe saved scheduled journeys; they are not live travel advice.

## Scope

Run `v2_1_full_1600`; export schema `dashboard-v2.1-static-1`. Historical scheduled journeys on 13 and 17 October 2026. Not a live journey planner or official Victorian Government advice. The State of Victoria does not endorse this dashboard.

## Government timetable facts

Transport Victoria GTFS Schedule, Department of Transport and Planning, licensed under Creative Commons Attribution 4.0:
https://opendata.transport.vic.gov.au/dataset/gtfs-schedule
https://creativecommons.org/licenses/by/4.0/

The source schedule was processed using OpenTripPlanner 2.9.0 and the recorded V2.1 rule. Times, selected journeys and aggregated indicators are derived research outputs, not an official journey-planning service. Retained input hashes appear in `v2_1/index.json`; the current upstream download is not asserted to be the retained study feed.

## Centre points

Eleven unchanged Plan Melbourne points are reused from the preserved original study. Attribution: © State of Victoria, Department of Transport and Planning. The source spatial-download page links to departmental website copyright terms (CC BY 4.0); this is not an independently confirmed layer-specific licence declaration.

https://spatial.planning.vic.gov.au/gis/rest/services/planmelb_activity_centres/MapServer/0
https://transport.vic.gov.au/website-terms/copyright

## Geometry component

© OpenStreetMap contributors. The OSM-derived selected route geometry database is offered under ODbL 1.0:
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/

`v2_1/selected_geometries.geojson` contains all 1,600 selected geometries, with request identifiers and scenario metadata. It is a separate, machine-readable geometry component. The scenario GeoJSON files and selected geometry in route chunks are subsets of that component and carry the same ODbL notice. Timetable facts and government centre points retain their own source notices; the licence does not purport to relicense them or the project's source code.

Derivation: the existing OTP graph combined the retained OSM network and GTFS inputs. The exporter reads immutable selected OTP itineraries, decodes each leg's encoded polyline at its stored precision, changes coordinate order to GeoJSON longitude/latitude, and groups legs into MultiLineStrings. It does not simplify, snap or repair geometry. Two selected endpoint/connection offsets remain flagged. Scenario map lines select the retained departure closest to the OD median duration, resolving ties by requested time then request key. No synthetic median path is generated.

The complete selected-geometry database and this derivation description support review of ODbL obligations. The export is not a legal determination that every potential distribution obligation has been discharged.

## Basemap and software

CARTO Light / Positron attribution is displayed in the map: © OpenStreetMap contributors, © CARTO. Tile use is governed separately by https://carto.com/legal/basemap-terms/ . Basemap tiles are not bundled in these downloads. No new claim about account quota or key restrictions is made. The configured browser key must be authorised for any deployment domain.

Existing OpenLayers and third-party software notices remain under `licenses/`. These notices do not grant a blanket licence over project code or unrelated research assets.
