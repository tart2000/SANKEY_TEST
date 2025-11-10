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
    keyList: 'formats',
    requiredKey: true,
    step: 'sorting',
  },
  selectByType: {
    label: 'Tri par type',
    en_gb: 'Sort by type',
    description: 'Sélectionne les articles selon leur type (après format)',
    keyList: 'types',
    requiredKey: true,
    step: 'sorting',
  },
  selectByMatiere: {
    label: 'Tri par matière',
    en_gb: 'Sort by material',
    description: 'Sélectionne les articles selon leur matière',
    keyList: 'matieres',
    requiredKey: true,
    step: 'sorting',
  },
  selectByQualite: {
    label: 'Tri par qualité',
    en_gb: 'Sort by quality',
    description: 'Sélectionne les articles selon leur qualité',
    keyList: 'qualite',
    requiredKey: true,
    step: 'sorting',
  },
  selectByCouleur: {
    label: 'Tri par couleur',
    en_gb: 'Sort by color',
    description: 'Sélectionne les articles selon leur couleur',
    keyList: 'couleurs',
    requiredKey: true,
    step: 'sorting',
  },
  selectByFibre: {
    label: 'Tri par fibre',
    en_gb: 'Sort by fiber',
    description: 'Sélectionne les articles selon leur composition en fibres',
    keyList: 'fibres',
    requiredKey: true,
    step: 'sorting',
  },
  selectByProprete: {
    label: 'Tri par propreté',
    en_gb: 'Sort by cleanliness',
    description: 'Sélectionne les articles selon leur propreté',
    keyList: 'proprete',
    requiredKey: true,
    step: 'sorting',
  },
  selectByPerturbateur: {
    label: 'Tri par nievau de perturbation',
    en_gb: 'Sort by level of perturbation',
    description: 'Sélectionne les articles selon la présence de perturbateurs',
    keyList: 'perturbateurs',
    requiredKey: true,
    step: 'sorting',
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
      dynamicTransfosCache.set(transfo.bubble_id, {
        ...transfo,
        title: title,
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

    // Vérifier les transformations dynamiques
    if (type.startsWith('dynamic_transfo_')) {
      const bubbleId = type.replace('dynamic_transfo_', '');
      const transfo = getDynamicTransfo(bubbleId);
      return transfo ? transfo.title : type;
    }

    return type;
  },

  getTransformationDescription(type) {
    // Vérifier d'abord les transformations statiques
    if (transformationTypes[type]) {
      return transformationTypes[type].description;
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
    // Transformations statiques
    const staticTransformations = Object.entries(transformationTypes).map(
      ([value, info]) => ({
        value,
        label: info.label,
        en_gb: info.en_gb,
        description: info.description,
        isStatic: true,
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
        description: `Transformation dynamique: ${transfo.step}`,
        isDynamic: true,
        bubbleId: transfo.bubble_id,
        version: transfo.version,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // Tri alphabétique par titre

    // Retourner avec séparateur
    return [
      ...staticTransformations,
      {
        value: 'separator',
        label: '--- Transformations dynamiques ---',
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

  // Utiliser le moteur de transformation générique unifié
  if (!window.genericTransformationEngine) {
    window.genericTransformationEngine = new GenericTransformationEngine();
  }

  return window.genericTransformationEngine.executeTransformation(
    lot,
    transfoDetails
  );
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
};

window.transformationUtils = transformationUtils;
window.transformationTypes = transformationTypes;

window.fetchItemMiniSync = fetchItemMiniSync;
window.fetchItemCompleteSync = fetchItemCompleteSync;
window.ensureDimensionColorsLoadedSync = ensureDimensionColorsLoadedSync;

// ← NOUVEAU : Exposer le cache globalement pour le debug
window.dynamicTransfosCache = dynamicTransfosCache;
window.dynamicTransfosLoaded = dynamicTransfosLoaded;

function mergeLots(lots) {
  // Si un seul lot, le retourner tel quel
  if (lots.length === 1) {
    return lots[0];
  }

  // 1. Première passe : calculer les masses totales
  const masses = {
    total: 0,
    formats: {},
    types: {},
    matieres: {},
    couleurs: {},
    fibres: {},
    perturbateurs: {},
    qualites: {},
    propres: {},
  };

  lots.forEach(lot => {
    masses.total += lot.total;
    Object.entries(lot.formats).forEach(([format, formatObj]) => {
      masses.formats[format] =
        (masses.formats[format] || 0) +
        lot.total * (formatObj.pourcentage / 100);
      Object.entries(formatObj.types).forEach(([type, typeObj]) => {
        masses.types[type] =
          (masses.types[type] || 0) +
          lot.total *
            (formatObj.pourcentage / 100) *
            (typeObj.pourcentage / 100);
        // Matières
        Object.entries(typeObj.matieres || {}).forEach(
          ([matiere, matiereObj]) => {
            masses.matieres[matiere] =
              (masses.matieres[matiere] || 0) +
              lot.total *
                (formatObj.pourcentage / 100) *
                (typeObj.pourcentage / 100) *
                (matiereObj.pourcentage / 100);
            // Fibres
            Object.entries(matiereObj.fibres || {}).forEach(
              ([fibre, fibreObj]) => {
                masses.fibres[fibre] =
                  (masses.fibres[fibre] || 0) +
                  lot.total *
                    (formatObj.pourcentage / 100) *
                    (typeObj.pourcentage / 100) *
                    (matiereObj.pourcentage / 100) *
                    (fibreObj.pourcentage / 100);
              }
            );
          }
        );
        // Couleurs
        Object.entries(typeObj.couleurs || {}).forEach(
          ([couleur, couleurObj]) => {
            masses.couleurs[couleur] =
              (masses.couleurs[couleur] || 0) +
              lot.total *
                (formatObj.pourcentage / 100) *
                (typeObj.pourcentage / 100) *
                (couleurObj.pourcentage / 100);
          }
        );
        // Perturbateurs
        Object.entries(typeObj.perturbateurs || {}).forEach(
          ([perturbateur, perturbateurObj]) => {
            masses.perturbateurs[perturbateur] =
              (masses.perturbateurs[perturbateur] || 0) +
              lot.total *
                (formatObj.pourcentage / 100) *
                (typeObj.pourcentage / 100) *
                (perturbateurObj.pourcentage / 100);
          }
        );
        // Qualités
        Object.entries(typeObj.qualites || {}).forEach(
          ([qualite, qualiteObj]) => {
            masses.qualites[qualite] =
              (masses.qualites[qualite] || 0) +
              lot.total *
                (formatObj.pourcentage / 100) *
                (typeObj.pourcentage / 100) *
                (qualiteObj.pourcentage / 100);
          }
        );
        // Propres
        Object.entries(typeObj.propres || {}).forEach(([propre, propreObj]) => {
          masses.propres[propre] =
            (masses.propres[propre] || 0) +
            lot.total *
              (formatObj.pourcentage / 100) *
              (typeObj.pourcentage / 100) *
              (propreObj.pourcentage / 100);
        });
      });
    });
  });

  const total = masses.total;

  // 2. Deuxième passe : reconstruire la structure avec les pourcentages calculés
  const result = {
    total,
    formats: {},
  };

  // Formats
  Object.entries(masses.formats).forEach(([format, masse]) => {
    // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
    let formatColor = null;
    for (const lot of lots) {
      if (lot.formats && lot.formats[format] && lot.formats[format].color) {
        formatColor = lot.formats[format].color;
        break; // Prendre la première couleur trouvée
      }
    }
    result.formats[format] = {
      pourcentage: (masse / total) * 100,
      types: {},
    };
    if (formatColor) result.formats[format].color = formatColor;

    // Types pour ce format
    const typesInFormat = new Set();
    lots.forEach(lot => {
      if (lot.formats && lot.formats[format] && lot.formats[format].types) {
        Object.keys(lot.formats[format].types).forEach(type =>
          typesInFormat.add(type)
        );
      }
    });

    typesInFormat.forEach(type => {
      if (!masses.types[type]) return;
      // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
      let typeColor = null;
      for (const lot of lots) {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].color
        ) {
          typeColor = lot.formats[format].types[type].color;
          break; // Prendre la première couleur trouvée
        }
      }
      result.formats[format].types[type] = {
        pourcentage: (masses.types[type] / masse) * 100,
        matieres: {},
        couleurs: {},
        perturbateurs: {},
        qualites: {},
        propres: {},
      };
      if (typeColor) result.formats[format].types[type].color = typeColor;

      // Matières pour ce type
      const matieresInType = new Set();
      lots.forEach(lot => {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].matieres
        ) {
          Object.keys(lot.formats[format].types[type].matieres).forEach(
            matiere => matieresInType.add(matiere)
          );
        }
      });

      matieresInType.forEach(matiere => {
        if (!masses.matieres[matiere]) return;
        // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
        let matiereColor = null;
        for (const lot of lots) {
          if (
            lot.formats &&
            lot.formats[format] &&
            lot.formats[format].types[type] &&
            lot.formats[format].types[type].matieres[matiere] &&
            lot.formats[format].types[type].matieres[matiere].color
          ) {
            matiereColor =
              lot.formats[format].types[type].matieres[matiere].color;
            break; // Prendre la première couleur trouvée
          }
        }

        // Calculer la distribution des fibres
        const fibresAgg = {};
        let fibresSum = 0;
        lots.forEach(lot => {
          if (
            lot.formats &&
            lot.formats[format] &&
            lot.formats[format].types[type] &&
            lot.formats[format].types[type].matieres[matiere] &&
            lot.formats[format].types[type].matieres[matiere].fibres
          ) {
            const matiereObj =
              lot.formats[format].types[type].matieres[matiere];
            const pctMatiere =
              typeof matiereObj.pourcentage === 'number'
                ? matiereObj.pourcentage
                : 100;
            const pctType =
              typeof lot.formats[format].types[type].pourcentage === 'number'
                ? lot.formats[format].types[type].pourcentage
                : 100;
            const pctFormat =
              typeof lot.formats[format].pourcentage === 'number'
                ? lot.formats[format].pourcentage
                : 100;
            Object.entries(matiereObj.fibres).forEach(([fibre, fibreObj]) => {
              const pctFibre =
                typeof fibreObj === 'object' && fibreObj !== null
                  ? fibreObj.pourcentage !== undefined
                    ? fibreObj.pourcentage
                    : fibreObj
                  : fibreObj;
              const pct =
                (pctFibre / 100) *
                (pctMatiere / 100) *
                (pctType / 100) *
                (pctFormat / 100) *
                100;
              fibresAgg[fibre] = (fibresAgg[fibre] || 0) + pct;
              fibresSum += pct;
            });
          }
        });

        // Normaliser les fibres
        const fibresObj = {};
        if (fibresSum > 0) {
          Object.entries(fibresAgg).forEach(([fibre, pct]) => {
            fibresObj[fibre] = {
              pourcentage: (pct / fibresSum) * 100,
            };
            // Chercher la couleur de la fibre dans les lots fusionnés (prendre la première trouvée)
            for (const lot of lots) {
              if (
                lot.formats &&
                lot.formats[format] &&
                lot.formats[format].types[type] &&
                lot.formats[format].types[type].matieres[matiere] &&
                lot.formats[format].types[type].matieres[matiere].fibres[
                  fibre
                ] &&
                lot.formats[format].types[type].matieres[matiere].fibres[fibre]
                  .color
              ) {
                fibresObj[fibre].color =
                  lot.formats[format].types[type].matieres[matiere].fibres[
                    fibre
                  ].color;
                break; // Prendre la première couleur trouvée
              }
            }
          });
        }

        result.formats[format].types[type].matieres[matiere] = {
          pourcentage: (masses.matieres[matiere] / masses.types[type]) * 100,
          fibres: fibresObj,
        };
        if (matiereColor)
          result.formats[format].types[type].matieres[matiere].color =
            matiereColor;
      });

      // Couleurs pour ce type
      const couleursInType = new Set();
      lots.forEach(lot => {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].couleurs
        ) {
          Object.keys(lot.formats[format].types[type].couleurs).forEach(
            couleur => couleursInType.add(couleur)
          );
        }
      });

      couleursInType.forEach(couleur => {
        if (!masses.couleurs[couleur]) return;
        // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
        let couleurColor = null;
        for (const lot of lots) {
          if (
            lot.formats &&
            lot.formats[format] &&
            lot.formats[format].types[type] &&
            lot.formats[format].types[type].couleurs[couleur] &&
            lot.formats[format].types[type].couleurs[couleur].color
          ) {
            couleurColor =
              lot.formats[format].types[type].couleurs[couleur].color;
            break; // Prendre la première couleur trouvée
          }
        }

        result.formats[format].types[type].couleurs[couleur] = {
          pourcentage: (masses.couleurs[couleur] / masses.types[type]) * 100,
        };
        if (couleurColor)
          result.formats[format].types[type].couleurs[couleur].color =
            couleurColor;
      });

      // Perturbateurs pour ce type
      const perturbateursInType = new Set();
      lots.forEach(lot => {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].perturbateurs
        ) {
          Object.keys(lot.formats[format].types[type].perturbateurs).forEach(
            perturbateur => perturbateursInType.add(perturbateur)
          );
        }
      });

      // Ne traiter les perturbateurs que si le type en a
      if (perturbateursInType.size > 0) {
        // Calculer la masse totale des perturbateurs pour ce type
        const perturbateursMassInType =
          perturbateursInType.size > 0
            ? Array.from(perturbateursInType).reduce((sum, p) => {
                return sum + (masses.perturbateurs[p] || 0);
              }, 0)
            : 0;

        // Initialiser l'objet perturbateurs seulement si nécessaire
        if (!result.formats[format].types[type].perturbateurs) {
          result.formats[format].types[type].perturbateurs = {};
        }

        perturbateursInType.forEach(perturbateur => {
          if (!masses.perturbateurs[perturbateur]) return;
          // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
          let perturbateurColor = null;
          for (const lot of lots) {
            if (
              lot.formats &&
              lot.formats[format] &&
              lot.formats[format].types[type] &&
              lot.formats[format].types[type].perturbateurs[perturbateur] &&
              lot.formats[format].types[type].perturbateurs[perturbateur].color
            ) {
              perturbateurColor =
                lot.formats[format].types[type].perturbateurs[perturbateur]
                  .color;
              break; // Prendre la première couleur trouvée
            }
          }

          result.formats[format].types[type].perturbateurs[perturbateur] = {
            pourcentage:
              perturbateursMassInType > 0
                ? (masses.perturbateurs[perturbateur] /
                    perturbateursMassInType) *
                  100
                : 0,
          };
          if (perturbateurColor)
            result.formats[format].types[type].perturbateurs[
              perturbateur
            ].color = perturbateurColor;
        });
      }

      // Qualités pour ce type
      const qualitesInType = new Set();
      lots.forEach(lot => {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].qualites
        ) {
          Object.keys(lot.formats[format].types[type].qualites).forEach(
            qualite => qualitesInType.add(qualite)
          );
        }
      });

      qualitesInType.forEach(qualite => {
        if (!masses.qualites[qualite]) return;
        // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
        let qualiteColor = null;
        for (const lot of lots) {
          if (
            lot.formats &&
            lot.formats[format] &&
            lot.formats[format].types[type] &&
            lot.formats[format].types[type].qualites[qualite] &&
            lot.formats[format].types[type].qualites[qualite].color
          ) {
            qualiteColor =
              lot.formats[format].types[type].qualites[qualite].color;
            break; // Prendre la première couleur trouvée
          }
        }

        result.formats[format].types[type].qualites[qualite] = {
          pourcentage: (masses.qualites[qualite] / masses.types[type]) * 100,
        };
        if (qualiteColor)
          result.formats[format].types[type].qualites[qualite].color =
            qualiteColor;
      });

      // Propres pour ce type
      const propresInType = new Set();
      lots.forEach(lot => {
        if (
          lot.formats &&
          lot.formats[format] &&
          lot.formats[format].types[type] &&
          lot.formats[format].types[type].propres
        ) {
          Object.keys(lot.formats[format].types[type].propres).forEach(propre =>
            propresInType.add(propre)
          );
        }
      });

      propresInType.forEach(propre => {
        if (!masses.propres[propre]) return;
        // Chercher la couleur dans les lots fusionnés (prendre la première trouvée)
        let propreColor = null;
        for (const lot of lots) {
          if (
            lot.formats &&
            lot.formats[format] &&
            lot.formats[format].types[type] &&
            lot.formats[format].types[type].propres[propre] &&
            lot.formats[format].types[type].propres[propre].color
          ) {
            propreColor = lot.formats[format].types[type].propres[propre].color;
            break; // Prendre la première couleur trouvée
          }
        }

        result.formats[format].types[type].propres[propre] = {
          pourcentage: (masses.propres[propre] / masses.types[type]) * 100,
        };
        if (propreColor)
          result.formats[format].types[type].propres[propre].color =
            propreColor;
      });
    });
  });

  // Après la fusion des formats/types, fusionner la propreté et la qualité au niveau racine
  // Propreté
  const allPropretes = Array.from(
    new Set(
      lots.flatMap(lot => (lot.proprete ? Object.keys(lot.proprete) : []))
    )
  );
  result.proprete = {};
  allPropretes.forEach(prop => {
    let sum = 0;
    let color = null;
    lots.forEach(lot => {
      if (lot.proprete && lot.proprete[prop]) {
        const val =
          typeof lot.proprete[prop] === 'number'
            ? lot.proprete[prop]
            : lot.proprete[prop].pourcentage || 0;
        sum += (lot.total * val) / 100;
        if (lot.proprete[prop].color) color = lot.proprete[prop].color;
      }
    });
    result.proprete[prop] = {
      pourcentage: (sum / total) * 100,
    };
    if (color) result.proprete[prop].color = color;
  });
  // Qualité
  const allQualites = Array.from(
    new Set(lots.flatMap(lot => (lot.qualite ? Object.keys(lot.qualite) : [])))
  );
  result.qualite = {};
  allQualites.forEach(qual => {
    let sum = 0;
    let color = null;
    lots.forEach(lot => {
      if (lot.qualite && lot.qualite[qual]) {
        const val =
          typeof lot.qualite[qual] === 'number'
            ? lot.qualite[qual]
            : lot.qualite[qual].pourcentage || 0;
        sum += (lot.total * val) / 100;
        if (lot.qualite[qual].color) color = lot.qualite[qual].color;
      }
    });
    result.qualite[qual] = {
      pourcentage: (sum / total) * 100,
    };
    if (color) result.qualite[qual].color = color;
  });

  return result;
}
window.mergeLots = mergeLots;

