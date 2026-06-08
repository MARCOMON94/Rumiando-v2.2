# Mapa de pantallas y endpoints

## Resumen
*documento pendiente de rutas finales*

Documento tecnico marcador para conectar intenciones de IA con pantallas y endpoints de RumiAndo. No fija rutas definitivas porque el backend no esta cerrado. Debe recordar que hace falta documentar busqueda, ficha individual, movimientos, avisos, dashboard, tratamientos, altas, bajas y recordatorios. Hasta entonces, la IA debe decir preparar formulario, abrir pantalla o solicitar confirmacion, no prometer endpoints concretos.

## Reglas operativas
- Buscar animal: debe conectarse con pantalla de busqueda por crotal, RFID, especie, estado o corral. Ruta, parametros y errores quedan pendientes.
- Ficha animal: pantalla central con datos basicos, historial reproductivo, sanitario, tratamientos, movimientos, avisos y estado actual. Ruta final pendiente.
- Movimientos: requiere prevalidacion, ejecucion, lista de crotales, destino, fecha, cambios de estado propuestos, respuesta parcial y auditoria. Pendiente de rutas finales.
- Avisos y recordatorios: distinguir consulta de avisos automaticos, crear recordatorio manual, posponer y marcar como completado. Rutas pendientes.
- Dashboard: debe exponer agregados por especie, corral, estado, avisos criticos, tratamientos activos, retiradas, partos proximos y bajas recientes. Ruta pendiente.
- Tratamientos: deben existir borrador y registro confirmado si el diseño lo permite. Campos: animales, producto, principio activo, lote, dosis, via, retirada, responsable y proxima dosis.
- Altas: validar crotal duplicado, especie, sexo, fecha, origen y corral inicial. Pendiente ruta final.
- Bajas: registrar motivo cerrado, fecha y trazabilidad. Muerte, venta, sacrificio o traslado deben requerir confirmacion reforzada.
- La IA debe decidir entre responder directamente, abrir pantalla, precargar formulario o ejecutar tras confirmacion, segun permisos y rutas.

## Casos frecuentes
- Buscar animal por crotal: cuando exista ruta final, consultar y abrir ficha.
- Movimiento lote: pendiente de ruta final; preparar datos, validar y confirmar.
- Crear aviso: pendiente de ruta final; recoger animal/lote, fecha, texto y prioridad.
- Registrar tratamiento: pendiente de ruta final; preparar borrador y confirmar.

## Limites y cautelas
Este documento no debe generar codigo ni endpoints definitivos. Cualquier ruta de ejemplo debe considerarse provisional. La IA no debe decir que ejecuto algo sin respuesta real del backend.

## Fuentes internas
- Requisitos RumiAndo: mapa de pantallas y endpoints.
- Decision de producto: responder, abrir pantalla, precargar formulario o ejecutar tras confirmacion.
- Estado tecnico: documento pendiente de rutas finales.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
