// Inicializa regras de bloqueio ao carregar
chrome.runtime.onInstalled.addListener(() => {
  updateRules();
});

// Listener para detectar tentativas (navegações para URLs bloqueadas)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const url = new URL(tab.url).hostname;
    chrome.storage.local.get(['blockedSites', 'attempts'], (data) => {
      const blockedSites = data.blockedSites || [];
      const attempts = data.attempts || [];

      const isBlocked = blockedSites.some(site => {
        if (url.includes(site.url)) {
          const now = new Date();
          if (site.expires && now > new Date(site.expires)) {
            // Remove regra expirada
            removeExpiredRule(site.url);
            return false;
          }
          // Registra tentativa
          attempts.push({
            url: url,
            timestamp: now.toISOString()
          });
          chrome.storage.local.set({ attempts });
          // Opcional: Mostra notificação de bloqueio
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png', // Adicione um ícone se quiser
            title: 'Site Bloqueado',
            message: `Acesso a ${url} foi bloqueado.`
          });
          return true;
        }
        return false;
      });

      if (isBlocked) {
        // Impede o carregamento (redireciona para página em branco ou erro)
        chrome.tabs.update(tabId, { url: 'chrome://newtab/' });
      }
    });
  }
});

// Função para atualizar regras de bloqueio dinâmicas
function updateRules() {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const blockedSites = data.blockedSites || [];
    const now = new Date();
    const activeRules = blockedSites
      .filter(site => !site.expires || now <= new Date(site.expires))
      .map((site, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: `*://${site.url}*`, resourceTypes: ['main_frame'] }
      }));

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: activeRules.map(r => r.id), // Remove regras antigas
      addRules: activeRules
    });
  });
}

// Remove regra expirada
function removeExpiredRule(url) {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const blockedSites = data.blockedSites || [];
    const updatedSites = blockedSites.filter(site => site.url !== url);
    chrome.storage.local.set({ blockedSites: updatedSites }, updateRules);
  });
}

// Atualiza regras quando storage muda (ex.: ao adicionar site)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedSites) {
    updateRules();
  }
});