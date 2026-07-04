# Longbourn Content Engine — Editorial Map & Batch Plan
Status: ENGINE LIVE (longbourn@ef2dac7) · 5 posts published · dating strategy = SCOTT DECIDING
Owner: Scott · Builder: Skippy · 2026-07-03

## How it works (built)
`content/journal.json` (manifest) + `content/posts/<slug>.html` (bodies) →
`python3 tools/build-journal.py` → post pages w/ Article JSON-LD, journal index
(featured newest + full grid, marker-fenced), sitemap.xml → `npx wrangler deploy`.
Adding a post = body file + manifest entry + script + deploy. Dates are manifest
fields — re-dating the whole corpus is a one-script edit whenever Scott decides.

## Voice bar (set by the two flagships)
Warm British editorial, second person, concrete examples over platitudes, one <hr>
breather per act, ends by tying back to the shop WITHOUT selling hard. 1,200–1,800
words. House bylines: Ellie Hartwell (occasions/etiquette), Scott Foster (craft/press).
NO listicle filler, no "In conclusion", no AI-slop hedging.

## Editorial map — 36 posts, 5 pillars
### A · Occasions — what to write (12) [highest search intent]
thank-you note ✅ · sympathy card ✅ · new-baby congratulations · wedding congratulations ·
get-well notes · apology letters · love letters (anniversary) · thinking-of-you ·
post-interview thank-you · teacher thank-you · hostess thank-you · Christmas/holiday notes
### B · Letter-writing craft (8)
how to start a letter (openings) · how to end a letter (sign-offs) · pen-pal guide ·
writing letters to grandparents/kids · anatomy of a personal letter · addressing envelopes
properly · how long should a note be · keeping letters (the memory box)
### C · Calligraphy & hand-lettering (6) [feeds Tool #2]
beginner's guide (tools+first strokes) · modern vs copperplate · practice drills that work ·
calligraphy envelope addressing · fixing common beginner mistakes · choosing first nib & ink
### D · The craft / letterpress (5) [Scott byline, real shop photos]
what is letterpress · how a Heidelberg Windmill works · deboss vs emboss vs foil ·
why cotton paper ✅ (exists) · a day in the print shop
### E · Paper, materials & etiquette (5)
paper weights explained · envelope size guide · wax seals 101 · the complete stationery
wardrobe · correspondence etiquette now ✅-adjacent (digital-world post exists)

## Batch cadence
~4–6 posts per session (quality ceiling), pillar-mixed. Order: finish A (buying-adjacent
intent) → C (tool tie-in) → B → E → D. Each batch: write bodies → manifest → build → deploy
→ verify → push. Internal links: every A/C post links its sibling guides + one product.

## Dating decision (open)
Options given to Scott 2026-07-03: (1) backdate spread over ~2yrs, (2) real dates batching
forward, (3) modest backfill + forward cadence. Skippy's counsel: content depth wins, fake
dates don't — Google first-crawl vs claimed-date mismatch reads manipulative and the honest
cadence costs nothing. Manifest makes any choice reversible.
