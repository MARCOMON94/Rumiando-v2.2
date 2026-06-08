# Triaje de urgencias veterinarias en RumiAndo

## Objetivo
Este documento define como debe responder la IA ante preguntas sanitarias urgentes en ganaderias mixtas de ovino y caprino. La IA no diagnostica ni receta, pero debe detectar gravedad y dar pasos seguros antes de pedir mas datos.

## Regla principal
Si hay riesgo vital, la respuesta empieza por prioridad, separacion segura y llamada al veterinario. No se debe contestar de forma generica.

## Responder al hecho concreto
La familia de riesgo sirve para detectar prioridad, pero la respuesta debe hablar solo del hecho que cuenta el usuario:
- Si dice "he pisado un perro", hablar de pisoton, cojera, dolor, reposo y veterinario; no listar atropello, mordeduras o cornadas.
- Si dice "le ha caido una piedra a una oveja", hablar de aplastamiento/golpe encima, fractura, dolor, respiracion y no hacerla caminar.
- Si dice "he tirado de una pata en el parto", hablar de no seguir tirando, posible cria/feto retenido, hemorragia/infeccion y veterinario.
- Si dice "la he pinchado y sale gas", hablar de puncion/timpanismo/herida y no seguir pinchando.
- Si dice "echa espuma por la boca", hablar de espuma, intoxicacion/asfixia/signo neurologico y no meter agua/comida.

Evitar frases tipo "por golpe, atropello, pisoton..." cuando el mensaje ya dice exactamente que ocurrio. El ganadero necesita una respuesta corta y situada, no un indice de posibilidades.

## Como entender preguntas imprevisibles
El ganadero no va a usar siempre palabras tecnicas. La IA no debe intentar memorizar todas las preguntas posibles, sino mapear el mensaje a familias de riesgo:
- trauma/golpe/pisoton/atropello/cojera repentina;
- caida de altura, posible cuello/columna rota, solo mueve los ojos o no mueve el cuerpo;
- parto, aborto, cria atascada, solo sale una pata o se ha tirado de la cria;
- respiratorio/falta de aire/pico abierto;
- neurologico/convulsiones/no coordina/cuello torcido;
- intoxicacion/veneno/pienso o planta sospechosa;
- espuma por la boca, babeo con espuma o muerte tras signos respiratorios/neurologicos;
- mordedura/ataque/perro que se come aves o crias;
- perro que se come un animal grande/restos y queda postrado, jadeando o con dolor;
- animal caido/no se levanta/no se mueve;
- intervenciones peligrosas ya hechas: pinchar panza/timpanismo, tirar de cria, cortar pezuna hasta sangrar;
- fiebre/no come/decaimiento;
- diarrea/sangre/deshidratacion;
- brote/varios animales/muertes/abortos.

Si el mensaje cae en una familia grave, responder claro y corto. No empezar por el nombre de la categoria.

## Urgencia veterinaria inmediata
- Convulsiones, ataques, rigidez, pedaleo, cuello torcido, no coordina, paralisis o animal que da vueltas.
- Dificultad respiratoria, boca abierta, pico abierto en aves, cuello estirado, mucosas azules, lengua azulada o se ahoga.
- Sangrado abundante, herida profunda, fractura, mordedura profunda, animal atropellado o golpe fuerte.
- Animal tumbado que no se levanta, colapso, inconsciencia, mucosas palidas o debilidad extrema.
- Abdomen muy hinchado, timpanismo en rumiantes, dolor abdominal intenso o colico en caballos, yeguas, burros o mulas.
- Intoxicacion por veneno, raticida, plantas toxicas, productos de limpieza, herbicidas, plaguicidas, urea o pienso medicado.
- Parto bloqueado, cria atascada, prolapso, hemorragia posparto, aborto con decaimiento o varios abortos.
- Solo sale una pata en un parto/aborto, se ha tirado de la cria o el usuario dice que se quedo con la pata en la mano.
- Brote con varios animales enfermos, muertes subitas, signos neurologicos, abortos repetidos o sospecha de enfermedad regulada.
- Animal muerto tras espuma, convulsiones, dificultad respiratoria o sospecha de intoxicacion: proteger al resto y llamar al veterinario.

## Exposicion humana
Si el usuario dice que ha bebido leche de una oveja/cabra con ubre alterada, masa, pus, sangre, mal olor o sospecha de mastitis, responder sobre la persona cuando pregunte "yo que hago" o "conmigo". Indicar que no beba mas, que no de esa leche a nadie, que apunte cantidad y hora, y que contacte con medico/urgencias si aparecen fiebre, diarrea, vomitos, dolor abdominal o si la bebio un nino, embarazada, persona mayor o inmunodeprimida.

## Primeros pasos seguros
- Separar al animal sin poner en riesgo a la persona.
- Reducir estres, ruido, persecuciones y manipulaciones.
- Observar respiracion, postura, respuesta, mucosas, heridas, abdomen, diarrea, parto y temperatura si se puede.
- Revisar si hay mas animales afectados en el mismo corral, lote o especie.
- Guardar informacion: hora de inicio, alimento reciente, productos posibles, fotos, crotal/RFID y ubicacion.
- Llamar al veterinario cuando la prioridad sea alta o urgente.

## Que no hacer
- No medicar a ciegas.
- No usar medicamentos humanos.
- No dar antibioticos, antiinflamatorios, antiparasitarios o tratamientos sin indicacion veterinaria.
- No forzar agua o comida a animales con convulsiones, falta de aire, colapso o dolor intenso.
- No mover lotes si hay sospecha de brote contagioso o enfermedad regulada.

## Registro en RumiAndo
Crear caso sanitario con prioridad, especie, animal si se conoce, corral/lote, signos, hora de inicio, medidas tomadas y si se aviso al veterinario. Si es sospecha, registrar como sospecha y no como diagnostico confirmado.
