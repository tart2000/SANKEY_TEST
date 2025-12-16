// Gestionnaire de la popup de transformation
// Fichier chargé
class TransformationPopup {
  constructor() {
    this.backdrop = null;
    this.modal = null;
    this.currentRef = null; // Pour stocker la référence
    this.mode = null; // Pour stocker le mode
    this._dropdownCloseHandler = null; // Pour gérer le dropdown proprement
    this.selectedKeys = []; // Pour stocker les keys sélectionnées
    this.isLoadingData = false; // Flag pour tracker le chargement des données API
    this._selectedDynamic = null; // Informations sur la transformation dynamique sélectionnée
    this._availableTransformations = null; // Cache local des transformations proposées
    this.threshold = null; // Pour stocker le seuil (nombre)
    this.condition = null; // Pour stocker la condition ('over' ou 'under')
  }

  async getI18nInstance(maxAttempts = 60, interval = 50) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (
        window.i18nextReady &&
        window.i18next &&
        typeof window.i18next.t === 'function'
      ) {
        return window.i18next;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(
      "[transformation-popup] i18next n'est pas prêt après l'attente configurée."
    );
  }

  getSelectedKeys() {
    return this.selectedKeys;
  }

  show(ref, mode) {
    // TransformationPopup.show called
    this.currentRef = ref;
    this.mode = mode;
    this._availableTransformations = null;
    this.createPopup(ref);
    // Ne pas appeler attachEventListeners ici, on le fera dans createPopupWithKeyList si nécessaire
  }

  createPopup(ref) {
    // Récupération de la transformation du lien cliqué
    const lastTransfo = ref.transformation || null;
    const lastType = lastTransfo
      ? Array.isArray(lastTransfo.type)
        ? lastTransfo.type[0]
        : lastTransfo.type
      : null;
    const keys = lastTransfo && lastTransfo.keys ? lastTransfo.keys : [];

    // Détecter si c'est une transformation dynamique (nouveau format ou ancien)
    const isDynamicTransfo =
      lastType &&
      (lastType === 'dynamic_transfo' ||
        lastType.startsWith('dynamic_transfo_'));

    if (isDynamicTransfo) {
      console.log('Transformation dynamique détectée:', lastType);
      // Pour les transformations dynamiques, utiliser la popup existante
      // mais charger les transformations disponibles d'abord
      if (window.transformationUtils) {
        // Créer un squelette minimal d'abord
        const selectedValue =
          lastType === 'dynamic_transfo' && lastTransfo?.dynamic_transfo_id
            ? `dynamic_transfo_${lastTransfo.dynamic_transfo_id}`
            : lastType;
        this.createPopupWithoutKeyList(ref, selectedValue, keys);

        // Activer le flag de chargement
        this.isLoadingData = true;

        // Puis charger et mettre à jour avec présélection
        this.loadTransformationsAndUpdatePopup(ref, selectedValue, keys);
      } else {
        // Fallback : créer la popup de base
        const selectedValue =
          lastType === 'dynamic_transfo' && lastTransfo?.dynamic_transfo_id
            ? `dynamic_transfo_${lastTransfo.dynamic_transfo_id}`
            : lastType;
        this.createPopupWithoutKeyList(ref, selectedValue, keys);
      }
      return;
    }

    // Récupérer la keyList de la transformation sélectionnée
    let keyList = null;
    let keyListData = null;
    if (
      lastType &&
      lastType !== 'dynamic_transfo' &&
      !(lastType && lastType.startsWith('dynamic_transfo_')) &&
      window.transformationTypes &&
      window.transformationTypes[lastType]
    ) {
      keyList = window.transformationTypes[lastType].keyList;
    }

    // Si keyList existe, charger dynamiquement la liste depuis l'API Bubble
    if (keyList) {
      // TOUJOURS créer la popup de base d'abord
      this.createPopupWithoutKeyList(ref, lastType, keys);

      // Activer le flag de chargement
      this.isLoadingData = true;

      // Puis charger les données et mettre à jour
      Promise.all([
        chargerDonneesBaseAPI(keyList),
        window.transformationUtils
          ? window.transformationUtils.getAvailableTransformations()
          : Promise.resolve([]),
      ])
        .then(([baseData, transformations]) => {
          // Stocker la liste pour la suite
          keyListData = baseData;
          // Maintenant on peut mettre à jour la popup existante avec la vraie liste et les transformations dynamiques
          this.createPopupWithKeyList(
            ref,
            keyList,
            keyListData,
            transformations
          );
          // Désactiver le flag de chargement
          this.isLoadingData = false;
        })
        .catch(error => {
          console.error('Erreur lors du chargement des données:', error);
          // Désactiver le flag de chargement même en cas d'erreur
          this.isLoadingData = false;
          // La popup de base existe déjà, on peut afficher l'erreur dedans
          if (this.modal) {
            this.modal.innerHTML = `
              <div class="text-red-600 text-sm">
                Erreur lors du chargement des données. Veuillez réessayer.
              </div>
            `;
          }
        });
      return; // On arrête ici, la suite sera gérée dans createPopupWithKeyList
    }

    // Pas de keyList, créer la popup directement avec loader
    this.createPopupWithoutKeyList(ref, lastType, keys);
  }

