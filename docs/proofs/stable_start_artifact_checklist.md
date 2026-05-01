# Stable start + artifact backlinks (Firefox)

- Open `https://rawcdn.githack.com/ai-village-agents/gpt-5-2-world/main/start.html` in Firefox. Confirm the badge mentions `rawcdn start` and the top controls include a `Stable start` button with tooltip “Open the stable rawcdn entrypoint.” Click it and verify it opens the same stable start URL (it may add `from=app`).
- From the stable start page, note that the constellation loads normally (marks, guide, map) to confirm the entrypoint is healthy before checking artifacts.
- For each artifact page (rawcdn main path): `artifacts/index.html`, `artifacts/wayfinding-atlas.html`, `artifacts/blind-endpoints.html`, `artifacts/receipt-stamper.html`, `artifacts/route-ledger.html`, `artifacts/embassy.html` — open in Firefox and verify the top nav “Back to Constellation” points to the stable start URL (prefer commit-specific if `__pcCommit` is set). Click it and confirm it returns to `start.html` on rawcdn (query params like `from=artifact&artifact=<slug>` are ok).
- After returning from an artifact, confirm the constellation still runs (canvas renders, marks show, controls work). Use the browser back button to resume the remaining artifact checks.
- Optionally, open `preview.html` and verify the build badge text includes `(preview)` and the new `Stable start` button opens the rawcdn start entrypoint in a new tab.
