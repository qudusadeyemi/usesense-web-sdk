# Changelog

All notable changes to the UseSense Web SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.13.1] - 2026-11-11

### Fixed

- **Every capture screen follows the brand** (BRAND-v1, capture-test-kit/BRAND-v1.md).
  The guided screens were hardcoded dark and ignored almost every brand setting.
  - One resolved capture theme per session or Flow run, as CSS variables used by
    every screen. Page screens (primer, "One more quick check", upload sheet,
    "Couldn't send your scan", result and error pages, leave dialog, "Getting ready",
    camera request) follow the full palette and `mode` (`light`, `dark`, `auto`;
    unset stays dark, today's look). Dark mode reads `colors.dark.*` only.
  - The camera stays dark. Brand reaches it only as accents, each gated to 3:1 on
    `#333333` (was `#1A1A1A`): the ring is `capture.ring`, else `colors.primary`,
    else the primary lightened (HSL L +5% per step, up to 8), else `#4F7CFF`; the
    extra-check ring and sheet icon are `capture.challenge`, else `#A878FC`; the
    failing oval, paused ring and Follow Dot are `capture.warning`, else
    `colors.warning`, else `#FFB84D`; the done tick and mic meter are
    `colors.success`, else `#00D4AA`. Fixed: camera background, dim, blur, oval
    guide, ring track, white guidance, shutter, fill light, colour sequence tint,
    Flash Reflection, Speak Digits pill, "Powered by Sense".
  - `capture.contourStart` / `contourEnd` are retired: accepted and ignored. Both
    renderers draw the lines in the ring colour.
  - Titles use `typography.displayFamily`; `shape.buttonRadius` / `buttonStyle`
    (filled or outline) apply to every capture button; `shape.radius` sets dialog,
    sheet (min(2r, 28)) and icon-tile corners; `primaryForeground` defaults to
    white or `#1C1A17` by contrast for a brand primary.
  - `appearance.logo` (url, placement `header` / `center` / `none`, height) heads
    every page screen, above the page (it sat under end pages). No logo: the
    display name as text. `appearance.icons` replaces the result tiles;
    `appearance.loader` (spinner, dots, bar, image) drives "Getting ready".
  - `typography.fontCss` is loaded (stylesheet URL, `@import` or `@font-face`)
    instead of Google Fonts when set.
  - "Powered by Sense" on every capture screen.
- **Precedence per field** (spec 2): code `appearance`, then legacy code fields
  (`primaryColor`, `logoUrl`, `displayName`), then the dashboard's
  `branding.appearance`, then its flat `primary_color` / `logo_url`, then Sense
  defaults. `UseSenseSDK` no longer defaults `primaryColor` to `#4F7CFF`, which
  hid the dashboard colour.
- **Sessions read the dashboard brand:** `branding` from session create and token
  exchange (`CaptureSessionData.branding`) now reaches the capture screens.
- In a Flow, the capture screens get the run's `appearance`, `copy` and the run
  view's `branding` (they read only `logo_url` before).
- With a light theme, the "Getting ready" and camera-request screens no longer
  mix a light background with white text.
- **Dark room, no face** (iOS parity, iOS PR #102): when the landmarker finds no
  face, the align screen measures the mean luma of the middle 60% of the frame.
  Below 70 for 0.4 s, the fill light turns on; the hint is silent while it settles
  (1.5 s), then "Find more light / Face a window or lamp" replaces "Show your face
  in the oval". The scan is unchanged (fill light frozen). A bright frame with no
  face behaves as before. Before, the light check ran only on a found face, so a
  dark room never got the fill light.
- **A head turn in the dark no longer pauses** (Android A03 device run): the fill
  light a dark scan needed now stays on for the extra check (it went off when the
  scan ended; never behind the inline Flash Reflection / RMAS), and sharpness gives
  way while moving, like stillness (a turning head in a dark room blurs every
  frame, which read as "Hold your phone steady"). Speak Digits and the scan still
  check sharpness. The paused line names the direction: "Then keep turning to the
  left", "Then keep tilting your head up", "Then look straight ahead" (new keys
  `extraCheck.pausedTurnSide` with `{side}`, and `extraCheck.pausedLookCentre`).
- **A face too dark to scan asks for light instead of starting** (user decision
  2026-11-11, iOS parity): on the align screen, a face-area mean luma below 20 (with
  or without the fill light) means no auto start and no shutter, and "Find more
  light / Face a window or lamp" stays up. From 20 up, light stays advice. A running
  scan is unchanged and no check is loosened. On an iPhone at luma ~7 the scan had
  dropped 15 windows (soft frames, the change watch reading sensor noise).

### Added

- **`copy.capture`** (spec 5): every string on the capture screens, with `{app}`
  and `{side}` placeholders. Blank keeps the shipped default (unchanged strings).
  `{side}` is the bare word (`left`, `right`, `up`, `down`); the preposition lives in
  the string ("Now to the {side}").
  Web-only keys added for strings the spec list lacks (reported for iOS/Android):
  `primer.gettingReady`, `primer.cameraTitle`, `primer.cameraBody`,
  `extraCheck.headTurnNext`, `slowly`, `tryAgain`, `turnFurther`, `keepFollowing`,
  `towardDot`, `pausedTurn`, `pausedDot`, `pausedDigits`, `cantHear`,
  `speakLouder`, `oneMoment`, `keepInOval`, `screenColour`, `result.retryTips`.
- `UseSenseSDK` accepts `appearance`, `copy` and `theme` (and `setBranding` takes
  `appearance` / `copy`). `VerificationCaptureEngine` accepts `appearance`,
  `copy` and `branding`.
- `CapturePreview` and `CAPTURE_PREVIEW_SCREENS`: a static preview of any capture
  screen with a brand (no camera, no network), for the dashboard's live preview.
- `resolveCaptureTheme`, `captureThemeVars`, `captureThemeTrace` (each field's
  source layer; logged with `window.__USESENSE_BRAND_TRACE__ = true`),
  `CaptureStrings`, `CAPTURE_COPY_DEFAULTS`, `mergeCaptureCopy`, the
  `SessionBranding` and `CaptureCopy` types.
- A test that fails on any new literal colour in capture UI code.

## [4.13.0] - 2026-11-10

### Added

- **Extra check on the scan screen** (LiveSense end-user storyboard, flows 4
  to 6). Guided capture only; `guidedCaptureEnabled: false` keeps the old
  screens.
  - **After the scan (server step-up, round 2):** when the /signals response
    asks for one, a "One more quick check" sheet (same styling as the upload
    sheet) says what to do in one sentence, then Continue runs the challenge
    on the scan screen: the clear camera, the oval and the ring in purple
    (`#A878FC`). Head Turn shows a side arrow ("Turn your head to the left",
    "Now to the right"); Follow Dot shows an amber dot with a dashed trail
    ("Follow the dot with your head"; it said "with your eyes", but the
    server checks head pose). Then a short green tick ("Done"), the upload
    sheet and the result. Replaces "One more quick check. Get ready...".
  - **Before the scan** (the session policy already has a challenge): the
    primer says "Two quick steps" and the movement follows straight on from
    the scan, with no brief, countdown or sheet.
  - **Speak Digits:** the numbers in a pill at the top, a live microphone
    level meter under the oval, "We can't hear you / Speak a little louder"
    after 2 s of silence. The microphone is asked for when the check starts
    (not with the camera). Refused or no input: "Microphone needed", with
    Try again or "Do a head movement instead", which calls the new
    `POST /v1/sessions/:id/challenge-fallback` and continues with the Follow
    Dot it returns. `requestChallengeFallback` and `ChallengeFallbackError`
    are exported.
  - **Unhappy paths:** the face leaving the oval pauses the check with an
    amber ring and says what to fix ("Move your face to the centre / Then
    keep turning"; Follow Dot: "Show your face in the oval / The dot will
    wait for you"); it never fails on the device. A missed turn gets one
    local retry with a hint ("Let's try that again / Turn a little further
    to the left"), then the server decides. Back after the scan has started
    asks "Leave verification?"; Leave ends the verification (onCancel, else
    back to the primer).
- **Result and error pages** from the storyboard: verified, in review,
  rejected (with "Try again" and tips only when `allowRetryOnReject` is set;
  new option, default off, with `onRetry` for a fresh session), camera
  refused (how to allow it in the browser), camera stopped, offline,
  timed out (15 minutes) and our error. `showResultScreen: false` still
  skips the result pages. A network failure during an upload keeps the scan
  and shows "Couldn't send your scan" with Try again.
- **Client inline step-up kept on the guided screens.** The suspicion engine
  still scores every capture, and when it triggers (and the policy's
  `inline_step_up.enabled` is not false) Flash Reflection / RMAS run on the
  scan screen: plain guidance under the oval ("One more moment", "Hold
  still", the RMAS action with "1 of 3"), an amber ring while it waits on
  the person, a green tick when done. It now also runs after a
  before-the-scan movement (it was skipped there), and always before the
  round-1 upload, so a server round-2 extra check comes after it.
- **Challenges get the same checks as the passive scan.** During any
  challenge (before the scan or round 2) the full quality gate keeps running:
  face found, one person, covered face (COVER-v1, judged on settled,
  facing-forward frames against a baseline from the challenge's own first
  frames), distance with the scan's hold band, in frame, sharpness, eyes
  open, light as advice. Pose is relaxed only toward the side the step asks
  for (Head Turn: the step's side, up to 50 degrees; Follow Dot: the dot's
  side); stillness applies to Speak Digits only. A failing check pauses the
  challenge as it pauses the scan: amber ring, guidance names the check
  ("Keep your face uncovered / Then keep turning"), no frames banked.
- **Closed-loop challenges, as iOS** (a port of the iOS `ChallengeRunner`):
  - Head Turn: a step ends once the pose has held the step's side for 0.6 s
    (15 degrees sideways, 12 up or down); after max(4 s, the server's step)
    one hint per challenge ("Let's try that again"), then "Let's try the next
    one" and the server decides.
  - Follow Dot: the dot glides to each waypoint and waits until the head
    moves along the dot's main direction from the previous waypoint
    (10 degrees yaw, 8 pitch, 10 degrees of wrong-way tolerance on the
    other axis).
  - The ring fills only for steps done. Frames bank only on target
    (Follow Dot: plus 2 once the dot has settled), and every step gets its
    share of the frame budget.
  - The challenge response carries `step_events` (prompt, reach and end
    times per step) and, for Follow Dot, `preview_mirrored: true`.
  - Gate pose limits per step as iOS: sideways 50, up/down 40, centre 30,
    Follow Dot 40/35, roll 20; Speak Digits keeps the scan's, and its
    stillness leaves out the chin. Yaw and pitch signs were measured on the
    web: left is negative yaw, up is positive pitch (same as iOS).
- **Round 2 carries the same signals as round 1**, in round 1's keys:
  `channel_integrity` (integrity signals, capture source, screen detection),
  `suspicion`, `verification_package` (mesh), `deep_classifier_on_device`
  (null: the web runs no on-device classifier), plus `frame_hashes`,
  `frames_manifest` and `face_mesh_signals`, all for round 2's frames.
- **Frozen camera guard.** Before either upload, if every frame of the
  round is the same picture (identical frame hashes or identical face
  meshes, 3 frames or more), the camera feed froze: the SDK does not upload
  (the server would reject it as a possible replay) and ends on "The camera
  stopped / Try again", calling `onStreamInterrupted` like a lost stream.
- New phases: `extra-check-brief`, `extra-check-done`, `mic-denied`,
  `upload-failed`.

- **LiveSense evidence contract (EVIDENCE-v1).** Additive: a server that sends
  no `evidence` block (or another contract) gets the same upload as before.
  - The `evidence` block from session create, Flow init-session and token
    exchange is read as optional, unknown keys ignored (`CaptureSessionData.evidence`,
    type `EvidenceSessionBlock`). Flow init-session now passes it through.
  - Per frame in `verification_package`: all 478 landmarks, rounded to 5
    decimals before `meshDigest`, read from the canvas the JPEG was encoded
    from (unmirrored, the uploaded picture itself); `transformMatrix` and the
    pose from it under `poseNormalizationMethod: "matrix_zyx_v3"`;
    `blendshapes.eyeBlinkLeft/Right` (3 decimals); `timestamp` on the capture
    clock (ms since the camera opened).
  - The server's colour sequence plays during the guided scan as a tint over
    the view, timed by `requestAnimationFrame`, recorded as shown in
    `metadata.evidence.colour`. A gate pause stops it and the replay resumes
    at the interrupted colour (`completed: false`, `interrupted_reason`); a
    dropped scan window clears it. Frames bank every 200 ms while a colour is
    up. White balance is locked where the camera offers it (`awb_locked`);
    `screen_brightness` is null.
  - The covered-face change watch is held while the tint is up and takes a
    new steady baseline 500 ms after it (COVER-v1 "Fill light and the change
    watch").
  - `metadata.evidence.closer` is `{ completed: false, skipped_reason: "platform_web" }`;
    no binding v2. `capability` says what this build can do.

### Changed

- **`client_context` on every session start.** POST /v1/sessions,
  exchange-token and Flow init-session now send
  `{ schema_version: 1, sdk: { name: "web", version } }`. Watchtower picks
  the passive-first policy from it; without it web sessions stayed on the
  up-front challenge. A web context passed to the Flows client without a
  version gets this SDK's version.
- The guided primer is the storyboard's page ("Take a quick selfie", three
  tips, Start).

### Fixed

- `verification_package` has one entry per uploaded frame, keyed by upload
  position, ascending, with no duplicate index or hash (4.9.1 sent `[0,0,2,2]`).
  Frame grabs no longer overlap.
- `computeHeadPoseFromMatrix` put the roll formula under `yaw`, yaw under
  `pitch` and pitch under `roll`. Now the shared ZYX formula. This also
  corrects `face_mesh_signals.headPose`, the suspicion engine's yaw input and
  the inline step-up RMAS head-turn checks (person's left is negative yaw).
- Verification frames are stamped with the camera's capture time
  (`requestVideoFrameCallback` `captureTime`) where the browser gives it,
  not the draw time; elsewhere (Chrome on macOS, Firefox) the draw time.

## [4.12.0] - 2026-11-10

### Added

- **Contour relief v3.1.** The scan's contour lines bulge away from the face
  centre, as in Revolut's scan: they arch up over the forehead and head, sag
  under the mouth and chin, and stay flat beside the head. The bulge is a
  smooth bump fitted to the face (taller above the centre); a separate detail
  field from MediaPipe's face mesh lifts the lines a little over the nose,
  brow and lips. Lines are one colour (the ring colour), 1.3 px, 9 px apart,
  never closer than 2.5 px, and packed lines fade. The camera blurs (18 px)
  1.5 s into the scan so the lines carry the shape. Display only.
- **Covered-face check** ("Keep your face uncovered"), after "one person" in
  the gate. During the scan, six face regions (forehead, cheeks, nose, mouth,
  chin) are compared with the scan's first frames; a region whose luma ratio,
  colour or edge energy changes past the limits (a hand, a phone, paper
  coming in front of the face) on 2 consecutive frames pauses the scan, so a
  single-frame blip on a clear face doesn't. The fill light is decided before
  the scan and frozen during it, since a veil appearing behind the watch's
  baseline reads as a covered face; if it changes anyway, the watch pauses
  500 ms and takes a new baseline. A brightness change alone never does. The
  baseline comes only from 3 consecutive settled frames (face found, still,
  in the oval, at the distance, facing forward), so a scan started while the user is still moving in waits;
  until then the watch is off. On a frame where the head moves, the watch
  doesn't judge and the guidance is "Hold still". A global
  brightness change such as the fill light does not trip it. Limits match
  iOS and Android. iOS and Android also run a segmentation model before the
  scan; the web does not ship it (a 16 MB download that added about 15 s to
  scan start on Fast 4G).

### Changed

- **Stalled signal uploads now retry.** Each attempt fails after 20 s with no
  bytes moving either way (it had no limit, so a stalled body hung), then
  retries on a fresh connection with the same idempotency key after 1, 2 and
  4 s. A slow upload that keeps moving is never cut off. `onAttempt` reports
  each attempt; `UPLOAD_RETRY` holds the timing. Debug trace (`console.debug`):
  bytes sent per 10% step and "body sent N bytes in Ts, waiting for the
  server". Parity with iOS and Android.
- **One person:** a second face overlapping the subject (IoU of 0.3 or more)
  is the same face found twice, not another person. Face presence and
  tracking confidence are 0.5 (were 0.3), as iOS and Android.
- **Light is advice only.** A too-dark face turns on the fill light and gets
  a hint, but no longer blocks auto start or the scan. Sharpness is still
  checked in any light.
- **Fill light** is a warm veil over the whole screen (`#FFF4E2` at 38%)
  instead of a frame around the oval. No light hint while it settles (1.5 s).
- **Distance hysteresis.** Once scanning, the distance band widens to
  0.15 to 0.34 (start band unchanged, 0.17 to 0.32).
- A paused scan's guidance names the check that holds it.
- **Upload bar** eases toward a cap per stage (sending to 60%, checking to
  95%) so it keeps moving until the result, matching iOS and Android. Copy:
  "Usually under 10 seconds".
- Sentence case on the camera, result, step-up and challenge-brief titles.

The upload payload and scoring are unchanged.

## [4.11.0] - 2026-11-08

### Added

- **LiveSense guided capture (Phase 1).** `VerificationCaptureEngine` now runs a
  quality gate on the face area in priority order (face found, one person,
  distance, in the oval, pose, light, sharpness, eyes open, stillness) and shows
  only the highest failing check as plain guidance text under the oval. A check
  must fail for 400 ms before its hint shows, and a hint stays at least 1.2 s.
  Distance uses eye distance over the oval width divided by 0.72, band
  0.17 to 0.32. The scan starts on its own after 2 s of all-pass, pauses
  instead of restarting on a failure, turns on a fill light when the face is
  too dark, and offers a shutter after 20 s or 3 paused windows.
- **Contour scan.** Full-bleed mirrored preview with depth contour lines edge to
  edge, a progress ring and an upload sheet, matching the iOS and Android SDKs.
- **Capture colours.** `FlowAppearance.capture { ring, contourStart, contourEnd,
  warning }`, with Sense defaults.
- **Shared face primer.** "Take a selfie" / "Start face scan" in both session
  and Flow modes. Back shows on every capture screen.
- **Hosted-link mode** for Flows (`mode: 'hosted'`), so Watchtower's hosted
  pages run on the SDK. `showIntro`, `showResultScreen` and
  `onStreamInterrupted` on the engine. Capture-source evidence and the camera
  inventory are sent with uploads.
- `guidedCaptureEnabled` (default `true`) keeps the old flow when `false`.

### Removed

- The "Powered by Sense" footer on engine screens and the legacy intro card.

### Fixed

- A capture chain left over from a previous attempt could upload alongside a
  retry. Chains now stop when their attempt is no longer current.
- With MediaPipe unavailable, the capture no longer sticks on the guide.

The upload payload and scoring are unchanged apart from the added
capture-source evidence.

## [4.10.2] - 2026-10-09

### Added

- **Face init-session sends a device binding.** When a flow's face step
  starts, the runner sends the stable signals the server hashes into the device
  fingerprint (`device_binding.components`). The server then reuses a Device
  Trust check from earlier in the run only if it came from this device, instead
  of matching on platform and User-Agent alone. Collection is capped at 1.5 s
  and never blocks the face step. `FlowsClient.initSession(toolId,
  deviceBinding)` takes it as an optional second argument.

## [4.10.1] - 2026-10-08

### Fixed

- **Device Trust no longer collects signals from a background tab.** The
  camera-free Device Trust step collected the browser's signals the moment
  the page loaded. A link opened in a background tab then reported
  `visibility_state: hidden` and `has_focus: false`, which DeepSense reads as a
  headless or background session: up to 40 points off, enough to fail the
  default threshold of 60 for a real person on a real device (seen on staging:
  51 and 60 where a focused tab scores near 100). The runner now waits until
  the page is visible, then for focus (at most 1.5s more), before collecting.
  It costs nothing when the page is already in front.

## [4.10.0] - 2026-10-08

### Added

- **Camera-free Device Trust.** The Flow runner declares
  `device_signals_v1` (`?caps=` on load, `client.capabilities` on advance). A
  Device Trust step then arrives as a `device` capture: the runner shows
  "Checking your device", collects the browser's integrity signals with no
  camera or prompt, and posts them with the step's nonce to
  `/v1/sdk/flow-runs/:id/device-signals`. A stale nonce or an already-settled
  step re-reads the run. Older SDKs keep working: the server settles the step
  from the network alone for them.
- **Server step-up (round 2).** When a server Step-up rule matches the uploaded
  capture, the `/signals` response now carries a `step_up` instruction. The
  `VerificationCaptureEngine` shows "One more quick check", runs the requested
  Head Turn or Follow Dot on the still-open camera with a fresh frame buffer,
  uploads it with `round=2`, and then completes. Nothing changes when the
  server asks for nothing, and an instruction this SDK can't render is ignored
  (the server then sends the session to review).
- The SDK declares `capabilities: ["step_up_v1"]` when it creates or exchanges
  a session, when a Flow face step starts, and in the upload metadata
  (`client_capabilities`) for sessions the integrator's backend created.
  Without it the server sends a step-up session to manual review.

## [4.9.1] - 2026-08-07

### Fixed

- 🐛 **Three screen-detection signals were never actually computed.** The engine
  called `computeScreenDetectionSignals(frameLuminances, null)`, and every
  canvas-derived signal starts `if (!canvas) return 0.5`, so
  `luminance_histogram_spread`, `edge_energy_ratio` and
  `color_channel_uniformity` all shipped as a hardcoded `0.5`. Production
  confirmed it: 42 sessions with exactly `0.5 / 0.5 / 0.5`. Only
  `frame_luminance_cv` carried a real measurement.

  Frames now encode into a persistent canvas so the last frame's pixels survive
  the call, and the real canvas is passed. `luminance_histogram_spread` is
  correctly calibrated against the observed range and now contributes actual
  anti-spoofing signal instead of a constant.

  Requires the server-side calibration fix, which is already deployed: the other
  two signals are scored against thresholds their formulas can never reach, so
  sending real values without it would newly penalise every session.

## [4.9.0] - 2026-08-07

### Changed

- ⚡ **Frames upload at 960px instead of the camera's native resolution.** Frames
  were encoded straight off the video element at whatever the camera returned,
  which put 1.9–3.4 MB on the wire per session. On a mobile uplink that is
  minutes of "Almost done": one production session was measured spending 1.9
  seconds capturing and 193 seconds uploading, at ~14.6 KB/s. Frames are now
  capped at 960 on the longest edge (portrait and landscape alike) with
  high-quality resampling, cutting frame bytes ~63%.

  960 was chosen by measuring, not by feel: 198 real frames from 11 production
  sessions across 3 orgs, pushed through the actual pipeline. Face matching is
  indifferent — Rekognition similarity 99.99 → 99.99 against a threshold of 90,
  zero detection failures, and cross-generation matching (an existing 720p
  enrolment against a downscaled probe) is unaffected. The binding constraint is
  Rekognition's `Quality.Sharpness`, which the server's screen-replay detector
  reads: at 960 no session in the corpus crossed the "possible screen" ceiling,
  where 640 pushed 2 of 11 over it and 480 pushed 7.

  `frames_manifest[].resolution_w/h` now reports the **encoded** size rather than
  the camera's native size, so the server can scale its sharpness thresholds to
  the capture. `channel_integrity.camera_resolution` still reports the native
  camera. Frame hashes are over the downscaled bytes, as before.

- ⚡ **metadata.json is gzipped.** It measured 345–461 KB uncompressed in
  production — 13–24% of the whole upload — and browsers do not compress request
  bodies on their own. gzip takes ~55% off it. Falls back to plain JSON where
  `CompressionStream` is missing (Safari < 16.4) or throws, so it can never fail
  a capture.

  **Requires a server that accepts gzipped metadata.** The server detects it from
  the payload's magic bytes rather than a filename or header, and still accepts
  plain JSON from older SDKs — but it must be deployed first.

### Added

- ✨ **The "Almost done" screen shows real upload progress** — a percentage, the
  total size, and a progress bar. A bare spinner makes a slow uplink
  indistinguishable from a hung one, and subjects force-quit rather than wait.
  Uploads now go over `XMLHttpRequest`, since `fetch()` cannot report request
  progress; retry, backoff, `Retry-After` and error handling are unchanged.
- ✨ `uploadSignals` accepts `onProgress({ loaded, total, percent })`. Fires per
  attempt, so a retry restarts at 0.

## [4.8.2] - 2026-08-05

### Changed

- **Report the document capture route.** The server tailors failure guidance to
  it: "hold the document still and wait for the camera to focus" is the right
  instruction for a live capture and meaningless to someone who chose a file,
  since the photo already exists and there is nothing left to hold. The camera
  review screen reports `camera`, the file input reports `upload` (both for
  images and for the PDF-to-JPEG branch). The runner already distinguished them
  for its own UI; it just never told the server.
- `captureMethod` is optional on the wire, so an older server ignores it and a
  runner that omits it makes the server fall back to the step's configured
  capture methods. No coordinated release required.

## [4.8.1] - 2026-08-04

### Fixed

- **"Verification is temporarily unavailable" for a document that was fine.** The
  document upload branch had two outcomes: `provider` -> "temporarily
  unavailable", everything else -> "please retake it". A file that arrived cut
  short took the first path, so a subject holding a perfectly good ID was told
  to wait out an outage that was not happening, and the retry re-sent identical
  bytes. The server now reports `reason: "incomplete"` and carries the
  instruction in `message`; neither old branch fits it, since nothing upstream
  is wrong and a retake changes nothing. Adds the third branch and a
  `documentIncomplete` copy key. `too_large` now also prefers the server's
  message, which is the only place the exceeded limit is known.

  Note: the corruption that produced this in production was server-side and is
  already fixed. This release only changes what the subject is told.

## [4.8.0] - 2026-07-29

### Added

- ✨ **The capture screen is now themeable.** `VerificationCaptureEngine` accepts a `theme` prop (`EngineTheme`, exported from the package root) covering background, foreground, muted, card and border colours, the primary foreground, success/destructive/warning, display and body fonts, and the light-mode surfaces used by the intro and result screens. Every token falls back to the palette that shipped before, so omitting `theme` renders exactly as it did.

### Fixed

- 🐛 **White-labelling no longer stops at the capture screen.** `FlowAppearance` covers colours, typography, shape, logo, background, icons and loader, but none of it reached the face capture step: `FlowRunner` passed a single `primaryColor` and the engine ignored the flow theme entirely. A fully white-labelled flow still handed the subject an unbranded dark screen at the step they look at most. The resolved theme is now mapped onto the engine.
- 🐛 `FlowRunner` now forwards `logoUrl` and `displayName` to the capture engine. It never had.
- 🐛 In dark mode, the engine's intro and result screens followed a hardcoded light surface and flashed white mid-flow. They now track the dark palette.

### Known gaps

- `icons`, `loader`, `shape` (radius and button style) and `background.imageUrl` from `FlowAppearance` are not yet mapped onto the capture screen. Colour, typography and the light/dark surfaces are.
- Sessions must pass `theme` explicitly. Dashboard-configured appearance is applied automatically for Flows only.

## [4.7.0] - 2026-07-29

### Fixed

- 🐛 **The capture environment no longer defaults to sandbox.** `VerificationCaptureEngine` did `environmentProp ?? 'sandbox'` while its published type said the environment was "inferred from the API key prefix". No inference existed. Because the engine sends `?env=` on every upload, a production session mounted without an explicit prop had its signals looked up in the sandbox scope and rejected, and the run rendered a "Sandbox" badge over live traffic. Precedence is now: explicit prop, then `sessionData.environment` (stamped by the server at session creation), then `production`. `StraightLineCaptureEngine` had the same default and is fixed with it.
- 🐛 **Upload and completion failures now surface.** On failure the engine called `onError` but never left the `uploading` phase, so the UI sat on "Almost done" indefinitely while only the host was notified. There was no error phase beyond `camera-error`.

### Added

- ✨ `failed` capture phase: a terminal state for post-capture failures, with a message and a retry action.
- ✨ `CaptureSessionData.environment`, the environment the server recorded for the session. Optional for wire compatibility with older backends; the capture engines prefer it over any local default. Pass the session body from `POST /v1/sessions` through unchanged so the SDK never has to guess.

### Changed

- ⬆️ React 19 is now an accepted peer dependency (`^18.0.0 || ^19.0.0`). `^18.0.0` alone made the package uninstallable on a React 19 app.

## [4.6.0] - 2026-06-27

### Changed

- 🎨 Rebranded front-facing copy from UseSense to Sense.

## [4.5.0] - 2026-06-27

### Added

- ✨ **White-labeling.** `FlowAppearance` (full color palette + dark-mode overrides, typography, shape/button style, logo, background, custom icons/illustrations, and loader) plus `FlowCopy` (every subject-facing string and privacy disclosure) overrides on `runFlow`, merged SDK-init > dashboard org settings > built-in default. Exported from the package root; see `docs/WHITE_LABEL.md`.
- 🎨 Hosted-run-page parity for the flow runner: brand theme, dark mode, bundled brand fonts, branded loaders, and the id_number step.

### Fixed

- Server-configured `typography.fontCss` is now injected (was read from SDK-init only); blank color overrides fall back instead of clobbering; `background.color` applies in light mode only; a blank copy override falls through to the server value instead of the built-in default.

## [1.0.0] - 2026-02-19

### Added

#### Core SDK
- ✨ Initial release of @usesense/web-sdk
- 🎥 Video capture module with configurable FPS and duration
- 🎤 Audio capture module with risk-based policy support
- 🌐 Web integrity signal collection (comprehensive browser fingerprinting)
- 🔐 WebAuthn integration for optional credential binding
- 🎯 Step-up challenge support (head turn, follow dot, speak phrase)
- 📡 Complete API client for UseSense backend integration
- 🔄 Event-based architecture with comprehensive event types
- ⚡ TypeScript support with full type definitions
- 🎨 Customizable branding (colors, logos, fonts)

#### React Components
- 📱 `UseSenseVerification` - Main embedded verification component
- 🖼️ `IntroScreen` - Initial loading screen
- 🔑 `PermissionScreen` - Camera/microphone permission request
- 📹 `CaptureScreen` - Face framing and video capture
- 🎮 `ChallengeScreen` - Step-up challenges (dot tracking, head turn, speak)
- ⏳ `UploadingScreen` - Upload progress indicator
- ✅ `SuccessScreen` - Verification success
- ❌ `FailureScreen` - Verification failure with retry
- 🚫 `BlockedScreen` - Service unavailable

#### Features
- 🔄 Headless mode for programmatic control
- 🎨 Minimal, calm, trustworthy UI design
- 📊 Comprehensive metadata payload (timestamps, manifests, integrity signals)
- 🔐 Idempotency key support for API requests
- 🚨 Typed error handling with user-friendly messages
- 📈 Event callbacks for analytics and monitoring
- 🌍 Cross-browser compatibility (Chrome, Safari, Firefox, Edge)
- 📱 Mobile-responsive design
- ⚡ Graceful degradation for missing APIs

#### Demo Application
- 🎮 Complete Next.js demo application
- 📝 Enrollment flow demonstration
- 🔐 Authentication flow demonstration
- 🎨 Real-time branding customization
- 🐛 Debug console with event logs
- 📊 Web integrity signal inspector
- 🎯 Configuration options for testing

#### Documentation
- 📖 Comprehensive SDK README
- 📱 Demo application README
- 🔗 Integration guide with code examples
- 🏗️ Architecture overview
- 🔒 Security and privacy documentation
- 🐛 Troubleshooting guide
- 📝 TypeScript API documentation

### Security
- 🔒 No storage of video/audio in localStorage/IndexedDB
- 🔐 In-memory only capture data
- 🚨 Automatic cleanup of media streams
- 🔑 Environment variable support for credentials
- 🛡️ HTTPS requirement for production
- 🔐 Idempotency keys for all mutations

### Performance
- ⚡ Optimized video frame capture (15 FPS default)
- 📦 Minimal bundle size
- 🚀 Lazy loading support
- 🎯 Configurable upload limits
- ⏱️ Sub-5-second completion time

### Browser Support
- ✅ Chrome 80+
- ✅ Safari 14+
- ✅ Firefox 75+
- ✅ Edge 80+

### API Endpoints
- POST `/v1/sessions` - Create verification session
- POST `/v1/sessions/{id}/signals` - Upload capture signals
- POST `/v1/sessions/{id}/complete` - Complete session and get decision
- GET `/v1/sessions/{id}/status` - Poll session status

### Known Limitations
- ⚠️ No mobile native SDK (web only)
- ⚠️ No OS-level attestation (use WebAuthn as alternative)
- ⚠️ Liveness detection happens server-side (not in browser)
- ⚠️ Requires HTTPS in production (localhost OK for dev)

---

## [Unreleased]

### Planned Features
- 🔄 Automatic retry with exponential backoff
- 📊 Built-in analytics dashboard
- 🌐 Internationalization (i18n) support
- 🎨 Pre-built theme presets
- 📱 React Native SDK
- 🔐 Advanced WebAuthn features (conditional UI)
- 🎯 Enhanced challenge types
- 📈 Real-time quality feedback during capture
- 🔍 On-device face detection (optional)
- 🎥 H.264 hardware encoding support

---

## Version History

- **1.0.0** (2026-02-19): Initial release

---

## Migration Guides

### Migrating to 1.0.0

This is the initial release. No migration needed.

---

## Breaking Changes

None yet (initial release).

---

## Deprecations

None yet (initial release).

---

## Support

For questions about this changelog or the SDK:

- **Email**: support@usesense.com
- **Docs**: https://docs.usesense.com
- **GitHub**: https://github.com/usesense/web-sdk

---

**Note**: This changelog follows [semantic versioning](https://semver.org/). Breaking changes will increment the major version.
