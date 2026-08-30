# UseMyCurrentAccount

A browser extension for Microsoft Edge (and other Chromium browsers) that signs you in with the
browser profile's account by default.

If you have multiple "Connected to Windows" accounts, you'll be prompted to pick which account
every time you access a site that requires a login. This extension skips that screen by using
the browser profile's account.

The recommended way to use this is to use a separate profile in Edge for each AAD account you have and install
this extension in each profile. Then go to the site you want in the profile you want and you won't be prompted to login.

Click the toolbar icon to open the popup: switch the toggle off to be prompted normally, or add
other account emails and select which one to sign in with — the profile's account is the default.
(Browsers don't let extensions list your other signed-in accounts, so additional accounts are
entered manually.)

## Installation

Load the repository root as an unpacked extension: open `edge://extensions` (or
`chrome://extensions`), enable Developer mode, and choose "Load unpacked".
