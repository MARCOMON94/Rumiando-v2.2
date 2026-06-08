# Uso de la app RumiAndo para ganaderos

## Resumen
Manual conversacional no tecnico para explicar la app a ganaderos. Cubre consulta de animales, altas, movimientos, avisos, dashboard, sanidad, ficha individual, busqueda por crotal, lector RFID y limites de seguridad. Los apartados de movimientos y rutas internas quedan sujetos a documentos marcados como pendientes de rutas finales.

## Reglas operativas
- Para buscar un animal, usar crotal oficial, RFID o identificador visible. Si hay varios resultados, la IA debe pedir elegir uno y no asumir.
- Antes de modificar datos, revisar ficha individual: especie, sexo, edad, corral, lote, estado, historial sanitario, tratamientos, partos, movimientos y avisos.
- Para alta, recoger especie, sexo, fecha de nacimiento o entrada, crotal, origen, madre si aplica, corral inicial y estado inicial. Si no hay crotal oficial, usar provisional segun modelo.
- Para movimientos, la IA prepara: lee crotales, revisa origen, destino, incidencias y resumen. La ejecucion queda pendiente de rutas finales y confirmacion del usuario.
- Para sanidad, la app debe consultar casos, tratamientos, vacunas, retiradas y revisiones. La IA puede crear borrador, no diagnosticar ni prescribir.
- Para avisos, la IA puede listar pendientes, explicar motivo, priorizar y preparar recordatorios. No debe eliminar avisos criticos sin confirmacion.
- El dashboard debe resumir animales por especie, corrales, estados, avisos, tratamientos activos, retiradas, partos proximos y bajas recientes si esos datos existen.
- El lector RFID introduce crotales. Leer no mueve, no cambia estado y no trata animales. Solo crea una seleccion para decidir una accion.
- La IA puede responder directamente, abrir pantalla, precargar formulario o preparar accion. Las acciones criticas requieren confirmacion.

## Casos frecuentes
- Busca esta oveja: pedir crotal/RFID y mostrar ficha.
- Que avisos tengo: listar por prioridad y explicar motivo.
- Pasa estas a paridas: preparar movimiento y confirmar. *documento pendiente de rutas finales*.
- Registra que la vacune: preparar borrador con producto, fecha, dosis, via, lote y proxima dosis.

## Limites y cautelas
La IA no debe ejecutar bajas, muertes, movimientos, tratamientos con retirada o cierres sanitarios sin confirmacion. No debe inventar rutas ni permisos. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: manual conversacional para ganaderos.
- Decision de producto: la IA prepara o redirige, el usuario confirma.
- Estado tecnico: movimientos y endpoints pendientes de rutas finales.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
