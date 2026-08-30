
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_ACCOUNTS = 20;

function getData() {
   return new Promise(function (resolve) {
      chrome.storage.local.get(['state', 'accounts', 'selected'], function (data) {
         resolve({
            state: data.state === undefined ? true : data.state,
            accounts: Array.isArray(data.accounts) ? data.accounts : [],
            selected: typeof data.selected === 'string' && data.selected !== '' ? data.selected : null
         });
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

function showError(message) {
   var errorEl = document.getElementById('error');
   errorEl.textContent = message || '';
   errorEl.hidden = !message;
}

function accountRow(email, label, checked, removable) {
   var row = document.createElement('label');
   row.className = 'account-row';

   var radio = document.createElement('input');
   radio.type = 'radio';
   radio.name = 'account';
   radio.value = email;
   radio.checked = checked;
   radio.addEventListener('change', function () {
      // An empty value means "use the profile account" (the default).
      if (email === '') {
         chrome.storage.local.remove('selected');
      } else {
         chrome.storage.local.set({ selected: email });
      }
   });
   row.appendChild(radio);

   var text = document.createElement('span');
   text.className = 'account-label';
   text.textContent = label;
   row.appendChild(text);

   if (removable) {
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.title = 'Remove ' + email;
      remove.addEventListener('click', function (event) {
         event.preventDefault();
         removeAccount(email);
      });
      row.appendChild(remove);
   }

   return row;
}

async function renderAccounts() {
   var data = await getData();
   var profileEmail = await getProfileEmail();

   var listEl = document.getElementById('accounts');
   listEl.textContent = '';

   // If the stored selection no longer exists in the list, fall back to the
   // profile account.
   var selected = data.selected && data.accounts.indexOf(data.selected) !== -1 ? data.selected : null;

   var profileLabel = profileEmail ? profileEmail + ' (profile)' : 'Profile account (none found)';
   listEl.appendChild(accountRow('', profileLabel, selected === null, false));

   data.accounts.forEach(function (email) {
      listEl.appendChild(accountRow(email, email, selected === email, true));
   });
}

async function addAccount(email) {
   var data = await getData();

   if (!EMAIL_PATTERN.test(email)) {
      showError('Enter a valid email address.');
      return;
   }
   var exists = data.accounts.some(function (existing) {
      return existing.toLowerCase() === email.toLowerCase();
   });
   if (exists) {
      showError('That account is already in the list.');
      return;
   }
   if (data.accounts.length >= MAX_ACCOUNTS) {
      showError('Account limit reached.');
      return;
   }

   showError(null);
   data.accounts.push(email);
   chrome.storage.local.set({ accounts: data.accounts }, renderAccounts);
}

async function removeAccount(email) {
   var data = await getData();
   var accounts = data.accounts.filter(function (existing) {
      return existing !== email;
   });
   chrome.storage.local.set({ accounts: accounts }, function () {
      if (data.selected === email) {
         chrome.storage.local.remove('selected', renderAccounts);
      } else {
         renderAccounts();
      }
   });
}

document.getElementById('view-log').addEventListener('click', function () {
   chrome.tabs.create({ url: chrome.runtime.getURL('src/log.html') });
});

document.getElementById('toggle').addEventListener('change', function (event) {
   var state = event.target.checked;
   renderState(state);
   // The background service worker reacts to storage writes via
   // chrome.storage.onChanged and re-syncs the rules and badge.
   chrome.storage.local.set({ state: state });
});

document.getElementById('add-form').addEventListener('submit', function (event) {
   event.preventDefault();
   var input = document.getElementById('new-account');
   var email = input.value.trim();
   addAccount(email).then(function () {
      if (!document.getElementById('error').textContent) {
         input.value = '';
      }
   });
});

async function init() {
   renderState((await getData()).state);
   await renderAccounts();
}

init();
