# Uso de la app RumiAndo para ganaderos

## Resumen
Manual conversacional no tecnico para explicar la app a ganaderos. Cubre consulta de animales, altas, movimientos, avisos, Animal Watchlist, dashboard, sanidad, ficha individual, busqueda por crotal, lector RFID y limites de seguridad. Los apartados de movimientos y rutas internas quedan sujetos a documentos marcados como pendientes de rutas finales.

## Reglas operativas
- Para buscar un animal, usar crotal oficial, RFID o identificador visible. Si hay varios resultados, la IA debe pedir elegir uno y no asumir.
- Antes de modificar datos, revisar ficha individual: especie, sexo, edad, corral, lote, estado, historial sanitario, tratamientos, partos, movimientos y avisos.
- Para alta, recoger especie, sexo, fecha de nacimiento o entrada, crotal, origen, madre si aplica, corral inicial y estado inicial. Si no hay crotal oficial, usar provisional segun modelo.
- Para movimientos, la IA prepara: lee crotales, revisa origen, destino, incidencias y resumen. La ejecucion queda pendiente de rutas finales y confirmacion del usuario.
- Para sanidad, la app debe consultar casos, tratamientos, vacunas, retiradas y revisiones. La IA puede crear borrador, no diagnosticar ni prescribir.
- Para avisos, la IA puede listar pendientes, explicar motivo, priorizar y preparar recordatorios. No debe eliminar avisos criticos sin confirmacion.
- El dashboard debe resumir animales por especie, corrales, estados, avisos, tratamientos activos, retiradas, partos proximos y bajas recientes si esos datos existen.
- El lector RFID introduce crotales. Leer no mueve, no cambia estado y no trata animales. Solo crea una seleccion para decidir una accion.
- Animal Watchlist es una lista privada y persistente por usuario para localizar animales concretos con el lector. Puede llenarse desde avisos, ficha de animal o censo, con motivo automatico o manual opcional.
- En `/animal-watchlist` el lector esta activo por defecto. Si se lee un crotal marcado, la app avisa, muestra tarjeta flotante con animal y motivo, y marca el item como visto sin eliminarlo.
- Desde la tarjeta de Animal Watchlist se puede elegir una accion posterior. La accion no se valida al seleccionar destino; se registra solo al pulsar `Finalizar`.
- La IA puede responder directamente, abrir pantalla, precargar formulario o preparar accion. Las acciones criticas requieren confirmacion.

## Casos frecuentes
- Busca esta oveja: pedir crotal/RFID y mostrar ficha.
- Que avisos tengo: listar por prioridad y explicar motivo.
- Pon esta oveja en Animal Watchlist: abrir o preparar la lista de busqueda viva con motivo opcional.
- Ya he encontrado esta de la lista: explicar que queda tachada/vista hasta que el usuario la elimine manualmente.
- Pasa estas a paridas: preparar movimiento y confirmar. *documento pendiente de rutas finales*.
- Registra que la vacune: preparar borrador con producto, fecha, dosis, via, lote y proxima dosis.

## Limites y cautelas
La IA no debe ejecutar bajas, muertes, movimientos, tratamientos con retirada o cierres sanitarios sin confirmacion. No debe inventar rutas ni permisos. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion.

## Fuentes internas
- Requisitos RumiAndo: manual conversacional para ganaderos.
- Decision de producto: la IA prepara o redirige, el usuario confirma.
- Decision de producto: Animal Watchlist persiste por usuario y no elimina animales al leerlos; solo los marca como vistos.
- Estado tecnico: movimientos y endpoints pendientes de rutas finales.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
