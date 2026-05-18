const prisma = require('../config/prisma');

async function getCatalogs(cuentaGanaderaId) {
  const [
    farmUnits,
    species,
    breeds,
    reproductiveStatuses,
    pens,
    diseases
  ] = await Promise.all([
    prisma.unidadRega.findMany({
      where: {
        cuentaGanaderaId,
        activa: true
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
    })
  ]);

  return {
    farmUnits,
    species,
    breeds,
    reproductiveStatuses,
    pens,
    diseases
  };
}

module.exports = {
  getCatalogs
};