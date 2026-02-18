// Popup "Associer à un cahier des charges" pour la valorisation d'un nœud Reste.
// Style aligné sur TransformationPopup (backdrop + modal Tailwind).

class CdcAssociatePopup {
  constructor() {
    this.backdrop = null;
    this.modal = null;
    this.currentNode = null;
    this.onAssociateCallback = null;
    this.selectedCdc = null;
    this.cdcList = [];
  }

  getI18n() {
    if (window.i18next && typeof window.i18next.t === 'function') {
      return window.i18next;
    }
    return null;
  }

  getUrlParams() {
    if (typeof getUrlParams === 'function') {
      return getUrlParams();
    }
    const urlParams = new URLSearchParams(window.location.search);
    return {
      teamId: urlParams.get('teamId') || '',
      isLive: urlParams.get('isLive') === 'true',
    };
  }

  close() {
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    this.backdrop = null;
    this.modal = null;
    this.currentNode = null;
    this.onAssociateCallback = null;
    this.selectedCdc = null;
    this.cdcList = [];
  }

  show(node, onAssociate) {
    this.currentNode = node;
    this.onAssociateCallback = onAssociate || null;
    this.selectedCdc = null;
    this.cdcList = [];

    const i18n = this.getI18n();
    const t = i18n ? key => i18n.t(key) : key => key;
    const params = this.getUrlParams();
    const { teamId, isLive } = params;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 z-50';
    this.backdrop.style.background = 'none';

    this.modal = document.createElement('div');
    this.modal.className =
      'bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6';
    this.modal.style.boxShadow =
      '0 8px 40px 8px rgba(0,0,0,0.35), 0 1.5px 8px rgba(0,0,0,0.10)';
    this.modal.style.position = 'absolute';
    this.modal.style.top = '200px';
    this.modal.style.left = '50%';
    this.modal.style.transform = 'translateX(-50%)';

    this.modal.innerHTML = `
      <h3 class="text-lg font-semibold mb-4">${t('associateToCdc')}</h3>
      <div id="cdc-popup-content" class="space-y-4">
        <div class="text-sm text-gray-500">Chargement...</div>
      </div>
      <div class="mt-6 flex justify-end space-x-3">
        <button id="cdc-cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${t('cancel')}</button>
        <button id="cdc-associate-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>${t('associate')}</button>
      </div>
    `;

    this.backdrop.appendChild(this.modal);
    document.body.appendChild(this.backdrop);

    const cancelBtn = this.modal.querySelector('#cdc-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    const associateBtn = this.modal.querySelector('#cdc-associate-btn');
    if (associateBtn) {
      associateBtn.addEventListener('click', () => {
        if (this.selectedCdc && this.onAssociateCallback) {
          this.onAssociateCallback(this.selectedCdc);
          this.close();
        }
      });
    }

    if (!teamId) {
      const content = this.modal.querySelector('#cdc-popup-content');
      if (content) {
        content.innerHTML =
          '<p class="text-sm text-amber-600">' +
          (t('noTeamId') || 'Pas de teamId trouvé dans les paramètres URL') +
          '</p>';
      }
      return;
    }

    this.loadCdcs(teamId, isLive, t);
  }

  loadCdcs(teamId, isLive, t) {
    const content = this.modal.querySelector('#cdc-popup-content');
    const associateBtn = this.modal.querySelector('#cdc-associate-btn');

    fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'cdcs',
        params: { team_id: teamId, isLive },
        method: 'GET',
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
      })
      .then(data => {
        const entries =
          data && typeof data === 'object' ? Object.entries(data) : [];
        this.cdcList = entries.map(([title, obj]) => ({
          title,
          bubble_id: (obj && obj.bubble_id) || null,
        }));

        if (this.cdcList.length === 0) {
          content.innerHTML =
            '<p class="text-sm text-gray-600">' +
            t('noCdcToAssociate') +
            '</p>';
          if (associateBtn) associateBtn.style.display = 'none';
          return;
        }

        let listHtml =
          '<ul class="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-60 overflow-y-auto">';
        this.cdcList.forEach((cdc, idx) => {
          listHtml += `
            <li class="cdc-list-item px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 border-gray-200" data-cdc-index="${idx}">
              ${escapeHtml(cdc.title)}
            </li>`;
        });
        listHtml += '</ul>';

        content.innerHTML = listHtml;

        content.querySelectorAll('.cdc-list-item').forEach(el => {
          el.addEventListener('click', () => {
            content.querySelectorAll('.cdc-list-item').forEach(e => {
              e.classList.remove(
                'bg-blue-100',
                'border-l-4',
                'border-blue-600'
              );
            });
            el.classList.add('bg-blue-100', 'border-l-4', 'border-blue-600');
            const idx = parseInt(el.getAttribute('data-cdc-index'), 10);
            const cdc = this.cdcList[idx];
            if (cdc && cdc.bubble_id) {
              this.selectedCdc = { bubble_id: cdc.bubble_id, title: cdc.title };
              if (associateBtn) {
                associateBtn.disabled = false;
              }
            }
          });
        });
      })
      .catch(err => {
        console.error('[CdcAssociatePopup] loadCdcs error', err);
        content.innerHTML =
          '<p class="text-sm text-red-600">' +
          (t('error') || 'Erreur') +
          ': ' +
          (err.message || String(err)) +
          '</p>';
        if (associateBtn) associateBtn.style.display = 'none';
      });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (typeof window !== 'undefined') {
  window.CdcAssociatePopup = CdcAssociatePopup;
}
