
// Dynamic declarativeNetRequest rule ids.
const ALLOW_AUTHORIZE = 1;
const REDIRECT_AUTHORIZE = 2;
const ALLOW_REALM = 3;
const REDIRECT_REALM = 4;
const ALL_RULE_IDS = [ALLOW_AUTHORIZE, REDIRECT_AUTHORIZE, ALLOW_REALM, REDIRECT_REALM];

const RESOURCE_TYPES = ['main_frame', 'sub_frame', 'xmlhttprequest', 'other'];

function getProfileEmail() {
   return new Promise(function (resolve) {
      chrome.identity.getProfileUserInfo(function (userInfo) {
         resolve(userInfo && userInfo.email);
      });
   });
}

function buildRules(email) {
   // The allow rules outrank the redirect rules, so a request that already
   // carries login_hint/sid (or whr) is never rewritten — this also stops the
   // rewritten request from being redirected again.
   var rules = [
      {
         id: ALLOW_AUTHORIZE,
         priority: 2,
         action: { type: 'allow' },
         condition: {
            regexFilter: '^https://login\\.microsoftonline\\.com/[^?]*/authorize[^?]*\\?(?:.*&)?(?:login_hint|sid)=',
            resourceTypes: RESOURCE_TYPES
         }
      },
      {
         id: REDIRECT_AUTHORIZE,
         priority: 1,
         action: {
            type: 'redirect',
            redirect: {
               transform: {
                  queryTransform: {
                     addOrReplaceParams: [{ key: 'login_hint', value: email }]
                  }
               }
            }
         },
         condition: {
            regexFilter: '^https://login\\.microsoftonline\\.com/[^?]*/authorize',
            resourceTypes: RESOURCE_TYPES
         }
      }
   ];

   // The whr realm rules need the email's domain; skip them rather than
   // inject a bogus value if the email is not in the expected form.
   var at = email.indexOf('@');
   if (at > 0 && at < email.length - 1) {
      var domain = email.slice(at + 1);
      rules.push(
         {
            id: ALLOW_REALM,
            priority: 2,
            action: { type: 'allow' },
            condition: {
               regexFilter: '^https://login\\.microsoftonline\\.com/[^?]*/(?:saml2|wsfed)[^?]*\\?(?:.*&)?whr=',
               resourceTypes: RESOURCE_TYPES
            }
         },
         {
            id: REDIRECT_REALM,
            priority: 1,
            action: {
               type: 'redirect',
               redirect: {
                  transform: {
                     queryTransform: {
                        addOrReplaceParams: [{ key: 'whr', value: domain }]
                     }
                  }
               }
            },
            condition: {
               regexFilter: '^https://login\\.microsoftonline\\.com/[^?]*/(?:saml2|wsfed)',
               resourceTypes: RESOURCE_TYPES
            }
         }
      );
   }

   return rules;
}

function getState() {
   return new Promise(function (resolve) {
      chrome.storage.local.get('state', function (data) {
         resolve(data.state === undefined ? true : data.state);
      });
   });
}

function getSelectedAccount() {
   return new Promise(function (resolve) {
      chrome.storage.local.get(['selected', 'accounts'], function (data) {
         var accounts = Array.isArray(data.accounts) ? data.accounts : [];
         var selected = typeof data.selected === 'string' ? data.selected : null;
         // Only honor a selection that is still in the saved account list;
         // anything else falls back to the profile account.
         resolve(selected && accounts.indexOf(selected) !== -1 ? selected : null);
      });
   });
}

async function sync() {
   var state = await getState();
   updateIcon(state);

   // A user-selected account takes precedence; the profile account is the
   // default. The selected value is user-entered, so it gets the same
   // guarded treatment as the profile email in buildRules.
   var email = null;
   if (state) {
      email = (await getSelectedAccount()) || await getProfileEmail();
   }

   if (state && email) {
      await chrome.declarativeNetRequest.updateDynamicRules({
         removeRuleIds: ALL_RULE_IDS,
         addRules: buildRules(email)
      });
   } else {
      await chrome.declarativeNetRequest.updateDynamicRules({
         removeRuleIds: ALL_RULE_IDS
      });
   }
}

