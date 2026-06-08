# Reproduccion, gestacion, partos y secado

## Resumen
Este documento explica como responder sobre cubricion, inseminacion, diagnostico de gestacion, aborto, parto, posparto y secado en ovino y caprino. Sirve para calcular dias desde cubricion, fecha orientativa de parto, revisiones reproductivas y alertas. Las reglas deben configurarse por especie, raza, sistema productivo y criterio del ganadero o veterinario.

## Reglas operativas
- La fecha de cubricion o inseminacion es el punto de partida. La IA puede calcular dias transcurridos si la fecha esta registrada, pero debe advertir si hay varias cubriciones o datos dudosos.
- Como orientacion general, la gestacion ovina ronda 147 dias, con variacion aproximada de 144 a 152 dias. En cabras se usa aproximadamente 150 dias, con variacion frecuente de 145 a 155 dias. Son medias, no garantia.
- El diagnostico de gestacion depende del metodo. Puede programarse aviso de revision entre 30 y 45 dias postcubricion si la explotacion usa ecografia o revision veterinaria. No repetir celo no confirma gestacion por si solo.
- Estados reproductivos posibles: vacia, cubierta, diagnostico pendiente, gestante, proxima a parto, parida, lactacion, secado, aborto registrado y revision reproductiva. Cada estado debe guardar fecha de inicio.
- Alertas sugeridas: revision de preñez tras cubricion, preparacion de paridera antes de fecha estimada, parto retrasado, revision posparto, secado programado y control tras aborto.
- El aborto debe registrarse como evento reproductivo y sanitario. Recomendar guantes, aislar, retirar restos sin exponer a perros/gatos/aves y consultar veterinario, especialmente si hay mas casos.
- El parto normal requiere cama limpia, vigilancia, agua, comprobacion de crias, calostro y placenta. Si hay esfuerzo sin progreso, mala presentacion, agotamiento, mal olor o fiebre, veterinario urgente.
- La creacion automatica de crias al registrar parto puede quedar como ampliacion futura si no esta en MVP. Mientras tanto, la IA debe explicar que el nacimiento debe registrarse manualmente o segun flujo disponible.
- El secado debe registrarse con fecha, animal/lote, motivo y plan. Afecta a ordeño, alimentacion, control mamario y futuros avisos.

## Casos frecuentes
- Cuanto lleva preñada: calcular dias desde cubricion registrada y mostrar ventana orientativa.
- Cuando deberia parir: sumar rango orientativo segun especie y avisar de variabilidad.
- Cuando revisar si esta preñada: recomendar aviso segun protocolo, normalmente revision veterinaria a partir de ventana util.
- Ha abortado: aislar, usar guantes, registrar y llamar al veterinario si hay repeticion o mal estado.

## Limites y cautelas
La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario. Si una norma depende de MAPA, CCAA o criterio veterinario, debe verificarse antes de aplicarla en produccion. Los calculos dependen de datos exactos y configuracion por explotacion.

## Fuentes internas
- Requisitos RumiAndo sobre reproduccion, gestacion, partos y secado.
- Decision de producto: alertas por dias desde eventos reproductivos.
- Fuentes tecnicas a verificar: protocolo reproductivo de cada explotacion y veterinario.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa. En todos los casos debe conservar el tono de ayuda practica: que revisar primero, que registrar en la app, que no hacer y cuando elevar el caso a veterinario o administracion. La precision del RAG depende de que este documento no se mezcle con temas no relacionados.
