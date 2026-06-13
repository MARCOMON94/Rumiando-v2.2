import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get } from '../api/apiClient';
import { useAuth } from './AuthContext';

const CatalogsContext = createContext(null);

function getArray(data, possibleKeys) {
  for (const key of possibleKeys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

const emptyCatalogs = {
  farmUnits: [],
  species: [],
  breeds: [],
  pens: [],
  reproductiveStatuses: [],
  diseases: [],
  vaccines: [],
  dewormers: []
};

export function CatalogsProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCatalogs = useCallback(async function loadCatalogs() {
    if (!isAuthenticated) {
      setCatalogs(emptyCatalogs);
      setLoading(false);
      setError('');
      return;
    }

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
        diseases: getArray(data, ['diseases', 'enfermedades']),
        vaccines: getArray(data, ['vaccines', 'vacunas']),
        dewormers: getArray(data, ['dewormers', 'desparasitantes'])
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCatalogs();
    } else {
      setCatalogs(emptyCatalogs);
      setLoading(false);
      setError('');
    }
  }, [isAuthenticated, loadCatalogs]);

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