// MOTEUR GÉNÉRIQUE UNIFIÉ : Une seule logique pour TOUTES les transformations dynamiques
class GenericTransformationEngine {
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

  // Méthode principale qui orchestre la transformation avec décrochage hiérarchique
  executeTransformation(lot, transfoDetails) {
    console.log(
      'GenericTransformationEngine.executeTransformation (hiérarchique) appelée pour:',
      transfoDetails.title
    );

    // Vérifications de base
    if (!transfoDetails || !transfoDetails.dimensions) {
      console.error('transfoDetails ou dimensions manquants:', transfoDetails);
      throw new Error('Configuration de transformation invalide');
    }

    // 1. Identifier la dimension primaire selon les règles du .md
    const primaryDimension = this.identifyPrimaryDimension(
      transfoDetails.dimensions
    );
    console.log('Dimension primaire identifiée:', primaryDimension);

    if (!primaryDimension) {
      throw new Error(
        'Aucune dimension primaire identifiée pour la transformation'
      );
    }

    // 2. Collecter TOUS les critères d'input de toutes les dimensions
    const allInputCriteria = {};
    for (const [dimension, config] of Object.entries(
      transfoDetails.dimensions
    )) {
      if (config.input && Object.keys(config.input).length > 0) {
        allInputCriteria[dimension] = config.input;
      }
    }

    // 3. Trouver tous les éléments qui matchent dans la hiérarchie
    const matchingElements = this.findMatchingElements(
      lot,
      allInputCriteria,
      primaryDimension
    );
    console.log('Éléments à décrocher:', matchingElements);

    if (matchingElements.length === 0) {
      console.log('Aucun élément ne matche les critères - lot cible vide');
      return {
        targetLot: {
          total: 0,
          title: transfoDetails.title || 'Transformation dynamique',
        },
        coProductLot: JSON.parse(JSON.stringify(lot)),
      };
    }

    // 4. Décrocher tous les éléments trouvés
    const primaryCfg = transfoDetails.dimensions[primaryDimension] || {};
    const targetConfig = {
      key: Object.keys(primaryCfg.target || {})[0],
      value: Object.values(primaryCfg.target || {})[0],
    };

    if (!targetConfig.key || !targetConfig.value) {
      throw new Error(
        'Configuration target manquante pour la dimension primaire'
      );
    }

    const { filteredLot, remainingLot } = this.filterLotByCriteria(
      lot,
      matchingElements,
      primaryDimension
    );
    const decrochedMass = this.calculateLotTotalMass(filteredLot);

    this.applyPrimaryTarget(filteredLot, primaryDimension, {
      [targetConfig.key]: targetConfig.value,
    });
    filteredLot.total = this.calculateLotTotalMass(filteredLot);

    const targetLot = {
      [primaryDimension]: JSON.parse(
        JSON.stringify(filteredLot[primaryDimension] || {})
      ),
    };
    targetLot.title = transfoDetails.title || 'Transformation dynamique';
    this.copySiblingDimensions(targetLot, filteredLot, primaryDimension);

    // 6. Calculer la masse totale décrochée
    const totalDecrochedMass = decrochedMass;
    console.log('Masse totale décrochée:', totalDecrochedMass);

    // 7. Appliquer le yield sur la masse totale décrochée
    const yieldPercent = transfoDetails.yield || 100;
    const targetMass = (totalDecrochedMass * yieldPercent) / 100;
    const coproFromDecroched = Math.max(totalDecrochedMass - targetMass, 0);
    const remainderMass = Math.max((lot.total || 0) - totalDecrochedMass, 0);
    targetLot.total = targetMass;

    // 8. Créer le co-produit
    const coProductLot = this.finalizeCoProductLot(
      remainingLot,
      coproFromDecroched,
      primaryCfg,
      primaryDimension,
      remainderMass
    );
    if (coProductLot) {
      coProductLot.title = `Co-produit ${transfoDetails.title || 'dynamique'}`;
      this.copySiblingDimensions(
        coProductLot,
        remainingLot || lot,
        primaryDimension
      );
    }

    // 9. Appliquer les targets enfants éventuels
    this.applyChildTargets(
      targetLot,
      transfoDetails.dimensions,
      primaryDimension
    );

    // 10. Recalculer les pourcentages pour maintenir la cohérence
    this.recalculatePercentagesAfterDecrochage(targetLot);
    if (coProductLot) {
      this.recalculatePercentagesAfterDecrochage(coProductLot);
    }

    return { targetLot, coProductLot };
  }

