# Flujo de confirmacion de acciones

## Resumen
Las acciones sensibles de RumiAndo se confirman en pantallas de la app, no solo por texto del chat. La IA interpreta la intencion, abre el flujo correcto con datos prellenados y deja que el ganadero lea animales, revise la lista y pulse el boton final.

## Flujo general
- Paso 1: detectar intencion: movimiento, estado reproductivo, evento sanitario, parto, baja, Busqueda inteligente, alerta manual o consulta.
- Paso 2: recoger lo minimo: destino, estado, tipo sanitario, causa, fecha orientativa, motivo o prioridad, segun corresponda.
- Paso 3: abrir pantalla real con `ui_action`.
- Paso 4: el lector anade animales a la lista o abre ficha segun el modo activo.
- Paso 5: la pantalla valida animales encontrados, duplicados, dados de baja, fuera de REGA o con avisos sensibles.
- Paso 6: el usuario pulsa `Finalizar` o `Guardar`.
- Paso 7: la app comunica resultado real: procesados, omitidos, fallos e incidencias.

## Confirmaciones por tipo
- Movimiento de corral: confirmar destino y lista. Si hay regla de automatizacion, preguntar si se aplica tambien el cambio reproductivo.
- Estado reproductivo: confirmar estado/evento y lista. En diagnostico de gestacion, resultado por defecto positivo y semanas si se indicaron.
- Evento sanitario: confirmar tipo, producto/enfermedad, via/dosis si aplica, y lista. Normalizar nombres con catalogo/RAG y pedir confirmacion si hay duda.
- Parto: confirmar datos de crias, sexo, crotal provisional/padre opcional y movimientos posteriores.
- Baja: confirmar causa y registrar salida. Un animal en baja queda bloqueado para nuevas acciones operativas.
- Alerta manual: confirmar fecha o plazo, motivo y prioridad.
- Busqueda inteligente: anadir o quitar de lista; no resuelve automaticamente avisos.

## Casos frecuentes
- "Mueve estas a paridas" -> abrir `/operations/movement`.
- "Registra tratamiento a todo el corral" -> abrir `/operations/health`; corral completo solo existe en Evento sanitario.
- "Da de baja a DEMOAUTO001 por muerte" -> si se localiza, abrir `/animals/:id/discharge` con causa muerte.
- "Ha parido esta oveja" -> activar lector silencioso `parto` si falta animal.
- "Confirmo" en chat no debe ejecutar cambios legacy si no hay pantalla activa. Debe guiar al usuario a pulsar el boton final de la pantalla.

## Limites y cautelas
La IA debe respetar permisos, auditoria y validaciones del backend. No debe ocultar incidencias ni saltarse la pantalla de confirmacion. En sanidad, retirada, enfermedad de declaracion obligatoria, aborto, mortalidad o varios animales afectados, recomendar veterinario o autoridad competente segun el caso.

## Fuentes internas
- Decision de producto: confirmar desde UI, no ejecutar directamente desde chat.
- Decision de producto: las operaciones vigentes son `/operations/movement`, `/operations/reproductive` y `/operations/health`.
- Decision de producto: `OperationSessionPanel` es flujo antiguo y no debe reactivarse.

## Nota de uso para el RAG
Recuperar este documento cuando el usuario quiera registrar, finalizar, confirmar o ejecutar una accion. La respuesta debe ser prudente: explicar que se abrira la pantalla correspondiente y que el registro real ocurre al pulsar el boton final.
