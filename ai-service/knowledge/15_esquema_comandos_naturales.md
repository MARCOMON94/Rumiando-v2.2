# Esquema de comandos naturales

## Resumen
Recopila frases que el ganadero podria usar con la IA y como interpretarlas. Sirve para entrenar o guiar el parser de intenciones: movimientos, busquedas, avisos, reproduccion, sanidad, tratamientos y dashboard. No define endpoints finales; traduce lenguaje natural a intencion, datos requeridos y siguiente paso seguro.

## Reglas operativas
- Comandos de movimiento usan pasar, meter, llevar, apartar, sacar o mover: "pasa estas al corral de paridas", "mete estas en cebo", "estas van al lazareto". Intencion: preparar movimiento.
- Para movimientos, datos requeridos: animales, destino y si implica cambio de estado. Si falta algo, preguntar. Ejecucion pendiente de rutas finales y confirmacion.
- Comandos de busqueda: "busca esta oveja", "donde esta la 3482", "enseñame su ficha". Intencion: lectura. Requiere crotal, RFID o seleccion.
- Comandos reproductivos: "cuanto lleva preñada", "cuando deberia parir", "ponla como cubierta", "ha abortado". Distinguir consulta de cambio de estado.
- Comandos sanitarios: "no come", "esta tumbada", "tiene diarrea", "tose", "cojea", "creo que tiene lengua azul". Intencion: orientacion sanitaria o caso/aviso.
- Comandos de tratamiento: "le puse antibiotico", "vacune estas", "desparasite el lote", "cuando vendo leche". Requiere producto, fecha, dosis, via, retirada y animales.
- Comandos de avisos: "ponme un aviso", "recuerdame revisarla", "que tengo pendiente", "por que salta esto", "posponlo tres dias".
- Comandos de dashboard: "cuantas hay en produccion", "que hay en lazareto", "resumen de hoy", "animales con retirada". Intencion: consulta agregada.
- El parser debe aceptar lenguaje coloquial, pero no ejecutar acciones por intuicion. Primero entender, luego pedir datos, luego confirmar.

## Casos frecuentes
- Pasa estas al corral de paridas: movimiento; pedir crotales y confirmar. *documento pendiente de rutas finales*.
- Dime cuanto lleva preñada: consulta reproductiva; calcular desde cubricion registrada.
- Pon aviso en 15 dias: recordatorio; confirmar animal/lote, fecha y texto.
- Tiene basquilla: usar diccionario, preguntar signos y recomendar veterinario si hay urgencia.

## Limites y cautelas
El parser no debe convertir nombres populares en diagnosticos ni frases ambiguas en acciones ejecutadas. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: esquema de comandos naturales.
- Decision de producto: lenguaje ganadero traducido a intenciones seguras.
- Estado tecnico: comandos de movimiento pendientes de rutas finales.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
