// Listen for messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRules') {
    updateRules();
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
  // Default data
  chrome.storage.local.set({
    blockedSites: [],
    notificationsEnabled: true
  });
  updateRules();
});

// Update rules function - APRIMORADO
function updateRules() {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const blockedSites = data.blockedSites || [];
    const now = new Date();
    
    // Filtra sites ativos (não expirados)
    const activeSites = blockedSites.filter(site => 
      !site.expires || new Date(site.expires) > now
    );

    console.log(`🔄 Updating rules: ${activeSites.length} active sites`);

    // Cria regras para declarativeNetRequest
    const rules = activeSites.map((site, index) => ({
      id: index + 1,
      priority: 1,
      action: { 
        type: 'redirect',
        redirect: { url: 'about:blank' }
      },
      condition: { 
        urlFilter: `*://${site.url}*`,
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }));

    // Remove TODAS as regras antigas (1 a 1000)
    const removeRuleIds = Array.from({ length: 1000 }, (_, i) => i + 1);
    
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: rules
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error updating rules:', chrome.runtime.lastError);
      } else {
        console.log(`✅ Successfully updated ${rules.length} blocking rules`);
        
        // Remove sites expirados do storage
        if (activeSites.length !== blockedSites.length) {
          const updatedBlockedSites = activeSites;
          chrome.storage.local.set({ blockedSites: updatedBlockedSites });
          console.log(`🧹 Removed ${blockedSites.length - activeSites.length} expired sites`);
        }
      }
    });
  });
}

// Track blocked attempts - REMOVIDO
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Apenas para navegações principais
  if (details.frameId === 0 && details.type === 'main_frame') {
    try {
      const url = new URL(details.url);
      const hostname = url.hostname.toLowerCase();
      const fullUrl = details.url;

      chrome.storage.local.get(['blockedSites'], (data) => {
        const blockedSites = data.blockedSites || [];
        const now = new Date();

        // Procura pelo site bloqueado (case insensitive)
        const blockedSite = blockedSites.find(site => 
          hostname.includes(site.url.toLowerCase()) || 
          site.url.toLowerCase().includes(hostname)
        );

        if (blockedSite) {
          // Verifica se expirou
          if (blockedSite.expires && now > new Date(blockedSite.expires)) {
            console.log(`⏰ Site expired: ${blockedSite.url}`);
            // Remove site expirado
            const updatedSites = blockedSites.filter(s => s.url !== blockedSite.url);
            chrome.storage.local.set({ blockedSites: updatedSites }, () => {
              updateRules();
            });
            return;
          }

          // Reforça o bloqueio
          setTimeout(() => {
            chrome.tabs.update(details.tabId, { url: 'about:blank' });
          }, 50);
          
          // Mostra notificação
          showBlockNotification(hostname, blockedSite);
        }
      });
    } catch (error) {
      console.error('Error processing navigation:', error);
    }
  }
});

// Listener adicional para reforço
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab?.url && tab.url.startsWith('http')) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();

      chrome.storage.local.get(['blockedSites'], (data) => {
        const blockedSites = data.blockedSites || [];
        const now = new Date();
        
        const isBlocked = blockedSites.some(site => {
          const siteMatch = hostname.includes(site.url.toLowerCase()) || 
                           site.url.toLowerCase().includes(hostname);
          return siteMatch && (!site.expires || now < new Date(site.expires));
        });

        if (isBlocked) {
          console.log(`🔒 Tab reinforcement: blocking ${hostname}`);
          chrome.tabs.update(tabId, { url: 'about:blank' });
        }
      });
    } catch (error) {
      // Ignore invalid URLs
    }
  }
});

// Função de notificação aprimorada
function showBlockNotification(hostname, blockedSite) {
  chrome.storage.local.get(['notificationsEnabled'], (data) => {
    const notificationsEnabled = data.notificationsEnabled !== false;
    
    if (notificationsEnabled && Notification.permission === 'granted') {
      const title = '🚫 Site Bloqueado';
      const message = `Acesso a ${hostname} foi bloqueado.\n` +
                     `Tipo: ${blockedSite.isPermanent ? 'Permanente' : `Temporário (${blockedSite.duration})`}`;
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        title: title,
        message: message,
        priority: 2,
        isClickable: true,
        contextMessage: new Date().toLocaleTimeString('pt-BR')
      }, (notificationId) => {
        setTimeout(() => {
          chrome.notifications.clear(notificationId, () => {});
        }, 5000);
      });
    }
  });
}

// Limpeza periódica
setInterval(() => {
  chrome.storage.local.get(['blockedSites'], (data) => {
    const blockedSites = data.blockedSites || [];
    const now = new Date();
    const activeSites = blockedSites.filter(site => 
      !site.expires || new Date(site.expires) > now
    );

    if (activeSites.length !== blockedSites.length) {
      chrome.storage.local.set({ blockedSites: activeSites });
      updateRules();
      console.log(`🧹 Cleanup: removed ${blockedSites.length - activeSites.length} expired sites`);
    }
  });
}, 30 * 60 * 1000); // 30 minutos

// Inicializa regras e permissões de notificação
updateRules();

if (chrome.notifications && Notification.permission === 'default') {
  chrome.notifications.requestPermission();
}

// Listener para cliques em notificações
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('options.html'),
    active: true 
  });
  chrome.notifications.clear(notificationId, () => {});
});