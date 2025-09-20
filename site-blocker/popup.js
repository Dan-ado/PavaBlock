document.addEventListener('DOMContentLoaded', function() {
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const statsCard = document.getElementById('stats-card');
  const recentSection = document.getElementById('recent-section');
  const attemptsList = document.getElementById('attempts-list');

  // Event Listeners
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById('clear-attempts').addEventListener('click', clearAttempts);

  // Load Data
  loadPopupData();

  function loadPopupData() {
    chrome.storage.local.get(['blockedSites', 'attempts'], (data) => {
      const blockedSites = data.blockedSites || [];
      const attempts = data.attempts || [];

      // Hide loading
      loadingState.style.display = 'none';

      if (blockedSites.length === 0 && attempts.length === 0) {
        emptyState.style.display = 'block';
        return;
      }

      // Update Stats
      updateStats(blockedSites, attempts);
      
      // Show Recent Attempts (last 10)
      if (attempts.length > 0) {
        showRecentAttempts(attempts.slice(0, 10));
        recentSection.style.display = 'block';
      }

      // Show stats card
      statsCard.style.display = 'block';
    });
  }

  function updateStats(blockedSites, attempts) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const attemptsToday = attempts.filter(attempt => {
      const attemptDate = new Date(attempt.timestamp);
      return attemptDate >= today;
    }).length;

    document.getElementById('blocked-count').textContent = blockedSites.length;
    document.getElementById('attempts-today').textContent = attemptsToday;
    document.getElementById('total-attempts').textContent = attempts.length;
  }

  function showRecentAttempts(recentAttempts) {
    attemptsList.innerHTML = '';
    
    if (recentAttempts.length === 0) {
      const li = document.createElement('li');
      li.className = 'attempt-item';
      li.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 8px;">📝</div>
          <div>Nenhuma tentativa registrada</div>
        </div>
      `;
      attemptsList.appendChild(li);
      return;
    }
    
    recentAttempts.forEach((attempt, index) => {
      const li = document.createElement('li');
      li.className = 'attempt-item';
      
      const attemptDate = new Date(attempt.timestamp);
      const now = new Date();
      const timeAgo = getTimeAgo(attemptDate, now);
      
      const isPermanent = attempt.permanent || false;
      
      li.innerHTML = `
        <div class="attempt-url">
          <span style="font-size: 0.8em; opacity: 0.6; margin-right: 8px;">🔒</span>
          ${attempt.url}
          ${isPermanent ? '<span style="font-size: 0.7em; color: var(--warning-color); margin-left: 8px; padding: 2px 6px; background: #fef3c7; border-radius: 4px;">Permanente</span>' : ''}
        </div>
        <div class="attempt-time">
          <span style="font-size: 0.75em; opacity: 0.7; margin-right: 6px;">🕒</span>
          ${formatDateTime(attempt.timestamp)}
          <span style="font-size: 0.7em; color: var(--text-muted); margin-left: 12px; opacity: 0.8;">
            ${timeAgo}
          </span>
        </div>
      `;
      attemptsList.appendChild(li);
    });
  }

  function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getTimeAgo(attemptDate, now) {
    const diffInSeconds = Math.floor((now - attemptDate) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) {
      return 'agora';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m atrás`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d atrás`;
    } else {
      return `${Math.floor(diffInDays / 7)}s atrás`;
    }
  }

  function clearAttempts() {
    if (confirm('Tem certeza que deseja limpar todo o histórico de tentativas? Esta ação não pode ser desfeita.')) {
      const btn = document.getElementById('clear-attempts');
      const originalText = btn.innerHTML;
      
      // Feedback visual
      btn.innerHTML = '⏳ Limpando...';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      
      chrome.storage.local.set({ attempts: [] }, () => {
        attemptsList.innerHTML = '';
        recentSection.style.display = 'none';
        loadPopupData(); // Refresh stats
        
        // Success feedback
        btn.innerHTML = '✅ Histórico limpo!';
        btn.style.background = '#10b981';
        btn.style.borderColor = '#10b981';
        
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.background = 'transparent';
          btn.style.borderColor = 'var(--primary-color)';
          btn.disabled = false;
          btn.style.opacity = '1';
        }, 2000);
      });
    }
  }
});