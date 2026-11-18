# XYZ Bank

The Sense sales demo bank, served at **try.usesense.ai/xyz**.

A rep signs in with their Watchtower account, picks the attack the prospect fears, and shows two things side by side: what the customer sees in a polished banking app, and what Sense decided and why, with Sensei's write-up. Every scenario plays three ways: **Genuine**, **Attacker** and **Without Sense** (KYC only). Live scenarios also run a real Sense face check with a sandbox or production key, and link to the decision in Watchtower.

## For reps: a ten-minute demo

1. **Set up** (before the call): prospect name, their real logo file, brand colour, business type and market. Paste a sandbox key from Watchtower, Developers, API keys, and press **Check key**.
2. **Scenarios**: the list opens on the top five attacks for that business type.
3. **Stage**: the attack plays on its own. `Space` pauses, `←` `→` step through, `1` `2` `3` switch between Genuine, Attacker and Without Sense, `[` `]` move between scenarios, and `T` shows the talk track.
4. **Run it live**: on scenarios marked Live. Your first live run signs you up. After that, Sense recognises you, so:
   - genuine runs check you as a returning customer, and
   - **Same face, new name** run live is stopped as a duplicate.
5. **Their phone**: shows a QR code. The prospect takes the face check on their own phone, and the result appears on your screen.
6. **Open in Watchtower**: opens the live decision with its evidence.
7. **Demos**: groups what you showed by prospect. **Copy link** gives a leave-behind that replays those scenarios, scripted only. Paste a Growth tracked-link code first if you want opens reported to Growth.

## Scenarios (17)

| Journey | Scenarios |
| --- | --- |
| Sign-up | Good customers fast (live), Face swap on a stolen ID (live genuine), Photo of a screen (live), Replayed record photo, Real record wrong face, Same face new name (live), Bot farm, Recruited mule |
| Account protection | Big payment to a new payee (live), SIM swap new phone (live), Rented account, Dormant account |
| AI agents | Assistant opens an account (live, QR hand-off), Undeclared automation |
| Sense Network | Stopped somewhere else, Mule ring |
| Review and Sensei | The grey case |

Scenarios are data in `src/scenarios/`. To add one, write it with the builders in `build.ts` and add it to the list in `index.ts`. The tests check its shape, the copy and the industry ordering.

## How live checks work

- The key stays in the rep's browser (localStorage) and is only sent to the Sense API.
- **Run it live**:
  - `POST /v1/sessions` with the key creates an enrollment, or an authentication against the rep's stored identity.
  - The SDK's `VerificationCaptureEngine` runs the capture.
  - The result maps onto the four questions.
- **Their phone**:
  - The stage creates the session and puts the per-session token, deflated, in the QR link's URL fragment. The API key never goes in the link.
  - The stage polls `GET /v1/sessions/:id/status`, then reads `GET /v1/sessions/:id`.
- **Key check**: unknown ids give 404 for a good key and 401 for a bad one, so the check creates nothing.
- **Live decisions**: only liveness, device and duplicate checks run live. Government lookups stay scripted, because sandbox lookups still reach the real provider and bill.

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
