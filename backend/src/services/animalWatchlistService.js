const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const normalizeEarTag = require('../utils/normalizeEarTag');

function getItemInclude() {
  return {
    animal: {
      include: {
        unidadRega: true,
        especie: true,
        raza: true,
        corralActual: true,
        estadoReproductivo: true
      }
    }
  };
}

function buildCounts(items) {
  const total = items.length;
  const seenTotal = items.filter((item) => item.seenAt).length;

  return {
    total,
    seenTotal,
    pendingTotal: total - seenTotal
  };
}

async function checkAnimal(animalId, cuentaGanaderaId) {
  const animal = await prisma.animal.findFirst({
    where: {
      id: Number(animalId),
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!animal) {
    throw new AppError('Animal no encontrado para esta cuenta ganadera', 404);
  }

  if (animal.estadoRegistro === 'BAJA') {
    throw new AppError('No se puede añadir a Búsqueda inteligente un animal dado de baja', 400);
  }

  return animal;
}

async function listItems(userId, cuentaGanaderaId) {
  const items = await prisma.animalWatchlistItem.findMany({
    where: {
      userId,
      cuentaGanaderaId
    },
    include: getItemInclude(),
    orderBy: [
      {
        createdAt: 'desc'
      }
    ]
  });

  return {
    data: items,
    ...buildCounts(items)
  };
}

async function addItem(userId, cuentaGanaderaId, data = {}) {
  if (!data.animalId) {
    throw new AppError('animalId es obligatorio', 400);
  }

  await checkAnimal(data.animalId, cuentaGanaderaId);

  const existing = await prisma.animalWatchlistItem.findUnique({
    where: {
      userId_animalId: {
        userId,
        animalId: Number(data.animalId)
      }
    }
  });

  const itemData = {
    motivoTipo: data.motivoTipo ?? data.reasonType ?? null,
    motivoTexto: data.motivoTexto ?? data.reasonText ?? null,
    sourceType: data.sourceType ?? null,
    sourceRef: data.sourceRef ?? null
  };

  if (existing) {
    const updateData = {};

    if (data.motivoTipo !== undefined || data.reasonType !== undefined) {
      updateData.motivoTipo = itemData.motivoTipo;
    }
    if (data.motivoTexto !== undefined || data.reasonText !== undefined) {
      updateData.motivoTexto = itemData.motivoTexto;
    }
    if (data.sourceType !== undefined) {
      updateData.sourceType = itemData.sourceType;
    }
    if (data.sourceRef !== undefined) {
      updateData.sourceRef = itemData.sourceRef;
    }

    if (Object.keys(updateData).length === 0) {
      return prisma.animalWatchlistItem.findUnique({
        where: {
          id: existing.id
        },
        include: getItemInclude()
      });
    }

    return prisma.animalWatchlistItem.update({
      where: {
        id: existing.id
      },
      data: updateData,
      include: getItemInclude()
    });
  }

  return prisma.animalWatchlistItem.create({
    data: {
      ...itemData,
      userId,
      cuentaGanaderaId,
      animalId: Number(data.animalId)
    },
    include: getItemInclude()
  });
}

async function markRead(userId, cuentaGanaderaId, data = {}) {
  const code = normalizeEarTag(data.crotal || data.code || data.earTag);

  if (!code) {
    throw new AppError('Debe indicarse un crotal valido', 400);
  }

  const now = new Date();
  const matches = await prisma.animalWatchlistItem.findMany({
    where: {
      userId,
      cuentaGanaderaId,
      animal: {
        OR: [
          {
            crotal: code
          },
          {
            numeroInterno: {
              equals: code,
              mode: 'insensitive'
            }
          }
        ]
      }
    },
    include: getItemInclude()
  });

  if (matches.length === 0) {
    return {
      matched: false,
      data: [],
      code
    };
  }

  const updatedItems = [];

  for (const item of matches) {
    updatedItems.push(
      await prisma.animalWatchlistItem.update({
        where: {
          id: item.id
        },
        data: {
          seenAt: item.seenAt || now,
          lastReadAt: now,
          seenCount: {
            increment: 1
          }
        },
        include: getItemInclude()
      })
    );
  }

  return {
    matched: true,
    data: updatedItems,
    code
  };
}

async function deleteItem(id, userId, cuentaGanaderaId) {
  const item = await prisma.animalWatchlistItem.findFirst({
    where: {
      id: Number(id),
      userId,
      cuentaGanaderaId
    }
  });

  if (!item) {
    throw new AppError('Animal Watchlist item no encontrado', 404);
  }

  await prisma.animalWatchlistItem.delete({
    where: {
      id: item.id
    }
  });

  return {
    deleted: true,
    id: item.id
  };
}

async function clearItems(userId, cuentaGanaderaId) {
  const result = await prisma.animalWatchlistItem.deleteMany({
    where: {
      userId,
      cuentaGanaderaId
    }
  });

  return {
    deleted: result.count
  };
}

module.exports = {
  listItems,
  addItem,
  markRead,
  deleteItem,
  clearItems
};
