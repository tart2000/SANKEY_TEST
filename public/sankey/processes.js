// Nouvelle transformation adaptée à lotType : sélection par format
function selectByFormat(lot, selectedFormats) {
  // Vérifications de sécurité
  if (!lot.formats) {
    console.warn('[selectByFormat] Lot sans dimension formats');
    return {
      targetLot: { total: 0, formats: {} },
      coProductLot: lot,
    };
  }

  if (!selectedFormats || selectedFormats.length === 0) {
    console.warn('[selectByFormat] Aucun format sélectionné');
    return {
      targetLot: { total: 0, formats: {} },
      coProductLot: lot,
    };
  }

  const dist = lot.formats;
  let selected = {};
  let rest = {};
  let selectedPct = 0;
  let restPct = 0;

  Object.entries(dist).forEach(([key, value]) => {
    const pourcentage = value.pourcentage || 0; // Protection contre undefined
    // Parcourir le tableau de tableaux pour trouver le bubble_id
    const isSelected = selectedFormats.some(subArray =>
      Array.isArray(subArray)
        ? subArray.includes(value.bubble_id)
        : subArray === value.bubble_id
    );

    if (isSelected) {
      selected[key] = JSON.parse(JSON.stringify(value));
      selectedPct += pourcentage;
    } else {
      rest[key] = JSON.parse(JSON.stringify(value));
      restPct += pourcentage;
    }
  });

  // Éviter les divisions par zéro
  if (selectedPct > 0) {
    Object.keys(selected).forEach(k => {
      selected[k].pourcentage = (selected[k].pourcentage / selectedPct) * 100;
    });
  }

  if (restPct > 0) {
    Object.keys(rest).forEach(k => {
      rest[k].pourcentage = (rest[k].pourcentage / restPct) * 100;
    });
  }

  // Création des deux lots avec deep clone
  const targetLot = JSON.parse(JSON.stringify(lot));
  targetLot.formats = selected;
  targetLot.total = (lot.total * selectedPct) / 100;

  const coProductLot = JSON.parse(JSON.stringify(lot));
  coProductLot.formats = rest;
  coProductLot.total = (lot.total * restPct) / 100;

  if (
    Math.abs(
      lot.total - ((targetLot?.total || 0) + (coProductLot?.total || 0))
    ) > 2
  ) {
    console.warn(
      '[selectByFormat] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot?.total || 0,
      'reste =',
      coProductLot?.total || 0,
      'somme =',
      (targetLot?.total || 0) + (coProductLot?.total || 0)
    );
  }

  return { targetLot, coProductLot };
}

// Sélectionne un ou plusieurs types dans un format donné (niveau 2)
function selectByType(lot, selectedTypes) {
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
    const dist = formatObj.types;
    let selected = {};
    let rest = {};
    let selectedPct = 0;
    let restPct = 0;

    Object.entries(dist).forEach(([key, value]) => {
      let pct = typeof value === 'number' ? value : value.pourcentage;
      // Comparer uniquement avec les bubble_id
      if (selectedTypes.includes(value.bubble_id)) {
        selected[key] = JSON.parse(JSON.stringify(value));
        if (value.color) selected[key].color = value.color;
        selected[key].pourcentage = pct;
        selectedPct += pct;
      } else {
        rest[key] = JSON.parse(JSON.stringify(value));
        if (value.color) rest[key].color = value.color;
        rest[key].pourcentage = pct;
        restPct += pct;
      }
    });

    // Si aucun type n'est sélectionné, tout va au reste
    if (selectedPct === 0) {
      // Normaliser restPct pour couvrir 100% du format
      const totalPct = selectedPct + restPct;
      if (totalPct > 0) {
        restPct = (restPct / totalPct) * 100;
      } else {
        restPct = 100;
      }
    }

    // Recalcul des pourcentages pour ce format
    Object.keys(selected).forEach(k => {
      if (selectedPct > 0)
        selected[k].pourcentage = (selected[k].pourcentage / selectedPct) * 100;
      else selected[k].pourcentage = 0;
    });
    Object.keys(rest).forEach(k => {
      if (restPct > 0)
        rest[k].pourcentage = (rest[k].pourcentage / restPct) * 100;
      else rest[k].pourcentage = 0;
    });

    // Mise à jour des lots pour ce format
    const formatMass = lot.total * (formatObj.pourcentage / 100);

    if (selectedPct > 0) {
      // Le format a des types sélectionnés
      const selectedMass = formatMass * (selectedPct / 100);
      const restMass = formatMass * (restPct / 100);

      targetLot.formats[formatKey].types = selected;
      targetLot.formats[formatKey].pourcentage = selectedMass;

      coProductLot.formats[formatKey].types = rest;
      coProductLot.formats[formatKey].pourcentage = restMass;

      selectedMassTotal += selectedMass;
      restMassTotal += restMass;
    } else {
      // Le format n'a aucun type sélectionné, tout va au co-produit
      coProductLot.formats[formatKey].types = rest;
      coProductLot.formats[formatKey].pourcentage = formatMass; // Stocker la masse, pas le pourcentage

      // Supprimer le format du lot cible
      delete targetLot.formats[formatKey];

      restMassTotal += formatMass;
    }
  });

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats pour qu'ils fassent 100%
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Vérification adaptée pour les transformations enchaînées
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      '[selectByType] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

// Sélectionne une ou plusieurs matières dans un type donné (niveau 3)
function selectByMatiere(lot, selectedMatieres) {
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
    const typesObj = formatObj.types;
    let selectedTypes = {};
    let restTypes = {};
    let typeMassesSelected = {};
    let typeMassesRest = {};
    let formatSelectedMass = 0;
    let formatRestMass = 0;

    Object.entries(typesObj).forEach(([typeKey, typeObj]) => {
      const matieresObj = typeObj.matieres || {};
      let selectedMatieresObj = {};
      let restMatieresObj = {};
      let selectedPct = 0;
      let restPct = 0;

      // Si le type n'a pas de matières, le traiter comme un type "reste"
      if (Object.keys(matieresObj).length === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        const typeMass =
          lot.total *
          (formatObj.pourcentage / 100) *
          (typeObj.pourcentage / 100);
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
        return; // Passer au type suivant
      }

      Object.entries(matieresObj).forEach(([nom, matiere]) => {
        // Comparer avec les bubble_id au lieu des noms
        if (selectedMatieres.includes(matiere.bubble_id)) {
          selectedMatieresObj[nom] = JSON.parse(JSON.stringify(matiere));
          if (matiere.color) selectedMatieresObj[nom].color = matiere.color;
          selectedPct += matiere.pourcentage;
        } else {
          restMatieresObj[nom] = JSON.parse(JSON.stringify(matiere));
          if (matiere.color) restMatieresObj[nom].color = matiere.color;
          restPct += matiere.pourcentage;
        }
      });

      const typeMass =
        lot.total * (formatObj.pourcentage / 100) * (typeObj.pourcentage / 100);
      const selectedMass = typeMass * (selectedPct / 100);
      const restMass = typeMass * (restPct / 100);

      // Toujours ajouter le type, même si aucune matière n'est sélectionnée
      if (selectedPct > 0) {
        Object.keys(selectedMatieresObj).forEach(nom => {
          selectedMatieresObj[nom].pourcentage =
            (selectedMatieresObj[nom].pourcentage / selectedPct) * 100;
        });
        selectedTypes[typeKey] = {
          ...typeObj,
          matieres: selectedMatieresObj,
        };
        if (typeObj.color) selectedTypes[typeKey].color = typeObj.color;
        typeMassesSelected[typeKey] = selectedMass;
        formatSelectedMass += selectedMass;
      }

      // Toujours ajouter le type au reste, même si toutes les matières sont sélectionnées
      if (restPct > 0) {
        Object.keys(restMatieresObj).forEach(nom => {
          restMatieresObj[nom].pourcentage =
            (restMatieresObj[nom].pourcentage / restPct) * 100;
        });
        restTypes[typeKey] = {
          ...typeObj,
          matieres: restMatieresObj,
        };
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = restMass;
        formatRestMass += restMass;
      }

      // Si le type n'a ni matières sélectionnées ni matières restantes, l'ajouter au reste
      if (selectedPct === 0 && restPct === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
      }
    });

    // Recalcul des pourcentages des types dans chaque format
    if (formatSelectedMass > 0) {
      Object.keys(selectedTypes).forEach(typeKey => {
        selectedTypes[typeKey].pourcentage =
          (typeMassesSelected[typeKey] / formatSelectedMass) * 100;
      });
      targetLot.formats[formatKey].types = selectedTypes;
      targetLot.formats[formatKey].pourcentage = formatSelectedMass;
      selectedMassTotal += formatSelectedMass;
    } else {
      // Aucune matière sélectionnée dans ce format, le supprimer du target
      delete targetLot.formats[formatKey];
    }

    if (formatRestMass > 0) {
      Object.keys(restTypes).forEach(typeKey => {
        restTypes[typeKey].pourcentage =
          (typeMassesRest[typeKey] / formatRestMass) * 100;
      });
      coProductLot.formats[formatKey].types = restTypes;
      coProductLot.formats[formatKey].pourcentage = formatRestMass;
      restMassTotal += formatRestMass;
    } else if (formatSelectedMass === 0) {
      // Le format n'a ni matières sélectionnées ni matières restantes, tout va au reste
      const formatMass = lot.total * (formatObj.pourcentage / 100);
      coProductLot.formats[formatKey].pourcentage = formatMass;
      restMassTotal += formatMass;
    } else {
      // Toutes les matières sont sélectionnées, supprimer du coproduit
      delete coProductLot.formats[formatKey];
    }
  });

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats pour qu'ils fassent 100%
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Vérification adaptée pour les transformations enchaînées
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      '[selectByMatiere] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

