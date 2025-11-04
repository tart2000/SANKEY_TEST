// Gestionnaire de la popup des techs
class TechPopup {
  constructor() {
    this.backdrop = null;
    this.modal = null;
    this.currentNodeId = null;
    this.mode = null;
    this.selectedTech = null;
    this.techList = null;
    this.teamId = null;
  }

  show(ref, mode) {
    console.log('TechPopup.show called with:', { ref, mode });
    this.currentRef = ref;
    this.mode = mode;
    this.createPopup();
  }

  async createPopup() {
    // Récupérer le teamId depuis les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    this.teamId = urlParams.get('teamId');

    if (!this.teamId) {
      console.error(i18next.t('noTeamId'));
      this.createPopupWithError(i18next.t('noTeamSelected'));
      return;
    }

    // Charger les techs de la team depuis l'API
    try {
      const teamData = await this.loadTeamTechs(this.teamId);
      this.techList = teamData.techs || {};

      // Vérifier et mettre à jour les versions des techs dans le scénario
      await this.checkAndUpdateTechVersions();

      this.createPopupWithTechs();
    } catch (error) {
      console.error(i18next.t('errorLoadingTechs'), error);
      this.createPopupWithError(i18next.t('errorLoadingTools'));
    }
  }

  // Fonction utilitaire pour récupérer la step d'une transformation
  getTransformationStep(transformation) {
    if (!transformation) return 'sorting';

    const type = Array.isArray(transformation.type)
      ? transformation.type[0]
      : transformation.type;

    // 1. Si la transformation a une step définie, l'utiliser
    if (transformation.step) {
      return transformation.step;
    }

    // 2. Sinon, chercher dans transformationTypes
    if (window.transformationTypes && window.transformationTypes[type]) {
      return window.transformationTypes[type].step || 'sorting';
    }

    // 3. Fallback par défaut
    return 'sorting';
  }