  // Identifier la dimension primaire selon les règles du .md
  identifyPrimaryDimension(dimensions) {
    // Règle 1: Dimension avec co-produit défini
    for (const [dimension, config] of Object.entries(dimensions)) {
      if (this.hasCoproduct(config.coproduct)) {
        console.log(`Dimension primaire trouvée par co-produit: ${dimension}`);
        return dimension;
      }
    }

    // Règle 2: Première dimension avec target défini selon DIMENSION_PROCESSING_ORDER
    // de config/dimensions.js
    for (const dimension of this.processingOrder) {
      if (this.hasTarget(dimensions[dimension]?.target)) {
        console.log(`Dimension primaire trouvée par target: ${dimension}`);
        return dimension;
      }
    }

    console.log('Aucune dimension primaire identifiée');
    return null;
  }

  // Appliquer la transformation selon la hiérarchie
  applyHierarchicalTransformation(lot, transfoDetails, primaryDimension) {
    console.log(
      'Application de la transformation hiérarchique selon:',
      this.processingOrder
    );

    // 1. PRÉSERVER LA STRUCTURE COMPLÈTE du lot d'origine avec deep clone
    let processedLot = JSON.parse(JSON.stringify(lot));

    // 2. Traitement séquentiel selon DIMENSION_PROCESSING_ORDER de config/dimensions.js
    for (const dimension of this.processingOrder) {
      const dimensionConfig = transfoDetails.dimensions[dimension];

      if (this.hasConfiguration(dimensionConfig)) {
        console.log(`Traitement de la dimension: ${dimension}`);
        processedLot = this.processDimension(
          processedLot,
          dimensionConfig,
          dimension
        );
      }
    }

    return processedLot;
  }

