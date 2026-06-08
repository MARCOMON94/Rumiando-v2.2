# Corrales, lotes y estados productivos

## Resumen
Este documento diferencia corral fisico, lote de manejo y estado productivo, reproductivo o sanitario. Evita errores como pensar que mover a lazareto diagnostica una enfermedad o que mover a paridera confirma parto. La IA debe explicar estos conceptos en lenguaje de ganadero y ayudar a mantener trazabilidad.

## Reglas operativas
- Corral fisico es ubicacion real: nave, patio, paridera, lazareto, recria, cebo, exterior o cercado. Responde a donde esta el animal.
- Lote es agrupacion de manejo: cubricion, secado, cebo, reposicion, tratamiento, vacunacion o recria. Responde a con quienes se maneja.
- Estado describe situacion: gestante, lactacion, produccion, cebo, reposicion, enferma, en observacion, tratamiento activo, retirada, baja o diagnostico pendiente.
- Un animal puede estar fisicamente en Nave 2, pertenecer al lote produccion y tener estado lactacion. Mezclar todo en una sola etiqueta es comodo hasta que la base de datos empieza a contar cuentos.
- Mover a lazareto significa aislamiento fisico. Puede sugerir estado sanitario, pero no debe aplicarse sin confirmacion.
- Mover a paridera puede sugerir proxima a parto, parida o vigilancia, pero no confirma gestacion ni parto. La IA debe preguntar motivo o proponer cambio de estado.
- Mover a cebo puede sugerir estado productivo cebo, pero se debe confirmar si el usuario quiere tambien cambiar estado.
- Los estados reproductivos deben tener fecha de inicio para calcular avisos. Los estados sanitarios deben relacionarse con caso, tratamiento o observacion.
- El lazareto no debe convertirse en cajon desastre. Debe registrarse motivo de entrada y recordatorio de revision.

## Casos frecuentes
- Esta enferma porque esta en lazareto: responder que lazareto indica aislamiento, no diagnostico.
- Quiero ver las de cebo: preguntar si quiere corral de cebo, lote de cebo o estado productivo cebo si hay ambigüedad.
- Movi una oveja a paridera: sugerir revisar estado reproductivo y crear aviso de parto si procede.
- Una cabra esta en produccion pero en otro corral: explicar que ubicacion y estado pueden ser distintos.

## Limites y cautelas
Los nombres exactos de estados y lotes dependen del modelo final de RumiAndo y de cada explotacion. Cambios criticos requieren confirmacion. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: diferenciar corral fisico y estados.
- Decision de producto: evitar cambios automaticos de estado por movimiento fisico.
- Modelo funcional interno de RumiAndo pendiente de ajuste final.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
