export const OPERATION_DEFINITIONS = [
  {
    key: 'corral',
    label: 'Corral',
    title: 'Cambio de corral',
    readerAction: 'cambio_corral'
  },
  {
    key: 'estado_reproductivo',
    label: 'Estado reproductivo',
    title: 'Cambio de estado reproductivo',
    readerAction: 'reproduccion'
  },
  {
    key: 'sanitario',
    label: 'Sanitario',
    title: 'Caso sanitario',
    readerAction: 'sanidad'
  },
  {
    key: 'tratamiento',
    label: 'Tratamiento',
    title: 'Tratamiento',
    readerAction: 'tratamiento'
  },
  {
    key: 'vacunacion',
    label: 'Vacunacion',
    title: 'Vacunacion',
    readerAction: 'vacunacion'
  },
  {
    key: 'desparasitacion',
    label: 'Desparasitacion',
    title: 'Desparasitacion',
    readerAction: 'desparasitacion'
  },
  {
    key: 'baja',
    label: 'Baja',
    title: 'Baja por muerte',
    readerAction: 'baja_muerte'
  }
];

export const OPERATION_BY_KEY = OPERATION_DEFINITIONS.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

export function operationFromActionType(actionType) {
  if (actionType === 'ANIMAL_DISCHARGE') return 'baja';
  if (actionType === 'CHANGE_PEN') return 'corral';
  if (['CREATE_HEALTH_CASE', 'UPDATE_HEALTH_CASE'].includes(actionType)) return 'sanitario';
  if (['CREATE_TREATMENT', 'UPDATE_TREATMENT'].includes(actionType)) return 'tratamiento';
  if (['CREATE_VACCINATION', 'UPDATE_VACCINATION'].includes(actionType)) return 'vacunacion';
  if (['CREATE_DEWORMING', 'UPDATE_DEWORMING'].includes(actionType)) return 'desparasitacion';
  if (['CREATE_REPRODUCTIVE_EVENT', 'UPDATE_REPRODUCTIVE_EVENT'].includes(actionType)) return 'estado_reproductivo';
  return 'corral';
}

export function readerActionForOperation(operationType) {
  return OPERATION_BY_KEY[operationType]?.readerAction || 'cambio_corral';
}