  // Traiter une dimension spécifique
  processDimension(lot, dimensionConfig, dimensionName) {
    const { input, target, coproduct } = dimensionConfig;

    // Recherche d'éléments correspondants (pour information, pas de filtrage ici)
    if (this.hasInputCriteria(input)) {
      console.log(`Recherche d'éléments correspondants pour ${dimensionName}`);
      const matchingElements = this.findMatchingElements(
        lot,
        input,
        dimensionName
      );
      console.log(`Éléments trouvés:`, matchingElements);
      // Note: Le filtrage sera fait plus tard dans executeTransformation
    }

    // Application de la transformation cible
    if (this.hasTarget(target)) {
      console.log(
        `Application de la transformation cible pour ${dimensionName}`
      );
      lot = this.applyTargetTransformation(lot, target, dimensionName);
    }

    // Gestion des co-produits
    if (this.hasCoproduct(coproduct)) {
      console.log(`Gestion des co-produits pour ${dimensionName}`);
      lot = this.handleCoproducts(lot, coproduct, dimensionName);
    }

    return lot;
  }

  // Vérifier si une dimension a une configuration
  hasConfiguration(dimensionConfig) {
    return (
      dimensionConfig &&
      (this.hasInputCriteria(dimensionConfig.input) ||
        this.hasTarget(dimensionConfig.target) ||
        this.hasCoproduct(dimensionConfig.coproduct))
    );
  }

  // Vérifier si des critères d'entrée sont définis
  hasInputCriteria(input) {
    return input && Object.keys(input).length > 0;
  }

  // Vérifier si une transformation cible est définie
  hasTarget(target) {
    return target && Object.keys(target).length > 0;
  }

  // Vérifier si des co-produits sont définis
  hasCoproduct(coproduct) {
    return coproduct && Object.keys(coproduct).length > 0;
  }

  // Trouver tous les éléments qui matchent les critères d'input dans la hiérarchie
  findMatchingElements(lot, inputCriteria) {
    const criteria = {};
    if (!inputCriteria || Object.keys(inputCriteria).length === 0) {
      return criteria;
    }

    this.processingOrder.forEach(dimension => {
      const dimensionInput = inputCriteria[dimension];
      if (!dimensionInput || typeof dimensionInput !== 'object') return;
      const ids = new Set();
      Object.values(dimensionInput).forEach(entry => {
        if (entry && entry.bubble_id) {
          ids.add(entry.bubble_id);
        }
      });
      if (ids.size > 0) {
        criteria[dimension] = ids;
      }
    });

    console.log(
      'Critères normalisés pour la transformation dynamique:',
      Object.fromEntries(
        Object.entries(criteria).map(([dim, set]) => [dim, Array.from(set)])
      )
    );

    return criteria;
  }

  getSelectorForDimension(dimension) {
    const map = {
      formats: selectByFormat,
      types: selectByType,
      matieres: selectByMatiere,
      fibres: selectByFibre,
      couleurs: selectByCouleur,
      perturbateurs: selectByPerturbateur,
      proprete: selectByProprete,
      qualite: selectByQualite,
    };
    return map[dimension] || null;
  }

  filterLotByCriteria(lot, criteria, primaryDimension) {
    let filteredLot = JSON.parse(JSON.stringify(lot));
    const remainderLots = [];

    this.processingOrder.forEach(dimension => {
      const ids = criteria[dimension];
      if (!ids || ids.size === 0) return;
      const selector = this.getSelectorForDimension(dimension);
      if (!selector) return;

      const idsArray = Array.from(ids);
      if (idsArray.length === 0) return;

      const result = selector(filteredLot, idsArray);
      if (result && result.targetLot) {
        filteredLot = result.targetLot;
      }
      if (result && result.coProductLot && result.coProductLot.total) {
        remainderLots.push(result.coProductLot);
      }
    });

    filteredLot.total = this.calculateLotTotalMass(filteredLot);

    let remainingLot = null;
    if (remainderLots.length > 0) {
      const validLots = remainderLots.filter(
        lotPart =>
          lotPart &&
          (typeof lotPart.total === 'number'
            ? lotPart.total > 0
            : this.calculateLotTotalMass(lotPart) > 0)
      );
      if (validLots.length > 0) {
        remainingLot = mergeLots(validLots);
        remainingLot.total = this.calculateLotTotalMass(remainingLot);
      }
    }

    return { filteredLot, remainingLot };
  }

  finalizeCoProductLot(
    remainingLot,
    coproFromDecroched,
    primaryCfg,
    primaryDimension,
    remainderMass = 0
  ) {
    let coProductLot = remainingLot
      ? JSON.parse(JSON.stringify(remainingLot))
      : null;

    const coproductCfg = primaryCfg && primaryCfg.coproduct;
    if (
      coproFromDecroched > 0 &&
      coproductCfg &&
      Object.keys(coproductCfg).length > 0
    ) {
      if (!coProductLot) {
        coProductLot = { total: 0 };
        coProductLot[primaryDimension] = {};
      }
      this.addCoproductDistribution(
        coProductLot,
        coproFromDecroched,
        coproductCfg,
        primaryDimension
      );
    }

    const remainder = Math.max(Number(remainderMass) || 0, 0);
    if (!coProductLot && (remainder > 0 || coproFromDecroched > 0)) {
      coProductLot = { total: 0 };
      coProductLot[primaryDimension] = {};
    }

    if (!coProductLot) {
      return null;
    }

    coProductLot.total =
      this.calculateLotTotalMass(coProductLot) +
      Math.max(coproFromDecroched || 0, 0) +
      remainder;

    if (!coProductLot.total || coProductLot.total <= 0.1) {
      return null;
    }

    return coProductLot;
  }

