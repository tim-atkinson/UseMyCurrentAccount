# Information used by Use My Current Account

First, a reminder: Use My Current Account is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement.

With that out of the way, here's a breakdown of all the information we may collect or use:

* Email Address

The browser profile's email address is used to set the `login_hint`/`whr` parameters on sign-in requests to `https://login.microsoftonline.com`. It is not stored or transmitted anywhere else.

* Accounts you add

Email addresses you add in the popup are saved in the browser's local extension storage so they can be listed for selection. They never leave your browser, except that the selected one is used to set `login_hint`/`whr` on sign-in requests exactly as above. Removing an account from the list deletes it from storage.

* Activity log

The extension keeps a local log of the sign-in requests it processed: a timestamp, the flow type (OAuth/SAML/WS-Fed), the action taken (hint added, or skipped because the request already specified an account), and the website that initiated the sign-in. Log entries never contain email addresses or URLs, only the 200 most recent are kept, they never leave your browser, and the log can be cleared at any time from the activity log page.