# Flujo de confirmacion de acciones

## Resumen
*documento pendiente de rutas finales*

Describe el flujo que debe seguir la IA antes de ejecutar acciones sensibles: movimientos, bajas, tratamientos, cambios de estado y recordatorios importantes. El ejemplo principal es movimiento por lote. Los endpoints y nombres exactos quedan pendientes de implementacion final.

## Reglas operativas
- Paso 1: detectar intencion. Ejemplo: "mueve estas ovejas al corral X". La IA identifica movimiento y datos necesarios: animales, destino, fecha/hora y posible cambio de estado.
- Paso 2: pedir datos faltantes. Si no hay crotales, pedir lectura RFID o lista manual. Si falta destino, pedir corral/lote concreto.
- Paso 3: validar animales. Clasificar encontrados, no encontrados, duplicados, dados de baja, ya en destino, con retirada, en tratamiento, en lazareto o con aviso sanitario.
- Paso 4: mostrar resumen previo. Debe incluir numero de animales, incidencias, origen actual, destino propuesto, cambios de estado sugeridos y advertencias.
- Paso 5: pedir confirmacion. En acciones criticas debe ser explicita y reforzada. Respuestas ambiguas no deben ejecutar bajas, tratamientos con retirada ni muertes.
- Paso 6: ejecutar solo tras confirmacion y cuando existan rutas finales. La IA no debe prometer ejecucion si no hay respuesta real del backend.
- Paso 7: comunicar resultado real. Indicar exitos, fallos, animales omitidos, errores de permisos y elementos pendientes.
- Si el usuario cancela, no se modifica nada. Puede quedar borrador si el sistema lo permite, marcado como no ejecutado.
- Si el usuario cambia destino o lista de animales, reiniciar resumen y confirmacion. Nada de reciclar confirmaciones viejas, que luego vienen fantasmas en la base de datos.
- La respuesta visible no debe ensenar rutas, metodos HTTP ni payloads salvo que el usuario pida "endpoints", "rutas" o informacion tecnica. El ganadero debe ver: que accion se ha entendido, que animal/lote afecta, que falta y que debe confirmar.

## Casos frecuentes
- Mueve estas a paridas: pedir crotales, validar, resumir y confirmar.
- He leido estos crotales: usar lectura como seleccion provisional y preguntar accion.
- Quita los no encontrados y sigue: recalcular lote valido y pedir nueva confirmacion.
- Registra tratamiento a todo el corral: validar animales, producto, dosis, via, retirada y confirmar reforzado.
- "DEMOAUTO001 pasame ese animal a secado": preparar movimiento de DEMOAUTO001 a secado. Si falta corral real o unidad REGA, decirlo en lenguaje natural y pedir confirmacion.
- "Da de baja a DEMOAUTO001" -> pedir motivo y fecha. Si responde "por muerte" -> guardar motivo y pedir fecha. Si responde "hoy" -> preparar baja con fecha hoy y pedir confirmacion final. Si dice "hoy y no hay mas causas" -> observaciones "sin causa adicional".
- Las continuaciones cortas ("hoy", "por muerte", "sin mas causas", "confirmo") pertenecen al ultimo borrador de accion si la conversacion anterior lo deja claro.
- Mientras la ejecucion definitiva desde chat este pausada, una confirmacion clara debe responder "confirmacion recibida" y dejar el borrador pendiente, sin modificar datos reales.

## Limites y cautelas
Este documento no fija endpoints ni payloads definitivos. La IA debe respetar permisos, auditoria y validaciones del backend. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: flujo de confirmacion de acciones.
- Decision de producto: confirmar antes de modificar datos.
- Estado tecnico: documento pendiente de rutas finales.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