// The popup writes the toggle state and account selection to storage; react
// here so the rules and badge stay in sync (the toolbar icon no longer fires
// onClicked once a popup is set).
chrome.storage.onChanged.addListener(function (changes, area) {
   if (area === 'local' && (changes.state || changes.selected)) {
      sync();
   }
});

function updateIcon(state) {
   var color = [255, 0, 0, 255];
   var text = state ? '' : 'Off';
   chrome.action.setBadgeBackgroundColor({
       color: color
   });

   chrome.action.setBadgeText({
       text: text
   });
}

// --- Activity log -----------------------------------------------------------
// declarativeNetRequest match feedback is only available to unpacked
// extensions, so processed sign-ins are observed with non-blocking webRequest
// listeners on the same URLs the rules target. Log entries deliberately
// contain no email addresses and no URLs (request URLs carry login_hint);
// only a timestamp, the flow, the action taken, and the initiating site.

var MAX_LOG_ENTRIES = 200;
var rewrittenRequestIds = new Set();

var WATCH_FILTER = {
   urls: [
      'https://login.microsoftonline.com/*/authorize*',
      'https://login.microsoftonline.com/*/saml2*',
      'https://login.microsoftonline.com/*/wsfed*'
   ],
   types: RESOURCE_TYPES
};

function classifyFlow(url) {
   var path = url.pathname;
   if (path.indexOf('/authorize') !== -1) { return 'oauth'; }
   if (path.indexOf('/saml2') !== -1) { return 'saml'; }
   if (path.indexOf('/wsfed') !== -1) { return 'wsfed'; }
   return null;
}

function hasHint(url, flow) {
   var params = url.searchParams;
   if (flow === 'oauth') {
      return params.has('login_hint') || params.has('sid');
   }
   return params.has('whr');
}

function appendLog(entry) {
   chrome.storage.local.get('log', function (data) {
      var log = Array.isArray(data.log) ? data.log : [];
      log.unshift(entry);
      if (log.length > MAX_LOG_ENTRIES) {
         log.length = MAX_LOG_ENTRIES;
      }
      chrome.storage.local.set({ log: log });
   });
}

// A matching request that already carries the hint was left alone — unless it
// is the re-issued request following our own rewrite (same requestId).
chrome.webRequest.onBeforeRequest.addListener(function (details) {
   if (rewrittenRequestIds.has(details.requestId)) { return; }
   var url = new URL(details.url);
   var flow = classifyFlow(url);
   if (!flow || !hasHint(url, flow)) { return; }
   getState().then(function (state) {
      if (!state) { return; }
      appendLog({ t: Date.now(), flow: flow, action: 'skipped', site: details.initiator || null });
   });
}, WATCH_FILTER);

// A redirect back to the same endpoint with the hint parameter now present is
// our rule firing (the DNR rewrite surfaces as a redirect of the request).
chrome.webRequest.onBeforeRedirect.addListener(function (details) {
   var url = new URL(details.url);
   var flow = classifyFlow(url);
   if (!flow || hasHint(url, flow)) { return; }
   var target;
   try {
      target = new URL(details.redirectUrl);
   } catch (e) {
      return;
   }
   if (target.origin !== url.origin || target.pathname !== url.pathname) { return; }
   if (!hasHint(target, flow)) { return; }
   rewrittenRequestIds.add(details.requestId);
   if (rewrittenRequestIds.size > 500) {
      rewrittenRequestIds.clear();
   }
   getState().then(function (state) {
      if (!state) { return; }
      appendLog({
         t: Date.now(),
         flow: flow,
         action: flow === 'oauth' ? 'hinted' : 'realm',
         site: details.initiator || null
      });
   });
}, WATCH_FILTER);

// The service worker is not persistent and starts on install, browser
// startup, and any handled event; re-syncing the rules here on every start
// keeps them tracking the current profile email and stored state.
sync();
