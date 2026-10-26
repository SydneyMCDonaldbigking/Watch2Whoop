# Elder-friendly UI: first increment

Implemented on `feat/elder-care-mvp` as an optional presentation plugin. This increment targets the existing web interface used by the Flutter shell and by browsers. It does not add family relationships, medication workflows, new health calculations or medical advice.

## Use

Choose **大字模式 / Easy view** in the page header or on the sign-in screen. The **Me** page also includes **大字简洁模式 / Large text & simple view**, with an explanation and a switch back to the standard interface.

The choice defaults to off and is stored in browser/device local storage as `be.elder-mode`. It applies to that browser/device, including its sign-in screen, rather than to an account. Storage failures leave the current view usable and display a warning that the choice could not be saved. Clearing site data clears the preference.

When enabled:

- Larger text, stronger secondary-text/status colors, visible keyboard focus and reduced motion.
- Main buttons and form fields have at least 52 CSS pixels of height; icon controls have at least 48.
- Summary cards use one column, with four persistent navigation entries: Today, Trends, Log and Me.
- **More pages** retains access to the existing Log and Food pages. Friends appears only when the original server flag exposes it. Existing authorization checks still apply.
- **Read this page** reads visible content in the current page with a matching language voice explicitly marked `localService`. There is no cloud-voice fallback. If none is available, the user is directed to the device screen reader. Reading can be stopped and is cancelled when changing pages, opening sheets, changing login state, replacing page content, hiding or leaving the page.
- New sheets move focus inside, wrap keyboard tab navigation and restore focus when closed.

Reading is initiated by the user. Input values and hidden elements are excluded from text extraction. The plugin sends no network requests and persists no page text, health data or sharing permissions. Reading aloud can be heard by people nearby, so users should choose where to use it.

## Integration

- `body_engine/src/body_engine/web/static/elder-mode.js`: existing `BodyPlugins` and `BodyHooks` interfaces, preference, controls and local speech.
- `body_engine/src/body_engine/web/static/elder-mode.css`: overrides scoped under `html.elder-mode`; standard mode remains available.
- `index.html`: stylesheet/script registration, header/sign-in switches and quick actions.
- `i18n.js`: matching Chinese and English keys.
- `sw.js`: new assets in the shell cache and shell version advanced to `be-shell-v148`.
- `body_engine/tests/test_i18n.py`: new script registered for the existing translation coverage checks.

There are no database migrations, API changes, extra dependencies or modifications to `app.js`, HealthKit sync, scoring, account roles or data-access rules. The existing flat asset embedding path also picks up the new stylesheet and script for the native offline shell.

## Validation performed

Validation used a loopback-only preview serving the real static assets with synthetic API fixtures, with a visible preview label. It did not access a real account or health database. The fixture server and its data are outside the repository.

- Existing internationalization assertion functions passed directly for every registered script and page: bilingual key coverage, used keys, marked HTML, script load order and service-worker asset registration. This was not a full pytest run; pytest is unavailable in the current runtime.
- JavaScript syntax checks and Git whitespace checks.
- Browser checks: standard/easy view switching and persistence, sign-in toggle, Me settings, Chinese/English labels, narrow mobile widths, 200% root text, and desktop layout.
- More pages follows the original Friends flag; sheet focus entry, wrapping and restoration checked with keyboard navigation.
- Deterministic browser speech stubs verified the local-voice path, cancellation on navigation, and refusal of a remote-only voice. This does not establish audible playback on real hardware.

## Remaining acceptance work

Run the interface in the iOS Flutter/WKWebView app and on target devices with VoiceOver/TalkBack and actual local voices. Check dark mode, long translations, dynamic text, every existing detail sheet and users with differing permissions against a real development backend. The current synthetic preview does not validate backend integration, HealthKit or live scores. This increment is not a claim of full accessibility conformance.

Family authorization and revocation, personalized trend baselines, medication reminders and reliable notifications remain separate development phases in `ELDER_CARE_MIGRATION_PLAN.md`.
