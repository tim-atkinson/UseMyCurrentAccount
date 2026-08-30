
function getState() {
   return new Promise(function (resolve) {
      chrome.storage.local.get('state', function (data) {
         resolve(data.state === undefined ? true : data.state);
      });
   });
}

function getProfileEmail() {
   return new Promise(function (resolve) {
      chrome.identity.getProfileUserInfo(function (userInfo) {
         resolve(userInfo && userInfo.email);
      });
   });
}

function renderState(state) {
   document.getElementById('toggle').checked = state;
   document.getElementById('status').textContent = state ? 'Enabled' : 'Disabled';
}

async function init() {
   renderState(await getState());

   var email = await getProfileEmail();
   var emailEl = document.getElementById('email');
   if (email) {
      emailEl.textContent = email;
   } else {
      emailEl.textContent = 'No profile account found';
      emailEl.classList.add('missing');
   }
}

document.getElementById('toggle').addEventListener('change', function (event) {
   var state = event.target.checked;
   renderState(state);
   // The background service worker reacts to this write via
   // chrome.storage.onChanged and re-syncs the rules and badge.
   chrome.storage.local.set({ state: state });
});

init();
