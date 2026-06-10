import { createContext, useContext, useState } from 'react';

const OperationSessionContext = createContext(null);

function normalizeAnimalKey(animal) {
  return String(animal?.id || animal?.crotal || animal?.numeroInterno || '').toUpperCase();
}

function uniqueAnimals(animals) {
  const seen = new Set();
  const result = [];

  for (const animal of animals || []) {
    const key = normalizeAnimalKey(animal);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(animal);
  }

  return result;
}

function uniquePens(pens) {
  const seen = new Set();
  const result = [];

  for (const pen of pens || []) {
    const key = String(pen?.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(pen);
  }

  return result;
}

function createSession(config = {}) {
  return {
    id: `operation-${Date.now()}`,
    operationType: config.operationType || 'corral',
    mode: config.mode || 'lote',
    selectedAnimals: uniqueAnimals(config.selectedAnimals),
    selectedPens: uniquePens(config.selectedPens),
    unknownCodes: config.unknownCodes || [],
    duplicateCodes: config.duplicateCodes || [],
    operationData: config.operationData || {},
    source: config.source || 'home',
    status: config.status || 'draft',
    message: config.message || ''
  };
}

export function OperationSessionProvider({ children }) {
  const [session, setSession] = useState(null);

  function startOperation(config = {}) {
    const nextSession = createSession(config);
    setSession(nextSession);
    return nextSession;
  }

  function patchSession(patch) {
    setSession((current) => {
      if (!current) return current;
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return {
        ...current,
        ...nextPatch
      };
    });
  }

  function setMode(mode) {
    patchSession({
      mode,
      selectedAnimals: [],
      selectedPens: [],
      unknownCodes: [],
      duplicateCodes: [],
      status: 'reading'
    });
  }

  function setOperationData(data) {
    patchSession((current) => ({
      operationData: {
        ...current.operationData,
        ...data
      }
    }));
  }

  function addAnimals(animals) {
    patchSession((current) => ({
      selectedAnimals: uniqueAnimals([...(current.selectedAnimals || []), ...(animals || [])])
    }));
  }

  function setAnimals(animals) {
    patchSession({
      selectedAnimals: uniqueAnimals(animals)
    });
  }

  function setPens(pens) {
    patchSession({
      selectedPens: uniquePens(pens)
    });
  }

  function finishReading(draft = {}) {
    patchSession((current) => ({
      mode: draft.mode || current.mode,
      selectedAnimals: uniqueAnimals([...(current.selectedAnimals || []), ...(draft.animals || [])]),
      selectedPens: uniquePens(draft.pens || current.selectedPens || []),
      unknownCodes: draft.unknownCodes || [],
      duplicateCodes: draft.duplicateCodes || [],
      status: 'ready'
    }));
  }

  function clearOperation() {
    setSession(null);
  }

  const value = {
    session,
    startOperation,
    patchSession,
    setMode,
    setOperationData,
    addAnimals,
    setAnimals,
    setPens,
    finishReading,
    clearOperation
  };

  return (
    <OperationSessionContext.Provider value={value}>
      {children}
    </OperationSessionContext.Provider>
  );
}

export function useOperationSession() {
  return useContext(OperationSessionContext);
}
