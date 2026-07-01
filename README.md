# MS Quick Search

A Firefox / Zen WebExtension that turns the address bar into a launcher for
configurable custom search engines.

Modeled after the [Chrome extension Custom Search Engine](https://chromewebstore.google.com/detail/custom-search-engine/kelahdmegihhooaelnaahkeggodajdjf)

Type:

```
ms <keyword> <search text>
```

For example, with the default configuration:

```
ms g firefox extension tips        -> Google search
ms c dosearchsite                  -> Confluence site search
ms yt zen browser review           -> YouTube search
```

## How it works

- The extension registers `ms` as an [omnibox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/omnibox)
  keyword. After typing `ms ` and a space in the address bar, Firefox/Zen hands
  control of that input to this extension.
- The first word after `ms` is looked up against your configured keyword list.
  The rest of the text is substituted into that engine's URL template wherever
  `{searchTerms}` appears (URL-encoded).
- If the keyword isn't recognized, the whole input is sent to your default
  fallback engine (Google, by default) instead.
- As soon as you type `ms ` (before typing anything else), the single-line
  suggestion shows every configured keyword and name, e.g.
  `Keywords: c (Confluence), g (Google), yt (YouTube)`. This value is kept
  up to date proactively (on browser startup, install, and whenever settings
  are saved/synced) rather than set reactively when you enter keyword mode —
  reacting at that point is too late, since the omnibox row is already
  rendered by the time the update would land.
- The full multi-row dropdown is a separate, hard platform limit: Firefox's
  `omnibox.onInputChanged` event does not fire for the bare empty-text state,
  only once you type an actual character after `ms `. At that point it
  narrows to matching keywords (e.g. `g — Google`), and once you add search
  text each suggestion previews which engine it will run against.

## Configuring keywords

Open the extension's **Options** page (`about:addons` → MS Quick Search →
Preferences, or `about:debugging` while loaded temporarily) to add, edit, or
remove keywords. Each entry has:

- **Keyword** — the word typed after `ms` (no spaces), e.g. `c`
- **Name** — a friendly label shown in suggestions
- **URL template** — the destination URL, with `{searchTerms}` marking where
  the search text is inserted

Example Confluence entry:

```
Keyword: c
Name:    Confluence
URL:     https://confluence.mycompany.com/dosearchsite.action?cql=siteSearch+~+%22{searchTerms}%22&queryString={searchTerms}
```

Settings are stored in `browser.storage.sync`, so they roam with your Firefox
account if sync is enabled.

## Syncing across devices

Because settings live in `browser.storage.sync`, any keyword you add or edit
automatically syncs to every device signed in to the same Firefox Account
with Sync enabled for **Add-ons** (check this under
`about:preferences#sync`). The options page has a shortcut button that opens
that settings pane directly.

While the options page is open:

- If you have no unsaved edits, changes that arrive from another synced
  device are applied automatically and a status message confirms it.
- If you're mid-edit, a banner appears instead ("Settings changed on another
  synced device") with a **Reload** button, so a remote change never silently
  overwrites what you're typing.

Notes:

- Sync only propagates while both devices are online and Firefox has synced
  recently — there's no way for a WebExtension to force an immediate sync
  cycle.
- If Firefox Sync isn't set up at all, `storage.sync` still works — it just
  behaves like local storage on that single device.

## Installing (Firefox or Zen)

Zen is a Firefox fork and loads WebExtensions the same way Firefox does.

### Temporary install (development / unsigned use)

This is the easiest way to run the extension without dealing with signing at
all — Firefox and Zen both allow loading *any* unsigned add-on this way,
regardless of the `xpinstall.signatures.required` setting or which release
channel you're on.

1. Go to `about:debugging` in the address bar.
2. Click **This Firefox** (or **This Zen**) in the sidebar.
3. Click **Load Temporary Add-on…**.
4. In the file picker, select either:
   - `manifest.json` in this folder, to load the source directly (best while
     actively developing — no build step needed), or
   - the built package at `dist/ms_quick_search-1.0.0.xpi`, to load exactly
     what you'd ship.

The add-on appears in the list on that page as "MS Quick Search," and the
`ms` keyword is immediately usable in the address bar.

Trade-offs to know about:

- **It's temporary**: the add-on is unloaded the next time the browser fully
  restarts (not just closing a window) — closing and reopening Zen/Firefox
  means repeating the steps above. It's meant for active development
  sessions, not day-to-day permanent use.
- **After editing source files**, go back to `about:debugging` and click
  **Reload** next to the add-on — changes to `background.js`/`options.*`
  aren't picked up automatically the way a normal web page would be.
- **Errors are visible here too**: `about:debugging` has an **Inspect**
  button for the loaded add-on that opens its console/background-script
  logs, useful for debugging `background.js`.

For something that survives a restart, see **Permanent install** below.

### Permanent install

A packaged, ready-to-install build is at `dist/ms_quick_search-1.0.0.xpi`
(rebuild it any time with the command in [Building the package](#building-the-package)
below). It is **unsigned** — Mozilla only signs extensions it has reviewed,
so a locally-built package like this one can't be signed without going
through that process. What "install permanently" requires depends on your
browser:

1. **Try it directly first**: `about:addons` → gear icon → **Install Add-on
   From File…** → select the `.xpi`. Some Firefox forks, including Zen, ship
   with signature enforcement relaxed for exactly this kind of self-built
   add-on, so this may just work.
2. **If it's rejected as unsigned**, check `about:config` for
   `xpinstall.signatures.required` and set it to `false`, then retry step 1.
   This override is only honored on Firefox Developer Edition, Nightly, ESR,
   or unbranded builds — not on release-channel Firefox — but many forks
   (Zen included) enable it more broadly.
3. **For a build that installs on any channel, including release Firefox**:
   sign it yourself for free via Mozilla's self-distribution flow.
   - Create an account at https://addons.mozilla.org and generate an API
     key/secret at https://addons.mozilla.org/developers/addon/api/key/.
   - From this folder, run:
     ```
     npx web-ext@7 sign --source-dir=. --artifacts-dir=./dist \
       --api-key=<your-jwt-issuer> --api-secret=<your-jwt-secret> \
       --channel=unlisted
     ```
   - This uploads the extension for automated review and downloads a signed
     `.xpi` into `dist/` once approved (usually within minutes). Install that
     file the same way as above — it will work permanently on any Firefox or
     Zen install without config changes.

## Building the package

The `dist/` folder holds the packaged `.xpi`. To rebuild it after making
changes (bumping `version` in `manifest.json` first is recommended):

```
npx web-ext@7 build --source-dir=. --artifacts-dir=./dist --overwrite-dest
```

This zips up exactly the extension source files (it skips `dist/`, `README.md`
is currently included but harmless, and dotfiles/hidden folders are excluded
automatically). The web-ext CLI requires Node 20+; pinning to `web-ext@7`
above works on Node 18 too.

## Files

- `manifest.json` — extension manifest (MV3, omnibox keyword `ms`)
- `background.js` — omnibox parsing, URL building, navigation
- `options.html` / `options.js` / `options.css` — settings UI for managing keywords
- `dist/` — packaged `.xpi` build output
