# Planning Context integration and source limits

20 October 2026. This dashboard displays the saved `public/data/experimental/planning_context_v2.json` asset alongside the completed scheduled analysis. The independent public-source checkout is `Publication/melbourne-pt-connectivity-system-public`; the original public V1 site remains separate. Earlier local-only integration notes remain recoverable in the checkpoint commit history.

The view offers six profiles: scheduled connectivity burden; area-level demand context; area-level equity context; and three documented combinations. The interface renders the stored scenario-specific scores and ranks, and decomposes each score using its actual recorded weights. Chart and table selections open the saved unweighted itinerary. The displayed SA2 residents and jobs are not observed OD passenger demand, and a containing SA2 is not an activity-centre catchment. The 2021 context predates the October 2026 timetable.

Research preparation and methodology remain in `scripts/prepare_v2_3_context.py`, `scripts/rank_v2_3_context.py`, `scripts/export_v2_3_planning.py`, `docs/V2_3_DEMAND_EQUITY_METHODOLOGY.md` and `system_development/data/SOURCE_REGISTER.md` in the local final system. The exporter refuses to overwrite the validated JSON. Source identities and hashes are retained in the asset. Publication includes only the reviewed JSON and source attribution; no live OTP or PostGIS request is made by this page.

Local automated and browser verification for this interface is recorded in `system_development_handoffs/final_interface_audit/` beside the final system. The browser verification covered all six profiles and desktop, tablet and phone viewports; it is not a physical-device test.
