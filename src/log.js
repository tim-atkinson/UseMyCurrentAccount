
var FLOW_LABELS = {
   oauth: 'OAuth',
   saml: 'SAML',
   wsfed: 'WS-Fed'
};

var ACTION_LABELS = {
   hinted: 'Added account hint (login_hint)',
   realm: 'Added domain hint (whr)',
   skipped: 'Skipped — request already specified an account'
};

function render(log) {
   var entriesEl = document.getElementById('entries');
   var emptyEl = document.getElementById('empty');
   entriesEl.textContent = '';

   log = Array.isArray(log) ? log : [];
   emptyEl.hidden = log.length !== 0;

   log.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'entry';

      var time = document.createElement('span');
      time.className = 'time';
      time.textContent = entry.t ? new Date(entry.t).toLocaleString() : '';
      row.appendChild(time);

      var action = document.createElement('span');
      action.className = 'action';
      action.textContent = ACTION_LABELS[entry.action] || 'Unknown';
      if (entry.site) {
         var site = document.createElement('span');
         site.className = 'site';
         site.textContent = 'from ' + entry.site;
         action.appendChild(site);
      }
      row.appendChild(action);

      var flow = document.createElement('span');
      flow.className = 'flow';
      flow.textContent = FLOW_LABELS[entry.flow] || '?';
      row.appendChild(flow);

      entriesEl.appendChild(row);
   });
}

chrome.storage.local.get('log', function (data) {
   render(data.log);
});

// Live-update while the page is open.
chrome.storage.onChanged.addListener(function (changes, area) {
   if (area === 'local' && changes.log) {
      render(changes.log.newValue);
   }
});

document.getElementById('clear').addEventListener('click', function () {
   chrome.storage.local.remove('log', function () {
      render([]);
   });
});