// Patch pour selectByQualite
function selectByQualite(lot, selectedQualites) {
  // Deep clone pour ne pas modifier l'objet d'origine
  const dist = lot.qualite;
  let selected = {};
  let rest = {};
  let selectedPct = 0;
  let restPct = 0;

  Object.entries(dist).forEach(([key, value]) => {
    // Gestion des deux formats possibles (nombre ou objet avec pourcentage)
    const pct =
      typeof value === 'object' && value !== null
        ? value.pourcentage !== undefined
          ? value.pourcentage
          : 0
        : value;

    // Comparer avec les bubble_id au lieu des noms
    if (selectedQualites.includes(value.bubble_id)) {
      // Préserver toutes les propriétés comme dans selectByFormat
      selected[key] = JSON.parse(JSON.stringify(value));
      selected[key].pourcentage = pct;
      selectedPct += pct;
    } else {
      // Préserver toutes les propriétés comme dans selectByFormat
      rest[key] = JSON.parse(JSON.stringify(value));
      rest[key].pourcentage = pct;
      restPct += pct;
    }
  });

  // Recalcul des pourcentages
  Object.keys(selected).forEach(k => {
    if (selectedPct > 0) {
      selected[k].pourcentage = (selected[k].pourcentage / selectedPct) * 100;
    } else {
      selected[k].pourcentage = 0;
    }
  });
  Object.keys(rest).forEach(k => {
    if (restPct > 0) {
      rest[k].pourcentage = (rest[k].pourcentage / restPct) * 100;
    } else {
      rest[k].pourcentage = 0;
    }
  });

  // Création des deux lots (toujours créer les lots, même vides, comme selectByFormat)
  const targetLot = JSON.parse(JSON.stringify(lot));
  targetLot.qualite = selected;
  targetLot.total = lot.total * (selectedPct / 100);

  const coProductLot = JSON.parse(JSON.stringify(lot));
  coProductLot.qualite = rest;
  coProductLot.total = lot.total * (restPct / 100);

  if (
    Math.abs(
      lot.total - ((targetLot?.total || 0) + (coProductLot?.total || 0))
    ) > 2
  ) {
    console.warn(
      '[selectByQualite] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot?.total || 0,
      'reste =',
      coProductLot?.total || 0,
      'somme =',
      (targetLot?.total || 0) + (coProductLot?.total || 0)
    );
  }

  return { targetLot, coProductLot };
}

// Sélectionne une ou plusieurs couleurs dans un lot
function selectByCouleur(lot, selectedCouleurs) {
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
    const typesObj = formatObj.types;
    let selectedTypes = {};
    let restTypes = {};
    let typeMassesSelected = {};
    let typeMassesRest = {};
    let formatSelectedMass = 0;
    let formatRestMass = 0;

    Object.entries(typesObj).forEach(([typeKey, typeObj]) => {
      const couleursObj = typeObj.couleurs || {};
      let selectedCouleursObj = {};
      let restCouleursObj = {};
      let selectedPct = 0;
      let restPct = 0;

      // Si le type n'a pas de couleurs, le traiter comme un type "reste"
      if (Object.keys(couleursObj).length === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        const typeMass =
          lot.total *
          (formatObj.pourcentage / 100) *
          (typeObj.pourcentage / 100);
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
        return; // Passer au type suivant
      }

      Object.entries(couleursObj).forEach(([couleur, couleurObj]) => {
        // Comparer avec les bubble_id au lieu des noms
        if (selectedCouleurs.includes(couleurObj.bubble_id)) {
          selectedCouleursObj[couleur] = JSON.parse(JSON.stringify(couleurObj));
          if (couleurObj.color)
            selectedCouleursObj[couleur].color = couleurObj.color;
          selectedPct += couleurObj.pourcentage;
        } else {
          restCouleursObj[couleur] = JSON.parse(JSON.stringify(couleurObj));
          if (couleurObj.color)
            restCouleursObj[couleur].color = couleurObj.color;
          restPct += couleurObj.pourcentage;
        }
      });

      const typeMass =
        lot.total * (formatObj.pourcentage / 100) * (typeObj.pourcentage / 100);
      const selectedMass = typeMass * (selectedPct / 100);
      const restMass = typeMass * (restPct / 100);

      // Toujours ajouter le type, même si aucune couleur n'est sélectionnée
      if (selectedPct > 0) {
        Object.keys(selectedCouleursObj).forEach(couleur => {
          selectedCouleursObj[couleur].pourcentage =
            (selectedCouleursObj[couleur].pourcentage / selectedPct) * 100;
        });
        selectedTypes[typeKey] = {
          ...typeObj,
          couleurs: selectedCouleursObj,
        };
        if (typeObj.color) selectedTypes[typeKey].color = typeObj.color;
        typeMassesSelected[typeKey] = selectedMass;
        formatSelectedMass += selectedMass;
      }

      // Toujours ajouter le type au reste, même si toutes les couleurs sont sélectionnées
      if (restPct > 0) {
        Object.keys(restCouleursObj).forEach(couleur => {
          restCouleursObj[couleur].pourcentage =
            (restCouleursObj[couleur].pourcentage / restPct) * 100;
        });
        restTypes[typeKey] = {
          ...typeObj,
          couleurs: restCouleursObj,
        };
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = restMass;
        formatRestMass += restMass;
      }

      // Si le type n'a ni couleurs sélectionnées ni couleurs restantes, l'ajouter au reste
      if (selectedPct === 0 && restPct === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
      }
    });

    // Recalcul des pourcentages des types dans chaque format
    if (formatSelectedMass > 0) {
      Object.keys(selectedTypes).forEach(typeKey => {
        selectedTypes[typeKey].pourcentage =
          (typeMassesSelected[typeKey] / formatSelectedMass) * 100;
      });
      targetLot.formats[formatKey].types = selectedTypes;
      targetLot.formats[formatKey].pourcentage = formatSelectedMass;
      selectedMassTotal += formatSelectedMass;
    } else {
      // Aucune couleur sélectionnée dans ce format, le supprimer du target
      delete targetLot.formats[formatKey];
    }

    if (formatRestMass > 0) {
      Object.keys(restTypes).forEach(typeKey => {
        restTypes[typeKey].pourcentage =
          (typeMassesRest[typeKey] / formatRestMass) * 100;
      });
      coProductLot.formats[formatKey].types = restTypes;
      coProductLot.formats[formatKey].pourcentage = formatRestMass;
      restMassTotal += formatRestMass;
    } else if (formatSelectedMass === 0) {
      // Le format n'a ni couleurs sélectionnées ni couleurs restantes, tout va au reste
      const formatMass = lot.total * (formatObj.pourcentage / 100);
      coProductLot.formats[formatKey].pourcentage = formatMass;
      restMassTotal += formatMass;
    } else {
      // Toutes les couleurs sont sélectionnées, supprimer du coproduit
      delete coProductLot.formats[formatKey];
    }
  });

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats pour qu'ils fassent 100%
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Vérification adaptée pour les transformations enchaînées
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      '[selectByCouleur] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

// Sélectionne une ou plusieurs fibres dans un lot
function selectByFibre(
  lot,
  selectedFibres,
  threshold = null,
  condition = null
) {
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
    const typesObj = formatObj.types;
    let selectedTypes = {};
    let restTypes = {};
    let typeMassesSelected = {};
    let typeMassesRest = {};
    let formatSelectedMass = 0;
    let formatRestMass = 0;

    Object.entries(typesObj).forEach(([typeKey, typeObj]) => {
      const matieresObj = typeObj.matieres || {};
      let selectedMatieresObj = {};
      let restMatieresObj = {};
      let selectedPct = 0;
      let restPct = 0;

      // Si le type n'a pas de matières, le traiter comme un type "reste"
      if (Object.keys(matieresObj).length === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        const typeMass =
          lot.total *
          (formatObj.pourcentage / 100) *
          (typeObj.pourcentage / 100);
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
        return; // Passer au type suivant
      }

      Object.entries(matieresObj).forEach(([nom, matiere]) => {
        const fibresObj = matiere.fibres || {};

        // Si la matière n'a pas de fibres, la traiter comme "reste"
        if (Object.keys(fibresObj).length === 0) {
          restMatieresObj[nom] = JSON.parse(JSON.stringify(matiere));
          if (matiere.color) restMatieresObj[nom].color = matiere.color;
          restPct += matiere.pourcentage;
          return; // Passer à la matière suivante
        }

        // On vérifie la présence d'une fibre sélectionnée dans la matière
        const hasSelectedFibre = Object.entries(fibresObj).some(
          ([fibre, fibreObj]) => {
            const pctFibre =
              typeof fibreObj === 'object' && fibreObj !== null
                ? fibreObj.pourcentage !== undefined
                  ? fibreObj.pourcentage
                  : fibreObj
                : fibreObj;
            // Comparer avec les bubble_id au lieu des noms
            if (!selectedFibres.includes(fibreObj.bubble_id)) return false;
            if (threshold !== null && condition !== null) {
              if (condition === 'over') return pctFibre >= threshold;
              if (condition === 'under') return pctFibre <= threshold;
              return false;
            }
            return true;
          }
        );

        if (hasSelectedFibre) {
          selectedMatieresObj[nom] = JSON.parse(JSON.stringify(matiere));
          if (matiere.color) selectedMatieresObj[nom].color = matiere.color;
          selectedPct += matiere.pourcentage;
        } else {
          restMatieresObj[nom] = JSON.parse(JSON.stringify(matiere));
          if (matiere.color) restMatieresObj[nom].color = matiere.color;
          restPct += matiere.pourcentage;
        }
      });

      const typeMass =
        lot.total * (formatObj.pourcentage / 100) * (typeObj.pourcentage / 100);
      const selectedMass = typeMass * (selectedPct / 100);
      const restMass = typeMass * (restPct / 100);

      if (selectedPct > 0) {
        Object.keys(selectedMatieresObj).forEach(nom => {
          selectedMatieresObj[nom].pourcentage =
            (selectedMatieresObj[nom].pourcentage / selectedPct) * 100;
        });
        selectedTypes[typeKey] = {
          ...typeObj,
          matieres: selectedMatieresObj,
        };
        if (typeObj.color) selectedTypes[typeKey].color = typeObj.color;
        typeMassesSelected[typeKey] = selectedMass;
        formatSelectedMass += selectedMass;
      }
      if (restPct > 0) {
        Object.keys(restMatieresObj).forEach(nom => {
          restMatieresObj[nom].pourcentage =
            (restMatieresObj[nom].pourcentage / restPct) * 100;
        });
        restTypes[typeKey] = {
          ...typeObj,
          matieres: restMatieresObj,
        };
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = restMass;
        formatRestMass += restMass;
      }

      // Si le type n'a ni matières sélectionnées ni matières restantes, l'ajouter au reste
      if (selectedPct === 0 && restPct === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
      }
    });

    // Recalcul des pourcentages des types dans chaque format
    if (formatSelectedMass > 0) {
      Object.keys(selectedTypes).forEach(typeKey => {
        selectedTypes[typeKey].pourcentage =
          (typeMassesSelected[typeKey] / formatSelectedMass) * 100;
      });
      targetLot.formats[formatKey].types = selectedTypes;
      targetLot.formats[formatKey].pourcentage = formatSelectedMass;
      selectedMassTotal += formatSelectedMass;
    } else {
      // Aucune fibre sélectionnée dans ce format, le supprimer du target
      delete targetLot.formats[formatKey];
    }

    if (formatRestMass > 0) {
      Object.keys(restTypes).forEach(typeKey => {
        restTypes[typeKey].pourcentage =
          (typeMassesRest[typeKey] / formatRestMass) * 100;
      });
      coProductLot.formats[formatKey].types = restTypes;
      coProductLot.formats[formatKey].pourcentage = formatRestMass;
      restMassTotal += formatRestMass;
    } else if (formatSelectedMass === 0) {
      // Le format n'a ni fibres sélectionnées ni fibres restantes, tout va au reste
      const formatMass = lot.total * (formatObj.pourcentage / 100);
      coProductLot.formats[formatKey].pourcentage = formatMass;
      restMassTotal += formatMass;
    } else {
      // Toutes les fibres sont sélectionnées, supprimer du coproduit
      delete coProductLot.formats[formatKey];
    }
  });

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats pour qu'ils fassent 100%
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Vérification adaptée pour les transformations enchaînées
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      '[selectByFibre] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