  // Méthode pour créer la popup sans keyList (pas de paramètres)
  createPopupWithoutKeyList(ref, lastType, keys) {
    // Création du backdrop (transparent comme dans /lots)
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 z-50';
    this.backdrop.style.background = 'none';

    // Création de la modal avec ombre prononcée comme dans /lots
    this.modal = document.createElement('div');
    this.modal.className =
      'bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 p-6';
    this.modal.style.boxShadow =
      '0 8px 40px 8px rgba(0,0,0,0.35), 0 1.5px 8px rgba(0,0,0,0.10)';
    this.modal.style.position = 'absolute';
    this.modal.style.top = '200px';
    this.modal.style.left = '50%';
    this.modal.style.transform = 'translateX(-50%)';

    // Pills pour les keys existantes
    const displayNames =
      ref.transformation && ref.transformation._displayNames
        ? ref.transformation._displayNames[0]
        : keys;
    const pills = displayNames
      .map((name, i) => {
        const keyId = keys[i] || name;
        const isBubbleId = /^\d+x\d+$/.test(keyId);
        const textColor = isBubbleId ? 'text-blue-800' : 'text-red-600';
        return `<span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 ${textColor} text-sm mr-2 mb-2">
        ${name}
        <button type="button" class="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none" data-key-index="${i}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </span>`;
      })
      .join('');

    // Label et description de la transformation sélectionnée
    const currentLabel =
      lastType && window.transformationUtils
        ? window.transformationUtils.getTransformationLabel(lastType)
        : i18next.t('noTransformation');
    const currentDesc =
      lastType && window.transformationUtils
        ? window.transformationUtils.getTransformationDescription(lastType)
        : '';

    // Adapter le titre et le texte du bouton selon le mode
    const title =
      this.mode === 'add'
        ? i18next.t('addTransformation')
        : i18next.t('editTransformation');
    const buttonText =
      this.mode === 'add' ? i18next.t('create') : i18next.t('save');

    this.modal.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">${title}</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('transformationType')}</label>
          <div class="text-sm text-gray-500 mb-2">Chargement des transformations...</div>
          <div id="transfo-keys" class="flex flex-wrap mt-2">${pills}</div>
        </div>
      </div>
      <div class="mt-6 flex justify-end space-x-3">
        <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
        <button id="save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${buttonText}</button>
      </div>
    `;

    this.backdrop.appendChild(this.modal);
    document.body.appendChild(this.backdrop);

    // Attacher les event listeners de base IMMÉDIATEMENT (fermeture)
    this.attachBasicEventListeners();

    // Activer le flag de chargement
    this.isLoadingData = true;

    // Charger les transformations et créer la popup complète
    this.loadTransformationsAndCreateCompletePopup(ref, lastType, keys);
  }

  // Méthode pour attacher les event listeners de base (fermeture uniquement)
  attachBasicEventListeners() {
    // Attacher le gestionnaire de clic directement sur le backdrop
    // SUPPRIMÉ : Gestionnaire du backdrop qui causait des problèmes
    // La popup ne se fermera que via le bouton Annuler ou Sauvegarder

    // Attacher le bouton Annuler
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  // Méthode pour METTRE À JOUR la popup existante (au lieu d'en créer une nouvelle)
  createPopupWithKeyList(ref, keyList, keyListData, transformations) {
    // NE PAS créer de nouveaux éléments - utiliser ceux existants !
    // this.backdrop et this.modal existent déjà depuis createPopupWithoutKeyList

    // COMMENTÉ : Création du backdrop (transparent comme dans /lots)
    // this.backdrop = document.createElement('div');
    // this.backdrop.className = 'fixed inset-0 z-50';
    // this.backdrop.style.background = 'none';

    // COMMENTÉ : Création de la modal avec ombre prononcée comme dans /lots
    // this.modal = document.createElement('div');
    // this.modal.className = 'bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6';
    // this.modal.style.boxShadow = '0 8px 40px 8px rgba(0,0,0,0.35), 0 1.5px 8px rgba(0,0,0,0.10)';
    // this.modal.style.position = 'absolute';
    // this.modal.style.top = '200px';
    // this.modal.style.left = '50%';
    // this.modal.style.transform = 'translateX(-50%)';

    // Récupération de la transformation du lien cliqué
    const lastTransfo = ref.transformation || null;
    const lastType = lastTransfo
      ? Array.isArray(lastTransfo.type)
        ? lastTransfo.type[0]
        : lastTransfo.type
      : null;
    const keys = lastTransfo && lastTransfo.keys ? lastTransfo.keys : [];

    // Pills pour les keys (utiliser _displayNames si disponible, sinon les keys)
    const displayNames =
      lastTransfo && lastTransfo._displayNames
        ? lastTransfo._displayNames[0]
        : keys;

    // Initialiser selectedKeys avant de créer le HTML (pour getThresholdHTML)
    if (keyListData && keys.length > 0) {
      this.selectedKeys = keys.map((id, i) => {
        const name = displayNames[i] || id;
        // Trouver l'objet data correspondant dans keyListData
        const data = Object.entries(keyListData).find(
          ([k, v]) => v.bubble_id === id
        )?.[1];
        return { id, name, data };
      });
    } else {
      this.selectedKeys = keys.map((id, i) => ({
        id,
        name: displayNames[i] || id,
      }));
    }

    // Initialiser threshold avant de créer le HTML
    this.initializeThreshold();

    const pills = displayNames
      .map((name, i) => {
        // Vérifier si c'est un ID Bubble (format: nombrexnombre)
        const keyId = keys[i] || name;
        const isBubbleId = /^\d+x\d+$/.test(keyId);
        const textColor = isBubbleId ? 'text-blue-800' : 'text-red-600';
        return `<span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 ${textColor} text-sm mr-2 mb-2">
        ${name}
        <button type="button" class="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none" data-key-index="${i}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </span>`;
      })
      .join('');

    // Générer les options du dropdown à partir de keyListData avec bubble_id
    // Trier par ordre alphabétique en utilisant les noms traduits
    const keyOptions = Object.entries(keyListData || {})
      .map(([name, value]) => {
        const translatedName = this.getTitreAffiche(name, value);
        return { name, value, translatedName };
      })
      .sort((a, b) =>
        a.translatedName.localeCompare(b.translatedName, undefined, {
          sensitivity: 'base',
        })
      )
      .map(
        ({ name, value, translatedName }) =>
          `<div class="px-3 py-2 hover:bg-blue-100 cursor-pointer" data-name="${name}" data-id="${value.bubble_id}">${translatedName}</div>`
      )
      .join('');
    // Masquer et désactiver l'input si threshold est actif
    const shouldHideKeyInput = this.threshold !== null && this.condition;
    const keyInputHTML = keyList
      ? `
      <div class="relative mt-2" ${shouldHideKeyInput ? 'style="display: none;"' : ''}>
        <input id="key-input" type="text" autocomplete="off" placeholder="${i18next.t('parameters')}" ${shouldHideKeyInput ? 'disabled' : ''} class="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
        <div id="key-dropdown" class="absolute left-0 right-0 bg-white border border-gray-200 rounded shadow-lg z-[60] max-h-40 overflow-y-auto hidden">${keyOptions}</div>
      </div>
    `
      : '';

    // Label et description de la transformation sélectionnée
    const currentLabel =
      lastType && window.transformationUtils
        ? window.transformationUtils.getTransformationLabel(lastType)
        : i18next.t('noTransformation');
    const currentDesc =
      lastType && window.transformationUtils
        ? window.transformationUtils.getTransformationDescription(lastType)
        : '';

    // Génération dynamique des options du select (AJOUTÉ)
    let options = '';
    if (!lastType) {
      options += `<option value="" disabled selected>${i18next.t('selectTransformation')}</option>`;
    }

    // Utiliser directement les transformations passées en paramètre
    if (transformations && transformations.length > 0) {
      this._availableTransformations = transformations;
      this._availableTransformations = transformations;
      // Récupérer la langue depuis les paramètres URL
      const params = getUrlParams();
      const lang = params.lang || 'fr';

      transformations.forEach(transfo => {
        if (transfo.isSeparator) {
          options += `<option value="" disabled>${transfo.label}</option>`;
        } else {
          const selected = lastType === transfo.value ? 'selected' : '';
          // Utiliser la langue appropriée
          const displayLabel =
            lang === 'en_gb' && transfo.en_gb ? transfo.en_gb : transfo.label;
          options += `<option value="${transfo.value}" ${selected}>${displayLabel}</option>`;
        }
      });
    } else {
      // Fallback : utiliser les transformations statiques existantes
      options += (
        window.transformationUtils
          ? window.transformationUtils.getAvailableTransformations()
          : []
      )
        .map(
          t =>
            `<option value="${t.value}" ${lastType === t.value ? 'selected' : ''}>${t.label}</option>`
        )
        .join('');
    }

    // Adapter le titre et le texte du bouton selon le mode
    const title =
      this.mode === 'add'
        ? i18next.t('addTransformation')
        : i18next.t('editTransformation');
    const buttonText =
      this.mode === 'add' ? i18next.t('create') : i18next.t('save');

    this.modal.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">${title}</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('transformationType')}</label>
          <select id="transfo-type" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
            ${options}
          </select>
          <div id="transfo-description" class="text-xs text-gray-500 mt-1">${currentDesc}</div>
          <div id="transfo-keys" class="flex flex-wrap mt-2">${pills}</div>
          ${keyInputHTML}
          <div id="threshold-container">${this.getThresholdHTML(lastType)}</div>
        </div>
      </div>
      <div class="mt-6 flex justify-end space-x-3">
        <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
        <button id="save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${buttonText}</button>
      </div>
    `;

    // Attacher les listeners directement (plus besoin de charger les transformations)
    this.attachEventListeners();

    // Masquer et désactiver l'input si threshold est actif (après création du HTML)
    if (this.threshold !== null && this.condition) {
      const keyInputWrapper =
        this.modal.querySelector('#key-input')?.parentElement;
      const keyInput = this.modal.querySelector('#key-input');
      if (keyInputWrapper) {
        keyInputWrapper.style.display = 'none';
      }
      if (keyInput) {
        keyInput.disabled = true;
      }
    }
  }

  // Nouvelle méthode pour charger les transformations et créer la popup complète sans keyList
  async loadTransformationsAndCreateCompletePopup(ref, lastType, keys) {
    try {
      // Charger les transformations disponibles
      const transformations =
        await window.transformationUtils.getAvailableTransformations();

      // Créer directement la popup complète avec les transformations chargées
      this.createPopupWithKeyList(ref, null, null, transformations);

      // Désactiver le flag de chargement après le chargement réussi
      this.isLoadingData = false;
    } catch (error) {
      console.error('Erreur lors du chargement des transformations:', error);

      // Désactiver le flag de chargement même en cas d'erreur
      this.isLoadingData = false;

      // Afficher un message d'erreur dans la popup existante
      if (this.modal) {
        const contentDiv = this.modal.querySelector('.space-y-4');
        if (contentDiv) {
          contentDiv.innerHTML = `
            <div class="text-red-600 text-sm">
              Erreur lors du chargement des transformations. Veuillez réessayer.
            </div>
          `;
        }
      }
    }
  }

  // Nouvelle méthode pour charger les transformations dans createPopupWithKeyList
  async loadTransformationsForPopupWithKeyList(
    ref,
    lastType,
    keys,
    keyList,
    keyListData,
    pills,
    keyInputHTML,
    currentLabel,
    currentDesc,
    transformations
  ) {
    try {
      // Charger les transformations disponibles
      // const transformations = await window.transformationUtils.getAvailableTransformations(); // This line is now redundant as transformations are passed as an argument

      this._availableTransformations = transformations;
      // Générer les options du select
      let options = '';
      if (!lastType) {
        options += `<option value="" disabled selected>${i18next.t('selectTransformation')}</option>`;
      }

      // Récupérer la langue depuis les paramètres URL
      const params = getUrlParams();
      const lang = params.lang || 'fr';

      transformations.forEach(transfo => {
        if (transfo.isSeparator) {
          options += `<option value="" disabled>${transfo.label}</option>`;
        } else {
          const selected = lastType === transfo.value ? 'selected' : '';
          // Utiliser la langue appropriée
          const displayLabel =
            lang === 'en_gb' && transfo.en_gb ? transfo.en_gb : transfo.label;
          options += `<option value="${transfo.value}" ${selected}>${displayLabel}</option>`;
        }
      });

      // Adapter le titre et le texte du bouton selon le mode
      const title =
        this.mode === 'add'
          ? i18next.t('addTransformation')
          : i18next.t('editTransformation');
      const buttonText =
        this.mode === 'add' ? i18next.t('create') : i18next.t('save');

      this.modal.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">${title}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('transformationType')}</label>
            <select id="transfo-type" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
              ${options}
            </select>
            <div id="transfo-description" class="text-xs text-gray-500 mt-1">${currentDesc}</div>
            <div id="transfo-keys" class="flex flex-wrap mt-2">${pills}</div>
            ${keyInputHTML}
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
          <button id="save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${buttonText}</button>
        </div>
      `;

      // Attacher les listeners
      this.attachEventListeners();
    } catch (error) {
      console.error('Erreur lors du chargement des transformations:', error);

      // Afficher un message d'erreur
      this.modal.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">Erreur</h3>
        <div class="text-red-600 text-sm mb-4">
          Erreur lors du chargement des transformations. Veuillez réessayer.
        </div>
        <div class="mt-6 flex justify-end space-x-3">
          <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
        </div>
      `;

      // Attacher seulement le listener pour le bouton cancel
      const cancelBtn = this.modal.querySelector('#cancel-btn');
      if (cancelBtn) {
        cancelBtn.onclick = () => this.hide();
      }
    }
  }

  // Nouvelle méthode pour charger les transformations et mettre à jour la popup
  async loadTransformationsAndUpdatePopup(ref, lastType, keys) {
    try {
      // Charger les transformations disponibles
      const transformations =
        await window.transformationUtils.getAvailableTransformations();

      // Générer les options du select
      let options = '';
      if (!lastType) {
        options += `<option value="" disabled selected>${i18next.t('selectTransformation')}</option>`;
      }

      // Récupérer la langue depuis les paramètres URL
      const params = getUrlParams();
      const lang = params.lang || 'fr_fr';

      transformations.forEach(transfo => {
        if (transfo.isSeparator) {
          options += `<option value="" disabled>${transfo.label}</option>`;
        } else {
          const selected = lastType === transfo.value ? 'selected' : '';
          // Utiliser la langue appropriée
          const displayLabel =
            lang === 'en_gb' && transfo.en_gb ? transfo.en_gb : transfo.label;
          options += `<option value="${transfo.value}" ${selected}>${displayLabel}</option>`;
        }
      });

      // Label et description de la transformation sélectionnée
      const currentLabel =
        lastType && window.transformationUtils
          ? window.transformationUtils.getTransformationLabel(lastType)
          : i18next.t('noTransformation');
      const currentDesc =
        lastType && window.transformationUtils
          ? window.transformationUtils.getTransformationDescription(lastType)
          : '';

      // Pills pour les keys
      const pills = keys
        .map(
          (key, i) =>
            `<span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm mr-2 mb-2">
          ${key}
          <button type="button" class="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none" data-key-index="${i}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </span>`
        )
        .join('');

      // Mettre à jour le contenu de la popup de manière robuste
      const selectEl = this.modal.querySelector('#transfo-type');
      const descEl = this.modal.querySelector('#transfo-description');
      const keysEl = this.modal.querySelector('#transfo-keys');
      if (selectEl) selectEl.innerHTML = options;
      if (descEl) descEl.textContent = currentDesc;
      if (keysEl) keysEl.innerHTML = pills;
      if (!selectEl) {
        // Si la structure n'existe pas encore, reconstruire le contenu entier
        this.modal.innerHTML = `
          <h3 class="text-lg font-semibold mb-2">${i18next.t('editTransformation')}</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('transformationType')}</label>
              <select id="transfo-type" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
                ${options}
              </select>
              <div id="transfo-description" class="text-xs text-gray-500 mt-1">${currentDesc}</div>
              <div id="transfo-keys" class="flex flex-wrap mt-2">${pills}</div>
            </div>
          </div>
          <div class="mt-6 flex justify-end space-x-3">
            <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
            <button id="save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${i18next.t('save')}</button>
          </div>
        `;
      }

      // Désactiver le flag de chargement après le chargement des transformations
      this.isLoadingData = false;

      // Attacher les listeners (qui va appeler updateSaveButtonState)
      this.attachEventListeners();
    } catch (error) {
      console.error('Erreur lors du chargement des transformations:', error);

      // Désactiver le flag de chargement même en cas d'erreur
      this.isLoadingData = false;

      // Afficher un message d'erreur
      const loadingDiv =
        this.modal.querySelector('.animate-spin')?.parentElement?.parentElement;
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <div class="text-red-600 text-sm">
            Erreur lors du chargement des transformations. Veuillez réessayer.
          </div>
        `;
      }
    }
  }

  // Fonction pour initialiser selectedKeys avec les données existantes
  initializeSelectedKeys() {
    if (!this.currentRef?.transformation) return [];

    const transfo = this.currentRef.transformation;
    const keys = transfo.keys || [];
    const displayNames = transfo._displayNames?.[0] || [];

    // Si on a les displayNames, les utiliser
    if (displayNames.length === keys.length) {
      return keys.map((id, i) => ({ id, name: displayNames[i] }));
    }

    // Sinon, utiliser les keys comme noms (fallback)
    return keys.map(id => ({ id, name: id }));
  }

  // Fonction pour initialiser threshold et condition avec les données existantes
  initializeThreshold() {
    if (!this.currentRef?.transformation) {
      this.threshold = null;
      this.condition = null;
      return;
    }

    const transfo = this.currentRef.transformation;
    this.threshold = transfo.threshold !== undefined ? transfo.threshold : null;
    this.condition = transfo.condition || null;
  }

  // Fonction pour générer le HTML du threshold
  getThresholdHTML(selectedType = null) {
    // Si selectedType n'est pas fourni, essayer de le récupérer depuis le modal
    if (!selectedType && this.modal) {
      selectedType = this.modal.querySelector('#transfo-type')?.value;
    }
    const supportsThreshold =
      selectedType &&
      window.transformationTypes &&
      window.transformationTypes[selectedType] &&
      window.transformationTypes[selectedType].supportsThreshold === true;

    // Le bouton n'est visible que si un seul élément est sélectionné et que le type supporte le threshold
    const showAddButton =
      supportsThreshold &&
      this.selectedKeys.length === 1 &&
      (this.threshold === null || this.condition === null);

    // La ligne threshold est visible si threshold et condition sont définis
    const showThresholdRow = this.threshold !== null && this.condition !== null;

    let html = '';

    // Bouton "Ajouter un seuil"
    if (showAddButton) {
      html += `
        <div class="mt-2">
          <button
            type="button"
            id="add-threshold-btn"
            class="text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none"
          >
            ${i18next.t('addThreshold')}
          </button>
        </div>
      `;
    }

    // Ligne threshold (dropdown + input)
    if (showThresholdRow) {
      html += `
        <div id="threshold-row" class="mt-2 flex items-center gap-2">
          <select
            id="threshold-condition"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          >
            <option value="over" ${this.condition === 'over' ? 'selected' : ''}>${i18next.t('thresholdGreaterThan')}</option>
            <option value="under" ${this.condition === 'under' ? 'selected' : ''}>${i18next.t('thresholdLessThan')}</option>
          </select>
          <input
            type="number"
            id="threshold-value"
            min="0"
            max="100"
            value="${this.threshold || 0}"
            class="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            placeholder="0"
          />
          <span class="text-sm text-gray-700">%</span>
          <button
            type="button"
            id="remove-threshold-btn"
            class="text-sm text-red-600 hover:text-red-700 underline focus:outline-none ml-auto"
          >
            ${i18next.t('removeThreshold')}
          </button>
        </div>
      `;
    }

    return html;
  }

  attachEventListeners() {
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    const saveBtn = this.modal.querySelector('#save-btn');
    const transfoTypeSelect = this.modal.querySelector('#transfo-type');
    const keysContainer = this.modal.querySelector('#transfo-keys');
    const keyInput = this.modal.querySelector('#key-input');
    const keyDropdown = this.modal.querySelector('#key-dropdown');

    // Pour garder la liste des keys sélectionnées
    // Initialiser avec les keys existantes si on édite une transformation
    this.selectedKeys = this.initializeSelectedKeys();

    // Initialiser threshold et condition depuis la transformation existante
    this.initializeThreshold();

    // Fonction pour vérifier si le bouton de sauvegarde doit être activé
    const updateSaveButtonState = () => {
      const selectedType = transfoTypeSelect.value;
      const isDropdownEmpty = !selectedType;
      const isRequiredKey =
        window.transformationTypes &&
        window.transformationTypes[selectedType] &&
        window.transformationTypes[selectedType].requiredKey;
      const hasKeys = this.selectedKeys.length > 0;

      // Le bouton "Enregistrer" est désactivé si :
      // 1. Chargement en cours des données API OU
      // 2. Aucun type sélectionné OU
      // 3. Type avec requiredKey=true ET aucun tag sélectionné
      const isValid =
        !this.isLoadingData && !isDropdownEmpty && (!isRequiredKey || hasKeys);

      saveBtn.disabled = !isValid;
      saveBtn.className = isValid
        ? 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        : 'px-4 py-2 bg-gray-400 text-gray-200 rounded cursor-not-allowed';
    };

    // Initialiser l'état du bouton
    updateSaveButtonState();

    // Écouter les changements de type
    transfoTypeSelect.addEventListener('change', e => {
      this.handleTransformationTypeChange(
        e.target.value,
        updateSaveButtonState
      );
    });

    // Charger immédiatement les détails si une transformation dynamique est déjà sélectionnée
    const initialType = transfoTypeSelect.value;
    const existingTransfo = this.currentRef?.transformation;
    if (
      initialType &&
      (initialType.startsWith('dynamic_transfo_') ||
        initialType === 'dynamic_transfo')
    ) {
      const existingMeta =
        existingTransfo && existingTransfo.type
          ? {
              bubbleId:
                existingTransfo.dynamic_transfo_id ||
                initialType.replace('dynamic_transfo_', ''),
              version: existingTransfo.dynamic_transfo_version || null,
              step: existingTransfo.step || null,
            }
          : null;

      this.handleTransformationTypeChange(initialType, updateSaveButtonState, {
        existingMeta,
        isInitialLoad: true,
      });
    }

    // Attaching cancel button listener
    cancelBtn.onclick = () => {
      // Cancel button clicked
      this.close();
    };

    saveBtn.onclick = () => {
      const selectedType = transfoTypeSelect.value;
      const selectedMeta =
        this._availableTransformations?.find(
          transfo => transfo.value === selectedType
        ) || null;
      const params = getUrlParams();
      const lang = params.lang || 'fr_fr';
      const currentTransfo =
        this.currentRef?.transformation && this.currentRef.transformation.type
          ? this.currentRef.transformation
          : null;
      let transformation;

      // ← NOUVEAU : Détecter si c'est une transformation dynamique
      if (
        selectedType.startsWith('dynamic_transfo_') ||
        selectedType === 'dynamic_transfo'
      ) {
        // Transformation dynamique (format .md)
        // 1) Si selectedType vient du menu fusionné (value = dynamic_transfo_<id>)
        // 2) Ou si l'option est déjà normalisée en 'dynamic_transfo'
        let bubbleId = null;
        if (selectedType.startsWith('dynamic_transfo_')) {
          bubbleId = selectedType.replace('dynamic_transfo_', '');
        } else if (this._selectedDynamic && this._selectedDynamic.bubbleId) {
          bubbleId = this._selectedDynamic.bubbleId;
        }

        transformation = {
          type: ['dynamic_transfo'],
          dynamic_transfo_id: bubbleId,
          dynamic_transfo_version: this._selectedDynamic?.version || null,
          // Enregistrer explicitement la step pour l'icône
          step: this._selectedDynamic?.step || 'sorting',
        };
        if (lang === 'en_gb' && selectedMeta) {
          transformation.title =
            selectedMeta.en_gb || selectedMeta.label || bubbleId;
        } else if (currentTransfo?.title) {
          transformation.title = currentTransfo.title;
        }
      } else {
        // ← EXISTANT : Logique pour les transformations statiques
        const selectedIds = this.selectedKeys.map(k => k.id);
        const selectedNames = this.selectedKeys.map(k => {
          // Utiliser la traduction selon la langue courante
          // Les données complètes sont déjà dans selectedKeys
          return this.getTitreAffiche(k.name, k.data);
        });

        transformation = {
          type: [selectedType],
          keys: selectedIds, // IDs pour les calculs
          _displayNames: [selectedNames], // Noms pour l'affichage
        };

        // Ajouter threshold/condition si présents (et une seule key)
        if (
          this.threshold !== null &&
          this.condition &&
          selectedIds.length === 1
        ) {
          transformation.threshold = this.threshold;
          transformation.condition = this.condition;
        }
      }

      if (this.currentRef) {
        if (this.mode === 'add') {
          // Mode add : utiliser le path fourni
          const path = this.currentRef.path;
          const scenario = window.scenarios[window.currentScenarioIdx].scenario;

          console.log('🔍 Popup saveTransformation (add mode):', {
            path,
            scenario,
            transformation,
            currentRef: this.currentRef,
          });

          if (path) {
            console.log('🔍 Calling addTransformationToPath...');
            console.log(
              '🔍 addTransformationToPath function exists:',
              typeof addTransformationToPath
            );

            if (typeof addTransformationToPath === 'function') {
              const result = addTransformationToPath(
                scenario,
                path,
                transformation
              );
              console.log('🔍 addTransformationToPath result:', result);

              // Afficher le scénario complet après ajout
              window.publishScenario(scenario, 'AJOUT TRANSFORMATION');

              console.log('🔍 Continuing after addTransformationToPath...');
            } else {
              console.error('❌ addTransformationToPath function not found!');
              return;
            }

            // Relancer le Sankey
            const lot = window.lotType;
            const dimension = window.currentDimension;
            if (typeof runSankey === 'function') {
              runSankey({
                lot,
                scenario,
                containerId: 'sankey-container',
                dimension,
              });
            }
          } else {
            console.error("Pas de path fourni pour l'ajout de transformation");
          }
        } else if (this.mode === 'edit') {
          // Mode edit : utiliser le path fourni
          const path = this.currentRef.path;
          const nodeId = this.currentRef.nodeId;
          const nodeInfo = findTransformationByNodeId(
            window.scenarios[window.currentScenarioIdx].scenario,
            nodeId
          );

          if (nodeInfo) {
            // Conserver l'ID existant
            transformation._nodeId = nodeInfo.transformation._nodeId;
            // Supprimer le _path s'il existe
            delete transformation._path;

            // Mettre à jour la transformation avec la nouvelle fonction
            const success = window.updateTransformationByNodeId(
              window.scenarios[window.currentScenarioIdx].scenario,
              nodeId,
              transformation
            );

            if (!success) {
              console.error(
                'Erreur lors de la mise à jour de la transformation'
              );
              return;
            }

            // Publier le scénario après édition
            window.publishScenario(
              window.scenarios[window.currentScenarioIdx].scenario,
              'ÉDITION TRANSFORMATION'
            );

            // Relancer le Sankey
            const lot = window.lotType;
            const dimension = window.currentDimension;
            if (typeof runSankey === 'function') {
              runSankey({
                lot,
                scenario: window.scenarios[window.currentScenarioIdx].scenario,
                containerId: 'sankey-container',
                dimension,
              });
            }
          } else {
            console.error('Transformation non trouvée pour nodeId:', nodeId);
          }
        }
      }

      // Activer le bouton Enregistrer de la page principale
      if (typeof setScenarioModifie === 'function') {
        setScenarioModifie(true);
      }

      this.close();
    };

    // Suppression visuelle d'une key (et du modèle) - CORRIGÉ
    if (keysContainer) {
      // Utiliser la délégation d'événements pour éviter les problèmes de listeners multiples
      keysContainer.addEventListener('click', e => {
        if (e.target.closest('button[data-key-index]')) {
          e.preventDefault();
          e.stopPropagation();
          const button = e.target.closest('button[data-key-index]');
          const pill = button.closest('span');
          if (pill && button) {
            const index = parseInt(button.dataset.keyIndex);
            if (index >= 0 && index < this.selectedKeys.length) {
              this.selectedKeys.splice(index, 1);
              pill.remove();

              // Mettre à jour les data-key-index des pills restants
              const remainingPills = keysContainer.querySelectorAll(
                'button[data-key-index]'
              );
              remainingPills.forEach((btn, newIndex) => {
                btn.dataset.keyIndex = newIndex;
              });

              // Si on revient à une seule key après suppression, on peut réactiver le threshold
              // mais on le laisse à null par défaut (l'utilisateur doit le réactiver manuellement)

              // Si on supprime la dernière fibre et qu'on a un threshold, le désactiver
              if (this.selectedKeys.length === 0 && this.threshold !== null) {
                this.threshold = null;
                this.condition = null;
              }

              updateSaveButtonState();
              // Mettre à jour l'affichage du threshold si nécessaire
              this.updateThresholdDisplay(updateSaveButtonState);
            }
          }
        }
      });
    }

    // COMMENTÉ : Le gestionnaire global est déjà attaché par attachBasicEventListeners
    // Pas besoin de le refaire ici

    // Gestion du dropdown des paramètres (keyInput et keyDropdown)
    if (keyInput && keyDropdown) {
      // Récupérer les données de base pour ce type de transformation
      const selectedType = transfoTypeSelect.value;
      const keyList =
        window.transformationTypes &&
        window.transformationTypes[selectedType] &&
        window.transformationTypes[selectedType].keyList;

      if (keyList) {
        // Charger les données de base si pas encore fait
        chargerDonneesBaseAPI(keyList)
          .then(keyListData => {
            // S'assurer que l'input reste masqué si threshold est actif (après chargement des données)
            if (this.threshold !== null && this.condition) {
              const keyInputWrapper = keyInput?.parentElement;
              if (keyInputWrapper) {
                keyInputWrapper.style.display = 'none';
              }
              if (keyInput) {
                keyInput.disabled = true;
              }
            }
            // Fonction pour récupérer les clés déjà utilisées par cette transformation spécifique
            const getUsedKeysForThisTransformation = () => {
              const usedKeys = new Set();

              // Dans les deux modes (add et edit), masquer uniquement les clés de cette transformation
              if (this.currentRef && this.currentRef.transformation) {
                // Mode edit : transformation existante
                const existingTransfo = this.currentRef.transformation;
                if (
                  existingTransfo.keys &&
                  Array.isArray(existingTransfo.keys[0])
                ) {
                  existingTransfo.keys[0].forEach(key => {
                    if (
                      key &&
                      typeof key === 'string' &&
                      /^\d+x\d+$/.test(key)
                    ) {
                      usedKeys.add(key);
                    }
                  });
                }
              }

              return usedKeys;
            };

            // Fonction pour afficher les options filtrées
            let showFilteredOptions = (searchValue = '') => {
              const allKeys = Object.entries(keyListData || {});
              const usedKeysForThisTransfo = getUsedKeysForThisTransformation();

              const filtered = allKeys.filter(
                ([name, itemData]) =>
                  name &&
                  name.toLowerCase().includes(searchValue.toLowerCase()) &&
                  // Masquer les clés déjà sélectionnées dans cette popup
                  !this.selectedKeys.some(
                    k => k.name === name && k.id === itemData.bubble_id
                  ) &&
                  // Masquer uniquement les clés déjà utilisées par cette transformation
                  !usedKeysForThisTransfo.has(itemData.bubble_id)
              );

              if (filtered.length > 0) {
                // Calculer les traductions et trier par ordre alphabétique
                const optionsWithTranslations = filtered
                  .map(([name, itemData]) => {
                    const translatedName = this.getTitreAffiche(name, itemData);
                    return { name, itemData, translatedName };
                  })
                  .sort((a, b) =>
                    a.translatedName.localeCompare(
                      b.translatedName,
                      undefined,
                      { sensitivity: 'base' }
                    )
                  );

                keyDropdown.innerHTML = optionsWithTranslations
                  .map(
                    ({ name, itemData, translatedName }) =>
                      `<div class="px-3 py-2 hover:bg-blue-100 cursor-pointer" data-name="${name}" data-id="${itemData.bubble_id}">${translatedName}</div>`
                  )
                  .join('');
                keyDropdown.classList.remove('hidden');
              } else {
                keyDropdown.innerHTML = '';
                keyDropdown.classList.add('hidden');
              }
            };

            // S'assurer que l'input est masqué si threshold est actif (après chargement des données)
            const ensureInputHidden = () => {
              if (this.threshold !== null && this.condition) {
                const keyInputWrapper = keyInput?.parentElement;
                if (keyInputWrapper) {
                  keyInputWrapper.style.display = 'none';
                }
                if (keyInput) {
                  keyInput.disabled = true;
                }
              }
            };

            // Masquer immédiatement si threshold est actif
            ensureInputHidden();

            // Réappliquer après chaque interaction pour garantir que ça reste masqué
            const originalShowFilteredOptions = showFilteredOptions;
            showFilteredOptions = (searchValue = '') => {
              if (this.threshold === null || !this.condition) {
                originalShowFilteredOptions(searchValue);
              }
            };

            // Listener pour le focus sur l'input (seulement si pas de threshold actif)
            keyInput.addEventListener('focus', () => {
              if (this.threshold === null || !this.condition) {
                showFilteredOptions();
              } else {
                // Empêcher l'ouverture du dropdown si threshold actif
                keyInput.blur();
              }
            });

            // Listener pour le clic sur l'input (pour rouvrir le dropdown même si déjà focus)
            keyInput.addEventListener('click', e => {
              if (this.threshold === null || !this.condition) {
                showFilteredOptions();
              } else {
                // Empêcher l'ouverture du dropdown si threshold actif
                e.preventDefault();
                e.stopPropagation();
              }
            });

            // Listener pour la saisie
            keyInput.addEventListener('input', e => {
              showFilteredOptions(e.target.value.trim());
            });

            // Listener pour la sélection d'une option
            keyDropdown.addEventListener(
              'mousedown',
              e => {
                if (e.target && e.target.dataset.name) {
                  // Empêcher la propagation ET le comportement par défaut
                  e.stopPropagation();
                  e.preventDefault();

                  const name = e.target.dataset.name;
                  const id = e.target.dataset.id;

                  // Empêcher l'ajout si threshold est actif (on ne peut avoir qu'une seule fibre)
                  if (
                    this.threshold !== null &&
                    this.condition &&
                    this.selectedKeys.length >= 1
                  ) {
                    return;
                  }

                  if (
                    !this.selectedKeys.some(k => k.name === name && k.id === id)
                  ) {
                    // Récupérer l'objet complet pour la traduction
                    const itemData = keyListData[name];
                    const translatedName = this.getTitreAffiche(name, itemData);

                    this.selectedKeys.push({ name, id, data: itemData });

                    // Ajouter le pill visuellement avec le nom traduit
                    const pill = document.createElement('span');
                    pill.innerHTML = `${translatedName}<button type="button" class="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none" data-key-index="${this.selectedKeys.length - 1}"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
                    pill.className =
                      'inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm mr-2 mb-2';

                    if (keysContainer) {
                      keysContainer.appendChild(pill);
                    }

                    // Si on passe à plus d'une key, désactiver le threshold
                    if (this.selectedKeys.length > 1) {
                      this.threshold = null;
                      this.condition = null;
                    }

                    updateSaveButtonState();
                    // Mettre à jour l'affichage du threshold
                    this.updateThresholdDisplay(updateSaveButtonState);
                  }

                  keyDropdown.classList.add('hidden');
                  keyInput.value = '';
                }
              },
              { capture: true }
            );

            keyDropdown.addEventListener('click', e => {
              e.stopPropagation();
            });

            // Fermer le dropdown avec Escape
            if (this._escapeHandler) {
              document.removeEventListener('keydown', this._escapeHandler);
            }
            this._escapeHandler = e => {
              if (e.key === 'Escape' && keyDropdown) {
                keyDropdown.classList.add('hidden');
                keyInput.value = '';
              }
            };
            document.addEventListener('keydown', this._escapeHandler);
          })
          .catch(error => {
            console.error(
              'Erreur lors du chargement des données de base:',
              error
            );
          });
      }
    }

    // Gestion du threshold
    this.attachThresholdListeners(updateSaveButtonState);

    // S'assurer que l'input reste masqué si threshold est actif (après tous les listeners)
    // Utiliser setTimeout pour s'assurer que c'est exécuté après toutes les initialisations
    setTimeout(() => {
      if (this.threshold !== null && this.condition) {
        const keyInputWrapper =
          this.modal.querySelector('#key-input')?.parentElement;
        const keyInput = this.modal.querySelector('#key-input');
        if (keyInputWrapper) {
          keyInputWrapper.style.display = 'none';
        }
        if (keyInput) {
          keyInput.disabled = true;
        }
      }
    }, 0);
  }

  // Méthode pour mettre à jour l'affichage du threshold
  updateThresholdDisplay(updateSaveButtonState) {
    const thresholdContainer = this.modal.querySelector('#threshold-container');
    const selectedType = this.modal.querySelector('#transfo-type')?.value;
    const keyInputWrapper =
      this.modal.querySelector('#key-input')?.parentElement;

    if (thresholdContainer) {
      thresholdContainer.innerHTML = this.getThresholdHTML(selectedType);
      // Réattacher les listeners après mise à jour du HTML
      this.attachThresholdListeners(updateSaveButtonState);
    }

    // Masquer et désactiver l'input de recherche si threshold actif
    const keyInput = this.modal.querySelector('#key-input');
    if (keyInputWrapper && keyInput) {
      if (this.threshold !== null && this.condition) {
        keyInputWrapper.style.display = 'none';
        keyInput.disabled = true;
      } else {
        keyInputWrapper.style.display = 'block';
        keyInput.disabled = false;
      }
    }
  }

  // Méthode pour attacher les listeners du threshold
  attachThresholdListeners(updateSaveButtonState) {
    const addThresholdBtn = this.modal.querySelector('#add-threshold-btn');
    const removeThresholdBtn = this.modal.querySelector(
      '#remove-threshold-btn'
    );
    const thresholdCondition = this.modal.querySelector('#threshold-condition');
    const thresholdValue = this.modal.querySelector('#threshold-value');

    // Bouton "Ajouter un seuil"
    if (addThresholdBtn) {
      addThresholdBtn.addEventListener('click', () => {
        this.threshold = 0;
        this.condition = 'over';
        this.updateThresholdDisplay(updateSaveButtonState);
        if (updateSaveButtonState) updateSaveButtonState();
      });
    }

    // Bouton "Supprimer le seuil"
    if (removeThresholdBtn) {
      removeThresholdBtn.addEventListener('click', () => {
        this.threshold = null;
        this.condition = null;
        this.updateThresholdDisplay(updateSaveButtonState);
        if (updateSaveButtonState) updateSaveButtonState();
      });
    }

    // Dropdown condition
    if (thresholdCondition) {
      thresholdCondition.addEventListener('change', e => {
        this.condition = e.target.value;
        if (updateSaveButtonState) updateSaveButtonState();
      });
    }

    // Input threshold value
    if (thresholdValue) {
      thresholdValue.addEventListener('input', e => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0 && value <= 100) {
          this.threshold = value;
        }
        if (updateSaveButtonState) updateSaveButtonState();
      });
    }
  }

  handleTransformationTypeChange(
    newType,
    updateSaveButtonState,
    { existingMeta = null, isInitialLoad = false } = {}
  ) {
    if (!newType) return;

    const transfoDescription = this.modal.querySelector('#transfo-description');
    if (window.transformationUtils && transfoDescription) {
      transfoDescription.textContent =
        window.transformationUtils.getTransformationDescription(newType);
    }

    const isDynamic = newType.startsWith('dynamic_transfo_');
    const keysContainer = this.modal.querySelector('#transfo-keys');
    const keyInput = this.modal.querySelector('#key-input');
    const keyInputWrapper = keyInput ? keyInput.parentElement : null;

    if (isDynamic) {
      const bubbleId = newType.replace('dynamic_transfo_', '');
      console.log('Transformation dynamique sélectionnée:', bubbleId);

      this._selectedDynamic = {
        bubbleId,
        version:
          existingMeta?.version ??
          this._selectedDynamic?.version ??
          this.currentRef?.transformation?.dynamic_transfo_version ??
          null,
        step:
          existingMeta?.step ??
          this._selectedDynamic?.step ??
          this.currentRef?.transformation?.step ??
          'sorting',
      };

      // Activer le flag de chargement et mettre à jour le bouton
      this.isLoadingData = true;
      if (typeof updateSaveButtonState === 'function') {
        updateSaveButtonState();
      }

      if (keysContainer) {
        keysContainer.style.display = 'none';
      }
      if (keyInputWrapper) {
        keyInputWrapper.style.display = 'none';
      }
      if (transfoDescription) {
        transfoDescription.style.display = 'none';
      }

      // Supprimer les résidus d'un chargement précédent
      const existingTable = this.modal.querySelector('#transfo-details-table');
      if (existingTable) {
        existingTable.remove();
      }
      const existingGeneralInfo = this.modal.querySelector(
        '#transfo-general-info'
      );
      if (existingGeneralInfo) {
        existingGeneralInfo.remove();
      }
      const existingError = this.modal.querySelector('#transfo-error-message');
      if (existingError) {
        existingError.remove();
      }

      // Afficher le tableau des détails (qui désactivera le flag de chargement)
      this.displayDynamicTransfoDetails(bubbleId);
      return;
    }

    // Cas des transformations statiques
    if (keysContainer) {
      keysContainer.style.display = 'block';
    }
    if (keyInputWrapper) {
      // Ne pas réafficher l'input si threshold est actif
      if (this.threshold === null || !this.condition) {
        keyInputWrapper.style.display = 'block';
      } else {
        keyInputWrapper.style.display = 'none';
      }
    }
    if (transfoDescription) {
      transfoDescription.style.display = 'block';
    }

    // Réinitialiser threshold si changement de type (mais pas lors du chargement initial)
    if (!isInitialLoad) {
      this.threshold = null;
      this.condition = null;
      // Si on change de type, réafficher l'input (threshold désactivé)
      if (keyInputWrapper) {
        keyInputWrapper.style.display = 'block';
      }
    }

    // Mettre à jour l'affichage du threshold après changement de type
    if (typeof updateSaveButtonState === 'function') {
      this.updateThresholdDisplay(updateSaveButtonState);
    }

    // Nettoyer les éventuels éléments spécifiques aux dynamiques
    const existingTable = this.modal.querySelector('#transfo-details-table');
    if (existingTable) {
      existingTable.remove();
    }
    const existingGeneralInfo = this.modal.querySelector(
      '#transfo-general-info'
    );
    if (existingGeneralInfo) {
      existingGeneralInfo.remove();
    }
    const existingError = this.modal.querySelector('#transfo-error-message');
    if (existingError) {
      existingError.remove();
    }

    // Réinitialiser la step à 'sorting' pour les transformations statiques
    if (!isInitialLoad && this.currentRef && this.currentRef.transformation) {
      this.currentRef.transformation.step = 'sorting';
    }

    // Vérifier si la nouvelle transformation nécessite des paramètres
    const keyList =
      window.transformationTypes &&
      window.transformationTypes[newType] &&
      window.transformationTypes[newType].keyList;

    if (keyList) {
      // Créer une nouvelle référence avec le nouveau type mais sans les anciens paramètres
      const existingTransfo = this.currentRef?.transformation;
      const newRef = {
        ...this.currentRef,
        transformation: {
          type: [newType],
          keys: [],
          _displayNames: [[]],
          // Conserver les métadonnées importantes
          _path: existingTransfo?._path,
          _index: existingTransfo?._index,
        },
      };
      this.close();
      this.show(newRef, this.mode);
      return;
    }

    if (typeof updateSaveButtonState === 'function') {
      updateSaveButtonState();
    }
  }

  close() {
    // close() called
    if (this.backdrop) {
      // Removing backdrop and modal
      if (this._dropdownCloseHandler) {
        document.removeEventListener('mousedown', this._dropdownCloseHandler);
        this._dropdownCloseHandler = null;
      }
      if (this._escapeHandler) {
        document.removeEventListener('keydown', this._escapeHandler);
        this._escapeHandler = null;
      }
      // COMMENTÉ : Plus de gestionnaire global, fermeture directe sur backdrop
      // if (this._globalCloseHandler) {
      //   document.removeEventListener('mousedown', this._globalCloseHandler);
      //   this._globalCloseHandler = null;
      // }
      this.backdrop.remove();
      this.backdrop = null;
      this.modal = null;
      // Backdrop and modal removed
    } else {
      // No backdrop to remove
    }
  }

  // Fonction pour récupérer l'objet mini depuis Bubble (adaptée pour le contexte sankey)
  async recupererElementMini(bubbleId) {
    try {
      // Utiliser fetchItemMini depuis processes.js
      if (window.fetchItemMini) {
        return await window.fetchItemMini(bubbleId);
      }

      // Fallback si la fonction n'est pas disponible
      const params = getUrlParams();
      const isLive = params.isLive;

      const response = await fetch('/api/bubble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'item_small',
          method: 'GET',
          params: { id: bubbleId, isLive },
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'élément mini:", error);
      return null;
    }
  }

  // Fonction pour convertir les bubble_id en noms d'affichage
  async getBubbleIdsAsNames(bubbleIdObjects) {
    const names = [];
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    for (const [key, obj] of Object.entries(bubbleIdObjects)) {
      const bubbleId = obj.bubble_id;
      const percent = obj.percent ? ` (${obj.percent}%)` : '';

      try {
        // Utiliser la nouvelle fonction optimisée
        const elementMini = await this.recupererElementMini(bubbleId);
        if (elementMini) {
          // getTitreAffiche fonctionne déjà avec {fr_fr, en_gb}
          const nomReel = this.getTitreAffiche(key, elementMini);
          names.push(`${nomReel}${percent}`);
        } else {
          names.push(`${key}${percent}`);
        }
      } catch (error) {
        console.warn(`Erreur pour ${bubbleId}:`, error);
        names.push(`${key}${percent}`);
      }
    }

    return names.join(', ');
  }

  // Fonction utilitaire pour obtenir le titre traduit (copiée depuis lot.js)
  getTitreAffiche(key, obj) {
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Si la langue est en_gb ET que l'objet a une clé en_gb non vide
    if (lang === 'en_gb' && obj && obj.en_gb && obj.en_gb.trim() !== '') {
      return obj.en_gb;
    }

    // Sinon, retourne la clé originale
    return key;
  }

  // Fonction pour obtenir le label de dimension selon la langue
  getDimensionLabel(dimension) {
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Utiliser la variable dimensions de index.html (ligne 139)
    if (typeof dimensions !== 'undefined' && Array.isArray(dimensions)) {
      const dimObj = dimensions.find(d => d.value === dimension);

      if (dimObj && dimObj.label) {
        // Utiliser exactement la même logique que le dropdown (lignes 236-240 dans index.html)
        const result =
          typeof dimObj.label === 'object'
            ? dimObj.label[lang] || dimObj.label.fr_fr || dimObj.value
            : dimObj.label;
        return result;
      }
    }

    // Fallback simple
    return dimension;
  }

  // Fonction pour extraire les données du tableau à partir des détails de transformation
  async extractTableDataFromTransfo(transfoDetails) {
    // Extraire les informations générales (yield, step, loss_percent)
    const generalInfo = {
      yield: transfoDetails.yield !== undefined ? transfoDetails.yield : null,
      step: transfoDetails.step || null,
      lossPercent: transfoDetails.loss_percent || 0,
    };

    // Extraire les filtres (types depuis select)
    const filterTypes = [];
    if (transfoDetails.select) {
      for (const [key, item] of Object.entries(transfoDetails.select)) {
        if (item && item.bubble_id) {
          const elementMini = await this.recupererElementMini(item.bubble_id);
          if (elementMini) {
            const nomReel = this.getTitreAffiche(key, elementMini);
            filterTypes.push(nomReel);
          } else {
            filterTypes.push(key);
          }
        }
      }
    }

    // Extraire le type cible (pas le format)
    // La structure est { format: { fr_fr, en_gb, bubble_id }, type: { fr_fr, en_gb, bubble_id } }
    let targetType = '-';
    if (transfoDetails.target?.type?.bubble_id) {
      const elementMini = await this.recupererElementMini(
        transfoDetails.target.type.bubble_id
      );
      if (elementMini) {
        targetType = this.getTitreAffiche(
          transfoDetails.target.type.fr_fr || '-',
          elementMini
        );
      } else {
        targetType = transfoDetails.target.type.fr_fr || '-';
      }
    }

    // Extraire le type coproduit
    let coproductType = '-';
    if (transfoDetails.coproduct?.type?.bubble_id) {
      const elementMini = await this.recupererElementMini(
        transfoDetails.coproduct.type.bubble_id
      );
      if (elementMini) {
        coproductType = this.getTitreAffiche(
          transfoDetails.coproduct.type.fr_fr || '-',
          elementMini
        );
      } else {
        coproductType = transfoDetails.coproduct.type.fr_fr || '-';
      }
    }

    // Extraire le type perte
    let lossType = '-';
    if (transfoDetails.loss?.type?.bubble_id) {
      const elementMini = await this.recupererElementMini(
        transfoDetails.loss.type.bubble_id
      );
      if (elementMini) {
        lossType = this.getTitreAffiche(
          transfoDetails.loss.type.fr_fr || '-',
          elementMini
        );
      } else {
        lossType = transfoDetails.loss.type.fr_fr || '-';
      }
    }

    return {
      generalInfo,
      filterTypes: filterTypes.join(', ') || '-',
      targetType,
      coproductType,
      lossType,
    };
  }

  // Fonction pour afficher le tableau des détails de transformation
  async displayDynamicTransfoDetails(bubbleId) {
    const i18nInstance = await this.getI18nInstance();

    // Afficher le spinner pendant le chargement
    const transfoTypeSelect = this.modal.querySelector('#transfo-type');
    if (transfoTypeSelect) {
      // Supprimer l'ancien tableau/spinner/erreur s'il existe
      const existingContent = this.modal.querySelector(
        '#transfo-details-table, #transfo-loading-spinner, #transfo-error-message'
      );
      if (existingContent) {
        existingContent.remove();
      }

      // Insérer le spinner après le select
      const spinnerHTML = `
        <div id="transfo-loading-spinner" class="mt-3 flex items-center justify-center py-8 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p class="text-sm text-gray-600">${i18nInstance.t(
              'loadingDetails'
            )}</p>
          </div>
        </div>
      `;
      transfoTypeSelect.insertAdjacentHTML('afterend', spinnerHTML);
    }

    try {
      // Récupérer les détails de la transformation
      const transfoDetails =
        await window.transformationUtils.getDynamicTransfoDetails(bubbleId);

      if (!transfoDetails) {
        console.warn(i18nInstance.t('cannotLoadTransformationDetails'));
        // Afficher un message d'avertissement
        this.showTransfoDetailsError(
          i18nInstance.t('cannotLoadTransformationDetails')
        );
        return;
      }

      // Mémoriser les informations principales pour la sauvegarde
      this._selectedDynamic = {
        bubbleId,
        version:
          transfoDetails.version ??
          this._selectedDynamic?.version ??
          this.currentRef?.transformation?.dynamic_transfo_version ??
          null,
        step:
          transfoDetails.step ??
          this._selectedDynamic?.step ??
          this.currentRef?.transformation?.step ??
          'sorting',
      };

      // Extraire les données pour le tableau
      const tableData = await this.extractTableDataFromTransfo(transfoDetails);

      // Supprimer le spinner
      const spinner = this.modal.querySelector('#transfo-loading-spinner');
      if (spinner) {
        spinner.remove();
      }

      // Créer et afficher le tableau
      this.renderTransfoDetailsTable(tableData);
    } catch (error) {
      console.error(
        "Erreur lors de l'affichage des détails de transformation:",
        error
      );
      // Afficher un message d'erreur
      this.showTransfoDetailsError(
        i18nInstance.t('errorLoadingTransformationDetails')
      );
    } finally {
      // Désactiver le flag de chargement dans tous les cas
      this.isLoadingData = false;

      // Mettre à jour l'état du bouton (si attachEventListeners a déjà été appelé)
      const saveBtn = this.modal?.querySelector('#save-btn');
      const transfoTypeSelect = this.modal?.querySelector('#transfo-type');
      if (saveBtn && transfoTypeSelect) {
        const selectedType = transfoTypeSelect.value;
        const isDropdownEmpty = !selectedType;
        const isRequiredKey =
          window.transformationTypes &&
          window.transformationTypes[selectedType] &&
          window.transformationTypes[selectedType].requiredKey;
        const hasKeys = this.selectedKeys.length > 0;
        const isValid =
          !this.isLoadingData &&
          !isDropdownEmpty &&
          (!isRequiredKey || hasKeys);

        saveBtn.disabled = !isValid;
        saveBtn.className = isValid
          ? 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          : 'px-4 py-2 bg-gray-400 text-gray-200 rounded cursor-not-allowed';
      }
    }
  }

  // Fonction helper pour afficher les erreurs de chargement
  showTransfoDetailsError(message) {
    // Supprimer le spinner s'il existe
    const spinner = this.modal.querySelector('#transfo-loading-spinner');
    if (spinner) {
      spinner.remove();
    }

    // Supprimer l'ancien message d'erreur s'il existe
    const existingError = this.modal.querySelector('#transfo-error-message');
    if (existingError) {
      existingError.remove();
    }

    // Afficher le message d'erreur
    const transfoTypeSelect = this.modal.querySelector('#transfo-type');
    if (transfoTypeSelect) {
      const errorHTML = `
        <div id="transfo-error-message" class="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">${message}</p>
        </div>
      `;
      transfoTypeSelect.insertAdjacentHTML('afterend', errorHTML);
    }
  }

  // Fonction pour créer et afficher le tableau HTML
  renderTransfoDetailsTable(data) {
    const i18nInstance = window.i18next;

    if (
      !window.i18nextReady ||
      !i18nInstance ||
      typeof i18nInstance.t !== 'function'
    ) {
      setTimeout(() => this.renderTransfoDetailsTable(data), 100);
      return;
    }

    // Vérifier si on a des données
    const generalInfo = data.generalInfo || null;
    const filterTypes = data.filterTypes || '-';
    const targetType = data.targetType || '-';
    const coproductType = data.coproductType || '-';
    const lossType = data.lossType || '-';

    if (!generalInfo) {
      console.log('Aucune donnée à afficher dans le tableau');
      return;
    }

    // Construire la section des informations générales
    let generalInfoHTML = '';
    if (
      generalInfo &&
      (generalInfo.yield !== null ||
        generalInfo.step ||
        generalInfo.lossPercent > 0)
    ) {
      generalInfoHTML = `
        <div id="transfo-general-info" class="mt-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div id="general-info-header" class="px-3 py-2 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between">
            <h4 class="text-sm font-medium text-gray-900">${i18next.t('generalInfo')}</h4>
            <svg id="general-info-collapse-icon" class="w-4 h-4 text-gray-600 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
          <div id="general-info-body" class="px-3 py-2">
            <div class="space-y-2 text-sm">
              ${generalInfo.yield !== null ? `<div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('yield')}</span><span class="text-gray-900">${generalInfo.yield}%</span></div>` : ''}
              ${generalInfo.lossPercent > 0 ? `<div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('loss')}</span><span class="text-gray-900">${generalInfo.lossPercent}%</span></div>` : ''}
              ${generalInfo.step ? `<div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('step')}</span><span class="text-gray-900">${generalInfo.step}</span></div>` : ''}
              <div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('filters')}</span><span class="text-gray-900">${filterTypes}</span></div>
              <div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('target')}</span><span class="text-gray-900">${targetType}</span></div>
              <div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('coproduct')}</span><span class="text-gray-900">${coproductType}</span></div>
              ${generalInfo.lossPercent > 0 ? `<div class="flex justify-between"><span class="font-medium text-gray-700">${i18next.t('loss')}</span><span class="text-gray-900">${lossType}</span></div>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    const combinedHTML = generalInfoHTML;

    // Supprimer l'ancien contenu s'il existe
    const existingGeneralInfo = this.modal.querySelector(
      '#transfo-general-info'
    );
    if (existingGeneralInfo) {
      existingGeneralInfo.remove();
    }
    const existingTable = this.modal.querySelector('#transfo-details-table');
    if (existingTable) {
      existingTable.remove();
    }

    // Ajouter le nouveau contenu après le select de type de transformation
    const transfoTypeSelect = this.modal.querySelector('#transfo-type');
    if (transfoTypeSelect) {
      transfoTypeSelect.insertAdjacentHTML('afterend', combinedHTML);

      // Ajouter les listeners pour le collapse/expand des informations générales
      if (generalInfoHTML) {
        const generalInfoHeader = this.modal.querySelector(
          '#general-info-header'
        );
        const generalInfoBody = this.modal.querySelector('#general-info-body');
        const generalInfoIcon = this.modal.querySelector(
          '#general-info-collapse-icon'
        );

        if (generalInfoHeader && generalInfoBody && generalInfoIcon) {
          generalInfoHeader.addEventListener('click', () => {
            const isCollapsed = generalInfoBody.style.display === 'none';

            if (isCollapsed) {
              generalInfoBody.style.display = 'block';
              generalInfoIcon.style.transform = 'rotate(0deg)';
            } else {
              generalInfoBody.style.display = 'none';
              generalInfoIcon.style.transform = 'rotate(-90deg)';
            }
          });
        }
      }
    } else {
      console.warn(
        'Impossible de trouver le select de type de transformation pour insérer le tableau'
      );
    }
  }
}

// Fonction utilitaire pour charger dynamiquement la liste depuis l'API Bubble
async function chargerDonneesBaseAPI(dimension) {
  try {
    // Récupérer le paramètre isLive depuis l'URL si présent
    const urlParams = new URLSearchParams(window.location.search);
    const isLive = urlParams.get('isLive') === 'true';
    // Mapping dimension → endpoint
    const mapping = {
      formats: 'formats',
      types: 'types',
      matieres: 'matieres',
      fibres: 'fibres',
      couleurs: 'couleurs',
      qualite: 'qualites',
      proprete: 'propretes',
      perturbateurs: 'perturbateurs',
    };
    const endpoint = mapping[dimension] || dimension;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        params: { isLive },
        method: 'GET',
      }),
    });
    if (!response.ok)
      throw new Error(i18next.t('apiError', { status: response.status }));
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement des données Bubble:', error);
    return {};
  }
}

// Exposer la popup globalement
window.transformationPopup = new TransformationPopup();
window.afficherPopupTransfo = (ref, mode) =>
  window.transformationPopup.show(ref, mode);
// Fonction globale définie
