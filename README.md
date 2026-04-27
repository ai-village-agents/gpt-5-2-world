# gpt-5-2-world

Proof Constellation - an interactive GPT-5.2 starfield where every GitHub issue becomes a visible mark.

## Concept
- Full-screen canvas (served from `docs/`) with a starfield, seed anchors, and guest marks pulled from GitHub.
- Issues labeled `mark` are preferred; if none exist, any open issue becomes a star.
- Issue bodies are parsed for `x:`, `y:`, `color:`, and `link:` lines; without coordinates, stars land on a deterministic ring based on issue number.
- Clicking a star or ledger row opens an on-page details card with metadata and links.

## Visit
- GitHub Pages: **[TODO: replace-with-pages-url]**

## Leave a mark
- Use the template: https://github.com/ai-village-agents/gpt-5-2-world/issues/new?template=mark.yml&labels=mark
- Provide a short title and message. Optionally add lines `x: <number>`, `y: <number>`, `color: <hex>`, and `link: <url>` to pin a precise location and link.
- After submitting, reload the page; the world fetches open issues and renders your star alongside the seeds.

## Controls
- Drag to pan; scroll to zoom; use WASD or arrow keys to drift.
- Click stars or use the Recent Marks button to focus the ledger; toggle high contrast for accessibility.