function selectByProprete(lot, selectedProprete) {
  // Accepte un tableau ou une valeur unique
  const selectedArray = Array.isArray(selectedProprete)
    ? selectedProprete
    : [selectedProprete];
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));

  // Calculer les masses pour chaque lot
  let targetMass = 0;
  let coProductMass = 0;

  if (lot.proprete) {
    Object.entries(lot.proprete).forEach(([prop, pct]) => {
      const mass = lot.total * (pct.pourcentage / 100);
      // Comparer avec les bubble_id au lieu des noms
      if (selectedArray.includes(pct.bubble_id)) {
        targetMass += mass;
      } else {
        coProductMass += mass;
      }
    });
  }

  // Mettre à jour les totaux
  targetLot.total = targetMass;
  coProductLot.total = coProductMass;

  // Mettre à jour les pourcentages de propreté
  if (targetMass > 0) {
    const targetProprete = {};
    Object.entries(lot.proprete).forEach(([prop, pct]) => {
      // Comparer avec les bubble_id au lieu des noms
      if (selectedArray.includes(pct.bubble_id)) {
        // Préserver toutes les propriétés comme dans selectByFormat
        targetProprete[prop] = JSON.parse(JSON.stringify(pct));
        targetProprete[prop].pourcentage =
          (pct.pourcentage * lot.total) / targetMass;
      }
    });
    targetLot.proprete = targetProprete;
  }

  if (coProductMass > 0) {
    const coProductProprete = {};
    Object.entries(lot.proprete).forEach(([prop, pct]) => {
      // Comparer avec les bubble_id au lieu des noms
      if (!selectedArray.includes(pct.bubble_id)) {
        // Préserver toutes les propriétés comme dans selectByFormat
        coProductProprete[prop] = JSON.parse(JSON.stringify(pct));
        coProductProprete[prop].pourcentage =
          (pct.pourcentage * lot.total) / coProductMass;
      }
    });
    coProductLot.proprete = coProductProprete;
  }

  if (
    Math.abs(
      lot.total - ((targetLot?.total || 0) + (coProductLot?.total || 0))
    ) > 2
  ) {
    console.warn(
      '[selectByProprete] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot?.total || 0,
      'reste =',
      coProductLot?.total || 0,
      'somme =',
      (targetLot?.total || 0) + (coProductLot?.total || 0)
    );
  }

  return { targetLot, coProductLot };
}

// Sélectionne un ou plusieurs perturbateurs dans un lot
function selectByPerturbateur(lot, selectedPerturbateurs) {
  // Deep clone pour ne pas modifier l'objet d'origine
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
    const typesObj = formatObj.types;
    let selectedTypes = {};
    let restTypes = {};
    let typeMassesSelected = {};
    let typeMassesRest = {};
    let formatSelectedMass = 0;
    let formatRestMass = 0;

    Object.entries(typesObj).forEach(([typeKey, typeObj]) => {
      const perturbateursObj = typeObj.perturbateurs || {};
      let selectedPerturbateursObj = {};
      let restPerturbateursObj = {};
      let selectedPct = 0;
      let restPct = 0;

      // Si le type n'a pas de perturbateurs, le traiter comme un type "reste"
      if (Object.keys(perturbateursObj).length === 0) {
        restTypes[typeKey] = JSON.parse(JSON.stringify(typeObj));
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        const typeMass =
          lot.total *
          (formatObj.pourcentage / 100) *
          (typeObj.pourcentage / 100);
        typeMassesRest[typeKey] = typeMass;
        formatRestMass += typeMass;
        return; // Passer au type suivant
      }

      Object.entries(perturbateursObj).forEach(([nom, perturbateur]) => {
        // Comparer avec les bubble_id au lieu des noms
        if (selectedPerturbateurs.includes(perturbateur.bubble_id)) {
          selectedPerturbateursObj[nom] = JSON.parse(
            JSON.stringify(perturbateur)
          );
          if (perturbateur.color)
            selectedPerturbateursObj[nom].color = perturbateur.color;
          selectedPct += perturbateur.pourcentage;
        } else {
          restPerturbateursObj[nom] = JSON.parse(JSON.stringify(perturbateur));
          if (perturbateur.color)
            restPerturbateursObj[nom].color = perturbateur.color;
          restPct += perturbateur.pourcentage;
        }
      });

      const typeMass =
        lot.total * (formatObj.pourcentage / 100) * (typeObj.pourcentage / 100);
      const selectedMass = typeMass * (selectedPct / 100);
      const restMass = typeMass * (restPct / 100);

      // Toujours ajouter le type, même si aucun perturbateur n'est sélectionné
      if (selectedPct > 0) {
        Object.keys(selectedPerturbateursObj).forEach(nom => {
          selectedPerturbateursObj[nom].pourcentage =
            (selectedPerturbateursObj[nom].pourcentage / selectedPct) * 100;
        });
        selectedTypes[typeKey] = {
          ...typeObj,
          perturbateurs: selectedPerturbateursObj,
        };
        if (typeObj.color) selectedTypes[typeKey].color = typeObj.color;
        typeMassesSelected[typeKey] = selectedMass;
        formatSelectedMass += selectedMass;
      }

      if (restPct > 0) {
        Object.keys(restPerturbateursObj).forEach(nom => {
          restPerturbateursObj[nom].pourcentage =
            (restPerturbateursObj[nom].pourcentage / restPct) * 100;
        });
        restTypes[typeKey] = {
          ...typeObj,
          perturbateurs: restPerturbateursObj,
        };
        if (typeObj.color) restTypes[typeKey].color = typeObj.color;
        typeMassesRest[typeKey] = restMass;
        formatRestMass += restMass;
      }
    });

    // Recalcul des pourcentages des types dans chaque format
    if (formatSelectedMass > 0) {
      Object.keys(selectedTypes).forEach(typeKey => {
        selectedTypes[typeKey].pourcentage =
          (typeMassesSelected[typeKey] / formatSelectedMass) * 100;
      });
      targetLot.formats[formatKey].types = selectedTypes;
      targetLot.formats[formatKey].pourcentage = formatSelectedMass;
      selectedMassTotal += formatSelectedMass;
    } else {
      // Aucun perturbateur sélectionné dans ce format, le supprimer du target
      delete targetLot.formats[formatKey];
    }

    if (formatRestMass > 0) {
      Object.keys(restTypes).forEach(typeKey => {
        restTypes[typeKey].pourcentage =
          (typeMassesRest[typeKey] / formatRestMass) * 100;
      });
      coProductLot.formats[formatKey].types = restTypes;
      coProductLot.formats[formatKey].pourcentage = formatRestMass;
      restMassTotal += formatRestMass;
    } else if (formatSelectedMass === 0) {
      // Le format n'a ni perturbateurs sélectionnés ni perturbateurs restants, tout va au reste
      const formatMass = lot.total * (formatObj.pourcentage / 100);
      coProductLot.formats[formatKey].pourcentage = formatMass;
      restMassTotal += formatMass;
    } else {
      // Tous les perturbateurs sont sélectionnés, supprimer du coproduit
      delete coProductLot.formats[formatKey];
    }
  });

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats pour qu'ils fassent 100%
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Vérification adaptée pour les transformations enchaînées
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      '[selectByPerturbateur] Poids incohérent : origine =',
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

// Table de correspondance entre les noms techniques et les noms d'affichage
const transformationTypes = {
  selectByFormat: {
    label: 'Tri par format',
    en_gb: 'Sort by format',
    description:
      'Sélectionne les articles selon leur format (vêtements, chaussures, etc.)',
    description_en_gb:
      'Select items according to their format (clothing, shoes, etc.)',
    keyList: 'formats',
    requiredKey: true,
    step: 'sorting',
  },
  selectByType: {
    label: 'Tri par type',
    en_gb: 'Sort by type',
    description: 'Sélectionne les articles selon leur type (après format)',
    description_en_gb: 'Select items according to their type (after format)',
    keyList: 'types',
    requiredKey: true,
    step: 'sorting',
  },
  selectByMatiere: {
    label: 'Tri par matière',
    en_gb: 'Sort by material',
    description: 'Sélectionne les articles selon leur matière',
    description_en_gb: 'Select items according to their material',
    keyList: 'matieres',
    requiredKey: true,
    step: 'sorting',
  },
  selectByQualite: {
    label: 'Tri par qualité',
    en_gb: 'Sort by quality',
    description: 'Sélectionne les articles selon leur qualité',
    description_en_gb: 'Select items according to their quality',
    keyList: 'qualite',
    requiredKey: true,
    step: 'sorting',
  },
  selectByCouleur: {
    label: 'Tri par couleur',
    en_gb: 'Sort by color',
    description: 'Sélectionne les articles selon leur couleur',
    description_en_gb: 'Select items according to their color',
    keyList: 'couleurs',
    requiredKey: true,
    step: 'sorting',
  },
  selectByFibre: {
    label: 'Tri par fibre',
    en_gb: 'Sort by fiber',
    description: 'Sélectionne les articles selon leur composition en fibres',
    description_en_gb: 'Select items according to their fiber composition',
    keyList: 'fibres',
    requiredKey: true,
    step: 'sorting',
  },
  selectByProprete: {
    label: 'Tri par propreté',
    en_gb: 'Sort by cleanliness',
    description: 'Sélectionne les articles selon leur propreté',
    description_en_gb: 'Select items according to their cleanliness',
    keyList: 'proprete',
    requiredKey: true,
    step: 'sorting',
  },
  selectByPerturbateur: {
    label: 'Tri par nievau de perturbation',
    en_gb: 'Sort by level of perturbation',
    description: 'Sélectionne les articles selon la présence de perturbateurs',
    description_en_gb: 'Select items according to the presence of disruptors',
    keyList: 'perturbateurs',
    requiredKey: true,
    step: 'sorting',
  },
};

