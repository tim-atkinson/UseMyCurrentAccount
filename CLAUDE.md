# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Use My Current Account" is a Microsoft Edge browser extension (also Chrome-compatible) that skips the account-picker screen on Microsoft sign-in pages by defaulting to the browser profile's account. It is published to the Edge Extension Store. The intended usage model is one Edge profile per AAD account, with the extension installed in each profile.

## Development

There is no build system, package manager, linter, or test suite. The extension is plain JavaScript loaded directly by the browser:

- To test changes, load the repository root as an unpacked extension (edge://extensions or chrome://extensions with Developer mode enabled) and reload it after edits.
- When releasing, bump `version` in `manifest.json`.

## Architecture

The entire extension is two files:

- `manifest.json` — Manifest V3, with a (non-persistent) background **service worker**. Permissions: `identity`/`identity.email` (to read the profile's email), `storage` (to persist the on/off toggle), and `declarativeNetRequest` with `host_permissions` scoped to `login.microsoftonline.com`.
- `src/background.js` — all logic. MV3 forbids blocking `webRequest`, so URL rewriting is done with **declarativeNetRequest dynamic rules** (installed via `updateDynamicRules`, keyed by fixed rule ids):
  - Redirect rules use `queryTransform.addOrReplaceParams` to rewrite sign-in URLs:
    - `/authorize` requests: appends `login_hint=<email>` — but only if neither `login_hint` nor `sid` is already present (a `sid` means a session is already selected; overriding it would break sign-in).
    - `/saml2` and `/wsfed` requests: appends `whr=<email domain>` if `whr` is not already present (SAML/WS-Fed flows use realm discovery, not `login_hint`).
  - The "only if not already present" guarantee is enforced by **higher-priority `allow` rules** whose `regexFilter` matches URLs already carrying the parameter — this also prevents the rewritten request from being redirected again. Any change to the redirect rules must keep the paired allow rules in sync.
  - `regexFilter` patterns are RE2, which has no lookahead/lookbehind — hence the allow-rule pattern rather than a negative match in the redirect rule.
  - Dynamic rules persist across service worker restarts, but `init()` re-syncs them on every worker start so they track the current profile email (from `chrome.identity.getProfileUserInfo`) and stored state.
  - Clicking the toolbar icon (`chrome.action.onClicked`) toggles the behavior: on adds the rules, off removes them; state is persisted in `chrome.storage.local` and reflected as an "Off" badge on the icon.

Behavior guarantees to preserve when modifying the request rewriting: never override an existing `login_hint`, `sid`, or `whr` parameter, and only touch `login.microsoftonline.com` URLs.

## Privacy Constraint

Per `PrivacyPolicy.md`, the profile email address is used only to set `login_hint`/`whr` in requests and is never stored or transmitted anywhere else. Don't add code that persists or sends the email.
