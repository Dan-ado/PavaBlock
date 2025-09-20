document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function updateAttemptsList() {
  chrome.storage.local.get(['attempts'], function(data) {
    const list = document.getElementById('attemptsList');
    list.innerHTML = '';
    (data.attempts || []).forEach(attempt => {
      const li = document.createElement('li');
      li.textContent = `${attempt.url} - ${new Date(attempt.timestamp).toLocaleString()}`;
      list.appendChild(li);
    });
  });
}

updateAttemptsList();