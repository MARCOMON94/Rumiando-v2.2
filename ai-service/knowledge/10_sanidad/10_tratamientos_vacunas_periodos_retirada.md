# Tratamientos, vacunas y periodos de retirada

## Resumen
Este documento guia a la IA al registrar tratamientos, vacunaciones, desparasitaciones y periodos de retirada. Sirve para preguntas como "le puse tal medicamento, ¿cuando puedo vender leche o carne?". La IA debe recoger datos estructurados, calcular fechas si tiene periodo indicado y evitar prescribir. La ficha tecnica y el veterinario mandan; el chat no es una farmacia con patas.

## Leche sospechosa consumida por una persona
Si el usuario dice que bebio leche de un animal con ubre alterada, masa, pus, sangre, mal olor o mastitis sospechada, la respuesta debe cambiar al humano si pregunta "yo que hago" o "conmigo". No recomendar medicacion. Indicar no beber mas, no dar esa leche a nadie, anotar cantidad/hora y contactar con medico/urgencias si hay fiebre, vomitos, diarrea, dolor abdominal o si afecta a nino, embarazada, persona mayor o inmunodeprimida.

## Reglas operativas
- Todo registro debe incluir producto, principio activo si se conoce, lote del medicamento si procede, fecha, animales afectados, dosis, unidad, via, responsable y veterinario si aplica.
- La dosis debe ser cantidad mas unidad: ml, mg, mg/kg, comprimidos, sobres u otra forma definida. Si falta, la IA debe pedirla o dejar borrador incompleto, nunca inventarla.
- Vias cerradas: oral, IM, IV, SC, topica, intramamaria, intrauterina y otras controladas. "Otras" debe requerir descripcion y criterio veterinario.
- El periodo de retirada debe registrarse para leche, carne o ambos segun ficha tecnica, receta o veterinario. La IA puede calcular fecha final si recibe fecha y dias.
- Si hay duda sobre como contar dias de retirada, debe prevalecer ficha tecnica, veterinario y configuracion validada del sistema.
- Tratamiento individual afecta a un crotal. Tratamiento por lote afecta a lista cerrada de animales. Tratamiento por corral afecta a todos los activos en esa ubicacion y exige confirmacion reforzada.
- Vacunas: registrar producto, enfermedad objetivo si procede, lote, fecha, via, dosis, animales y proxima dosis. La IA puede crear recordatorio, no diseñar plan vacunal sin veterinario.
- Desparasitaciones: registrar producto, via, dosis, grupo, retirada y motivo. Si se basa en analisis coprologico o protocolo, debe quedar indicado.
- Tratamientos con retirada deben generar aviso/bloqueo en leche o carne segun diseño de la app.

## Casos frecuentes
- Le puse antibiotico y quiero vender leche: pedir producto, fecha, dosis, via y retirada indicada. Si no se conoce, no autorizar venta.
- Vacune todo el corral: validar animales incluidos y crear registro por corral o lote con confirmacion.
- Desparasite pero no se el lote del producto: recomendar revisar envase o receta; registrar omision si no se puede recuperar.
- Me equivoque de retirada: corregir con trazabilidad, no borrar sin rastro si hay auditoria.

## Limites y cautelas
La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion. La IA no prescribe ni ajusta dosis. Los periodos de retirada dependen de medicamento, especie, via, dosis y legislacion.

## Fuentes internas
- Requisitos RumiAndo: producto, principio activo, lote, dosis, via, retirada y proxima dosis.
- Decision de producto: tratamiento individual, lote o corral.
- Fuentes a verificar: ficha tecnica, receta veterinaria y normativa vigente.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
