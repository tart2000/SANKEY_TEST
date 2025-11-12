(function (globalScope) {
  const CHILD_KEYS = new Set([
    'types',
    'matieres',
    'fibres',
    'couleurs',
    'perturbateurs',
    'qualite',
    'proprete',
  ]);

  function mergeLots(lots) {
    if (lots.length === 1) {
      return lots[0];
    }

    const totalMass = lots.reduce((sum, lot) => sum + (lot.total || 0), 0);

    const formatsMap = new Map();
    const qualiteMap = new Map();
    const propreteMap = new Map();

    lots.forEach(lot => {
      const lotTotal = lot.total || 0;
      aggregateFormats(formatsMap, lot.formats || {}, lotTotal);
      aggregateSimple(qualiteMap, lot.qualite || {}, lotTotal);
      aggregateSimple(propreteMap, lot.proprete || {}, lotTotal);
    });

    return {
      total: totalMass,
      formats: convertFormats(formatsMap, totalMass),
      qualite: convertSimple(qualiteMap, totalMass),
      proprete: convertSimple(propreteMap, totalMass),
    };
  }

  function aggregateFormats(map, formats, lotTotal) {
    Object.entries(formats).forEach(([label, format]) => {
      const id = format.bubble_id;
      if (!id) {
        throw new Error('Format sans bubble_id');
      }
      const mass = lotTotal * ((format.pourcentage || 0) / 100);
      if (mass === 0) {
        return;
      }
      const entry = getOrCreate(map, id, label, format, () => ({
        types: new Map(),
      }));
      entry.mass += mass;
      aggregateTypes(entry.types, format.types || {}, mass);
    });
  }

  function aggregateTypes(map, types, parentMass) {
    Object.entries(types).forEach(([label, type]) => {
      const id = type.bubble_id;
      if (!id) {
        throw new Error('Type sans bubble_id');
      }
      const mass = parentMass * ((type.pourcentage || 0) / 100);
      if (mass === 0) {
        return;
      }
      const entry = getOrCreate(map, id, label, type, () => ({
        matieres: new Map(),
        couleurs: new Map(),
        perturbateurs: new Map(),
      }));
      entry.mass += mass;
      aggregateMatieres(entry.matieres, type.matieres || {}, mass);
      aggregateSimple(entry.couleurs, type.couleurs || {}, mass);
      aggregateSimple(entry.perturbateurs, type.perturbateurs || {}, mass);
    });
  }

  function aggregateMatieres(map, matieres, parentMass) {
    Object.entries(matieres).forEach(([label, matiere]) => {
      const id = matiere.bubble_id;
      if (!id) {
        throw new Error('Matière sans bubble_id');
      }
      const mass = parentMass * ((matiere.pourcentage || 0) / 100);
      if (mass === 0) {
        return;
      }
      const entry = getOrCreate(map, id, label, matiere, () => ({
        fibres: new Map(),
      }));
      entry.mass += mass;
      aggregateFibres(entry.fibres, matiere.fibres || {}, mass);
    });
  }

  function aggregateFibres(map, fibres, parentMass) {
    Object.entries(fibres).forEach(([label, fibre]) => {
      const id = fibre.bubble_id;
      if (!id) {
        throw new Error('Fibre sans bubble_id');
      }
      const mass = parentMass * ((fibre.pourcentage || 0) / 100);
      if (mass === 0) {
        return;
      }
      const entry = getOrCreate(map, id, label, fibre, () => ({}));
      entry.mass += mass;
    });
  }

  function aggregateSimple(map, items, parentMass) {
    Object.entries(items).forEach(([label, item]) => {
      const id = item.bubble_id;
      if (!id) {
        throw new Error('Élément sans bubble_id');
      }
      const mass = parentMass * ((item.pourcentage || 0) / 100);
      if (mass === 0) {
        return;
      }
      const entry = getOrCreate(map, id, label, item, () => ({}));
      entry.mass += mass;
    });
  }

  function convertFormats(map, parentMass) {
    const result = {};
    map.forEach(entry => {
      const value = buildValue(entry, parentMass);
      value.types = convertTypes(entry.types, entry.mass);
      result[entry.key] = value;
    });
    return result;
  }

  function convertTypes(map, parentMass) {
    const result = {};
    map.forEach(entry => {
      const value = buildValue(entry, parentMass);
      value.matieres = convertMatieres(entry.matieres, entry.mass);
      value.couleurs = convertSimple(entry.couleurs, entry.mass);
      value.perturbateurs = convertSimple(entry.perturbateurs, entry.mass);
      result[entry.key] = value;
    });
    return result;
  }

  function convertMatieres(map, parentMass) {
    const result = {};
    map.forEach(entry => {
      const value = buildValue(entry, parentMass);
      value.fibres = convertSimple(entry.fibres, entry.mass);
      result[entry.key] = value;
    });
    return result;
  }

  function convertSimple(map, parentMass) {
    const result = {};
    map.forEach(entry => {
      result[entry.key] = buildValue(entry, parentMass);
    });
    return result;
  }

  function buildValue(entry, parentMass) {
    const pourcentage = parentMass > 0 ? (entry.mass / parentMass) * 100 : 0;
    return {
      ...entry.meta,
      pourcentage,
    };
  }

  function getOrCreate(map, id, key, source, createChildren) {
    let entry = map.get(id);
    if (!entry) {
      entry = {
        key,
        id,
        mass: 0,
        meta: extractMeta(source),
        ...createChildren(),
      };
      map.set(id, entry);
    } else {
      updateMeta(entry.meta, source);
    }
    return entry;
  }

  function extractMeta(source) {
    const meta = {};
    Object.keys(source).forEach(prop => {
      if (prop === 'pourcentage' || CHILD_KEYS.has(prop)) {
        return;
      }
      meta[prop] = source[prop];
    });
    return meta;
  }

  function updateMeta(meta, source) {
    Object.keys(source).forEach(prop => {
      if (prop === 'pourcentage' || CHILD_KEYS.has(prop)) {
        return;
      }
      if (meta[prop] === undefined) {
        meta[prop] = source[prop];
      }
    });
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