// Table de correspondance pour les transformations "translations"
const translationTypes = {
  cleaning: {
    label: 'Nettoyage',
    en_gb: 'Cleaning',
    description: 'Transforme le lot en propre',
    description_en_gb: 'Transform the lot into clean',
    dimension: 'proprete',
    output_id_test: '1751363332290x936743758301757400',
    output_id_live: '1751363332290x936743758301757400',
    step: 'preparation',
  },
  decoloration: {
    label: 'Décoloration',
    en_gb: 'Bleaching',
    description: 'Transforme le lot en blanc',
    description_en_gb: 'Transform the lot into white',
    description_en_gb:
      'Overwrites all color values into a single normalized value',
    dimension: 'couleurs',
    output_id_test: '1751446409161x466100660519829500',
    output_id_live: '1751446409161x466100660519829500',
    step: 'preparation',
  },
};

// Cache pour les transformations dynamiques
let dynamicTransfosCache = new Map();
let dynamicTransfosLoaded = false;
let lastLoadedIsLive = null; // Pour tracker le dernier mode chargé

// Cache global (bubble_id -> color) pour éviter des appels répétés
window.colorById = window.colorById || new Map();

// Cache unifié pour les items mini (bubble_id -> {bubble_id, fr_fr, en_gb, color})
window.itemMiniCache = window.itemMiniCache || new Map();

// Cache pour les items complets (bubble_id -> structure complète avec toutes les dimensions)
window.itemCompleteCache = window.itemCompleteCache || new Map();

// Récupère l'item mini complet (bubble_id, fr_fr, en_gb, color)
async function fetchItemMini(bubbleId) {
  try {
    if (!bubbleId || window.itemMiniCache.has(bubbleId))
      return window.itemMiniCache.get(bubbleId) || null;

    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'item_small',
        params: { id: bubbleId, isLive },
        method: 'GET',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();

    // Stocker dans les deux caches pour compatibilité
    window.itemMiniCache.set(bubbleId, data);
    if (data && data.color) {
      window.colorById.set(bubbleId, data.color);
    }

    return data;
  } catch (e) {
    console.warn('fetchItemMini failed for', bubbleId, e);
    return null;
  }
}

function fetchItemMiniSync(bubbleId) {
  try {
    if (!bubbleId) return null;
    if (window.itemMiniCache.has(bubbleId)) {
      return window.itemMiniCache.get(bubbleId) || null;
    }

    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(
      JSON.stringify({
        endpoint: 'item_small',
        params: { id: bubbleId, isLive },
        method: 'GET',
      })
    );

    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      window.itemMiniCache.set(bubbleId, data);
      if (data && data.color) {
        window.colorById.set(bubbleId, data.color);
      }
      return data;
    }

    console.warn('fetchItemMiniSync failed for', bubbleId, xhr.status);
    return null;
  } catch (error) {
    console.warn('fetchItemMiniSync failed for', bubbleId, error);
    return null;
  }
}

// Récupère l'item complet depuis l'API /item (structure complète avec toutes les dimensions)
async function fetchItemComplete(bubbleId) {
  try {
    if (!bubbleId || window.itemCompleteCache.has(bubbleId))
      return window.itemCompleteCache.get(bubbleId) || null;

    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'item',
        method: 'POST',
        params: { id: bubbleId, isLive },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();

    // Stocker dans le cache
    window.itemCompleteCache.set(bubbleId, data);

    // Aussi mettre à jour le cache des couleurs si disponible
    if (data && data.color) {
      window.colorById.set(bubbleId, data.color);
    }

    return data;
  } catch (e) {
    console.warn('fetchItemComplete failed for', bubbleId, e);
    return null;
  }
}

function fetchItemCompleteSync(bubbleId) {
  try {
    if (!bubbleId) return null;
    if (window.itemCompleteCache.has(bubbleId)) {
      return window.itemCompleteCache.get(bubbleId) || null;
    }

    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(
      JSON.stringify({
        endpoint: 'item',
        method: 'POST',
        params: { id: bubbleId, isLive },
      })
    );

    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      window.itemCompleteCache.set(bubbleId, data);
      if (data && data.color) {
        window.colorById.set(bubbleId, data.color);
      }
      return data;
    }

    console.warn('fetchItemCompleteSync failed for', bubbleId, xhr.status);
    return null;
  } catch (error) {
    console.warn('fetchItemCompleteSync failed for', bubbleId, error);
    return null;
  }
}

// Wrapper pour compatibilité - récupère seulement la couleur
async function fetchItemColor(bubbleId) {
  const itemMini = await fetchItemMini(bubbleId);
  return itemMini?.color || null;
}

// Charge en masse les couleurs d'une dimension (formats, types, ...)
async function ensureDimensionColorsLoaded(dimension) {
  try {
    if (!dimension) return;
    const endpointMap = {
      qualite: 'qualites',
      proprete: 'propretes',
    };
    const endpoint = endpointMap[dimension] || dimension;
    // Si on a déjà des couleurs pour cette dimension, on garde; on complète seulement
    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: { isLive }, method: 'GET' }),
    });
    if (!response.ok) return;
    const data = await response.json();
    Object.values(data || {}).forEach(item => {
      if (item && item.bubble_id) {
        // Stocker l'item mini complet
        const itemMini = {
          bubble_id: item.bubble_id,
          fr_fr: item.fr_fr || null,
          en_gb: item.en_gb || null,
          color: item.color || null,
        };
        window.itemMiniCache.set(item.bubble_id, itemMini);

        // Garder colorById pour compatibilité
        if (item.color && !window.colorById.has(item.bubble_id)) {
          window.colorById.set(item.bubble_id, item.color);
        }
      }
    });
  } catch (e) {
    console.warn('ensureDimensionColorsLoaded failed for', dimension, e);
  }
}

function ensureDimensionColorsLoadedSync(dimension) {
  try {
    if (!dimension) return;
    const endpointMap = {
      qualite: 'qualites',
      proprete: 'propretes',
    };
    const endpoint = endpointMap[dimension] || dimension;
    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ endpoint, params: { isLive }, method: 'GET' }));

    if (xhr.status !== 200) {
      console.warn(
        'ensureDimensionColorsLoadedSync failed for',
        dimension,
        xhr.status
      );
      return;
    }

    const data = JSON.parse(xhr.responseText) || {};
    Object.values(data).forEach(item => {
      if (item && item.bubble_id) {
        const itemMini = {
          bubble_id: item.bubble_id,
          fr_fr: item.fr_fr || null,
          en_gb: item.en_gb || null,
          color: item.color || null,
        };
        window.itemMiniCache.set(item.bubble_id, itemMini);
        if (item.color) {
          window.colorById.set(item.bubble_id, item.color);
        }
      }
    });
  } catch (error) {
    console.warn(
      'ensureDimensionColorsLoadedSync failed for',
      dimension,
      error
    );
  }
}

// Précharge les couleurs nécessaires pour une transfo dynamique (targets + coproducts), sans hardcoder les dimensions
async function preloadColorsForTransfo(details) {
  if (!details || !details.dimensions) return;
  const needed = new Map(); // dimension -> Set(ids)
  Object.entries(details.dimensions).forEach(([dimName, dimCfg]) => {
    if (!dimCfg) return;
    // target (une seule clé)
    const targetVal = dimCfg.target ? Object.values(dimCfg.target)[0] : null;
    if (targetVal && targetVal.bubble_id) {
      if (!needed.has(dimName)) needed.set(dimName, new Set());
      needed.get(dimName).add(targetVal.bubble_id);
    }
    // coproduct (plusieurs clés possibles)
    if (dimCfg.coproduct) {
      Object.values(dimCfg.coproduct).forEach(c => {
        if (c && c.bubble_id) {
          if (!needed.has(dimName)) needed.set(dimName, new Set());
          needed.get(dimName).add(c.bubble_id);
        }
      });
    }
  });
  const pending = [];
  for (const [dimName, ids] of needed.entries()) {
    // Charger la liste de la dimension pour remplir massivement les couleurs
    await ensureDimensionColorsLoaded(dimName);
    ids.forEach(id => {
      if (!window.colorById.has(id)) pending.push(fetchItemColor(id));
    });
  }
  if (pending.length > 0) await Promise.allSettled(pending);
}

// Fonction pour charger les transformations dynamiques depuis l'API Bubble
async function loadDynamicTransformations() {
  try {
    const params = getUrlParams();
    const isLive = params.isLive;

    // Vérifier si le mode isLive a changé
    if (lastLoadedIsLive !== null && lastLoadedIsLive !== isLive) {
      console.log(
        'Mode isLive changé, réinitialisation du cache des transformations dynamiques'
      );
      dynamicTransfosCache.clear();
      dynamicTransfosLoaded = false;
    }

    // Si déjà chargé pour ce mode, ne pas recharger
    if (dynamicTransfosLoaded && lastLoadedIsLive === isLive) {
      return Array.from(dynamicTransfosCache.values());
    }

    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'transfos',
        params: { isLive },
        method: 'GET',
      }),
    });

    if (!response.ok) {
      console.warn(
        'Impossible de charger les transformations dynamiques:',
        response.status
      );
      return [];
    }

    const data = await response.json();
    console.log('Liste des transformations dynamiques chargée:', data);

    // Vider le cache
    dynamicTransfosCache.clear();

    // Mettre en cache SEULEMENT la liste (sans détails)
    Object.entries(data).forEach(([title, transfo]) => {
      const titleEn =
        transfo.en_gb ||
        transfo.title_en ||
        (transfo.translations && transfo.translations.en_gb) ||
        title;

      dynamicTransfosCache.set(transfo.bubble_id, {
        ...transfo,
        title,
        en_gb: titleEn,
      });
    });

    dynamicTransfosLoaded = true;
    lastLoadedIsLive = isLive; // Mémoriser le mode chargé
    return Array.from(dynamicTransfosCache.values());
  } catch (error) {
    console.warn(
      'Erreur lors du chargement des transformations dynamiques:',
      error
    );
    return [];
  }
}

// Fonction pour obtenir une transformation dynamique par son ID
function getDynamicTransfo(bubbleId) {
  return dynamicTransfosCache.get(bubbleId);
}

// Exporter les fonctions globalement
window.preloadColorsForTransfo = preloadColorsForTransfo;
window.fetchItemColor = fetchItemColor;
window.fetchItemMini = fetchItemMini;
window.fetchItemComplete = fetchItemComplete;

