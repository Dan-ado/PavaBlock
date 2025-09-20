document.getElementById('addSite').addEventListener('click', () => {
  const site = document.getElementById('siteInput').value.trim();
  const duration = parseInt(document.getElementById('blockDuration').value) || 0;

  if (site && site.includes('.')) { // Validação básica
    chrome.storage.local.get(['blockedSites'], (data) => {
      const blockedSites = data.blockedSites || [];
      const expires = duration > 0 ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
      if (!blockedSites.some(s => s.url === site)) { // Evita duplicatas
        blockedSites.push({ url: site, expires });
        chrome.storage.local.set({ blockedSites }, () => {
          updateBlockedSitesList();
          document.getElementById('siteInput').value = '';
          document.getElementById('blockDuration').value = '';
        });
      }
    });
  }
});

function updateBlockedSitesList() {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const list = document.getElementById('blockedSites');
    list.innerHTML = '';
    (data.blockedSites || []).forEach((site, index) => {
      const li = document.createElement('li');
      const status = site.expires ? `(Expira em: ${new Date(site.expires).toLocaleString()})` : '(Permanente)';
      li.innerHTML = `${site.url} ${status} <button onclick="removeSite('${site.url}')">Remover</button>`;
      list.appendChild(li);
    });
  });
}

// Função para remover site (adicione no HTML ou como global)
window.removeSite = (url) => {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const blockedSites = data.blockedSites || [];
    const updatedSites = blockedSites.filter(s => s.url !== url);
    chrome.storage.local.set({ blockedSites: updatedSites }, updateBlockedSitesList);
  });
};

updateBlockedSitesList();