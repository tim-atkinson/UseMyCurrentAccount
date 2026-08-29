
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
   var domain = email.split('@').pop();

   // The allow rules outrank the redirect rules, so a request that already
   // carries login_hint/sid (or whr) is never rewritten — this also stops the
   // rewritten request from being redirected again.
   return [
      {
         id: ALLOW_AUTHORIZE,
         priority: 2,
         action: { type: 'allow' },
         condition: {
            regexFilter: '^https?://login\\.microsoftonline\\.com/[^?]*/authorize[^?]*\\?(?:.*&)?(?:login_hint|sid)=',
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
            regexFilter: '^https?://login\\.microsoftonline\\.com/[^?]*/authorize',
            resourceTypes: RESOURCE_TYPES
         }
      },
      {
         id: ALLOW_REALM,
         priority: 2,
         action: { type: 'allow' },
         condition: {
            regexFilter: '^https?://login\\.microsoftonline\\.com/[^?]*/(?:saml2|wsfed)[^?]*\\?(?:.*&)?whr=',
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
            regexFilter: '^https?://login\\.microsoftonline\\.com/[^?]*/(?:saml2|wsfed)',
            resourceTypes: RESOURCE_TYPES
         }
      }
   ];
}

function setState(state) {
   return new Promise(function (resolve) {
      chrome.storage.local.set({
         state: state
      }, resolve);
   });
}

function getState() {
   return new Promise(function (resolve) {
      chrome.storage.local.get('state', function (data) {
         resolve(data.state === undefined ? true : data.state);
      });
   });
}

async function applyState(state) {
   updateIcon(state);

   var email = state ? await getProfileEmail() : null;
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

async function init() {
   var state = await getState();
   await applyState(state);
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.action.onClicked.addListener(async function () {
   var newState = !(await getState());
   await setState(newState);
   await applyState(newState);
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

// The service worker is not persistent; re-sync the rules on every start so
// they track the current profile email and stored state.
init();