// ← NOUVELLE FONCTION : Obtenir les détails complets d'une transformation
async function getDetailedTransfo(bubbleId, isLive) {
  // ✅ Vérifier le cache d'abord avec clé composite
  const cacheKey = `${bubbleId}_${isLive}`;
  if (dynamicTransfosCache.has(cacheKey)) {
    console.log(`Cache hit pour ${bubbleId} (${isLive ? 'live' : 'dev'})`);
    return dynamicTransfosCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'transfo',
        params: { id: bubbleId, isLive },
        method: 'POST',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Détails complets pour ${bubbleId}:`, data);

    // ✅ Mettre en cache immédiatement avec clé composite
    dynamicTransfosCache.set(cacheKey, data);

    return data;
  } catch (error) {
    console.error(
      `Erreur lors du chargement des détails pour ${bubbleId}:`,
      error
    );
    return null;
  }
}

const transformationUtils = {
  getTransformationLabel(type) {
    // Récupérer la langue depuis les paramètres URL
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Vérifier d'abord les transformations statiques
    if (transformationTypes[type]) {
      // Retourner le label en fonction de la langue
      if (lang === 'en_gb' && transformationTypes[type].en_gb) {
        return transformationTypes[type].en_gb;
      }
      return transformationTypes[type].label;
    }

    // Vérifier les translations
    if (type.startsWith('translation_')) {
      const translationKey = type.replace('translation_', '');
      const translation = translationTypes[translationKey];
      if (translation) {
        if (lang === 'en_gb' && translation.en_gb) {
          return translation.en_gb;
        }
        return translation.label;
      }
    }

    // Vérifier les transformations dynamiques
    if (type.startsWith('dynamic_transfo_')) {
      const bubbleId = type.replace('dynamic_transfo_', '');
      const transfo = getDynamicTransfo(bubbleId);
      return transfo ? transfo.title : type;
    }

    return type;
  },

  getTransformationDescription(type) {
    // Récupérer la langue depuis les paramètres URL
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Vérifier d'abord les transformations statiques
    if (transformationTypes[type]) {
      // Retourner la description en fonction de la langue
      if (lang === 'en_gb' && transformationTypes[type].description_en_gb) {
        return transformationTypes[type].description_en_gb;
      }
      return transformationTypes[type].description;
    }

    // Vérifier les translations
    if (type.startsWith('translation_')) {
      const translationKey = type.replace('translation_', '');
      const translation = translationTypes[translationKey];
      if (translation) {
        if (lang === 'en_gb' && translation.description_en_gb) {
          return translation.description_en_gb;
        }
        return translation.description || '';
      }
    }

    // Vérifier les transformations dynamiques
    if (type.startsWith('dynamic_transfo_')) {
      const bubbleId = type.replace('dynamic_transfo_', '');
      const transfo = getDynamicTransfo(bubbleId);
      return transfo ? `Transformation dynamique: ${transfo.step}` : '';
    }

    return '';
  },

  async getAvailableTransformations() {
    // Transformations statiques (selectBy)
    const staticTransformations = Object.entries(transformationTypes).map(
      ([value, info]) => ({
        value,
        label: info.label,
        en_gb: info.en_gb,
        description: info.description,
        isStatic: true,
      })
    );

    // Transformations translations
    const translationTransformations = Object.entries(translationTypes).map(
      ([key, info]) => ({
        value: `translation_${key}`,
        label: info.label,
        en_gb: info.en_gb,
        description: info.description,
        description_en_gb: info.description_en_gb,
        isTranslation: true,
        dimension: info.dimension,
        step: info.step,
      })
    );

    // Charger la LISTE des transformations dynamiques (sans détails)
    const params = getUrlParams();
    const currentIsLive = params.isLive;

    if (!dynamicTransfosLoaded || lastLoadedIsLive !== currentIsLive) {
      await loadDynamicTransformations();
    }

    // Transformations dynamiques - dédupliquer par bubble_id
    const seenBubbleIds = new Set();
    const dynamicTransformations = Array.from(dynamicTransfosCache.values())
      .filter(transfo => {
        if (seenBubbleIds.has(transfo.bubble_id)) {
          return false; // Déjà vu, ignorer
        }
        seenBubbleIds.add(transfo.bubble_id);
        return true;
      })
      .map(transfo => ({
        value: `dynamic_transfo_${transfo.bubble_id}`,
        label: transfo.title,
        en_gb: transfo.en_gb || transfo.title,
        description: `Transformation dynamique: ${transfo.step}`,
        isDynamic: true,
        bubbleId: transfo.bubble_id,
        version: transfo.version,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // Tri alphabétique par titre

    if (
      !window.i18nextReady ||
      !window.i18next ||
      typeof window.i18next.t !== 'function'
    ) {
      console.warn(
        "[processes] i18next n'est pas initialisé pour le séparateur des transformations dynamiques"
      );
      return [
        ...staticTransformations,
        ...translationTransformations,
        ...dynamicTransformations,
      ];
    }

    // Retourner avec séparateur
    return [
      ...staticTransformations,
      ...translationTransformations,
      {
        value: 'separator',
        label: window.i18next.t('dynamicTransformationsSeparator'),
        isSeparator: true,
      },
      ...dynamicTransformations,
    ];
  },

  // Fonction pour obtenir les détails d'une transformation dynamique
  async getDynamicTransfoDetails(bubbleId) {
    const params = getUrlParams();
    const isLive = params.isLive;
    const cacheKey = `${bubbleId}_${isLive}`;

    if (dynamicTransfosCache.has(cacheKey)) {
      return dynamicTransfosCache.get(cacheKey);
    }

    try {
      const params = getUrlParams();
      const isLive = params.isLive;

      const response = await fetch('/api/bubble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: 'transfo',
          params: { id: bubbleId, isLive },
          method: 'POST',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();

      // Mettre à jour le cache avec clé composite
      dynamicTransfosCache.set(cacheKey, data);

      return data;
    } catch (error) {
      console.error(i18next.t('errorLoadingTransformationDetails'), error);
      return null;
    }
  },

  // Fonction synchrone pour obtenir les détails (charge à la demande si pas en cache)
  getDynamicTransfoDetailsSync(bubbleId) {
    const params = getUrlParams();
    const isLive = params.isLive;
    const cacheKey = `${bubbleId}_${isLive}`;

    // Si déjà en cache, retourner
    if (dynamicTransfosCache.has(cacheKey)) {
      return dynamicTransfosCache.get(cacheKey);
    }

    // Si pas en cache, charger MAINTENANT de manière synchrone
    console.log('Chargement synchrone des détails pour:', bubbleId);

    try {
      // Utiliser XMLHttpRequest pour un appel synchrone
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/bubble', false); // false = synchrone
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.send(
        JSON.stringify({
          endpoint: 'transfo',
          params: { id: bubbleId, isLive },
          method: 'POST',
        })
      );

      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        dynamicTransfosCache.set(cacheKey, data);
        console.log('Détails chargés et mis en cache pour:', bubbleId);
        return data;
      } else {
        console.error('Erreur lors du chargement synchrone:', xhr.status);
        return null;
      }
    } catch (error) {
      console.error('Erreur lors du chargement synchrone des détails:', error);
      return null;
    }
  },
};

// Fonction pour exécuter les transformations dynamiques
function executeDynamicTransfo(lot, transfoDetails) {
  console.log('executeDynamicTransfo appelée avec:', { lot, transfoDetails });

  // Utiliser le nouveau moteur de transformation simplifié
  if (!window.simpleDynamicTransformationEngine) {
    window.simpleDynamicTransformationEngine =
      new SimpleDynamicTransformationEngine();
  }

  return window.simpleDynamicTransformationEngine.executeTransformation(
    lot,
    transfoDetails
  );
}

// Fonction pour exécuter les transformations "translations"
function executeTranslation(lot, translationConfig) {
  console.log('executeTranslation appelée avec:', { lot, translationConfig });

  // 1. Récupération de la configuration
  const { dimension, output_id_test, output_id_live } = translationConfig;
  const params = getUrlParams();
  const isLive = params.isLive;
  const outputId = isLive ? output_id_live : output_id_test;

  if (
    !outputId ||
    outputId === 'PLACEHOLDER_TEST_ID' ||
    outputId === 'PLACEHOLDER_LIVE_ID'
  ) {
    console.error('executeTranslation: output_id non défini ou placeholder');
    return {
      targetLot: JSON.parse(JSON.stringify(lot)),
      coProductLot: null,
    };
  }

  // 2. Appel API synchrone
  const itemData = fetchItemMiniSync(outputId);
  if (!itemData || !itemData.fr_fr) {
    console.error(
      "executeTranslation: impossible de récupérer les données de l'item",
      outputId
    );
    return {
      targetLot: JSON.parse(JSON.stringify(lot)),
      coProductLot: null,
    };
  }

  const { bubble_id, fr_fr, en_gb, color } = itemData;

  // Deep clone du lot
  const processedLot = JSON.parse(JSON.stringify(lot));

  // 3. Vérifier si la dimension existe (au niveau racine ou dans les sous-structures)
  const dimensionHierarchy = window.DIMENSION_HIERARCHY || {};
  const dimensionConfig = dimensionHierarchy[dimension];
  const hasParent = dimensionConfig && dimensionConfig.parent;

  // Si la dimension a un parent, elle n'existe pas au niveau racine
  // Sinon, vérifier qu'elle existe au niveau racine
  if (!hasParent) {
    if (
      !processedLot[dimension] ||
      typeof processedLot[dimension] !== 'object'
    ) {
      console.warn(
        `executeTranslation: dimension ${dimension} absente ou invalide au niveau racine`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }
  } else {
    // Pour les dimensions imbriquées, vérifier qu'elles existent quelque part dans le lot
    let found = false;
    const checkDimensionExists = obj => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      if (obj[dimension] && typeof obj[dimension] === 'object') {
        found = true;
        return;
      }
      Object.values(obj).forEach(value => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkDimensionExists(value);
        }
      });
    };
    checkDimensionExists(processedLot);
    if (!found) {
      console.warn(
        `executeTranslation: dimension ${dimension} absente dans le lot`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }
  }

  // 4. Gestion des sous-dimensions
  const childDimensions = dimensionConfig ? dimensionConfig.children || [] : [];
  const aggregatedChildren = {};

  // Si la dimension a des enfants, agréger les sous-dimensions
  if (childDimensions.length > 0) {
    // Collecter toutes les occurrences de la dimension dans le lot
    const allDimensionOccurrences = [];

    // Si la dimension existe au niveau racine (pas de parent), l'utiliser directement
    if (
      !hasParent &&
      processedLot[dimension] &&
      typeof processedLot[dimension] === 'object'
    ) {
      allDimensionOccurrences.push({ data: processedLot[dimension], path: [] });
    }

    // Pour les dimensions imbriquées (avec parent), chercher récursivement
    // Pour les dimensions de niveau racine avec enfants, on a déjà ajouté au-dessus
    // mais on peut aussi chercher récursivement pour être sûr (même si normalement elles n'existent qu'au niveau racine)
    const collectDimensionOccurrences = (obj, path = [], skipRoot = false) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

      // Si on est au niveau racine et qu'on a déjà ajouté cette dimension, ne pas la rajouter
      if (skipRoot && path.length === 0 && obj[dimension]) {
        // Déjà ajouté, continuer récursivement
      } else if (obj[dimension] && typeof obj[dimension] === 'object') {
        // Vérifier qu'on ne l'a pas déjà ajouté (pour éviter les doublons)
        const alreadyAdded = allDimensionOccurrences.some(
          occ =>
            occ.data === obj[dimension] ||
            (path.length === 0 && occ.path.length === 0)
        );
        if (!alreadyAdded) {
          allDimensionOccurrences.push({ data: obj[dimension], path });
        }
      }

      Object.keys(obj).forEach(key => {
        if (key !== dimension) {
          const value = obj[key];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            collectDimensionOccurrences(value, [...path, key], skipRoot);
          }
        }
      });
    };

    // Collecter récursivement (skipRoot = true si on a déjà ajouté au niveau racine)
    collectDimensionOccurrences(
      processedLot,
      [],
      !hasParent && processedLot[dimension]
    );

    if (allDimensionOccurrences.length === 0) {
      console.warn(
        `executeTranslation: aucune occurrence de ${dimension} trouvée`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }

    // Pour chaque sous-dimension
    childDimensions.forEach(childDim => {
      const aggregated = {};

      // Parcourir toutes les occurrences de la dimension
      allDimensionOccurrences.forEach(({ data: dimensionData }) => {
        const allKeys = Object.keys(dimensionData);

        allKeys.forEach(key => {
          const parentValue = dimensionData[key];
          if (!parentValue || typeof parentValue !== 'object') return;

          const childData = parentValue[childDim];
          if (!childData || typeof childData !== 'object') return;

          const parentWeight = Math.max(
            Number(parentValue.pourcentage) || 0,
            0
          );

          // Agréger les valeurs de la sous-dimension en pondérant par le pourcentage du parent
          Object.entries(childData).forEach(([childKey, childValue]) => {
            if (!childValue || typeof childValue !== 'object') return;

            const childWeight =
              (Number(childValue.pourcentage) || 0) * (parentWeight / 100);

            if (!aggregated[childKey]) {
              aggregated[childKey] = {
                ...childValue,
                pourcentage: 0,
              };
            }
            aggregated[childKey].pourcentage += childWeight;

            // Préserver les propriétés importantes
            if (childValue.bubble_id)
              aggregated[childKey].bubble_id = childValue.bubble_id;
            if (childValue.color) aggregated[childKey].color = childValue.color;
            if (childValue.en_gb) aggregated[childKey].en_gb = childValue.en_gb;

            // Appliquer la couleur officielle depuis window.colorById si disponible
            if (
              window.colorById &&
              childValue.bubble_id &&
              window.colorById.has(childValue.bubble_id)
            ) {
              aggregated[childKey].color = window.colorById.get(
                childValue.bubble_id
              );
            }

            // Gérer les sous-dimensions récursives (ex: fibres sous matieres)
            const childDimConfig = dimensionHierarchy[childDim];
            const grandChildDims = childDimConfig
              ? childDimConfig.children || []
              : [];
            grandChildDims.forEach(grandChildDim => {
              if (childValue[grandChildDim]) {
                if (!aggregated[childKey][grandChildDim]) {
                  aggregated[childKey][grandChildDim] = {};
                }
                Object.entries(childValue[grandChildDim]).forEach(
                  ([gcKey, gcValue]) => {
                    if (!gcValue || typeof gcValue !== 'object') return;
                    const gcWeight =
                      (Number(gcValue.pourcentage) || 0) * (childWeight / 100);
                    if (!aggregated[childKey][grandChildDim][gcKey]) {
                      aggregated[childKey][grandChildDim][gcKey] = {
                        ...gcValue,
                        pourcentage: 0,
                      };
                    }
                    aggregated[childKey][grandChildDim][gcKey].pourcentage +=
                      gcWeight;
                  }
                );
              }
            });
          });
        });
      });

      // Normaliser la sous-dimension à 100%
      const normalize = obj => {
        const sum = Object.values(obj).reduce(
          (acc, v) => acc + (Number(v.pourcentage) || 0),
          0
        );
        if (sum > 0) {
          Object.values(obj).forEach(v => {
            v.pourcentage = (Number(v.pourcentage) || 0) * (100 / sum);
          });
        }
      };

      normalize(aggregated);

      // Normaliser les sous-dimensions récursives
      Object.values(aggregated).forEach(item => {
        if (item && typeof item === 'object') {
          childDimensions.forEach(childDim => {
            const childDimConfig = dimensionHierarchy[childDim];
            const grandChildDims = childDimConfig
              ? childDimConfig.children || []
              : [];
            grandChildDims.forEach(grandChildDim => {
              if (item[grandChildDim]) {
                normalize(item[grandChildDim]);
              }
            });
          });
        }
      });

      aggregatedChildren[childDim] = aggregated;
    });
  }

  // 5. Écrasement de la dimension
  const newDimensionValue = {
    bubble_id,
    color:
      color ||
      (window.colorById && window.colorById.has(bubble_id)
        ? window.colorById.get(bubble_id)
        : undefined),
    en_gb: en_gb || '',
    pourcentage: 100,
  };

  // Ajouter les sous-dimensions agrégées
  Object.keys(aggregatedChildren).forEach(childDim => {
    newDimensionValue[childDim] = aggregatedChildren[childDim];
  });

  // Fonction récursive pour écraser la dimension partout où elle apparaît
  const overwriteDimensionRecursive = (
    obj,
    targetDimension,
    newValue,
    newKey
  ) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

    // Si cette dimension existe à ce niveau, l'écraser
    if (obj[targetDimension] && typeof obj[targetDimension] === 'object') {
      obj[targetDimension] = {
        [newKey]: newValue,
      };
    }

    // Parcourir récursivement toutes les propriétés
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Ne pas parcourir la dimension qu'on vient d'écraser
        if (key !== targetDimension) {
          overwriteDimensionRecursive(value, targetDimension, newValue, newKey);
        }
      }
    });
  };

  // 5. Écrasement de la dimension
  // Si la dimension n'a pas de parent, l'écraser au niveau racine
  if (!hasParent) {
    processedLot[dimension] = {
      [fr_fr]: newDimensionValue,
    };
  }

  // Écraser récursivement la dimension dans toutes les sous-structures
  // (toujours faire ça pour s'assurer qu'on écrase toutes les occurrences)
  overwriteDimensionRecursive(
    processedLot,
    dimension,
    newDimensionValue,
    fr_fr
  );

  console.log(`executeTranslation: dimension ${dimension} écrasée avec:`, {
    key: fr_fr,
    value: newDimensionValue,
    result: processedLot[dimension],
  });

  // 6. Normalisation récursive (seulement pour les sous-dimensions agrégées, pas pour la dimension principale)
  // La dimension principale a déjà pourcentage: 100 et une seule clé, donc pas besoin de normaliser
  // Mais on doit normaliser les sous-dimensions agrégées si elles existent
  if (
    Object.keys(aggregatedChildren).length > 0 &&
    processedLot[dimension] &&
    processedLot[dimension][fr_fr]
  ) {
    const mainValue = processedLot[dimension][fr_fr];
    // Normaliser chaque sous-dimension agrégée
    Object.keys(aggregatedChildren).forEach(childDim => {
      if (mainValue[childDim] && typeof mainValue[childDim] === 'object') {
        if (window.genericTransformationEngine) {
          window.genericTransformationEngine.normalizeDimensionPercentages(
            mainValue[childDim]
          );
        } else {
          // Fallback de normalisation
          const normalize = dimData => {
            if (!dimData || typeof dimData !== 'object') return;
            const total = Object.values(dimData).reduce((sum, v) => {
              return (
                sum +
                (v && typeof v === 'object' && v.pourcentage !== undefined
                  ? v.pourcentage
                  : 0)
              );
            }, 0);
            if (total > 0) {
              Object.values(dimData).forEach(v => {
                if (v && typeof v === 'object' && v.pourcentage !== undefined) {
                  v.pourcentage = (v.pourcentage / total) * 100;
                }
              });
            }
          };
          normalize(mainValue[childDim]);
        }
      }
    });
  }

  // 7. Préservation des autres dimensions (déjà fait avec le deep clone)
  // Le lot est déjà une copie complète, donc toutes les autres dimensions sont préservées

  // 8. Retour
  return {
    targetLot: processedLot,
    coProductLot: null,
  };
}

window.processes = {
  selectByFormat,
  selectByType,
  selectByMatiere,
  selectByQualite,
  selectByCouleur,
  selectByFibre,
  selectByProprete,
  selectByPerturbateur,
  executeDynamicTransfo,
  executeTranslation,
};

window.transformationUtils = transformationUtils;
window.transformationTypes = transformationTypes;
window.translationTypes = translationTypes;

window.fetchItemMiniSync = fetchItemMiniSync;
window.fetchItemCompleteSync = fetchItemCompleteSync;
window.ensureDimensionColorsLoadedSync = ensureDimensionColorsLoadedSync;

// ← NOUVEAU : Exposer le cache globalement pour le debug
window.dynamicTransfosCache = dynamicTransfosCache;
window.dynamicTransfosLoaded = dynamicTransfosLoaded;

const mergeLots = window.mergeLots;
if (typeof mergeLots !== 'function') {
  console.error(
    '[processes] mergeLots non disponible. Assurez-vous que merge-lots.js est chargé.'
  );
}

// Nouveau moteur de transformation simplifié pour les transformations dynamiques
class SimpleDynamicTransformationEngine {
  constructor() {
    // Import de la Bible des dimensions depuis config/dimensions.js
    this.dimensionHierarchy = window.DIMENSION_HIERARCHY;
    this.processingOrder = window.DIMENSION_PROCESSING_ORDER;

    if (!this.processingOrder) {
      console.error(
        'DIMENSION_PROCESSING_ORDER non trouvé ! Vérifiez que config/dimensions.js est chargé'
      );
      // Fallback si le fichier n'est pas chargé
      this.processingOrder = [
        'formats',
        'types',
        'matieres',
        'fibres',
        'couleurs',
        'perturbateurs',
        'proprete',
        'qualite',
      ];
    }
  }

  // Méthode principale qui orchestre la transformation
  executeTransformation(lot, transfoDetails) {
    // Vérifications de base
    if (!transfoDetails || !transfoDetails.select) {
      throw new Error('Configuration de transformation invalide');
    }

    // 1. Extraire les bubble_id des types à sélectionner
    const selectedTypeIds = Object.values(transfoDetails.select)
      .map(item => item.bubble_id)
      .filter(Boolean);

    if (selectedTypeIds.length === 0) {
      return {
        targetLot: {
          total: 0,
          title: transfoDetails.title || 'Transformation dynamique',
        },
        coProductLot: JSON.parse(JSON.stringify(lot)),
      };
    }

    // 2. Filtrer le lot avec selectByType
    const { targetLot: filteredLot, coProductLot: nonMatchingLot } =
      selectByType(lot, selectedTypeIds);

    // 3. Normaliser les distributions du reste (non-matching)
    if (nonMatchingLot && nonMatchingLot.total > 0) {
      this.normalizeAllDistributions(nonMatchingLot);
    }

    // Si aucun élément ne matche, retourner directement
    if (!filteredLot || filteredLot.total === 0) {
      return {
        targetLot: {
          total: 0,
          title: transfoDetails.title || 'Transformation dynamique',
        },
        coProductLot: nonMatchingLot || JSON.parse(JSON.stringify(lot)),
      };
    }

    // 4. Charger les items complets pour target, loss, coproduct (avec cache)
    // La structure est { "nom français": { bubble_id, en_gb } }
    const getItemDataFromStructure = itemObj => {
      if (!itemObj) return { bubbleId: null, itemData: null, formatName: null };
      // La structure est { "nom français": { bubble_id, en_gb } }
      const firstKey = Object.keys(itemObj)[0];
      if (firstKey && itemObj[firstKey]?.bubble_id) {
        return {
          bubbleId: itemObj[firstKey].bubble_id,
          itemData: itemObj[firstKey],
          formatName: firstKey, // Le nom français est la clé
        };
      }
      return { bubbleId: null, itemData: null, formatName: null };
    };

    const targetItemInfo = getItemDataFromStructure(transfoDetails.target);
    const lossItemInfo = getItemDataFromStructure(transfoDetails.loss);
    const coproductItemInfo = getItemDataFromStructure(
      transfoDetails.coproduct
    );

    const targetItemBubbleId = targetItemInfo.bubbleId;
    const lossItemBubbleId = lossItemInfo.bubbleId;
    const coproductItemBubbleId = coproductItemInfo.bubbleId;

    if (!targetItemBubbleId) {
      throw new Error(
        `Item target introuvable: bubble_id manquant dans transfoDetails.target`
      );
    }

    const targetItem = targetItemBubbleId
      ? fetchItemCompleteSync(targetItemBubbleId)
      : null;
    const lossItem =
      lossItemBubbleId && transfoDetails.loss_percent > 0
        ? fetchItemCompleteSync(lossItemBubbleId)
        : null;
    const coproductItem = coproductItemBubbleId
      ? fetchItemCompleteSync(coproductItemBubbleId)
      : null;

    if (!targetItem) {
      throw new Error(`Item target introuvable: ${targetItemBubbleId}`);
    }

    // 5. Calculer les volumes
    const inputMass = filteredLot.total;
    const {
      lossMass,
      transformableMass,
      targetMass,
      coproductFromTransformable,
    } = this.calculateVolumes(
      inputMass,
      transfoDetails.loss_percent || 0,
      transfoDetails.yield || 100
    );

    // 6. Créer targetLot avec écrasement du format et application des distributions filles
    const targetLot = this.createTargetLot(
      filteredLot,
      targetItem,
      targetMass,
      transfoDetails,
      targetItemInfo
    );

    // 7. Créer lossLot si nécessaire
    let lossLot = null;
    if (lossMass > 0 && lossItem) {
      lossLot = this.createLossLot(
        lossItem,
        lossMass,
        transfoDetails,
        lossItemInfo
      );
    }

    // 8. Créer coproductFromTransformableLot si nécessaire
    let coproductFromTransformableLot = null;
    if (coproductFromTransformable > 0 && coproductItem) {
      coproductFromTransformableLot = this.createCoproductLot(
        filteredLot,
        coproductItem,
        coproductFromTransformable,
        transfoDetails,
        coproductItemInfo
      );
    }

    // 9. Fusionner les lots pour le coproductLot final
    const lotsToMerge = [];
    if (nonMatchingLot && nonMatchingLot.total > 0) {
      lotsToMerge.push(nonMatchingLot);
    }
    if (lossLot && lossLot.total > 0) {
      lotsToMerge.push(lossLot);
    }
    if (
      coproductFromTransformableLot &&
      coproductFromTransformableLot.total > 0
    ) {
      lotsToMerge.push(coproductFromTransformableLot);
    }

    let coProductLot = null;
    if (lotsToMerge.length > 0) {
      coProductLot = lotsToMerge[0];
      for (let i = 1; i < lotsToMerge.length; i++) {
        coProductLot = mergeLots([coProductLot, lotsToMerge[i]]);
      }
    }

    return { targetLot, coProductLot };
  }

  // Calculer les volumes
  calculateVolumes(inputMass, lossPercent, yieldPercent) {
    const lossMass = (inputMass * lossPercent) / 100;
    const transformableMass = inputMass - lossMass;
    const targetMass = (transformableMass * yieldPercent) / 100;
    const coproductFromTransformable = transformableMass - targetMass;

    return {
      lossMass,
      transformableMass,
      targetMass,
      coproductFromTransformable,
    };
  }

  // Créer le targetLot
  createTargetLot(
    sourceLot,
    targetItem,
    targetMass,
    transfoDetails,
    targetItemInfo
  ) {
    const targetLot = {
      total: targetMass,
      title: transfoDetails.title || 'Transformation dynamique',
    };

    // 1. Prendre le format récupéré par API en entier et le copier
    targetLot.formats = {};
    const targetFormatName =
      targetItemInfo.formatName ||
      (targetItem ? Object.keys(targetItem)[0] : 'Format inconnu');

    const targetBubbleId = targetItemInfo.bubbleId;

    // Dans l'item complet, les formats sont directement les clés de l'objet
    // Utiliser EXACTEMENT le même pattern que createLossLot
    // Mais avec un fallback si le nom ne correspond pas (prendre la première clé)
    let targetFormatData = {};
    if (targetItem) {
      if (targetItem[targetFormatName]) {
        targetFormatData = targetItem[targetFormatName];
      } else if (Object.keys(targetItem).length > 0) {
        // Fallback : prendre le premier format si le nom ne correspond pas
        const firstKey = Object.keys(targetItem)[0];
        targetFormatData = targetItem[firstKey];
      }
    }

    // Copier complètement le format de l'item complet (avec toutes ses distributions et color)
    // Utiliser le spread comme dans createLossLot pour préserver la color
    targetLot.formats[targetFormatName] = {
      ...targetFormatData,
      bubble_id: targetBubbleId,
      pourcentage: 100,
    };

    // Ajouter en_gb si disponible dans targetItemInfo.itemData
    if (targetItemInfo.itemData?.en_gb) {
      targetLot.formats[targetFormatName].en_gb = targetItemInfo.itemData.en_gb;
    }

    // Appliquer la color depuis le format de l'item complet (EXACTEMENT comme dans createLossLot)
    if (targetFormatData.color) {
      targetLot.formats[targetFormatName].color = targetFormatData.color;
    } else if (
      window.colorById &&
      targetBubbleId &&
      window.colorById.has(targetBubbleId)
    ) {
      targetLot.formats[targetFormatName].color =
        window.colorById.get(targetBubbleId);
    }

    // Ajouter en_gb si disponible dans targetItemInfo.itemData
    if (targetItemInfo.itemData?.en_gb) {
      targetLot.formats[targetFormatName].en_gb = targetItemInfo.itemData.en_gb;
    }

    // 2. Ajouter les qualités et propretés du lot d'entrée
    if (sourceLot.proprete) {
      targetLot.proprete = JSON.parse(JSON.stringify(sourceLot.proprete));
    }
    if (sourceLot.qualite) {
      targetLot.qualite = JSON.parse(JSON.stringify(sourceLot.qualite));
    }

    // 3. Descendre dans le format pour voir s'il a des distributions
    // Si il en a, les garder (déjà copiées)
    // S'il en a pas, appliquer celles du lot d'entrée (agrégées)
    const targetFormat = targetLot.formats[targetFormatName];

    // Pour chaque dimension enfant de formats
    this.processingOrder.forEach(dimension => {
      const dimensionConfig = this.dimensionHierarchy[dimension];
      if (!dimensionConfig || dimensionConfig.parent !== 'formats') return;

      // Si le format de référence n'a pas cette dimension, prendre celle du lot d'entrée
      if (!targetFormat[dimension] && sourceLot && sourceLot.formats) {
        const aggregated = this.aggregateDimensionFromFormats(
          sourceLot,
          dimension
        );
        if (aggregated && Object.keys(aggregated).length > 0) {
          targetFormat[dimension] = aggregated;
        }
      }
    });

    // Normaliser toutes les distributions
    this.normalizeAllDistributions(targetLot);

    // Réappliquer la color APRÈS normalisation pour être sûr qu'elle ne soit pas écrasée
    if (targetFormatData.color) {
      targetLot.formats[targetFormatName].color = targetFormatData.color;
    } else if (
      window.colorById &&
      targetBubbleId &&
      window.colorById.has(targetBubbleId)
    ) {
      targetLot.formats[targetFormatName].color =
        window.colorById.get(targetBubbleId);
    }

    return targetLot;
  }

  // Créer le lossLot
  createLossLot(lossItem, lossMass, transfoDetails, lossItemInfo) {
    const lossLot = {
      total: lossMass,
      title: `Perte ${transfoDetails.title || 'dynamique'}`,
    };

    // Créer le format de perte
    // Le nom du format est la clé française de l'objet loss
    lossLot.formats = {};
    const lossFormatName =
      lossItemInfo.formatName ||
      (lossItem ? Object.keys(lossItem)[0] : 'Format inconnu');

    const lossBubbleId = lossItemInfo.bubbleId;

    // Dans l'item complet, les formats sont directement les clés de l'objet
    const lossFormatData =
      lossItem && lossItem[lossFormatName] ? lossItem[lossFormatName] : {};

    lossLot.formats[lossFormatName] = {
      ...lossFormatData,
      bubble_id: lossBubbleId,
      pourcentage: 100,
    };

    // Ajouter en_gb si disponible dans lossItemInfo.itemData
    if (lossItemInfo.itemData?.en_gb) {
      lossLot.formats[lossFormatName].en_gb = lossItemInfo.itemData.en_gb;
    }

    // Appliquer la color depuis le format de l'item complet
    if (lossFormatData.color) {
      lossLot.formats[lossFormatName].color = lossFormatData.color;
    } else if (
      window.colorById &&
      lossBubbleId &&
      window.colorById.has(lossBubbleId)
    ) {
      lossLot.formats[lossFormatName].color =
        window.colorById.get(lossBubbleId);
    }

    // Appliquer TOUTES les distributions filles de lossItem (pas de fusion)
    this.applyAllChildDistributions(lossLot, lossItem);

    // Normaliser toutes les distributions
    this.normalizeAllDistributions(lossLot);

    return lossLot;
  }

  // Créer le coproductLot issu du transformable
  createCoproductLot(
    sourceLot,
    coproductItem,
    coproductMass,
    transfoDetails,
    coproductItemInfo
  ) {
    const coproductLot = {
      total: coproductMass,
      title: `Co-produit ${transfoDetails.title || 'dynamique'}`,
    };

    // Créer le format de coproduit
    // Le nom du format est la clé française de l'objet coproduct
    coproductLot.formats = {};
    const coproductFormatName =
      coproductItemInfo.formatName ||
      (coproductItem ? Object.keys(coproductItem)[0] : 'Format inconnu');

    const coproductBubbleId = coproductItemInfo.bubbleId;

    // Dans l'item complet, les formats sont directement les clés de l'objet
    const coproductFormatData =
      coproductItem && coproductItem[coproductFormatName]
        ? coproductItem[coproductFormatName]
        : {};

    coproductLot.formats[coproductFormatName] = {
      ...coproductFormatData,
      bubble_id: coproductBubbleId,
      pourcentage: 100,
    };

    // Ajouter en_gb si disponible dans coproductItemInfo.itemData
    if (coproductItemInfo.itemData?.en_gb) {
      coproductLot.formats[coproductFormatName].en_gb =
        coproductItemInfo.itemData.en_gb;
    }

    // Appliquer la color depuis le format de l'item complet
    if (coproductFormatData.color) {
      coproductLot.formats[coproductFormatName].color =
        coproductFormatData.color;
    } else if (
      window.colorById &&
      coproductBubbleId &&
      window.colorById.has(coproductBubbleId)
    ) {
      coproductLot.formats[coproductFormatName].color =
        window.colorById.get(coproductBubbleId);
    }

    // Appliquer les distributions filles (remplacement conditionnel)
    this.applyChildDistributions(coproductLot, coproductItem, sourceLot);

    // Normaliser toutes les distributions
    this.normalizeAllDistributions(coproductLot);

    return coproductLot;
  }

  // Appliquer les distributions filles conditionnellement (pour target et coproduct)
  applyChildDistributions(targetLot, referenceItem, sourceLot) {
    if (!targetLot.formats || !referenceItem) return;

    // Parcourir tous les formats dans targetLot
    Object.keys(targetLot.formats).forEach(formatKey => {
      const targetFormat = targetLot.formats[formatKey];
      // Dans l'item complet, les formats sont directement les clés de l'objet
      const referenceFormat = referenceItem.formats
        ? Object.values(referenceItem.formats)[0]
        : Object.keys(referenceItem).length > 0
          ? Object.values(referenceItem)[0]
          : null;

      if (!referenceFormat) return;

      // Pour chaque dimension enfant selon la hiérarchie
      this.processingOrder.forEach(dimension => {
        // Vérifier si cette dimension peut être enfant de formats
        const dimensionConfig = this.dimensionHierarchy[dimension];
        if (!dimensionConfig || dimensionConfig.parent !== 'formats') {
          // Vérifier si c'est une dimension de niveau racine (proprete, qualite)
          if (dimensionConfig && !dimensionConfig.parent) {
            // Appliquer au niveau racine du lot
            if (referenceItem[dimension]) {
              // L'item de référence a une distribution → remplacer
              targetLot[dimension] = JSON.parse(
                JSON.stringify(referenceItem[dimension])
              );
            } else if (sourceLot && sourceLot[dimension]) {
              // Sinon, prendre celle du lot d'entrée
              targetLot[dimension] = JSON.parse(
                JSON.stringify(sourceLot[dimension])
              );
            }
          }
          return;
        }

        // Si l'item de référence a une distribution dans cette dimension → remplacer
        if (referenceFormat[dimension]) {
          targetFormat[dimension] = JSON.parse(
            JSON.stringify(referenceFormat[dimension])
          );

          // Appliquer récursivement pour copier toutes les distributions enfants
          if (targetFormat[dimension]) {
            this.applyAllChildDistributionsRecursive(
              targetFormat[dimension],
              referenceFormat[dimension],
              dimension
            );
          }
        } else if (sourceLot && sourceLot.formats) {
          // Sinon, chercher dans le lot d'entrée
          // Agréger les distributions de cette dimension depuis tous les formats du lot d'entrée
          const aggregated = this.aggregateDimensionFromFormats(
            sourceLot,
            dimension
          );
          if (aggregated && Object.keys(aggregated).length > 0) {
            targetFormat[dimension] = aggregated;
          }
        }
      });
    });
  }

  // Appliquer récursivement les distributions filles
  applyChildDistributionsRecursive(
    targetNode,
    referenceNode,
    sourceLot,
    parentDimension
  ) {
    if (!targetNode || typeof targetNode !== 'object') return;

    // Parcourir toutes les dimensions enfants de la dimension parent
    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      // Parcourir tous les éléments du nœud cible
      Object.keys(targetNode).forEach(key => {
        const targetElement = targetNode[key];
        const referenceElement = referenceNode?.[key];

        if (!targetElement || typeof targetElement !== 'object') return;

        // Si l'item de référence a une distribution dans cette dimension → remplacer
        if (referenceElement && referenceElement[childDimension]) {
          targetElement[childDimension] = JSON.parse(
            JSON.stringify(referenceElement[childDimension])
          );
        } else if (sourceLot) {
          // Sinon, chercher dans le lot d'entrée (logique complexe, on garde ce qui existe déjà)
          // Pour simplifier, on garde ce qui existe déjà dans targetElement
        }

        // Appliquer récursivement pour les dimensions enfants
        if (targetElement[childDimension]) {
          this.applyChildDistributionsRecursive(
            targetElement[childDimension],
            referenceElement?.[childDimension],
            sourceLot,
            childDimension
          );
        }
      });
    });
  }

  // Agréger une dimension depuis tous les formats d'un lot
  aggregateDimensionFromFormats(lot, dimension) {
    if (!lot.formats) return null;

    const aggregated = {};
    let totalMass = 0;
    const massMap = new Map();

    Object.values(lot.formats).forEach(format => {
      const formatPct = format.pourcentage || 0;
      const dimensionData = format[dimension];

      if (!dimensionData) return;

      Object.entries(dimensionData).forEach(([key, value]) => {
        const elementPct = value.pourcentage || 0;
        const mass = (formatPct * elementPct) / 100;
        totalMass += mass;

        if (!massMap.has(key)) {
          massMap.set(key, {
            ...value,
            mass: 0,
          });
        }
        const entry = massMap.get(key);
        entry.mass += mass;
      });
    });

    if (totalMass === 0) return null;

    massMap.forEach((entry, key) => {
      aggregated[key] = {
        ...entry,
        pourcentage: (entry.mass / totalMass) * 100,
      };
      delete aggregated[key].mass;
    });

    return aggregated;
  }

  // Appliquer TOUTES les distributions filles de l'item de référence (pour loss)
  applyAllChildDistributions(lot, referenceItem) {
    if (!lot.formats || !referenceItem) return;

    // Parcourir tous les formats dans lot
    Object.keys(lot.formats).forEach(formatKey => {
      const lotFormat = lot.formats[formatKey];
      // Dans l'item complet, les formats sont directement les clés de l'objet
      const referenceFormat = referenceItem.formats
        ? Object.values(referenceItem.formats)[0]
        : Object.keys(referenceItem).length > 0
          ? Object.values(referenceItem)[0]
          : null;

      if (!referenceFormat) return;

      // Copier toutes les dimensions de l'item de référence
      this.processingOrder.forEach(dimension => {
        const dimensionConfig = this.dimensionHierarchy[dimension];
        if (!dimensionConfig) return;

        // Si c'est une dimension de niveau racine
        if (!dimensionConfig.parent) {
          if (referenceItem[dimension]) {
            lot[dimension] = JSON.parse(
              JSON.stringify(referenceItem[dimension])
            );
          }
          return;
        }

        // Si c'est une dimension enfant de formats
        if (dimensionConfig.parent === 'formats') {
          if (referenceFormat[dimension]) {
            lotFormat[dimension] = JSON.parse(
              JSON.stringify(referenceFormat[dimension])
            );
          }

          // Appliquer récursivement
          if (lotFormat[dimension]) {
            this.applyAllChildDistributionsRecursive(
              lotFormat[dimension],
              referenceFormat[dimension],
              dimension
            );
          }
        }
      });
    });
  }

  // Appliquer récursivement toutes les distributions (pour loss)
  applyAllChildDistributionsRecursive(
    targetNode,
    referenceNode,
    parentDimension
  ) {
    if (!targetNode || !referenceNode || typeof targetNode !== 'object') return;

    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      Object.keys(targetNode).forEach(key => {
        const targetElement = targetNode[key];
        const referenceElement = referenceNode[key];

        if (
          !targetElement ||
          !referenceElement ||
          typeof targetElement !== 'object'
        )
          return;

        // Copier complètement la distribution de l'item de référence
        if (referenceElement[childDimension]) {
          targetElement[childDimension] = JSON.parse(
            JSON.stringify(referenceElement[childDimension])
          );
        }

        // Appliquer récursivement
        if (targetElement[childDimension] && referenceElement[childDimension]) {
          this.applyAllChildDistributionsRecursive(
            targetElement[childDimension],
            referenceElement[childDimension],
            childDimension
          );
        }
      });
    });
  }

  // Normaliser toutes les distributions à tous les niveaux
  normalizeAllDistributions(lot) {
    if (!lot || typeof lot !== 'object') return;

    // Normaliser les dimensions de niveau racine
    this.processingOrder.forEach(dimension => {
      const dimensionConfig = this.dimensionHierarchy[dimension];
      if (!dimensionConfig) return;

      // Si c'est une dimension de niveau racine
      if (!dimensionConfig.parent && lot[dimension]) {
        this.normalizeDimension(lot[dimension]);
      }
    });

    // Normaliser récursivement depuis formats
    if (lot.formats) {
      Object.values(lot.formats).forEach(format => {
        this.normalizeFormatRecursive(format, 'formats');
      });
    }
  }

  // Normaliser récursivement un format et ses enfants
  normalizeFormatRecursive(node, parentDimension) {
    if (!node || typeof node !== 'object') return;

    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      if (node[childDimension]) {
        this.normalizeDimension(node[childDimension]);

        // Normaliser récursivement les enfants
        Object.values(node[childDimension]).forEach(childNode => {
          if (childNode && typeof childNode === 'object') {
            this.normalizeFormatRecursive(childNode, childDimension);
          }
        });
      }
    });
  }

  // Normaliser une dimension (faire que la somme fasse 100%)
  normalizeDimension(dimensionData) {
    if (!dimensionData || typeof dimensionData !== 'object') return;

    const total = Object.values(dimensionData).reduce((sum, item) => {
      return sum + (item.pourcentage || 0);
    }, 0);

    if (total > 0) {
      Object.values(dimensionData).forEach(item => {
        if (item.pourcentage !== undefined) {
          item.pourcentage = (item.pourcentage / total) * 100;
        }
      });
    }
  }
}

// Ancienne classe GenericTransformationEngine supprimée - remplacée par SimpleDynamicTransformationEngine

// Exposer le nouveau moteur globalement
window.SimpleDynamicTransformationEngine = SimpleDynamicTransformationEngine;
