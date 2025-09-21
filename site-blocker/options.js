document.addEventListener('DOMContentLoaded', function() {
  const siteInput = document.getElementById('siteInput');
  const durationInput = document.getElementById('blockDuration');
  const permanentCheckbox = document.getElementById('permanentBlock');
  const addSiteBtn = document.getElementById('addSite');
  const sitesList = document.getElementById('sites-list');
  const noSites = document.getElementById('no-sites');
  const totalSitesEl = document.getElementById('total-sites');
  const permanentCountEl = document.getElementById('permanent-count');
  const temporaryCountEl = document.getElementById('temporary-count');

  // Event Listeners
  addSiteBtn.addEventListener('click', addSite);
  siteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && siteInput.value.trim()) {
      addSite();
    }
  });

  // Toggle duration field based on checkbox
  permanentCheckbox.addEventListener('change', function() {
    const isChecked = this.checked;
    durationInput.disabled = isChecked;
    durationInput.value = isChecked ? '' : '60';
    durationInput.style.opacity = isChecked ? '0.5' : '1';
    durationInput.style.backgroundColor = isChecked ? '#f8fafc' : 'white';
    
    if (isChecked) {
      durationInput.placeholder = 'Bloqueio permanente';
    } else {
      durationInput.placeholder = 'Minutos';
    }
  });

  // Load initial data
  loadSites();
  updateStats();

  function addSite() {
    const site = siteInput.value.trim().toLowerCase();
    const isPermanent = permanentCheckbox.checked;
    let duration = 0;
    
    if (!isPermanent) {
      duration = parseInt(durationInput.value) || 0;
      if (duration < 1 || duration > 9999) {
        showNotification('Duração deve estar entre 1 e 9999 minutos', 'error');
        return;
      }
    }

    if (!site || !site.includes('.')) {
      showNotification('Por favor, insira um domínio válido (ex: example.com)', 'error');
      siteInput.focus();
      return;
    }

    // Check for duplicates
    chrome.storage.local.get(['blockedSites'], (data) => {
      const blockedSites = data.blockedSites || [];
      if (blockedSites.some(s => s.url === site)) {
        showNotification('Este site já está bloqueado!', 'warning');
        siteInput.focus();
        return;
      }

      const newSite = {
        url: site,
        expires: isPermanent ? null : new Date(Date.now() + duration * 60 * 1000).toISOString(),
        added: new Date().toISOString(),
        isPermanent: isPermanent,
        duration: isPermanent ? 'Permanente' : `${duration} min`
      };

      blockedSites.push(newSite);
      chrome.storage.local.set({ blockedSites }, () => {
        // Reset form
        siteInput.value = '';
        durationInput.value = '';
        permanentCheckbox.checked = false;
        durationInput.disabled = false;
        durationInput.style.opacity = '1';
        durationInput.style.backgroundColor = 'white';
        durationInput.placeholder = '60';
        siteInput.focus();
        
        loadSites();
        updateStats();
        showNotification(`Site ${isPermanent ? 'permanente' : `temporário de ${duration} min`} adicionado com sucesso!`, 'success');
        
        // Trigger background update
        chrome.runtime.sendMessage({ action: 'updateRules' });
      });
    });
  }

  function loadSites() {
    chrome.storage.local.get(['blockedSites'], (data) => {
      const blockedSites = data.blockedSites || [];
      
      if (blockedSites.length === 0) {
        noSites.style.display = 'block';
        sitesList.style.display = 'none';
        return;
      }

      noSites.style.display = 'none';
      sitesList.style.display = 'block';
      
      renderSites(blockedSites);
    });
  }

  function renderSites(sites) {
    sitesList.innerHTML = '';
    
    // Ordena por data de adição (mais recente primeiro)
    const sortedSites = sites.sort((a, b) => new Date(b.added) - new Date(a.added));
    
    sortedSites.forEach((site, index) => {
      const div = document.createElement('div');
      div.className = 'site-item';
      div.id = `site-${index}`;
      
      const now = new Date();
      const addedDate = new Date(site.added);
      const expiresText = site.expires ? `Expira: ${formatDate(site.expires)}` : 'Nunca expira';
      const statusClass = site.expires ? 'status-temporary' : 'status-permanent';
      const statusText = site.expires ? `⏰ ${site.duration}` : '🔒 Permanente';
      
      div.innerHTML = `
        <div class="site-info">
          <div class="site-url">${site.url}</div>
          <div class="site-duration">
            Adicionado: ${formatDate(site.added)} 
            ${site.expires ? `<br><span class="site-expiration">${expiresText}</span>` : ''}
          </div>
          <span class="site-status ${statusClass}">
            ${statusText}
          </span>
        </div>
        <button class="btn-remove" data-url="${site.url}">
          🗑️ Remover
        </button>
      `;
      sitesList.appendChild(div);

      // Adiciona o evento de clique dinamicamente
      const removeButton = div.querySelector('.btn-remove');
      removeButton.addEventListener('click', () => removeSite(site.url, removeButton));
    });
  }

  function removeSite(urlToRemove, button) {
    console.log(`Tentando remover site: ${urlToRemove}`); // Depuração
    // Feedback visual imediato
    button.textContent = '⏳...';
    button.disabled = true;
    button.style.opacity = '0.6';
    
    if (confirm(`Remover o bloqueio para ${urlToRemove}?`)) {
      chrome.storage.local.get(['blockedSites'], (data) => {
        const blockedSites = data.blockedSites || [];
        const updatedSites = blockedSites.filter(site => site.url !== urlToRemove);
        
        if (blockedSites.length === updatedSites.length) {
          console.error(`Site ${urlToRemove} não encontrado para remoção`);
          showNotification('Erro: Site não encontrado.', 'error');
          button.textContent = '🗑️ Remover';
          button.disabled = false;
          button.style.opacity = '1';
          return;
        }

        chrome.storage.local.set({ blockedSites: updatedSites }, () => {
          console.log(`Site ${urlToRemove} removido com sucesso`);
          // Remove o elemento da DOM imediatamente
          const siteItem = button.closest('.site-item');
          if (siteItem) {
            siteItem.style.transition = 'opacity 0.3s ease-out';
            siteItem.style.opacity = '0';
            setTimeout(() => {
              siteItem.remove();
              if (updatedSites.length === 0) {
                noSites.style.display = 'block';
                sitesList.style.display = 'none';
              }
            }, 300);
          }
          
          updateStats();
          showNotification('Site removido com sucesso!', 'success');
          
          // Trigger background update
          chrome.runtime.sendMessage({ action: 'updateRules' });
        });
      });
    } else {
      // Restaura botão se cancelado
      button.textContent = '🗑️ Remover';
      button.disabled = false;
      button.style.opacity = '1';
      console.log(`Remoção de ${urlToRemove} cancelada pelo usuário`);
    }
  }

  function updateStats() {
    chrome.storage.local.get(['blockedSites'], (data) => {
      const blockedSites = data.blockedSites || [];
      
      const permanentCount = blockedSites.filter(site => !site.expires).length;
      const temporaryCount = blockedSites.filter(site => site.expires).length;

      totalSitesEl.textContent = blockedSites.length;
      permanentCountEl.textContent = permanentCount;
      temporaryCountEl.textContent = temporaryCount;
    });
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: var(--radius);
      color: white;
      font-weight: 500;
      z-index: 10000;
      transform: translateX(400px);
      transition: var(--transition);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
      box-shadow: var(--shadow-lg);
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 200);
    }, 3000);
  }

  // Expose removeSite to global scope (opcional, mas mantido para compatibilidade)
  window.removeSite = removeSite;
});