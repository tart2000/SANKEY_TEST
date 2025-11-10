(function (globalScope) {
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
          Object.entries(typeObj.propres || {}).forEach(
            ([propre, propreObj]) => {
              masses.propres[propre] =
                (masses.propres[propre] || 0) +
                lot.total *
                  (formatObj.pourcentage / 100) *
                  (typeObj.pourcentage / 100) *
                  (propreObj.pourcentage / 100);
            }
          );
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
                  lot.formats[format].types[type].matieres[matiere].fibres[
                    fibre
                  ].color
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
                lot.formats[format].types[type].perturbateurs[perturbateur]
                  .color
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
            Object.keys(lot.formats[format].types[type].propres).forEach(
              propre => propresInType.add(propre)
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
              propreColor =
                lot.formats[format].types[type].propres[propre].color;
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
      new Set(
        lots.flatMap(lot => (lot.qualite ? Object.keys(lot.qualite) : []))
      )
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

  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = { mergeLots };
  }

  if (globalScope && typeof globalScope === 'object') {
    globalScope.mergeLots = mergeLots;
  }
})(
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
      ? globalThis
      : undefined
);
