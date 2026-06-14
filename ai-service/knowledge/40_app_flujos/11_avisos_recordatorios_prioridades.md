# Avisos, recordatorios y prioridades

## Resumen
Este documento explica como responder cuando el ganadero pregunta por avisos: "por que me dice que revise esta oveja?", "que es urgente hoy?" o "ponme un aviso para manana". Distingue avisos automaticos y recordatorios manuales. Cubre avisos reproductivos, sanitarios, retirada, vacunacion, desparasitacion, animales sin parto, diagnostico pendiente y tratamientos activos.

## Reglas operativas
- Un aviso automatico nace de una regla: dias desde cubricion, parto estimado, tratamiento con retirada, vacuna proxima, diagnostico pendiente, animal en lazareto, hembra sin parto o revision sanitaria.
- Un recordatorio manual nace de una orden del usuario: revisar pezuna, mirar ubre, llamar al veterinario, repetir ecografia. No implica diagnostico.
- La IA debe explicar el dato que disparo el aviso: fecha, evento, estado, tratamiento, lote o configuracion. No debe decir "porque esta mal" si solo falta confirmar gestacion.
- Prioridad alta: retirada activa, posible enfermedad grave, parto complicado, aborto, mortalidad, tratamiento activo, sospecha de enfermedad de declaracion obligatoria o varios animales afectados.
- Prioridad media: revision de gestacion, vacuna proxima, desparasitacion programada, posparto, animal en observacion o lazareto sin gravedad.
- Prioridad baja: tareas rutinarias, datos incompletos, limpieza de ficha o recordatorios informativos.
- Los avisos de retirada son criticos. Deben mostrar producto, animales afectados, fecha de inicio y fecha final calculada. No autorizar leche/carne antes de fin validado.
- Los avisos reproductivos dependen de fechas exactas. Si la cubricion es dudosa, la IA debe advertir que el calculo puede fallar.
- Los avisos sanitarios no diagnostican. Indican necesidad de revisar signos, evolucion y numero de afectados.
- Desde un aviso se puede anadir el animal a Busqueda inteligente con el motivo del aviso. Esto ayuda a localizarlo fisicamente; no completa ni elimina el aviso automatico.

## Casos frecuentes
- "Por que revisar esta oveja?" -> responder con el evento concreto que genero aviso y el tiempo transcurrido si esta disponible.
- "Quita este aviso" -> si es manual, puede completarse o posponerse; si es automatico, explicar que desaparece al resolver el dato que lo genera.
- "Posponlo tres dias" -> preparar posposicion si no es critico. En criticos, advertir riesgo.
- "Buscame las que tienen aviso" -> anadir a Busqueda inteligente o abrir `/animal-watchlist`, manteniendo el motivo visible.
- "Que es urgente hoy?" -> ordenar por retirada, parto, enfermedad, tratamientos, abortos, mortalidad y prioridad configurada.
- "Avisame en 7 dias de revisar ubre" -> preparar alerta manual con plazo 7 dias, motivo y prioridad.

## Limites y cautelas
La IA no debe ocultar avisos criticos por comodidad. Las reglas deben configurarse por explotacion y criterio veterinario. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: avisos reproductivos, sanitarios, retirada, vacunacion y desparasitacion.
- Decision de producto: separar aviso automatico de recordatorio manual.
- Decision de producto: Busqueda inteligente puede nacer desde avisos, pero no cambia la regla que genera el aviso.
- Decision de producto: el nombre tecnico interno puede seguir siendo `animal-watchlist`, pero al ganadero se le habla de Busqueda inteligente.

## Nota de uso para el RAG
Recuperar este documento cuando la pregunta trate de avisos, recordatorios, campana, prioridades, tareas pendientes, revisar animales o Busqueda inteligente desde avisos.
