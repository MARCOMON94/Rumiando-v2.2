import { createContext, useContext, useEffect, useState } from 'react';
import { get } from '../api/apiClient';

const CatalogsContext = createContext(null);

function getArray(data, possibleKeys) {
  for (const key of possibleKeys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

export function CatalogsProvider({ children }) {
  const [catalogs, setCatalogs] = useState({
    farmUnits: [],
    species: [],
    breeds: [],
    pens: [],
    reproductiveStatuses: [],
    diseases: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadCatalogs() {
    setLoading(true);
    setError('');

    try {
      const data = await get('/catalogs');

      setCatalogs({
        farmUnits: getArray(data, ['farmUnits', 'unidadesRega', 'unidades']),
        species: getArray(data, ['species', 'especies']),
        breeds: getArray(data, ['breeds', 'razas']),
        pens: getArray(data, ['pens', 'corrales']),
        reproductiveStatuses: getArray(data, ['reproductiveStatuses', 'estadosReproductivos']),
        diseases: getArray(data, ['diseases', 'enfermedades'])
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs();
  }, []);

  const value = {
    catalogs,
    loading,
    error,
    loadCatalogs
  };

  return (
    <CatalogsContext.Provider value={value}>
      {children}
    </CatalogsContext.Provider>
  );
}

export function useCatalogs() {
  return useContext(CatalogsContext);
}