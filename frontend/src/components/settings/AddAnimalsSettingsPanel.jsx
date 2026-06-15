import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { post } from '../../api/apiClient';
import { useCatalogs } from '../../context/CatalogsContext';
import useReaderCapture from '../../hooks/useReaderCapture';

const SEX_OPTIONS = [
  ['HEMBRA', 'Hembra'],
  ['MACHO', 'Macho'],
  ['CASTRADO', 'Castrado'],
  ['DESCONOCIDO', 'Desconocido']
];

const FIELD_OPTIONS = [
  ['crotal', 'Crotal'],
  ['sexo', 'Sexo'],
  ['fechaNacimiento', 'Fecha nacimiento'],
  ['numeroInterno', 'Número interno'],
  ['ignore', 'Ignorar']
];

function normalizeCode(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeCode)
    .filter(Boolean);
}

function initialBirthParts() {
  const year = new Date().getFullYear();
  return {
    day: '1',
    month: '1',
    year: String(year)
  };
}

function buildDate(parts) {
  const year = Number(parts.year);
  const month = String(Number(parts.month)).padStart(2, '0');
  const day = String(Number(parts.day)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function splitDelimitedLine(line) {
  const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
  const values = [];
  let current = '';
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseTableText(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = splitDelimitedLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });

  return { headers, rows };
}

function tableArraysToObjects(rawRows) {
  const rows = (rawRows || [])
    .map((row) => (Array.isArray(row) ? row : []))
    .map((row) => row.map((value) => (value == null ? '' : String(value).trim())))
    .filter((row) => row.some(Boolean));

  if (rows.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const objects = rows.slice(1).map((row) => (
    Object.fromEntries(headers.map((header, index) => [header, row[index] || '']))
  ));

  return { headers, rows: objects };
}

function guessField(header) {
  const normalized = normalizeHeader(header);
  if (['crotal', 'identificacion', 'identificacion oficial', 'id oficial', 'numero crotal'].includes(normalized)) {
    return 'crotal';
  }
  if (['sexo', 'genero', 'gender', 'sex'].includes(normalized)) return 'sexo';
  if (['fecha nacimiento', 'nacimiento', 'fecha nac', 'f nacimiento', 'date birth'].includes(normalized)) {
    return 'fechaNacimiento';
  }
  if (['numero interno', 'id interno', 'identificador interno'].includes(normalized)) return 'numeroInterno';
  return 'ignore';
}

function suggestedImportMap(headers) {
  const next = {};
  for (const header of headers) {
    const field = guessField(header);
    if (field !== 'ignore' && !next[field]) {
      next[field] = header;
    }
  }
  return next;
}

function importFieldOptions() {
  return FIELD_OPTIONS.filter(([value]) => value !== 'ignore');
}

function normalizeSex(value) {
  const normalized = normalizeHeader(value);
  if (['h', 'hembra', 'f', 'female'].includes(normalized)) return 'HEMBRA';
  if (['m', 'macho', 'male'].includes(normalized)) return 'MACHO';
  if (['castrado', 'castrada'].includes(normalized)) return 'CASTRADO';
  return 'DESCONOCIDO';
}

function normalizeDate(value, fallback) {
  if (!value) return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const clean = String(value).trim();
  const iso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  const spanish = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (spanish) {
    const year = spanish[3].length === 2 ? `20${spanish[3]}` : spanish[3];
    return `${year}-${spanish[2].padStart(2, '0')}-${spanish[1].padStart(2, '0')}`;
  }
  return fallback;
}

function farmUnitLabel(unit) {
  const suffix = [unit.especiePrincipal?.nombre, unit.razaPrincipal?.nombre].filter(Boolean).join(' · ');
  const base = unit.nombre || unit.codigoRega || `REGA ${unit.id}`;
  return suffix ? `${base} (${suffix})` : base;
}

function isReaderInteractiveElement(element) {
  return Boolean(element?.closest?.(
    'input:not([data-reader-capture="true"]), textarea, select, button, a[href], [contenteditable="true"], [role="button"]'
  ));
}

export default function AddAnimalsSettingsPanel() {
  const { catalogs, loading, error: catalogsError, loadCatalogs } = useCatalogs();
  const readerInputRef = useRef(null);
  const readerBufferRef = useRef('');
  const readerTimerRef = useRef(null);

  const [mode, setMode] = useState('reader');
  const [unitId, setUnitId] = useState('');
  const [penId, setPenId] = useState('');
  const [sex, setSex] = useState('HEMBRA');
  const [birthParts, setBirthParts] = useState(initialBirthParts);
  const [readerItems, setReaderItems] = useState([]);
  const [flashKey, setFlashKey] = useState(0);
  const [readerActivationFallback, setReaderActivationFallback] = useState(false);
  const [readerMessage, setReaderMessage] = useState('Pasa crotales y se irán añadiendo a la lista.');
  const [fileRows, setFileRows] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, index) => currentYear - index);
  const selectedUnit = catalogs.farmUnits.find((unit) => String(unit.id) === String(unitId));
  const selectedPen = catalogs.pens.find((pen) => String(pen.id) === String(penId));

  const focusReader = useCallback(function focusReader() {
    if (mode !== 'reader') return;
    window.setTimeout(() => {
      const target = readerInputRef.current;
      if (!target) return;
      if (isReaderInteractiveElement(document.activeElement)) return;

      target.focus({ preventScroll: true });
      if (document.activeElement === target) {
        setReaderActivationFallback(false);
      }
    }, 0);
  }, [mode]);

  const pensForUnit = useMemo(() => {
    if (!unitId) return [];
    return catalogs.pens.filter((pen) => Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(unitId));
  }, [catalogs.pens, unitId]);

  useEffect(() => {
    if (!unitId && catalogs.farmUnits.length > 0) {
      setUnitId(String(catalogs.farmUnits[0].id));
    }
  }, [catalogs.farmUnits, unitId]);

  useEffect(() => {
    if (!unitId) return;
    setPenId((current) => {
      if (current && pensForUnit.some((pen) => String(pen.id) === String(current))) return current;
      const productionPen = pensForUnit.find((pen) => normalizeHeader(pen.nombre) === 'produccion');
      return String(productionPen?.id || pensForUnit[0]?.id || '');
    });
  }, [pensForUnit, unitId]);

  useEffect(() => {
    if (mode !== 'reader') return undefined;

    setReaderActivationFallback(false);
    focusReader();
    const timer = window.setTimeout(() => {
      const target = readerInputRef.current;
      const activeElement = document.activeElement;
      const activeIsManualField = activeElement?.closest?.(
        'input:not([data-reader-capture="true"]), textarea, select, [contenteditable="true"]'
      );

      if (target && activeElement !== target && !activeIsManualField) {
        setReaderActivationFallback(true);
      }
    }, 650);

    return () => {
      window.clearTimeout(readerTimerRef.current);
      window.clearTimeout(timer);
    };
  }, [focusReader, mode]);

  function setBirthField(name, value) {
    setBirthParts((current) => ({
      ...current,
      [name]: value
    }));
  }

  const addCodes = useCallback(function addCodes(rawCodes) {
    const codes = Array.isArray(rawCodes) ? rawCodes : extractCodes(rawCodes);
    if (!codes.length) return;

    let added = 0;
    let repeated = 0;
    setReaderItems((current) => {
      const known = new Set(current.map((item) => item.crotal));
      const next = [...current];
      for (const code of codes) {
        if (known.has(code)) {
          repeated++;
          continue;
        }
        known.add(code);
        next.push({ crotal: code, sexo: sex });
        added++;
      }
      return next;
    });
    setReaderMessage(added
      ? `${added} añadido${added === 1 ? '' : 's'}${repeated ? ` · ${repeated} repetido${repeated === 1 ? '' : 's'}` : ''}`
      : 'Pasa crotales y se irán añadiendo a la lista.');
    if (added > 0) {
      setFlashKey((current) => current + 1);
    }
  }, [sex]);

  useReaderCapture({
    active: mode === 'reader',
    delay: 160,
    extractCodes,
    onCodes: addCodes,
    shouldCaptureIgnoredPaste: () => false,
    shouldIgnoreTarget: isReaderInteractiveElement
  });

  function flushReaderBuffer() {
    const raw = readerBufferRef.current;
    readerBufferRef.current = '';
    window.clearTimeout(readerTimerRef.current);
    addCodes(extractCodes(raw));
  }

  function handleReaderKeyDown(event) {
    const finishKey = event.key === 'Enter' || event.key === 'Tab';
    const characterKey = event.key.length === 1;
    if (!finishKey && !characterKey && event.key !== 'Backspace') return;

    event.preventDefault();
    if (finishKey) {
      flushReaderBuffer();
      return;
    }
    if (event.key === 'Backspace') {
      readerBufferRef.current = readerBufferRef.current.slice(0, -1);
      return;
    }
    readerBufferRef.current += event.key;
    window.clearTimeout(readerTimerRef.current);
    readerTimerRef.current = window.setTimeout(flushReaderBuffer, 180);
  }

  function updateReaderItem(crotal, field, value) {
    setReaderItems((current) => current.map((item) => (
      item.crotal === crotal ? { ...item, [field]: value } : item
    )));
  }

  function removeReaderItem(crotal) {
    setReaderItems((current) => current.filter((item) => item.crotal !== crotal));
  }

  function validateCommon() {
    if (!selectedUnit?.id) throw new Error('Selecciona una REGA.');
    if (!selectedUnit.especiePrincipalId && !selectedUnit.especiePrincipal?.id) {
      throw new Error('La REGA necesita especie asociada antes de dar altas.');
    }
    if (!selectedPen?.id) throw new Error('Selecciona el corral inicial.');
  }

  function basePayload() {
    return {
      unidadRegaId: Number(selectedUnit.id),
      especieId: Number(selectedUnit.especiePrincipalId || selectedUnit.especiePrincipal?.id),
      razaId: selectedUnit.razaPrincipalId || selectedUnit.razaPrincipal?.id || null,
      corralActualId: Number(selectedPen.id),
      fechaEntradaCorralActual: new Date().toISOString(),
      fechaEntrada: new Date().toISOString(),
      origen: 'Importación / alta posterior'
    };
  }

  async function createAnimals(items, options = {}) {
    const useDefaultBirthDate = options.useDefaultBirthDate !== false;

    try {
      validateCommon();
    setSaving(true);
    setFormError('');
    setMessage('');

    const fallbackBirthDate = useDefaultBirthDate ? buildDate(birthParts) : '';
    let created = 0;
    const failures = [];

    for (const item of items) {
      const crotal = normalizeCode(item.crotal);
      if (!crotal) continue;

      try {
        const birthDate = item.fechaNacimiento || fallbackBirthDate;
        await post('/animals', {
          ...basePayload(),
          crotal,
          numeroInterno: item.numeroInterno || null,
          sexo: item.sexo || 'DESCONOCIDO',
          ...(birthDate ? { fechaNacimiento: birthDate } : {})
        });
        created++;
      } catch (err) {
        failures.push(`${crotal}: ${err.message}`);
      }
    }

    await loadCatalogs?.();
    setMessage(`Animales creados: ${created}${failures.length ? `. Fallidos: ${failures.length}` : ''}.`);
    if (failures.length) setFormError(failures.slice(0, 4).join(' · '));
    if (created && mode === 'reader') setReaderItems([]);
    } catch (err) {
      setFormError(err.message || 'No se pudo crear la lista.');
    } finally {
      setSaving(false);
    }
  }

  async function submitReader(event) {
    event.preventDefault();
    await createAnimals(readerItems.map((item) => ({
      ...item,
      fechaNacimiento: buildDate(birthParts)
    })), { useDefaultBirthDate: true });
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    setFormError('');
    setMessage('');

    const parsed = [];
    let headers = [];

    for (const file of files) {
      let table;

      if (/\.(xlsx|xls)$/i.test(file.name)) {
        try {
          const XLSX = await import('xlsx');
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = sheetName ? workbook.Sheets[sheetName] : null;
          const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) : [];
          table = tableArraysToObjects(rows);
        } catch {
          setFormError(`No se pudo leer ${file.name}. Si tienes problemas con Excel, guardalo como CSV.`);
          continue;
        }
      } else if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        const text = await file.text();
        table = parseTableText(text);
      } else {
        setFormError('Formato no compatible. Usa Excel, CSV o TSV.');
        continue;
      }

      headers = headers.length ? headers : table.headers;
      parsed.push(...table.rows);
    }

    setFileHeaders(headers);
    setFileRows(parsed);
    setColumnMap(suggestedImportMap(headers));
  }

  function mappedFileItems() {
    return fileRows.map((row) => ({
      crotal: normalizeCode(row[columnMap.crotal]),
      sexo: columnMap.sexo ? normalizeSex(row[columnMap.sexo]) : sex,
      fechaNacimiento: columnMap.fechaNacimiento ? normalizeDate(row[columnMap.fechaNacimiento], '') : '',
      numeroInterno: columnMap.numeroInterno ? row[columnMap.numeroInterno] : ''
    })).filter((row) => row.crotal);
  }

  async function submitFileImport(event) {
    event.preventDefault();
    const items = mappedFileItems();
    if (!items.length) {
      setFormError('No hay filas válidas para importar.');
      return;
    }
    await createAnimals(items, { useDefaultBirthDate: false });
  }

  if (loading) return <p>Cargando catálogos...</p>;
  if (catalogsError) return <p className="alert error">{catalogsError}</p>;

  return (
    <div className="settings-add-animals-panel">
      {flashKey > 0 && <span key={flashKey} className="watchlist-screen-flash reader-green-flash" aria-hidden="true" />}

      <section className="settings-subform">
        <div className="form-grid">
          <label>
            Modo de alta
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="reader">Lista por lectura</option>
              <option value="excel">Importar Excel/CSV</option>
            </select>
          </label>

          <label>
            REGA
            <select
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value);
                focusReader();
              }}
              required
            >
              <option value="">Selecciona REGA</option>
              {catalogs.farmUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{farmUnitLabel(unit)}</option>
              ))}
            </select>
          </label>

          <label>
            Corral inicial
            <select
              value={penId}
              onChange={(event) => {
                setPenId(event.target.value);
                focusReader();
              }}
              required
            >
              <option value="">Selecciona corral</option>
              {pensForUnit.map((pen) => (
                <option key={pen.id} value={pen.id}>{pen.nombre}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted">
          Se darán de alta en este corral inicial. Después podrás moverlas con Movimiento de corral si hace falta.
        </p>

        {mode === 'reader' && (
        <div className="form-grid">
          <label>
            Día
            <select
              value={birthParts.day}
              onChange={(event) => {
                setBirthField('day', event.target.value);
              }}
            >
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
          <label>
            Mes
            <select
              value={birthParts.month}
              onChange={(event) => {
                setBirthField('month', event.target.value);
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            Año
            <select
              value={birthParts.year}
              onChange={(event) => {
                setBirthField('year', event.target.value);
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
        )}
      </section>

      {mode === 'reader' ? (
        <form className="settings-subform" onSubmit={submitReader}>
          <input
            ref={readerInputRef}
            className="batch-reader-input"
            data-reader-capture="true"
            aria-label="Lector para añadir animales"
            inputMode="none"
            autoComplete="off"
            onFocus={() => setReaderActivationFallback(false)}
            onKeyDown={handleReaderKeyDown}
            onPaste={(event) => {
              event.preventDefault();
              addCodes(extractCodes(event.clipboardData?.getData('text')));
            }}
          />
          <div className="batch-reader-status">
            <span className="batch-reader-dot" aria-hidden="true" />
            <strong>Lector activo</strong>
            <p>{readerMessage}</p>
            {readerActivationFallback && (
              <button
                type="button"
                className="batch-reader-activate"
                onClick={focusReader}
              >
                Activar lector
              </button>
            )}
          </div>
          <label>
            Sexo por defecto
            <select
              value={sex}
              onChange={(event) => {
                setSex(event.target.value);
                focusReader();
              }}
            >
              {SEX_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {readerItems.length === 0 ? (
            <p className="batch-empty-hint">Pasa crotales y se irán añadiendo a la lista.</p>
          ) : (
            <div className="batch-animal-list">
              {readerItems.map((item) => (
                <article className="batch-animal-row" key={item.crotal}>
                  <div>
                    <strong>{item.crotal}</strong>
                    <select
                      value={item.sexo}
                      onChange={(event) => {
                        updateReaderItem(item.crotal, 'sexo', event.target.value);
                        focusReader();
                      }}
                    >
                      {SEX_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" className="secondary" onClick={() => removeReaderItem(item.crotal)}>
                    Quitar
                  </button>
                </article>
              ))}
            </div>
          )}
          <button type="submit" disabled={saving || readerItems.length === 0}>
            {saving ? 'Creando...' : 'Crear animales'}
          </button>
        </form>
      ) : (
        <form className="settings-subform" onSubmit={submitFileImport}>
          <label>
            Archivo Excel/CSV
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" multiple onChange={handleFiles} />
          </label>
          <p className="muted">
            Puedes subir Excel, CSV o TSV. Si tienes problemas con un Excel, guárdalo como CSV. La app te deja confirmar qué columna es cada dato.
          </p>
          {fileHeaders.length > 0 && (
            <div className="settings-import-map">
              {importFieldOptions().map(([field, label]) => (
                <label key={field}>
                  <span>
                    {label}
                    {field === 'crotal' && <strong> obligatorio</strong>}
                  </span>
                  <select
                    value={columnMap[field] || ''}
                    onChange={(event) => setColumnMap((current) => ({
                      ...current,
                      [field]: event.target.value
                    }))}
                  >
                    <option value="">Sin columna</option>
                    {fileHeaders.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                  {field === 'sexo' && <small>Si lo dejas vacío, se usará el sexo por defecto.</small>}
                  {field === 'fechaNacimiento' && <small>Opcional. Si no viene en el Excel, queda sin fecha.</small>}
                  {field === 'numeroInterno' && <small>Opcional.</small>}
                </label>
              ))}
            </div>
          )}
          {fileRows.length > 0 && (
            <p className="alert">{mappedFileItems().length} animales preparados para importar.</p>
          )}
          <button type="submit" disabled={saving || fileRows.length === 0}>
            {saving ? 'Importando...' : 'Importar animales'}
          </button>
        </form>
      )}

      {message && <p className="alert">{message}</p>}
      {formError && <p className="alert error">{formError}</p>}
    </div>
  );
}