  // Appliquer la transformation cible
  applyTargetTransformation(lot, target, dimensionName) {
    // Concaténation de toutes les clés en une seule clé cible
    const targetBubbleId = Object.values(target)[0].bubble_id;
    const targetKey = Object.keys(target)[0];

    // Deep clone pour préserver la structure complète
    const transformedLot = JSON.parse(JSON.stringify(lot));

    // Remplacer SEULEMENT la dimension spécifiée
    transformedLot[dimensionName] = {};

    // Créer la nouvelle clé cible en préservant TOUTES les propriétés
    const targetValue = { ...Object.values(target)[0] };
    if (window.colorById && window.colorById.has(targetBubbleId)) {
      targetValue.color = window.colorById.get(targetBubbleId);
    }
    transformedLot[dimensionName][targetKey] = targetValue;

    // Cas particulier: si on remplace des formats par un format cible,
    // reconstruire immédiatement la distribution des types en concaténant
    // ceux des formats applicables (afin que l'étape d'agrégation de type cible fonctionne)
    if (dimensionName === 'formats') {
      const aggregatedTypes = this.aggregateTypesFromFormats(lot);
      if (aggregatedTypes && Object.keys(aggregatedTypes).length > 0) {
        transformedLot.formats[targetKey] =
          transformedLot.formats[targetKey] || {};
        transformedLot.formats[targetKey].types = aggregatedTypes;
      }
    }

    // Concaténer les distributions existantes de cette dimension
    const existingKeys = Object.keys(lot[dimensionName] || {});
    if (existingKeys.length > 0) {
      // Récupérer la première clé existante pour copier ses propriétés (color, etc.)
      const firstExistingKey = existingKeys[0];
      const firstExistingValue = lot[dimensionName][firstExistingKey];

      // Préserver la couleur d'origine SEULEMENT si aucune couleur officielle n'a été posée
      if (
        firstExistingValue.color &&
        !transformedLot[dimensionName][targetKey].color
      ) {
        transformedLot[dimensionName][targetKey].color =
          firstExistingValue.color;
      }
      if (firstExistingValue.pourcentage !== undefined) {
        // Calculer le pourcentage total concaténé
        let totalPourcentage = 0;
        existingKeys.forEach(key => {
          const value = lot[dimensionName][key];
          if (value && value.pourcentage !== undefined) {
            totalPourcentage += value.pourcentage;
          }
        });
        transformedLot[dimensionName][targetKey].pourcentage = totalPourcentage;
      }
    }

    return transformedLot;
  }

  // Gérer les co-produits
  handleCoproducts(lot, coproduct, dimensionName) {
    console.log(`Co-produits à gérer pour ${dimensionName}:`, coproduct);
    return lot;
  }

  // Appliquer la distribution du co-produit sur la dimension primaire
  applyCoproductDistribution(
    coProductLot,
    nonApplicableMass,
    coproFromApplicable,
    primaryDimension,
    coproductCfg,
    applicableSourceLot // nouveau: pour reconstruire les types issus de la part applicable
  ) {
    const totalCopro = (nonApplicableMass || 0) + (coproFromApplicable || 0);
    if (totalCopro <= 0) return coProductLot;

    // Base: distribution existante du non-applicable sur la dimension primaire
    const baseDist = JSON.parse(
      JSON.stringify(coProductLot[primaryDimension] || {})
    );

    // 1) Réduire les pourcentages de la base proportionnellement à la part nonApplicableMass
    const baseScale = nonApplicableMass / totalCopro;
    Object.values(baseDist).forEach(v => {
      if (v && typeof v.pourcentage === 'number') {
        v.pourcentage = v.pourcentage * baseScale;
      }
    });

    // 2) Ajouter la distribution définie par coproduct pour la part issue de l'applicable
    const coproScale = coproFromApplicable / totalCopro;
    const coproEntries = Object.entries(coproductCfg);
    coproEntries.forEach(([name, cfg]) => {
      const pct = (cfg.percent || 0) * coproScale;
      if (!baseDist[name]) baseDist[name] = {};
      baseDist[name].bubble_id = cfg.bubble_id;
      baseDist[name].pourcentage = (baseDist[name].pourcentage || 0) + pct;
      if (window.colorById && window.colorById.has(cfg.bubble_id)) {
        baseDist[name].color = window.colorById.get(cfg.bubble_id);
      }
    });

    // 3) Normalisation douce pour viser 100
    const sum = Object.values(baseDist).reduce(
      (acc, v) => acc + (typeof v.pourcentage === 'number' ? v.pourcentage : 0),
      0
    );
    if (sum > 0) {
      Object.values(baseDist).forEach(v => {
        if (typeof v.pourcentage === 'number') {
          v.pourcentage = (v.pourcentage / sum) * 100;
        }
      });
    }

    coProductLot[primaryDimension] = baseDist;
    // Si la dimension primaire est 'formats', propager la couleur au niveau format pour l'affichage
    if (primaryDimension === 'formats' && coProductLot.formats) {
      Object.entries(baseDist).forEach(([fmtName, fmtObj]) => {
        if (
          coProductLot.formats[fmtName] &&
          fmtObj &&
          fmtObj.color &&
          !coProductLot.formats[fmtName].color
        ) {
          coProductLot.formats[fmtName].color = fmtObj.color;
        }
        // Créer le format s'il n'existe pas encore (cas copro format nouveau)
        if (!coProductLot.formats[fmtName]) {
          coProductLot.formats[fmtName] = { pourcentage: fmtObj.pourcentage };
          if (fmtObj.color) coProductLot.formats[fmtName].color = fmtObj.color;
        } else {
          coProductLot.formats[fmtName].pourcentage = fmtObj.pourcentage;
        }
        // Reconstruire les types du co-produit:
        // concaténation des types de la part applicable (plan A)
        if (applicableSourceLot && applicableSourceLot.formats) {
          const aggTypes = this.aggregateTypesFromFormats(applicableSourceLot);
          if (aggTypes && Object.keys(aggTypes).length > 0) {
            coProductLot.formats[fmtName].types = JSON.parse(
              JSON.stringify(aggTypes)
            );
          }
        }
      });
    }
    return coProductLot;
  }

  // Concaténer tous les types présents sous les formats du lot courant
  // Pondération: pour chaque type, masse = format.pourcentage * type.pourcentage
  // Puis normalisation à 100
  aggregateTypesFromFormats(lot) {
    if (!lot || !lot.formats) return {};
    const accMass = new Map(); // key -> { bubble_id, color, mass }
    let total = 0;
    Object.entries(lot.formats).forEach(([fmt, fmtObj]) => {
      const pctFormat = Math.max(Number(fmtObj.pourcentage) || 0, 0);
      const types = (fmtObj && fmtObj.types) || {};
      Object.entries(types).forEach(([tName, tObj]) => {
        const pctType = Math.max(Number(tObj.pourcentage) || 0, 0);
        const mass = (pctFormat * pctType) / 100; // masse relative
        total += mass;
        if (!accMass.has(tName)) {
          accMass.set(tName, {
            bubble_id: tObj.bubble_id,
            color: tObj.color,
            mass: 0,
            // enfants copiés à plat; l'agrégation détaillée enfants se fait plus bas si besoin
            matieres: tObj.matieres
              ? JSON.parse(JSON.stringify(tObj.matieres))
              : undefined,
            couleurs: tObj.couleurs
              ? JSON.parse(JSON.stringify(tObj.couleurs))
              : undefined,
            perturbateurs: tObj.perturbateurs
              ? JSON.parse(JSON.stringify(tObj.perturbateurs))
              : undefined,
          });
        }
        const rec = accMass.get(tName);
        rec.mass += mass;
        // color officielle si connue
        if (
          window.colorById &&
          tObj.bubble_id &&
          window.colorById.has(tObj.bubble_id)
        ) {
          rec.color = window.colorById.get(tObj.bubble_id);
        }
      });
    });
    const result = {};
    if (total > 0) {
      accMass.forEach((rec, name) => {
        result[name] = {
          bubble_id: rec.bubble_id,
          pourcentage: (rec.mass / total) * 100,
        };
        if (rec.color) result[name].color = rec.color;
        if (rec.matieres) result[name].matieres = rec.matieres;
        if (rec.couleurs) result[name].couleurs = rec.couleurs;
        if (rec.perturbateurs) result[name].perturbateurs = rec.perturbateurs;
      });
    }
    return result;
  }

