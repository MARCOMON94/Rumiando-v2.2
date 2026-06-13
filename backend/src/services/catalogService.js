const prisma = require('../config/prisma');
const aiService = require('./aiService');
const AppError = require('../utils/AppError');

const SANITARY_TYPES = new Set(['vaccination', 'disease', 'deworming']);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function aliasesOf(item) {
  if (!item?.aliases) return [];
  if (Array.isArray(item.aliases)) return item.aliases;
  if (typeof item.aliases === 'string') {
    try {
      const parsed = JSON.parse(item.aliases);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function levenshtein(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return Math.max(left.length, right.length);

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1);

  for (let i = 1; i <= left.length; i++) {
    current[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function similarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  const max = Math.max(left.length, right.length);
  if (!max) return 0;

  return 1 - (levenshtein(left, right) / max);
}

function scoreCandidate(text, item) {
  const normalizedText = normalizeText(text);
  const names = [item.nombre, ...aliasesOf(item)].filter(Boolean);
  let best = 0;

  for (const name of names) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) continue;
    if (normalizedText === normalizedName) return 1;
    if (normalizedText.includes(normalizedName) || normalizedName.includes(normalizedText)) {
      best = Math.max(best, 0.92);
    }
    best = Math.max(best, similarity(normalizedText, normalizedName));
  }

  return best;
}

function serializeSanitaryItem(type, item) {
  if (!item) return null;

  return {
    id: item.id,
    type,
    nombre: item.nombre,
    aliases: aliasesOf(item),
    gravedadSugerida: item.gravedadSugerida || null,
    tipo: item.tipo || null,
    principioActivo: item.principioActivo || null,
    especieId: item.especieId || null
  };
}

async function getSanitaryCandidates(cuentaGanaderaId, type, especieId) {
  const where = {
    cuentaGanaderaId,
    activo: true
  };

  if (especieId) {
    where.OR = [
      { especieId: Number(especieId) },
      { especieId: null }
    ];
  }

  if (type === 'vaccination') {
    return prisma.catalogoVacuna.findMany({
      where,
      orderBy: {
        nombre: 'asc'
      }
    });
  }

  if (type === 'deworming') {
    return prisma.catalogoDesparasitante.findMany({
      where,
      orderBy: {
        nombre: 'asc'
      }
    });
  }

  return prisma.catalogoEnfermedad.findMany({
    where,
    orderBy: {
      nombre: 'asc'
    }
  });
}

async function getCatalogs(cuentaGanaderaId) {
  const [
    farmUnits,
    species,
    breeds,
    reproductiveStatuses,
    pens,
    diseases,
    vaccines,
    dewormers
  ] = await Promise.all([
    prisma.unidadRega.findMany({
      where: {
        cuentaGanaderaId,
        activa: true
      },
      include: {
        especiePrincipal: true,
        razaPrincipal: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoEspecie.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoRaza.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      include: {
        especie: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoEstadoReproductivo.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      orderBy: [
        {
          orden: 'asc'
        },
        {
          nombre: 'asc'
        }
      ]
    }),

    prisma.corral.findMany({
      where: {
        unidadRega: {
          cuentaGanaderaId
        },
        activo: true
      },
      include: {
        unidadRega: true,
        estadoReproductivoSugerido: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoEnfermedad.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoVacuna.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    }),

    prisma.catalogoDesparasitante.findMany({
      where: {
        cuentaGanaderaId,
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    })
  ]);

  return {
    farmUnits,
    species,
    breeds,
    reproductiveStatuses,
    pens,
    diseases,
    vaccines,
    dewormers
  };
}

async function askAiForSanitaryMatch({ text, type, candidates, authorization }) {
  if (!candidates.length) return null;

  try {
    const response = await aiService.normalizeSanitaryTerm({
      text,
      type,
      candidates: candidates.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        aliases: aliasesOf(item)
      }))
    }, authorization);

    const candidateId = response?.id || response?.catalogId || response?.item?.id;
    if (candidateId) {
      return candidates.find((item) => Number(item.id) === Number(candidateId)) || null;
    }

    const answerText = normalizeText(JSON.stringify(response || {}));
    return candidates.find((item) => (
      answerText.includes(normalizeText(item.nombre))
    )) || null;
  } catch {
    return null;
  }
}

async function createSanitaryCatalogItem({ type, text, cuentaGanaderaId, especieId, gravedad, dewormingType }) {
  const name = String(text || '').trim();
  if (!name) {
    throw new AppError('El nombre sanitario es obligatorio', 400);
  }

  if (type === 'vaccination') {
    return prisma.catalogoVacuna.upsert({
      where: {
        cuentaGanaderaId_nombre: {
          cuentaGanaderaId,
          nombre: name
        }
      },
      update: {
        activo: true,
        especieId: especieId ? Number(especieId) : undefined
      },
      create: {
        nombre: name,
        cuentaGanaderaId,
        especieId: especieId ? Number(especieId) : null
      }
    });
  }

  if (type === 'deworming') {
    return prisma.catalogoDesparasitante.upsert({
      where: {
        cuentaGanaderaId_nombre: {
          cuentaGanaderaId,
          nombre: name
        }
      },
      update: {
        activo: true,
        especieId: especieId ? Number(especieId) : undefined,
        tipo: dewormingType || undefined
      },
      create: {
        nombre: name,
        tipo: dewormingType || 'INTERNA',
        cuentaGanaderaId,
        especieId: especieId ? Number(especieId) : null
      }
    });
  }

  return prisma.catalogoEnfermedad.upsert({
    where: {
      cuentaGanaderaId_nombre: {
        cuentaGanaderaId,
        nombre: name
      }
    },
    update: {
      activo: true,
      especieId: especieId ? Number(especieId) : undefined,
      gravedadSugerida: gravedad || undefined
    },
    create: {
      nombre: name,
      cuentaGanaderaId,
      especieId: especieId ? Number(especieId) : null,
      gravedadSugerida: gravedad || null
    }
  });
}

async function normalizeSanitaryTerm(data, cuentaGanaderaId, authorization) {
  const type = data?.type || data?.tipo;
  const text = String(data?.text || data?.texto || '').trim();
  const especieId = data?.especieId || null;

  if (!SANITARY_TYPES.has(type)) {
    throw new AppError('Tipo sanitario no válido', 400);
  }

  if (!text) {
    throw new AppError('Texto sanitario obligatorio', 400);
  }

  const candidates = await getSanitaryCandidates(cuentaGanaderaId, type, especieId);
  const scored = candidates
    .map((item) => ({
      item,
      confidence: scoreCandidate(text, item)
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const localMatch = scored[0];
  if (localMatch?.confidence >= 0.86) {
    return {
      status: localMatch.confidence >= 0.98 ? 'matched' : 'suggested',
      source: 'catalog',
      confidence: Number(localMatch.confidence.toFixed(2)),
      item: serializeSanitaryItem(type, localMatch.item)
    };
  }

  const aiMatch = await askAiForSanitaryMatch({
    text,
    type,
    candidates,
    authorization
  });

  if (aiMatch) {
    return {
      status: 'suggested',
      source: 'rag',
      confidence: 0.84,
      item: serializeSanitaryItem(type, aiMatch)
    };
  }

  if (data?.createIfMissing) {
    const created = await createSanitaryCatalogItem({
      type,
      text,
      cuentaGanaderaId,
      especieId,
      gravedad: data?.gravedad,
      dewormingType: data?.dewormingType
    });

    return {
      status: 'created',
      source: 'manual',
      confidence: 1,
      item: serializeSanitaryItem(type, created)
    };
  }

  return {
    status: 'new',
    source: 'manual',
    confidence: 0,
    item: null
  };
}

module.exports = {
  getCatalogs,
  normalizeSanitaryTerm
};
