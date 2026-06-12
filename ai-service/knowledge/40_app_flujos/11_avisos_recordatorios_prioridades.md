# Avisos, recordatorios y prioridades

## Resumen
Este documento explica como responder cuando el ganadero pregunta por avisos: "¿por que me dice que revise esta oveja?". Distingue avisos automaticos y recordatorios manuales. Cubre avisos reproductivos, sanitarios, retirada, vacunacion, desparasitacion, animales sin parto, diagnostico pendiente y tratamientos activos.

## Reglas operativas
- Un aviso automatico nace de una regla: dias desde cubricion, parto estimado, tratamiento con retirada, vacuna proxima, diagnostico pendiente, animal en lazareto, hembra sin parto o revision sanitaria.
- Un recordatorio manual nace de una orden del usuario: revisar pezuña, mirar ubre, llamar al veterinario, repetir ecografia. No implica diagnostico.
- La IA debe explicar el dato que disparo el aviso: fecha, evento, estado, tratamiento, lote o configuracion. No debe decir "porque esta mal" si solo falta confirmar gestacion.
- Prioridad alta: retirada activa, posible enfermedad grave, parto complicado, aborto, mortalidad, tratamiento activo, sospecha EDO o varios animales afectados.
- Prioridad media: revision de gestacion, vacuna proxima, desparasitacion programada, posparto, animal en observacion o lazareto sin gravedad.
- Prioridad baja: tareas rutinarias, datos incompletos, limpieza de ficha o recordatorios informativos.
- Los avisos de retirada son criticos. Deben mostrar producto, animales afectados, fecha de inicio y fecha final calculada. No autorizar leche/carne antes de fin validado.
- Los avisos reproductivos dependen de fechas exactas. Si la cubricion es dudosa, la IA debe advertir que el calculo puede fallar.
- Los avisos sanitarios no diagnostican. Indican necesidad de revisar signos, evolucion y numero de afectados.
- Desde un aviso se puede anadir el animal a Animal Watchlist con el motivo del aviso. Esto solo ayuda a localizarlo fisicamente; no completa ni elimina el aviso automatico.

## Casos frecuentes
- Por que revisar esta oveja: responder con el evento concreto que genero aviso.
- Quita este aviso: si es manual, puede completarse o posponerse; si es automatico, explicar que desaparece al resolver el dato.
- Posponlo tres dias: preparar posposicion si no es critico. En criticos, advertir riesgo.
- Buscame las que tienen aviso: anadir los animales necesarios a Animal Watchlist o abrir la lista, manteniendo el motivo visible.
- Que es urgente hoy: ordenar por retirada, parto, enfermedad, tratamientos, abortos y mortalidad.

## Limites y cautelas
La IA no debe ocultar avisos criticos por comodidad. Las reglas deben configurarse por explotacion y criterio veterinario. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: avisos reproductivos, sanitarios, retirada, vacunacion y desparasitacion.
- Decision de producto: separar aviso automatico de recordatorio manual.
- Decision de producto: Animal Watchlist puede nacer desde avisos, pero no cambia la regla que genera el aviso.
- Modelo futuro: permitir posponer y registrar historial de avisos.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
