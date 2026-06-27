# White-labeling the UseSense flow runner

The verification UX is fully customizable through **one contract** — `FlowAppearance`
(look) and `FlowCopy` (words) — shared verbatim across the web, iOS, Android,
React Native, and Flutter SDKs, the hosted run pages, and remote sessions.

You can configure it **two ways**, and they merge so both work together:

```
SDK-init config   >   dashboard (org settings)   >   built-in hosted-page default
   (in code)            (no-code, per org)              (omit a field to inherit)
```

Every field is optional. Anything you don't set keeps the polished default.

---

## 1. In code (per-run, highest priority)

Pass `appearance` and/or `copy` when you start a run.

**Web**
```ts
runFlow({ flowRunId, sdkToken, appearance, copy });
```
**React Native**
```ts
UseSenseFlows.runFlow({ flowRunId, sdkToken, appearance, copy });
```
**iOS (Swift)**
```swift
UseSenseFlows.run(flowRunId: id, sdkToken: token,
                  appearance: appearance, copy: copy)   // or via BrandingConfig
```
**Android (Kotlin)**
```kotlin
UseSenseFlows.run(context, flowRunId = id, sdkToken = token,
                  appearance = appearance, copy = copy)
```
**Flutter (Dart)**
```dart
UseSenseFlows.runFlow(flowRunId: id, sdkToken: token,
                      appearance: appearance, copy: copy);
```

## 2. In the dashboard (no-code, per org)

**Settings → Branding → "Flow Appearance & Copy"** has an Appearance editor (full
palette + dark overrides, fonts, shape, logo, background, mode) with a live
preview, and a Copy editor (a field per string, placeholder = the default). It's
saved on your org settings and delivered to every SDK + the hosted pages
automatically — no redeploy.

---

## `FlowAppearance` reference

```ts
{
  colors?: {
    primary, primaryForeground, background, surface, foreground,
    muted, border, success, error, warning,
    dark?: { /* same keys — applied only in dark mode */ }
  },
  typography?: { fontFamily, displayFamily, fontCss },
  shape?: { radius, buttonRadius, buttonStyle: 'filled' | 'outline' },
  logo?: { url, placement: 'header' | 'center' | 'none', height },
  background?: { color, imageUrl },
  icons?: { success, review, notVerified, [slot]: url },   // custom illustrations
  loader?: { style: 'spinner' | 'dots' | 'bar', imageUrl },  // custom loader asset
  mode?: 'light' | 'dark' | 'auto'                           // default 'auto' (OS)
}
```

Notes:
- **Fonts:** the web SDK can load any web font via `typography.fontCss`; the native
  SDKs map a font *family name* to the closest system font (they can't fetch web
  fonts at runtime). Omit typography to keep the bundled Outfit / DM Sans.
- **Dark mode:** `mode: 'auto'` follows the OS and updates live; `colors.dark`
  overrides specific tokens in dark mode only.
- **Icons / loader:** image URLs (PNG/SVG/GIF). They render on surfaces that show
  illustrations (result screens, the loader); the web runner has no result
  illustration, so `icons` there is a no-op.

## `FlowCopy` reference

```ts
{
  welcome?: { title, body },
  buttons?: { continue, cancel, tryAgain, retake, useThisPhoto, uploadInstead, scan, upload, submitting },
  loading?: { default, verifying, submittingDocument, checkingQuality },
  face?:    { title, body, start },
  document?:{ selectTitle, selectBody, primerTitle, primerBody, uploadTitle, uploadBody, scanTitle, scanBody, confirmTitle, confirmBody },
  form?:    { title },
  idNumber?:{ title, body },
  result?:  { successTitle, successBody, reviewTitle, reviewBody, notVerifiedTitle, notVerifiedBody, cancelledTitle },
  errors?:  { generic, providerUnavailable, documentUnreadable },
  privacy?: { disclosure, consentTitle, consentBody },
  help?:    { [slot]: text }
}
```

A blank or omitted value always falls back to the built-in default, so you can
override just the strings you care about.

---

## Example

```ts
const appearance = {
  colors: { primary: '#E4002B', dark: { background: '#0A0A0A' } },
  shape:  { buttonRadius: 4, buttonStyle: 'outline' },
  logo:   { url: 'https://acme.example/logo.svg', placement: 'header' },
  loader: { imageUrl: 'https://acme.example/loading.gif' },
};
const copy = {
  face:   { title: 'Quick selfie check', start: 'Begin' },
  result: { successTitle: "You're verified", successBody: 'Welcome to Acme.' },
  privacy:{ disclosure: 'Acme processes your image per our Privacy Policy.' },
};
runFlow({ flowRunId, sdkToken, appearance, copy });
```