  // Récupérer une fonction de split par dimension (réutilise les sélecteurs existants)
  getDimensionSplitter(dimensionName) {
    const map = {
      formats: window.processes && window.processes.selectByFormat,
      types: window.processes && window.processes.selectByType,
      matieres: window.processes && window.processes.selectByMatiere,
      fibres: window.processes && window.processes.selectByFibre,
      couleurs: window.processes && window.processes.selectByCouleur,
      perturbateurs: window.processes && window.processes.selectByPerturbateur,
      proprete: window.processes && window.processes.selectByProprete,
      qualite: window.processes && window.processes.selectByQualite,
    };
    return map[dimensionName] || null;
  }

  // Agréger tous les types d'un format en un seul type cible et concaténer les distributions enfants
  enforceTypesTargetAggregation(lot, typesTargetCfg) {
    if (!lot || !lot.formats) return;
    const targetKey = Object.keys(typesTargetCfg)[0];
    const targetVal = Object.values(typesTargetCfg)[0];

    Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
      const types = formatObj.types || {};
      // Si déjà vide, rien à faire
      if (Object.keys(types).length === 0) return;

      // Accumulateurs
      const aggMatieres = {};
      const aggCouleurs = {};
      const aggPerturbateurs = {};

      // Agréger par pondération du pourcentage du type
      Object.entries(types).forEach(([typeName, typeObj]) => {
        const typeWeight = Math.max(Number(typeObj.pourcentage) || 0, 0);

        // Couleurs
        if (typeObj.couleurs) {
          Object.entries(typeObj.couleurs).forEach(([cName, cObj]) => {
            const add = (Number(cObj.pourcentage) || 0) * (typeWeight / 100);
            if (!aggCouleurs[cName])
              aggCouleurs[cName] = { ...cObj, pourcentage: 0 };
            aggCouleurs[cName].pourcentage += add;
            if (cObj.bubble_id) aggCouleurs[cName].bubble_id = cObj.bubble_id;
            if (cObj.color) aggCouleurs[cName].color = cObj.color;

            // Appliquer la couleur officielle depuis window.colorById si disponible
            if (
              window.colorById &&
              cObj.bubble_id &&
              window.colorById.has(cObj.bubble_id)
            ) {
              aggCouleurs[cName].color = window.colorById.get(cObj.bubble_id);
            }
          });
        }

        // Perturbateurs
        if (typeObj.perturbateurs) {
          Object.entries(typeObj.perturbateurs).forEach(([pName, pObj]) => {
            const add = (Number(pObj.pourcentage) || 0) * (typeWeight / 100);
            if (!aggPerturbateurs[pName])
              aggPerturbateurs[pName] = { ...pObj, pourcentage: 0 };
            aggPerturbateurs[pName].pourcentage += add;
            if (pObj.bubble_id)
              aggPerturbateurs[pName].bubble_id = pObj.bubble_id;
            if (pObj.color) aggPerturbateurs[pName].color = pObj.color;

            // Appliquer la couleur officielle depuis window.colorById si disponible
            if (
              window.colorById &&
              pObj.bubble_id &&
              window.colorById.has(pObj.bubble_id)
            ) {
              aggPerturbateurs[pName].color = window.colorById.get(
                pObj.bubble_id
              );
            }
          });
        }

        // Matières et fibres
        if (typeObj.matieres) {
          Object.entries(typeObj.matieres).forEach(([mName, mObj]) => {
            const mAddBase =
              (Number(mObj.pourcentage) || 0) * (typeWeight / 100);
            if (!aggMatieres[mName])
              aggMatieres[mName] = { ...mObj, pourcentage: 0 };
            aggMatieres[mName].pourcentage += mAddBase;
            if (mObj.bubble_id) aggMatieres[mName].bubble_id = mObj.bubble_id;
            if (mObj.color) aggMatieres[mName].color = mObj.color;

            // Fibres sous matières
            if (mObj.fibres) {
              if (!aggMatieres[mName].fibres) aggMatieres[mName].fibres = {};
              Object.entries(mObj.fibres).forEach(([fName, fObj]) => {
                const fAdd = (Number(fObj.pourcentage) || 0) * (mAddBase / 100);
                if (!aggMatieres[mName].fibres[fName]) {
                  aggMatieres[mName].fibres[fName] = {
                    ...fObj,
                    pourcentage: 0,
                  };
                }
                aggMatieres[mName].fibres[fName].pourcentage += fAdd;
                if (fObj.bubble_id)
                  aggMatieres[mName].fibres[fName].bubble_id = fObj.bubble_id;
                if (fObj.color)
                  aggMatieres[mName].fibres[fName].color = fObj.color;
              });
            }
          });
        }
      });

      // Normaliser à 100
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

      normalize(aggCouleurs);
      normalize(aggPerturbateurs);
      normalize(aggMatieres);
      // Normaliser fibres par matière
      Object.values(aggMatieres).forEach(m => {
        if (m.fibres) normalize(m.fibres);
      });

      // Remplacer les types par une seule entrée = target
      lot.formats[formatKey].types = {};
      lot.formats[formatKey].types[targetKey] = {
        bubble_id: targetVal.bubble_id,
        pourcentage: 100,
        matieres: aggMatieres,
        couleurs: aggCouleurs,
        perturbateurs: aggPerturbateurs,
      };
      if (window.colorById && window.colorById.has(targetVal.bubble_id)) {
        lot.formats[formatKey].types[targetKey].color = window.colorById.get(
          targetVal.bubble_id
        );
      }
    });
  }

  // Fixer une dimension enfant d'un type (ex: perturbateurs) à une seule clé cible à 100%
  setTypeChildDimensionToSingleKey(lot, childDimName, targetCfg) {
    if (!lot || !lot.formats) return;
    const targetKey = Object.keys(targetCfg)[0];
    const targetVal = Object.values(targetCfg)[0];
    Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
      const types = formatObj.types || {};
      Object.entries(types).forEach(([typeKey, typeObj]) => {
        const child = typeObj[childDimName];
        // Remplacer par la cible à 100%
        const newChild = {};
        newChild[targetKey] = {
          bubble_id: targetVal.bubble_id,
          pourcentage: 100,
        };

        // Appliquer la couleur depuis window.colorById si disponible
        if (window.colorById && window.colorById.has(targetVal.bubble_id)) {
          newChild[targetKey].color = window.colorById.get(targetVal.bubble_id);
        }
        lot.formats[formatKey].types[typeKey][childDimName] = newChild;
      });
    });
  }

  setLotDimensionToSingleKey(lot, dimensionName, targetCfg) {
    if (!lot || !targetCfg) return;
    const targetKey = Object.keys(targetCfg)[0];
    const targetVal = Object.values(targetCfg)[0];
    if (!targetKey || !targetVal) return;

    const entry = {
      bubble_id: targetVal.bubble_id,
      pourcentage: 100,
    };
    if (
      window.colorById &&
      targetVal.bubble_id &&
      window.colorById.has(targetVal.bubble_id)
    ) {
      entry.color = window.colorById.get(targetVal.bubble_id);
    } else if (targetVal.color) {
      entry.color = targetVal.color;
    }
    lot[dimensionName] = { [targetKey]: entry };
  }

  setFibresToSingleKey(lot, targetCfg) {
    if (!lot || !lot.formats || !targetCfg) return;
    const targetKey = Object.keys(targetCfg)[0];
    const targetVal = Object.values(targetCfg)[0];
    if (!targetKey || !targetVal) return;

    Object.values(lot.formats).forEach(formatObj => {
      const types = formatObj.types || {};
      Object.values(types).forEach(typeObj => {
        const matieres = typeObj.matieres || {};
        Object.values(matieres).forEach(matiereObj => {
          const newChild = {
            [targetKey]: {
              bubble_id: targetVal.bubble_id,
              pourcentage: 100,
            },
          };
          if (
            window.colorById &&
            targetVal.bubble_id &&
            window.colorById.has(targetVal.bubble_id)
          ) {
            newChild[targetKey].color = window.colorById.get(
              targetVal.bubble_id
            );
          } else if (targetVal.color) {
            newChild[targetKey].color = targetVal.color;
          }
          matiereObj.fibres = newChild;
        });
      });
    });
  }

  enforceMatieresTargetAggregation(lot, targetCfg) {
    if (!lot || !lot.formats || !targetCfg) return;
    const targetKey = Object.keys(targetCfg)[0];
    const targetVal = Object.values(targetCfg)[0];
    if (!targetKey || !targetVal) return;

    Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
      const types = formatObj.types || {};
      Object.entries(types).forEach(([typeKey, typeObj]) => {
        const matieres = typeObj.matieres || {};
        if (Object.keys(matieres).length === 0) return;

        const aggregatedFibres = {};
        let hasFibres = false;

        Object.values(matieres).forEach(matiereObj => {
          const matPct = Math.max(Number(matiereObj.pourcentage) || 0, 0);
          if (matiereObj.fibres) {
            Object.entries(matiereObj.fibres).forEach(([fKey, fObj]) => {
              const fibrePct = Math.max(Number(fObj.pourcentage) || 0, 0);
              if (!aggregatedFibres[fKey]) {
                aggregatedFibres[fKey] = {
                  bubble_id: fObj.bubble_id,
                  pourcentage: 0,
                };
                if (fObj.color) aggregatedFibres[fKey].color = fObj.color;
              }
              aggregatedFibres[fKey].pourcentage += (matPct * fibrePct) / 100;
              if (
                !aggregatedFibres[fKey].color &&
                window.colorById &&
                fObj.bubble_id &&
                window.colorById.has(fObj.bubble_id)
              ) {
                aggregatedFibres[fKey].color = window.colorById.get(
                  fObj.bubble_id
                );
              }
              hasFibres = true;
            });
          }
        });

        if (hasFibres) {
          const fibreSum = Object.values(aggregatedFibres).reduce(
            (acc, fibre) => acc + (Number(fibre.pourcentage) || 0),
            0
          );
          if (fibreSum > 0) {
            Object.values(aggregatedFibres).forEach(fibre => {
              fibre.pourcentage =
                (Number(fibre.pourcentage) || 0) * (100 / fibreSum);
            });
          }
        }

        const newMatiere = {
          bubble_id: targetVal.bubble_id,
          pourcentage: 100,
        };
        if (
          window.colorById &&
          targetVal.bubble_id &&
          window.colorById.has(targetVal.bubble_id)
        ) {
          newMatiere.color = window.colorById.get(targetVal.bubble_id);
        } else if (targetVal.color) {
          newMatiere.color = targetVal.color;
        }
        if (hasFibres) {
          newMatiere.fibres = aggregatedFibres;
        }

        lot.formats[formatKey].types[typeKey].matieres = {
          [targetKey]: newMatiere,
        };
      });
    });
  }

  applyPrimaryTarget(lot, primaryDimension, targetConfig) {
    if (!lot || !targetConfig) return;
    switch (primaryDimension) {
      case 'formats': {
        const transformed = this.applyTargetTransformation(
          lot,
          targetConfig,
          'formats'
        );
        lot.formats = transformed.formats || {};
        break;
      }
      case 'types':
        this.enforceTypesTargetAggregation(lot, targetConfig);
        break;
      case 'matieres':
        this.enforceMatieresTargetAggregation(lot, targetConfig);
        break;
      case 'fibres':
        this.setFibresToSingleKey(lot, targetConfig);
        break;
      case 'couleurs':
        this.setTypeChildDimensionToSingleKey(lot, 'couleurs', targetConfig);
        break;
      case 'perturbateurs':
        this.setTypeChildDimensionToSingleKey(
          lot,
          'perturbateurs',
          targetConfig
        );
        break;
      case 'proprete':
      case 'qualite':
        this.setLotDimensionToSingleKey(lot, primaryDimension, targetConfig);
        break;
      default:
        console.warn(
          '[DynamicTransfo] Dimension primaire non gérée:',
          primaryDimension
        );
    }
  }

  // Fusionner la structure de référence avec les données de l'élément original
  mergeWithReferenceStructure(targetElement, referenceItem, originalElement) {
    const merged = { ...targetElement };

    // Pour chaque dimension, fusionner les données
    for (const dimension of this.processingOrder) {
      if (referenceItem[dimension] && originalElement[dimension]) {
        merged[dimension] = this.mergeDimensionData(
          referenceItem[dimension],
          originalElement[dimension]
        );
      }
    }

    return merged;
  }

  // Fusionner les données d'une dimension spécifique
  mergeDimensionData(referenceData, originalData) {
    const merged = {};

    // Prendre les clés de référence comme base
    for (const [key, value] of Object.entries(referenceData)) {
      if (originalData[key]) {
        // Si l'élément original a cette clé, fusionner
        merged[key] = {
          ...value,
          pourcentage: originalData[key].pourcentage || value.pourcentage,
          color: originalData[key].color || value.color,
        };
      } else {
        // Sinon, utiliser la référence
        merged[key] = { ...value };
      }
    }

    return merged;
  }

  // Concaténer tous les éléments décrochés dans le target
  concatenateDecrochedElements(decrochedElements, targetKey, primaryDimension) {
    let combinedEntry = null;

    decrochedElements.forEach(element => {
      const dimensionMap = element[primaryDimension];
      if (!dimensionMap) return;
      const entry = dimensionMap[targetKey];
      if (!entry) return;
      if (!combinedEntry) {
        combinedEntry = JSON.parse(JSON.stringify(entry));
      } else {
        this.mergeElementIntoTarget(combinedEntry, entry);
      }
    });

    if (!combinedEntry) {
      return {};
    }

    return { [targetKey]: combinedEntry };
  }

  // Fusionner un élément dans le target
  mergeElementIntoTarget(targetEntry, element) {
    if (!targetEntry) return;
    if (!element) return;

    const currentPct = targetEntry.pourcentage || 0;
    const elementPct = element.pourcentage || 0;
    targetEntry.pourcentage = currentPct + elementPct;

    // Fusionner les dimensions enfants
    for (const dimension of this.processingOrder) {
      if (element[dimension]) {
        if (!targetEntry[dimension]) {
          targetEntry[dimension] = {};
        }
        this.mergeDimensionIntoTarget(
          targetEntry[dimension],
          element[dimension]
        );
      }
    }
  }

  // Fusionner une dimension dans le target
  mergeDimensionIntoTarget(targetDimension, elementDimension) {
    for (const [key, value] of Object.entries(elementDimension)) {
      if (targetDimension[key]) {
        // Fusionner les pourcentages
        const currentPct = targetDimension[key].pourcentage || 0;
        const elementPct = value.pourcentage || 0;
        targetDimension[key].pourcentage = currentPct + elementPct;
      } else {
        targetDimension[key] = { ...value };
      }
    }
  }

  // Calculer la masse totale des éléments décrochés
  calculateTotalMass(
    decrochedElements,
    sourceLotTotal,
    primaryDimension,
    targetKey
  ) {
    const baseMass = Number(sourceLotTotal) || 0;
    let totalMass = 0;
    for (const element of decrochedElements) {
      const dimensionMap = element[primaryDimension];
      if (!dimensionMap) continue;
      const entry = dimensionMap[targetKey];
      if (!entry || entry.pourcentage === undefined) continue;
      const pct = Number(entry.pourcentage) || 0;
      totalMass += (pct / 100) * baseMass;
    }
    return totalMass;
  }

  // Créer le lot co-produit
  createCoProductLot(
    originalLot,
    matchingElements,
    coproFromDecroched,
    coproductCfg,
    primaryDimension,
    decrochedElements,
    remainderMass
  ) {
    // Commencer avec le lot original
    const coProductLot = JSON.parse(JSON.stringify(originalLot));

    // Retirer les éléments qui ont été décrochés
    this.removeDecrochedElementsFromLot(coProductLot, matchingElements);

    // Ajouter la part non-yield des éléments décrochés selon la distribution coproduct
    if (
      coproFromDecroched > 0 &&
      coproductCfg &&
      Object.keys(coproductCfg).length > 0
    ) {
      this.addCoproductDistribution(
        coProductLot,
        coproFromDecroched,
        coproductCfg,
        primaryDimension
      );
    }

    // Calculer la masse totale du co-produit
    const remaining = Math.max(Number(remainderMass) || 0, 0);
    coProductLot.total = remaining + coproFromDecroched;

    if (!coProductLot.total || coProductLot.total <= 0.1) {
      return null;
    }

    return coProductLot;
  }

  // Ajouter la distribution des co-produits avec chargement des items complets
  addCoproductDistribution(coProductLot, mass, coproductCfg, primaryDimension) {
    if (!coproductCfg || Object.keys(coproductCfg).length === 0) return;
    if (!mass || mass <= 0) return;
    if (!coProductLot[primaryDimension]) {
      coProductLot[primaryDimension] = {};
    }

    const totalPercent = Object.values(coproductCfg).reduce(
      (sum, cfg) => sum + (cfg.percent || 0),
      0
    );
    if (!totalPercent) return;

    if (
      typeof window.ensureDimensionColorsLoadedSync === 'function' &&
      primaryDimension
    ) {
      window.ensureDimensionColorsLoadedSync(primaryDimension);
    }

    for (const [name, cfg] of Object.entries(coproductCfg)) {
      const percent = (cfg.percent || 0) * (mass / totalPercent);

      // Charger l'item complet pour avoir la structure de référence
      let completeItem = null;
      if (window.itemCompleteCache.has(cfg.bubble_id)) {
        completeItem = window.itemCompleteCache.get(cfg.bubble_id);
      } else if (typeof window.fetchItemCompleteSync === 'function') {
        completeItem = window.fetchItemCompleteSync(cfg.bubble_id);
      }

      if (completeItem) {
        // Utiliser la structure complète de l'item
        coProductLot[primaryDimension][name] = {
          bubble_id: cfg.bubble_id,
          pourcentage: percent,
          color:
            completeItem.color ||
            (window.colorById && window.colorById.get(cfg.bubble_id)),
          // Ajouter toutes les dimensions de l'item complet
          types: completeItem.types || {},
          matieres: completeItem.matieres || {},
          fibres: completeItem.fibres || {},
          couleurs: completeItem.couleurs || {},
          perturbateurs: completeItem.perturbateurs || {},
          proprete: completeItem.proprete || {},
          qualite: completeItem.qualite || {},
        };
      } else {
        // Fallback si l'API échoue
        coProductLot[primaryDimension][name] = {
          bubble_id: cfg.bubble_id,
          pourcentage: percent,
          color: window.colorById && window.colorById.get(cfg.bubble_id),
        };
      }
    }
  }

  // Calculer la masse totale d'un lot
  calculateLotTotalMass(lot) {
    if (lot.total !== undefined) {
      return lot.total;
    }

    // Calculer à partir des pourcentages des formats
    if (lot.formats) {
      return Object.values(lot.formats).reduce((sum, format) => {
        return sum + (format.pourcentage || 0);
      }, 0);
    }

    return 0;
  }

  // Appliquer les targets enfants
  applyChildTargets(targetLot, dimensions, primaryDimension) {
    if (!dimensions) return;

    const handlers = {
      types: cfg => this.enforceTypesTargetAggregation(targetLot, cfg),
      matieres: cfg => this.enforceMatieresTargetAggregation(targetLot, cfg),
      fibres: cfg => this.setFibresToSingleKey(targetLot, cfg),
      couleurs: cfg =>
        this.setTypeChildDimensionToSingleKey(targetLot, 'couleurs', cfg),
      perturbateurs: cfg =>
        this.setTypeChildDimensionToSingleKey(targetLot, 'perturbateurs', cfg),
      proprete: cfg =>
        this.setLotDimensionToSingleKey(targetLot, 'proprete', cfg),
      qualite: cfg =>
        this.setLotDimensionToSingleKey(targetLot, 'qualite', cfg),
    };

    Object.entries(handlers).forEach(([dimension, handler]) => {
      if (dimension === primaryDimension) return;
      const dimensionCfg = dimensions[dimension];
      if (dimensionCfg && this.hasTarget(dimensionCfg.target)) {
        handler(dimensionCfg.target);
      }
    });
  }

  // Recalculer les pourcentages après décrochage pour maintenir la cohérence des totaux
  recalculatePercentagesAfterDecrochage(lot) {
    console.log('Recalcul des pourcentages après décrochage');

    // Recalculer les pourcentages pour chaque dimension
    for (const dimension of this.processingOrder) {
      if (lot[dimension]) {
        this.normalizeDimensionPercentages(lot[dimension]);
      }
    }

    return lot;
  }

  copySiblingDimensions(targetLot, sourceLot, primaryDimension) {
    if (!sourceLot) return;
    this.processingOrder.forEach(dimension => {
      if (dimension === primaryDimension) return;
      if (!sourceLot[dimension]) return;
      if (!targetLot[dimension]) {
        targetLot[dimension] = JSON.parse(JSON.stringify(sourceLot[dimension]));
        return;
      }
      if (typeof targetLot[dimension] === 'object') {
        this.mergeDimensionIntoTarget(
          targetLot[dimension],
          sourceLot[dimension]
        );
      }
    });
  }

  // Normaliser les pourcentages d'une dimension pour qu'ils totalisent 100%
  normalizeDimensionPercentages(dimensionData) {
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

    // Normaliser récursivement les dimensions enfants
    Object.values(dimensionData).forEach(item => {
      if (item && typeof item === 'object') {
        for (const childDimension of this.processingOrder) {
          if (item[childDimension]) {
            this.normalizeDimensionPercentages(item[childDimension]);
          }
        }
      }
    });
  }
}

// Exposer le moteur de transformation générique globalement
window.GenericTransformationEngine = GenericTransformationEngine;
