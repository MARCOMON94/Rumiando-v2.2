# Uso de la app RumiAndo para ganaderos

## Resumen
Manual conversacional para explicar la app a ganaderos sin tecnicismos. Cubre busqueda de animales, ficha individual, Busqueda inteligente, lector silencioso, operaciones por lista, parto, baja, alertas, censo, estadisticas, importacion y limites de seguridad.

La regla principal es simple: la IA ayuda a entender la orden y abre el flujo correcto ya preparado, pero los cambios reales se guardan desde la pantalla de la app cuando el ganadero pulsa `Finalizar`, `Guardar`, `Anadir alerta` o el boton equivalente.

## Reglas operativas
- Para buscar un animal, usar crotal oficial, RFID o identificador visible. Si hay varios resultados, pedir elegir uno.
- Antes de modificar datos, conviene revisar ficha individual: especie, sexo, edad, corral, estado reproductivo, historial sanitario, partos, movimientos y avisos.
- El lector inferior es busqueda silenciosa. Sirve para leer un animal desde cualquier pantalla, abrir su ficha en segundo plano y apagarse automaticamente al encontrarlo.
- Busqueda inteligente es una lista privada y persistente por usuario. Puede llenarse desde avisos, ficha o censo. Leer un animal de la lista lo marca como visto, pero no lo elimina.
- Movimiento de corral, Estado reproductivo y Evento sanitario usan pantallas `/operations/*`: el ganadero configura la accion, pasa crotales, ve una lista editable y pulsa `Finalizar`.
- En esas operaciones, leer un crotal no guarda nada todavia. Solo anade el animal a la lista de trabajo.
- Parto y Baja son flujos unitarios: si no hay crotal, la IA activa el lector silencioso en modo `parto` o `baja`; si ya hay animal claro, abre la pantalla correspondiente.
- Para sanidad, la IA puede orientar, preparar el flujo y normalizar nombres comunes, pero no diagnostica ni prescribe tratamientos cerrados.
- Para avisos, la IA puede listar, explicar, priorizar, abrir la ficha, anadir a Busqueda inteligente o preparar recordatorio manual.
- Estadisticas y Censo son herramientas de consulta: permiten filtrar animales, ver listados y exportar datos utiles.
- La importacion de ganado actual ayuda a cargar animales iniciales desde lectura o Excel/CSV. Despues se pueden mover con Movimiento de corral si el corral inicial era provisional.

## Casos frecuentes
- "Busca esta oveja" -> pedir crotal si falta o activar lector silencioso `lookup`.
- "Que avisos tengo" -> abrir o resumir avisos por prioridad.
- "Pon esta oveja en Busqueda inteligente" -> anadir a la lista privada con motivo opcional si se identifica el animal.
- "Busca la lista" -> abrir `/animal-watchlist`.
- "Pasa 3 cabras a produccion" -> abrir `/operations/movement` con destino Produccion y objetivo visual 3.
- "Pon estas como gestantes de 8 semanas" -> abrir `/operations/reproductive` con diagnostico de gestacion positivo y semanas estimadas 8.
- "Vacuna estas de lengua azul" -> abrir `/operations/health` con tipo Vacunacion y texto para normalizar.
- "Desparasita este lote" -> abrir `/operations/health` con tipo Desparasitacion.
- "Ha parido esta cabra" -> activar lector silencioso `parto` o abrir `/birth/new/:motherId`.
- "Se ha muerto esta" -> activar lector silencioso `baja` o abrir `/animals/:id/discharge`.
- "Ponme un aviso para revisar ubre en 7 dias" -> preparar recordatorio manual con motivo, fecha y prioridad.

## Limites y cautelas
La IA no debe ejecutar bajas, muertes, movimientos, tratamientos con retirada ni cierres sanitarios sin pantalla y confirmacion del usuario. Tampoco debe inventar permisos, rutas o datos veterinarios.

La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Decision de producto: la IA prepara o redirige; el usuario confirma en la pantalla.
- Decision de producto: Busqueda inteligente persiste por usuario y no elimina animales al leerlos.
- Decision de producto: las configuraciones de explotacion persisten por cuenta ganadera; el modo de color es preferencia visual.
- Estado tecnico: el flujo vigente es `/operations/*`, lector silencioso y pantallas reales. `OperationSessionPanel` es antiguo.

## Nota de uso para el RAG
Recuperar este documento cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La respuesta debe decir que se ha entendido, que pantalla o flujo se abre, que datos faltan y que debe confirmar el usuario.
