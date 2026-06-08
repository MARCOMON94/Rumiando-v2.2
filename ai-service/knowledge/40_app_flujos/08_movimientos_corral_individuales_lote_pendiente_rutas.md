# Movimientos de corral individuales y en lote

## Resumen
*documento pendiente de rutas finales*

Este documento describe como debe hablar la IA sobre movimientos dentro de RumiAndo, pero no fija endpoints ni payloads porque las rutas finales aun no estan cerradas. Sirve para ordenes como "mueve estas ovejas al corral de paridas" o "he leido estos crotales, pasalos al lote de cebo". La IA puede preparar, validar y pedir confirmacion; no debe ejecutar sin autorizacion.

## Reglas operativas
- Un movimiento necesita origen, destino, fecha, hora y animales afectados. El origen debe venir de la ficha actual y el destino debe existir en la app. Si el usuario dice "al otro corral", la IA debe pedir cual.
- En movimiento individual, identificar por crotal, RFID o ficha. Antes de preparar el cambio, mostrar corral actual, lote, estado productivo/sanitario y avisos relevantes.
- En movimiento por lote, clasificar crotales: encontrados, no encontrados, duplicados, dados de baja, ya en destino, bloqueados por retirada o con alerta sanitaria.
- La IA debe distinguir movimiento fisico de cambio de estado. Mover a lazareto no diagnostica enfermedad; mover a paridera no confirma parto; mover a cebo no debe cambiar estado sin confirmacion.
- Debe generar resumen final: numero de animales, lista o grupo de crotales, destino, fecha/hora, incidencias, cambios de estado propuestos y advertencias.
- Solo tras confirmacion del usuario se enviara la accion al backend cuando existan rutas finales. Si cancela, no se modifica nada.
- Los movimientos masivos de un corral completo deben pedir confirmacion reforzada y mostrar impacto total. Nada de mover medio rebaño por una frase escrita con sueño.
- Animales con retirada, tratamiento activo, sospecha sanitaria o enfermedad regulada deben generar advertencia antes de cualquier movimiento.

## Casos frecuentes
- Mueve estas al corral de paridas: pedir crotales o usar RFID, validar, proponer destino, sugerir estado si procede y confirmar.
- Mete estas en cebo: comprobar edad/estado si disponible, destino y posibles incidencias.
- Estas van al lazareto: mover fisicamente si se confirma, pero recomendar crear caso o aviso sanitario si hay sintomas.
- Mueve todo el corral A al B: resumen reforzado con total de animales e incidencias.

## Limites y cautelas
Este documento esta pendiente de rutas finales. No debe usarse para inventar endpoints, IDs o estructuras definitivas. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: movimientos individuales y por lote.
- Decision de producto: preparar, validar, resumir y confirmar.
- Estado tecnico: documento pendiente de rutas finales del backend.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
