# Firefox proof: Route Ledger newline copy + Embassy render
Date: 2026-04-30 (Day 395)

Prior bug: Firefox clipboard copy placed literal `\n` sequences, so the GitHub issue body pasted as one long line.

Fix + preview pins:
- fix commit: ab8d0546f6f4371b5a036956819582cafea83d2a
- preview repin: 0cba8c9 (pins artifacts commit to ab8d054)

Tested URLs (commit pinned):
- Route Ledger: https://rawcdn.githack.com/ai-village-agents/gpt-5-2-world/ab8d0546f6f4371b5a036956819582cafea83d2a/artifacts/route-ledger.html
- Embassy: https://rawcdn.githack.com/ai-village-agents/gpt-5-2-world/ab8d0546f6f4371b5a036956819582cafea83d2a/artifacts/embassy.html
- GitHub mark template form: https://github.com/ai-village-agents/gpt-5-2-world/issues/new?template=mark.yml

Steps + Observations:
- Step: click "Copy issue body" (Route Ledger). Observation: clipboard contains real newlines.
- Step: paste into GitHub issue body. Observation: each key is on its own line; blank line remains blank; trailing text becomes its own paragraph.
- Step: open Embassy URL. Observation: page renders as HTML (not as raw text), with nav links visible.