  async loadTeamTechs(teamId) {
    const params = getUrlParams();
    const isLive = params.isLive;

    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'team',
        params: {
          id: teamId,
          isLive,
        },
        method: 'POST',
      }),
    });

    if (!response.ok)
      throw new Error(i18next.t('apiError', { status: response.status }));
    const teamData = await response.json();

    // Récupérer la step de la transformation pour filtrer les technologies
    const targetStep = this.getTransformationStep(
      this.currentRef?.transformation
    );

    // Filtrer les technologies selon la step
    if (teamData.techs && typeof teamData.techs === 'object') {
      const filteredTechs = {};
      Object.entries(teamData.techs).forEach(([name, tech]) => {
        if (tech.step) {
          if (tech.step === targetStep) {
            filteredTechs[name] = tech;
          }
        } else {
          // Si pas de step définie, garder la tech (comportement par défaut)
          filteredTechs[name] = tech;
        }
      });
      teamData.techs = filteredTechs;
    }

    return teamData;
  }

  // Nouvelle fonction pour charger les détails d'une tech
  async loadTechDetails(techId) {
    const params = getUrlParams();
    const isLive = params.isLive;

    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'tech',
        params: {
          id: techId,
          isLive,
        },
        method: 'POST',
      }),
    });

    if (!response.ok)
      throw new Error(i18next.t('apiError', { status: response.status }));
    return await response.json();
  }

  createPopupWithTechs() {
    // Création du backdrop (transparent comme les autres popups)
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 z-50';
    this.backdrop.style.background = 'none';

    // Création de la modal avec ombre prononcée comme les autres popups
    this.modal = document.createElement('div');
    this.modal.className =
      'bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6';
    this.modal.style.boxShadow =
      '0 8px 40px 8px rgba(0,0,0,0.35), 0 1.5px 8px rgba(0,0,0,0.10)';
    this.modal.style.position = 'absolute';
    this.modal.style.top = '200px';
    this.modal.style.left = '50%';
    this.modal.style.transform = 'translateX(-50%)';

    // Récupérer la tech existante si en mode edit
    const existingTech = this.getExistingTech();

    // Générer les options du dropdown
    const techOptions = Object.entries(this.techList)
      .sort(([a], [b]) => a.localeCompare(b)) // Tri alphabétique par nom
      .map(
        ([name, techData]) =>
          `<option value="${techData.bubble_id}" ${existingTech && existingTech.bubble_id === techData.bubble_id ? 'selected' : ''}>${name}</option>`
      )
      .join('');

    // Récupérer la step de la transformation pour l'affichage
    let stepInfo = '';
    if (this.currentRef?.transformation) {
      const stepId = this.getTransformationStep(this.currentRef.transformation);
      stepInfo = `<span class="text-sm text-gray-500 font-normal">(${stepId})</span>`;
    }

    const title =
      this.mode === 'add' ? i18next.t('addTool') : i18next.t('editTool');
    const buttonText =
      this.mode === 'add' ? i18next.t('add') : i18next.t('save');

    this.modal.innerHTML = `
      <div class="relative">
        <button id="close-btn" class="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <h3 class="text-lg font-semibold mb-4 pr-8">${title} ${stepInfo}</h3>
      </div>
      <div class="space-y-4">
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('tool')}</label>
            <select id="tech-select" class="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
              <option value="" disabled ${!existingTech ? 'selected' : ''}>${i18next.t('selectTool')}</option>
              ${techOptions}
            </select>
          </div>
          <div class="w-24">
            <label class="block text-sm font-medium text-gray-700 mb-1">${i18next.t('quantity')}</label>
            <input id="quantity-input" type="number" value="${existingTech ? existingTech.quantity || 1 : 1}" min="1" class="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
          </div>
        </div>
      </div>
      <div id="tech-details" class="mt-4 hidden">
        <h4 class="text-sm font-medium text-gray-700 mb-2">${i18next.t('toolCharacteristics')}</h4>
        <div class="bg-gray-50 rounded-lg p-3">
          <table class="w-full text-sm">
            <tbody id="tech-details-table">
              <!-- Les données seront injectées ici -->
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-6 flex justify-between items-center">
        ${
          this.mode === 'edit'
            ? `
        <button id="delete-btn" class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="${i18next.t('deleteTool')}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
        `
            : '<div></div>'
        }
        <div class="flex space-x-3">
          <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
          <button id="save-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${buttonText}</button>
        </div>
      </div>
    `;

    this.backdrop.appendChild(this.modal);
    document.body.appendChild(this.backdrop);
    this.attachEventListeners();

    // Si on est en mode edit et qu'il y a une tech existante, afficher ses détails
    if (this.mode === 'edit' && existingTech && existingTech.bubble_id) {
      // Utiliser les données stockées au lieu de faire un appel API
      if (existingTech.details) {
        this.displayTechDetails(existingTech.details);
      } else {
        // Fallback : faire l'appel API seulement si pas de détails stockés
        this.loadAndDisplayTechDetails(existingTech.bubble_id);
      }
    }
  }

  createPopupWithError(message) {
    // Création du backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 z-50';
    this.backdrop.style.background = 'none';

    // Création de la modal
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
      <h3 class="text-lg font-semibold mb-4 text-red-600">${i18next.t('error')}</h3>
      <p class="text-gray-700 mb-4">${message}</p>
      <div class="mt-6 flex justify-end">
        <button id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('close')}</button>
      </div>
    `;

    this.backdrop.appendChild(this.modal);
    document.body.appendChild(this.backdrop);

    const cancelBtn = this.modal.querySelector('#cancel-btn');
    cancelBtn.onclick = () => this.close();

    // Fermer en cliquant sur le backdrop
    this.backdrop.onclick = e => {
      if (e.target === this.backdrop) {
        this.close();
      }
    };
  }

  getExistingTech() {
    // Récupérer la tech existante depuis la transformation du ref
    const lastTransfo = this.currentRef?.transformation || null;
    return lastTransfo?.tech || null;
  }

  getNodeById(nodeId) {
    // Récupérer le nœud depuis window.sankeyScenario.nodes
    if (window.sankeyScenario && window.sankeyScenario.nodes) {
      return window.sankeyScenario.nodes.find(n => n.id === nodeId);
    }
    console.error('window.sankeyScenario.nodes non disponible');
    return null;
  }

  attachEventListeners() {
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    const saveBtn = this.modal.querySelector('#save-btn');
    const closeBtn = this.modal.querySelector('#close-btn');
    const deleteBtn = this.modal.querySelector('#delete-btn');
    const techSelect = this.modal.querySelector('#tech-select');
    const quantityInput = this.modal.querySelector('#quantity-input');

    // Fonction pour mettre à jour l'état du bouton de sauvegarde
    const updateSaveButtonState = () => {
      const selectedTechId = techSelect.value;
      const quantity = parseInt(quantityInput.value);
      const isValid = selectedTechId && quantity > 0;

      saveBtn.disabled = !isValid;
      saveBtn.className = isValid
        ? 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        : 'px-4 py-2 bg-gray-400 text-gray-200 rounded cursor-not-allowed';
    };

    // Initialiser l'état du bouton
    updateSaveButtonState();

    // Écouter les changements de tech et quantité
    techSelect.addEventListener('change', async e => {
      updateSaveButtonState();

      // Charger et afficher les détails de la tech sélectionnée
      const selectedTechId = e.target.value;
      if (selectedTechId) {
        await this.loadAndDisplayTechDetails(selectedTechId);
      } else {
        this.hideTechDetails();
      }
    });
    quantityInput.addEventListener('input', updateSaveButtonState);

    // Boutons de fermeture
    cancelBtn.onclick = () => this.close();
    closeBtn.onclick = () => this.close();

    // Bouton de suppression (seulement en mode edit)
    if (deleteBtn) {
      deleteBtn.onclick = () => this.showDeleteConfirmation();
    }

    saveBtn.onclick = async () => {
      console.log('🖱️ [AJOUT OUTIL] Clic sur le bouton Enregistrer');

      const selectedTechId = techSelect.value;
      const quantity = parseInt(quantityInput.value);

      console.log('📋 [AJOUT OUTIL] Données saisies:', {
        selectedTechId,
        quantity,
        currentRef: this.currentRef,
      });

      if (!selectedTechId) {
        console.warn('⚠️ [AJOUT OUTIL] Aucun outil sélectionné');
        alert(i18next.t('pleaseSelectTool'));
        return;
      }

      if (!quantity || quantity < 1) {
        console.warn('⚠️ [AJOUT OUTIL] Quantité invalide:', quantity);
        alert(i18next.t('quantityMustBeGreaterThanZero'));
        return;
      }

      // Récupérer les détails de la tech sélectionnée
      const selectedTechName =
        techSelect.options[techSelect.selectedIndex].text;
      const techData = this.techList[selectedTechName];

      console.log('🔍 [AJOUT OUTIL] Récupération des données de la tech:', {
        selectedTechName,
        techDataExists: !!techData,
        techListKeys: Object.keys(this.techList || {}),
      });

      if (!techData) {
        console.error(
          '❌ [AJOUT OUTIL] Données de la tech non trouvées dans techList'
        );
        alert(i18next.t('errorToolDataNotFound'));
        return;
      }

      // Récupérer les données détaillées de la tech via l'API
      let techDetails = null;
      try {
        console.log(
          "🌐 [AJOUT OUTIL] Chargement des détails de la tech depuis l'API..."
        );
        techDetails = await this.loadTechDetails(selectedTechId);
        console.log(
          '✅ [AJOUT OUTIL] Données détaillées de la tech récupérées:',
          techDetails
        );
      } catch (error) {
        console.error(
          '❌ [AJOUT OUTIL] Erreur lors du chargement des détails:',
          error
        );
        // Continuer sans les détails si l'API échoue
      }

      // Récupérer la step de la transformation
      const stepId = this.getTransformationStep(
        this.currentRef?.transformation
      );

      console.log('🔍 [AJOUT OUTIL] Step de la transformation:', {
        stepId,
        transformation: this.currentRef?.transformation,
      });

      // Créer l'objet tech à sauvegarder
      const techToSave = {
        name: selectedTechName,
        bubble_id: selectedTechId,
        quantity: quantity,
        rate: techDetails?.rate || techData.rate, // Utiliser le rate de l'API, sinon fallback sur la team
        step: stepId, // Utiliser la step de la transformation
        details: techDetails, // Ajouter les détails de la tech
      };

      console.log(
        '💾 [AJOUT OUTIL] Objet tech préparé pour sauvegarde:',
        techToSave
      );

      // Sauvegarder dans le scénario
      this.saveTechToScenario(techToSave);
      this.close();

      console.log('✅ [AJOUT OUTIL] Popup fermée après sauvegarde');
    };

    // Fermer en cliquant sur le backdrop
    this.backdrop.onclick = e => {
      if (e.target === this.backdrop) {
        this.close();
      }
    };
  }

  saveTechToScenario(techData) {
    console.log('🛠️ [AJOUT OUTIL] saveTechToScenario appelée avec:', {
      techData,
      currentRef: this.currentRef,
    });

    // Sauvegarder la tech dans le scénario
    const scenarioIdx = window.currentScenarioIdx;
    const scenario = window.scenarios[scenarioIdx]?.scenario;

    if (!scenario) {
      console.error('❌ [AJOUT OUTIL] Scénario non trouvé', {
        scenarioIdx,
        scenariosExists: !!window.scenarios,
      });
      return;
    }

    console.log('✅ [AJOUT OUTIL] Scénario trouvé:', {
      scenarioIdx,
      hasScenario: !!scenario,
    });

    // Trouver le nœud dans le scénario et mettre à jour sa tech
    const updateResult = this.updateNodeTechInScenario(
      scenario,
      this.currentRef.nodeId,
      techData
    );

    if (!updateResult) {
      console.error('❌ [AJOUT OUTIL] Échec de la mise à jour du nœud');
      return;
    }

    console.log('✅ [AJOUT OUTIL] Nœud mis à jour avec succès');

    // Publier le scénario après ajout/édition d'outil
    window.publishScenario(scenario, 'AJOUT/ÉDITION OUTIL');

    // Relancer le Sankey
    const lot = window.lotType;
    const dimension = window.currentDimension;

    console.log('🔄 [AJOUT OUTIL] Relance du Sankey:', {
      hasLot: !!lot,
      hasScenario: !!scenario,
      dimension,
      runSankeyExists: typeof runSankey === 'function',
    });

    if (typeof runSankey === 'function') {
      runSankey({
        lot,
        scenario,
        containerId: 'sankey-container',
        dimension,
      });
      console.log('✅ [AJOUT OUTIL] Sankey relancé avec succès');
    } else {
      console.error('❌ [AJOUT OUTIL] runSankey non disponible');
    }

    // Activer le bouton Enregistrer
    if (typeof setScenarioModifie === 'function') {
      setScenarioModifie(true);
      console.log('✅ [AJOUT OUTIL] Bouton Enregistrer activé');
    } else {
      console.warn('⚠️ [AJOUT OUTIL] setScenarioModifie non disponible');
    }
  }

  updateNodeTechInScenario(scenario, nodeId, techData) {
    console.log('🔍 [AJOUT OUTIL] updateNodeTechInScenario appelée:', {
      nodeId,
      nodeIdType: typeof nodeId,
      techData,
      currentRef: this.currentRef,
      transformationFromRef: this.currentRef?.transformation,
      transformationNodeIdFromRef: this.currentRef?.transformation?._nodeId,
      scenarioExists: !!scenario,
      scenarioKeys: scenario ? Object.keys(scenario) : [],
    });

    // Vérifier que le nodeId correspond bien à celui de la transformation dans currentRef
    if (this.currentRef?.transformation?._nodeId) {
      const refNodeId = this.currentRef.transformation._nodeId;
      if (String(refNodeId) !== String(nodeId)) {
        console.warn('⚠️ [AJOUT OUTIL] Incohérence de nodeId:', {
          nodeIdRecu: nodeId,
          nodeIdFromRef: refNodeId,
          'Ils correspondent?': String(refNodeId) === String(nodeId),
        });
      } else {
        console.log('✅ [AJOUT OUTIL] NodeId correspond bien au ref:', {
          nodeId,
          refNodeId,
        });
      }
    }

    // Afficher la structure complète du scénario pour debug
    console.log('📊 [AJOUT OUTIL] Structure du scénario avant recherche:', {
      scenarioType: typeof scenario,
      scenarioKeys: scenario ? Object.keys(scenario) : [],
      hasMain: !!(scenario && scenario.main),
      hasTransformations: !!(scenario && scenario.transformations),
      hasCoproductScenario: !!(scenario && scenario.coproduct_scenario),
      hasCoproductTransformations: !!(
        scenario &&
        scenario.coproduct_scenario &&
        scenario.coproduct_scenario.transformations
      ),
      mainTransformationsLength:
        scenario && scenario.main && scenario.main.transformations
          ? scenario.main.transformations.length
          : 0,
      transformationsLength:
        scenario && scenario.transformations
          ? scenario.transformations.length
          : 0,
      coproductTransformationsLength:
        scenario &&
        scenario.coproduct_scenario &&
        scenario.coproduct_scenario.transformations
          ? scenario.coproduct_scenario.transformations.length
          : 0,
      mainTransformationsNodeIds:
        scenario && scenario.main && scenario.main.transformations
          ? scenario.main.transformations.map(t => ({
              _nodeId: t._nodeId,
              _nodeIdType: typeof t._nodeId,
              type: t.type,
            }))
          : [],
      transformationsNodeIds:
        scenario && scenario.transformations
          ? scenario.transformations.map(t => ({
              _nodeId: t._nodeId,
              _nodeIdType: typeof t._nodeId,
              type: t.type,
            }))
          : [],
      coproductTransformationsNodeIds:
        scenario &&
        scenario.coproduct_scenario &&
        scenario.coproduct_scenario.transformations
          ? scenario.coproduct_scenario.transformations.map(t => ({
              _nodeId: t._nodeId,
              _nodeIdType: typeof t._nodeId,
              type: t.type,
            }))
          : [],
    });

    // Trouver la transformation par son _nodeId
    const nodeInfo = findTransformationByNodeId(scenario, nodeId);

    if (!nodeInfo) {
      console.error(
        '❌ [AJOUT OUTIL] Transformation non trouvée pour nodeId:',
        {
          nodeId,
          nodeIdType: typeof nodeId,
          scenario: !!scenario,
          suggestion:
            'Vérifiez que le nodeId correspond bien à un _nodeId présent dans le scénario (voir les logs ci-dessus)',
        }
      );
      return false;
    }

    console.log('✅ [AJOUT OUTIL] Transformation trouvée:', {
      nodeId,
      transformationType: nodeInfo.transformation?.type,
      hasExistingTech: !!nodeInfo.transformation?.tech,
      path: nodeInfo.path,
    });

    // Créer la nouvelle transformation avec la tech ajoutée
    const updatedTransformation = {
      ...nodeInfo.transformation,
      tech: techData,
    };

    console.log('📝 [AJOUT OUTIL] Transformation mise à jour préparée:', {
      originalTech: nodeInfo.transformation?.tech,
      newTech: techData,
    });

    // Utiliser updateTransformationByNodeId avec le nodeId
    if (typeof window.updateTransformationByNodeId === 'function') {
      const success = window.updateTransformationByNodeId(
        scenario,
        nodeId,
        updatedTransformation
      );

      if (!success) {
        console.error(
          '❌ [AJOUT OUTIL] Erreur lors de la mise à jour de la tech'
        );
        return false;
      }

      console.log(
        '✅ [AJOUT OUTIL] Transformation mise à jour dans le scénario'
      );
      return true;
    } else {
      console.error(
        '❌ [AJOUT OUTIL] updateTransformationByNodeId non disponible'
      );
      return false;
    }
  }

  showDeleteConfirmation() {
    // Créer une popup de confirmation
    const confirmationBackdrop = document.createElement('div');
    confirmationBackdrop.className =
      'fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center';

    const confirmationModal = document.createElement('div');
    confirmationModal.className =
      'bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6';

    confirmationModal.innerHTML = `
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">${i18next.t('deleteTool')}</h3>
        <p class="text-sm text-gray-500 mb-6">${i18next.t('confirmDeleteTool')}</p>
        <div class="flex justify-center space-x-3">
          <button id="cancel-delete-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">${i18next.t('cancel')}</button>
          <button id="confirm-delete-btn" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">${i18next.t('delete')}</button>
        </div>
      </div>
    `;

    confirmationBackdrop.appendChild(confirmationModal);
    document.body.appendChild(confirmationBackdrop);

    // Event listeners pour la confirmation
    const cancelDeleteBtn =
      confirmationModal.querySelector('#cancel-delete-btn');
    const confirmDeleteBtn = confirmationModal.querySelector(
      '#confirm-delete-btn'
    );

    cancelDeleteBtn.onclick = () => {
      confirmationBackdrop.remove();
    };

    confirmDeleteBtn.onclick = () => {
      this.deleteTechFromScenario();
      confirmationBackdrop.remove();
      this.close();
    };

    // Fermer en cliquant sur le backdrop
    confirmationBackdrop.onclick = e => {
      if (e.target === confirmationBackdrop) {
        confirmationBackdrop.remove();
      }
    };
  }

  async loadAndDisplayTechDetails(techId) {
    try {
      const techDetails = await this.loadTechDetails(techId);
      this.displayTechDetails(techDetails);
    } catch (error) {
      console.error(i18next.t('errorLoadingTechDetails'), error);
      this.hideTechDetails();
    }
  }

  displayTechDetails(techDetails) {
    const techDetailsContainer = this.modal.querySelector('#tech-details');
    const techDetailsTable = this.modal.querySelector('#tech-details-table');

    if (!techDetailsContainer || !techDetailsTable) return;

    let tableRows = '';

    // Débit (rate)
    if (techDetails.rate !== undefined) {
      tableRows += `<tr class="border-b border-gray-200">
        <td class="py-2 font-medium text-gray-700">${i18next.t('rate')}</td>
        <td class="py-2 text-gray-600">${techDetails.rate} kg/h</td>
      </tr>`;
    }

    // Consommation électrique
    if (techDetails.conso !== undefined) {
      tableRows += `<tr class="border-b border-gray-200">
        <td class="py-2 font-medium text-gray-700">${i18next.t('electricalConsumption')}</td>
        <td class="py-2 text-gray-600">${techDetails.conso} W</td>
      </tr>`;
    }

    // Profils RH
    if (techDetails.profils && Object.keys(techDetails.profils).length > 0) {
      tableRows += `<tr class="border-b border-gray-200">
        <td class="py-2 font-medium text-gray-700">${i18next.t('laborProfiles')}</td>
        <td class="py-2 text-gray-600">
          <ul class="list-disc list-inside space-y-1">`;

      Object.entries(techDetails.profils).forEach(
        ([profilName, profilData]) => {
          tableRows += `<li>${profilName}: ${profilData.timeh} ${i18next.t('hoursPerUnit')}</li>`;
        }
      );

      tableRows += `</ul>
        </td>
      </tr>`;
    }

    // Étape (step)
    if (techDetails.step) {
      tableRows += `<tr class="border-b border-gray-200">
        <td class="py-2 font-medium text-gray-700">${i18next.t('step')}</td>
        <td class="py-2 text-gray-600">${techDetails.step}</td>
      </tr>`;
    }

    // Version
    if (techDetails.version) {
      tableRows += `<tr class="border-b border-gray-200">
        <td class="py-2 font-medium text-gray-700">${i18next.t('version')}</td>
        <td class="py-2 text-gray-600">${techDetails.version}</td>
      </tr>`;
    }

    techDetailsTable.innerHTML = tableRows;
    techDetailsContainer.classList.remove('hidden');
  }

  hideTechDetails() {
    const techDetailsContainer = this.modal.querySelector('#tech-details');
    if (techDetailsContainer) {
      techDetailsContainer.classList.add('hidden');
    }
  }

  async checkAndUpdateTechVersions() {
    const scenarioIdx = window.currentScenarioIdx;
    const scenario = window.scenarios[scenarioIdx]?.scenario;

    if (!scenario) {
      console.log(i18next.t('noScenarioAvailableForVersionCheck'));
      return;
    }

    console.log(i18next.t('checkingTechVersions'));
    let hasUpdates = false;

    // Fonction récursive pour parcourir le scénario
    const checkTransformations = transformations => {
      if (!Array.isArray(transformations)) return;

      transformations.forEach((transfo, index) => {
        if (transfo.tech && transfo.tech.bubble_id) {
          // Récupérer les détails de la tech depuis l'API
          this.loadTechDetails(transfo.tech.bubble_id)
            .then(techDetails => {
              if (techDetails && techDetails.version) {
                const currentVersion = transfo.tech.version || '1.0';
                const apiVersion = techDetails.version;

                if (currentVersion !== apiVersion) {
                  console.log(
                    i18next.t('techVersionUpdated', {
                      techName: transfo.tech.name,
                      currentVersion: currentVersion,
                      apiVersion: apiVersion,
                    })
                  );

                  // Mettre à jour les détails de la tech
                  this.updateTechDetails(transfo, techDetails);
                  hasUpdates = true;
                }
              }
            })
            .catch(error => {
              console.error(
                i18next.t('errorCheckingTechVersion', {
                  techName: transfo.tech.name,
                }),
                error
              );
            });
        }

        // Vérifier les sous-scénarios récursivement
        if (transfo.scenario && transfo.scenario.transformations) {
          checkTransformations(transfo.scenario.transformations);
        }
        if (
          transfo.scenario &&
          transfo.scenario.coproduct_scenario &&
          transfo.scenario.coproduct_scenario.transformations
        ) {
          checkTransformations(
            transfo.scenario.coproduct_scenario.transformations
          );
        }
      });
    };

    // Vérifier les transformations principales
    if (scenario.transformations) {
      checkTransformations(scenario.transformations);
    }
    if (
      scenario.coproduct_scenario &&
      scenario.coproduct_scenario.transformations
    ) {
      checkTransformations(scenario.coproduct_scenario.transformations);
    }

    // Si des mises à jour ont été effectuées, relancer le Sankey
    if (hasUpdates) {
      setTimeout(() => {
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
        console.log(i18next.t('sankeyRelaunchedAfterVersionUpdate'));
      }, 1000); // Attendre un peu pour que toutes les vérifications soient terminées
    }
  }

  updateTechDetails(transformation, techDetails) {
    // Mettre à jour les détails de la tech dans la transformation
    if (transformation.tech) {
      transformation.tech = {
        ...transformation.tech,
        details: techDetails,
        version: techDetails.version || '1.0',
        rate: techDetails.rate,
        conso: techDetails.conso,
        step: techDetails.step,
        profils: techDetails.profils,
      };

      console.log(
        i18next.t('techUpdated', {
          techName: transformation.tech.name,
          version: techDetails.version,
        })
      );
    }
  }

  deleteTechFromScenario() {
    // Supprimer la tech du scénario
    const scenarioIdx = window.currentScenarioIdx;
    const scenario = window.scenarios[scenarioIdx]?.scenario;

    if (!scenario) {
      console.error('Scénario non trouvé');
      return;
    }

    // Utiliser le nodeId du ref
    const nodeId = this.currentRef?.nodeId;

    if (!nodeId) {
      console.error('NodeId manquant pour la suppression de la tech');
      return;
    }

    // Trouver la transformation par son _nodeId
    const nodeInfo = findTransformationByNodeId(scenario, nodeId);

    if (!nodeInfo) {
      console.error('Transformation non trouvée pour nodeId:', nodeId);
      return;
    }

    // Créer la nouvelle transformation sans la tech
    const updatedTransformation = {
      ...nodeInfo.transformation,
      tech: undefined, // Supprimer la tech
    };

    // Utiliser updateTransformationByNodeId pour mettre à jour
    if (typeof window.updateTransformationByNodeId === 'function') {
      const success = window.updateTransformationByNodeId(
        scenario,
        nodeId,
        updatedTransformation
      );

      if (!success) {
        console.error('Erreur lors de la suppression de la tech');
        return;
      }

      // Publier le scénario après suppression d'outil
      window.publishScenario(scenario, 'SUPPRESSION OUTIL');
    } else {
      console.error('updateTransformationByNodeId non disponible');
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

    // Activer le bouton Enregistrer
    if (typeof setScenarioModifie === 'function') {
      setScenarioModifie(true);
    }
  }

  close() {
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
      this.modal = null;
    }
  }
}

// Exposer la popup globalement
window.techPopup = new TechPopup();
window.showTechPopup = (nodeId, mode) => window.techPopup.show(nodeId, mode);
