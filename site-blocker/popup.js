document.addEventListener('DOMContentLoaded', function() {
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const statsCard = document.getElementById('stats-card');

  // Event Listeners
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // Load Data
  loadPopupData();

  function loadPopupData() {
    chrome.storage.local.get(['blockedSites'], (data) => {
      const blockedSites = data.blockedSites || [];

      // Hide loading
      loadingState.style.display = 'none';

      if (blockedSites.length === 0) {
        emptyState.style.display = 'block';
        return;
      }

      // Update Stats
      updateStats(blockedSites);
      
      // Show stats card
      statsCard.style.display = 'block';
    });
  }

  function updateStats(blockedSites) {
    document.getElementById('blocked-count').textContent = blockedSites.length;
  }
});