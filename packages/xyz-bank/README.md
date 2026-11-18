# XYZ Bank

The Sense sales demo bank, served at **try.usesense.ai/xyz**.

A rep signs in with their Watchtower account and gets three surfaces, one job each: **prepare** a demo for a prospect, **present** it on a call, and **follow up** with a link the prospect can try on their own. The story follows usesense.ai: "KYC checks the ID. Sense checks the person", the four questions (Real person? Right person? Only one? Still them?) and the outcomes Let through, Stopped and In review. The design is in the redesign proposal (artifact "XYZ Bank Redesign").

## For reps

1. **Your demos** (`/xyz`): one card per prospect, with what to do next. **Quick demo** is XYZ Bank with no prep.
2. **New demo** (`/xyz/new`): their website, then one review. Brand, business type and market come from the site (Watchtower's brand import, run through a staff endpoint that writes to no org; any staff account can use it). No website? Enter a name and drop their logo file.
3. **Their story**: the opener (a good customer, fast) and the three attacks the usesense.ai industry page names (`src/lib/story.ts`, `RECOMMENDED`). Reorder, remove, or add from the library, filtered by the four questions. Up to 4 attacks.
4. **Rehearse**: the presentation with your notes under it.
5. **Present** (`/xyz/d/<id>/present`): full screen, dark, built to be shared. Each attack plays in three beats: the attack, what their KYC saw ("Passed"), and what Sense saw ("Passed your KYC. Stopped by Sense."). Keys:
   - `→` `←` next and back; `/` jump to any attack by what the prospect asked ("loan stacking"); it plays, then returns to where you were and is added to their link
   - `L` Now you try: a real face check on their phone (QR) or your camera, then "Now try to fool it" (same face, new name), which Sense stops as a duplicate. **See it in Watchtower** opens the decision.
   - `U` Under the hood: the decision, its Ed25519 signature, the webhook and the SDK code in their brand
   - `N` notes in a separate window that follows the presentation and can drive it; share the Present tab, not the notes
   - `Esc` the end card, which makes their link
6. **After the call**: the demo page shows their link, a ready email, and **What they did**: opens (a new browser means it was forwarded), face checks and results, and next-step clicks. No faces are shown.

## Live checks

- By default every live check runs in the **Sense Demo sandbox org** through Watchtower (`POST /watchtower-api/demo-shares/checks`, staff only, 100 a day per rep). No key is pasted, and every result opens in Watchtower for reps who are members of that org.
- A sales engineer can switch a demo to **their key** (demo page, Live checks). Then the browser calls the Sense API with that key, and results land in the prospect's own Watchtower.
- On your own camera, a face Sense already knows checks in as a returning customer, so "Now try to fool it" is the step that gets stopped.
- Government lookups stay scripted: sandbox lookups still reach the real provider and bill.

## Booth mode

The demo page's **Make a booth screen** creates a booth link (`/xyz/b/<id>`): the story loops on a timer with a standing QR code to the try-it steps. Booth links allow 150 face checks over 14 days.

## Scenarios (19)

| Journey | Scenarios |
| --- | --- |
| Sign-up | Good customers fast, Face swap on a stolen ID, Photo of a screen, Replayed record photo, Real record wrong face, Same face new name, Bot farm, Recruited mule, Edited driving licence, Synthetic identity |
| Account protection | Big payment to a new payee, SIM swap new phone, Rented account, Dormant account |
| AI agents | Assistant opens an account, Undeclared automation |
| Sense Network | Stopped somewhere else, Mule ring |
| Review and Sensei | The grey case |

Scenarios are data in `src/scenarios/`; the three beats are derived from each scenario's attack and KYC-only variants in `src/lib/story.ts`.

## Prospect links

The end card, or **Send them the link** on the demo page, creates `try.usesense.ai/xyz/p/<id>`.

- **What the prospect gets:** no sign-in, their brand, and four parts:
  1. **Try it yourself**: open an account with a real face check, then be someone else (same face, new name) and get stopped. On a computer, the QR code to their phone comes first.
  2. **The attacks we showed you**, in the same three beats as the call.
  3. **What it means for your team**: fraud and risk, compliance, product, developers and leadership, each from its usesense.ai page. `?tab=compliance` opens on a tab.
  4. **Share** (a link opening on a colleague's tab) and **What next**: book a follow-up, the free fraud scan, start free in the sandbox.
- **Activity:** opens (with a browser id, to spot forwarding), checks, results and next-step clicks go on the link's timeline for the rep, and on Network Admin, Growth, Demo links for the sales lead.
- **Where it lives:** Watchtower (`modules/demo-shares`) keeps the link and starts each check in the Sense Demo sandbox org with `DEMO_SHARE_API_KEY`, so no key reaches a browser.
- **Limits:** 14 days, 5 face checks per link, 60 checks an hour across all links. **Switch off** ends a link at once.
- **The result card** shows the four answers and Sensei's summary. The prospect never sees Watchtower; the sessions are in the Sense Demo org's sandbox.

## Sign-in

- Reps sign in with Supabase email and password against the Watchtower production project (the publishable key is public by design).
- Only staff domains get in: `VITE_STAFF_DOMAINS`, default `usesense.ai`.
- `/replay` and `/phone` are public: they hold no keys.
- Set `VITE_DEMO_AUTH=off` to run locally without an account.

## Develop

```bash
npm install                       # from the repo root
npm run build:sdk                 # the app imports the built SDK
VITE_DEMO_AUTH=off npm run dev:xyz   # http://localhost:5180/xyz/
npm run test -w packages/xyz-bank
```

## Deploy

The built app is committed at `packages/demo/public/xyz`. The Next demo serves it, and `packages/demo/next.config.js` sends every `/xyz/*` route to `/xyz/index.html`. The existing try.usesense.ai deploy (push to main) ships it with no new project, DNS or build step.

After changing the source, run `npm run build:xyz` and commit `packages/demo/public/xyz`. CI rebuilds it and fails if the committed copy is stale.

## Known limits

- The leave-behind beacons use the existing Growth event kinds (`page_view`, `deck_slide`, `cta_click`). Per-rep demo history lives in the rep's browser; Growth has no endpoint for it yet.
- The prospect's face, if they use **Their phone**, is checked in whatever org the key belongs to. Use the Sense Demo org.
