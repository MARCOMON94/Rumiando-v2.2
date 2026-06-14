# Enfermedades importantes en ovino y caprino

## Resumen
Base prudente para orientar al ganadero ante signos frecuentes en ovejas y cabras. La IA no diagnostica ni prescribe: orienta, pregunta lo minimo, recomienda aislar si procede, registrar en Evento sanitario y avisar al veterinario ante signos rojos.

## Signos rojos siempre urgentes
- Animal caido, no se levanta, convulsiones, cuello torcido, ceguera repentina o incoordinacion.
- Fiebre alta, dificultad respiratoria, espuma, lengua/labios hinchados, salivacion intensa o lesiones en boca y pezuñas.
- Aborto, varios abortos, placenta/feto retenido, crias debiles en lote o muerte perinatal repetida.
- Muerte subita, varios animales afectados, diarrea con sangre, timpanismo fuerte, sospecha de intoxicacion o carbunco.
- Sospecha zoonotica: abortos con fiebre en personas, brucelosis, fiebre Q, ectima/orf en contacto con heridas humanas.

## Enfermedades y pistas practicas
- Lengua azul: rumiantes; en ovejas puede dar fiebre, apatia, edema de cara/labios/lengua, lesiones orales/nasales, salivacion, secrecion nasal, cojera por rodetes coronarios, aborto o muerte. En cabras suele ser mas leve o inaparante. No se transmite por contacto directo ni por leche; la transmite Culicoides. Requiere veterinario, control de vector, vigilancia y revisar normativa/CCAA.
- Fiebre aftosa/glosopeda: enfermedad vesicular grave y de declaracion. Sospechar con fiebre, ampollas o ulceras en boca, lengua, morro, ubres o pezuñas, salivacion, cojera intensa, rechazo a comer, caida de leche. Afecta bovino, porcino, ovino, caprino y otros biungulados. No mover animales y avisar veterinario/autoridad.
- Brucelosis: abortos, retencion de placenta, infertilidad, crias debiles, orquitis/epididimitis. Zoonosis importante; usar guantes, no consumir leche cruda, aislar hembra/restos y avisar al veterinario.
- Peste de pequeños rumiantes: fiebre, descarga ocular/nasal, lesiones orales, diarrea, tos/neumonia y mortalidad. Es enfermedad listada; ante sospecha, no mover y llamar al veterinario.
- Ectima contagioso/orf/boquera: costras en labios, boca, nariz, pezones o coronas. Puede afectar a personas por contacto; usar guantes, separar afectados y revisar mamadas.
- Mamitis/agalaxia: ubre caliente, dura, dolorosa, asimetrica, leche con grumos/sangre/mal olor, fiebre o cria que no mama. No mezclar leche sospechosa para consumo.
- Neumonia: tos, fiebre, mocos, respiracion rapida, orejas caidas, decaimiento; empeora con frio, humedad, transporte, polvo o hacinamiento.
- Clostridiosis/enterotoxemia/basquilla: muerte subita, diarrea fuerte, timpanismo, signos neurologicos o toxemia tras cambios de pienso/pasto. Urgencia veterinaria.
- Coccidiosis: crias con diarrea, a veces sangre, retraso de crecimiento, apatia y ambientes humedos/sucios o sobrecargados.
- Pedero/problema podal: cojera, mal olor interdigital, lesiones de pezuña, humedad y varios afectados. Revisar cama, corrales y plan veterinario.
- Paratuberculosis: adelgazamiento cronico, mala condicion, caida productiva y curso largo. Requiere diagnostico de rebaño.
- Scrapie/tembladera: rascado, cambios de comportamiento, incoordinacion, temblores o signos neurologicos progresivos. Es regulado y requiere veterinario.

## Como debe responder la IA
- Primero preguntar especie, edad, numero de afectados, evolucion, fiebre, apetito, respiracion, diarrea, abortos, cojera y cambios recientes de alimentacion/corral/transporte.
- Si hay signos rojos, respuesta corta: aislar, no mover, higiene/proteccion, llamar veterinario y registrar Evento sanitario.
- Si el usuario quiere registrar: abrir `/operations/health` con tipo probable, pero dejar confirmacion al ganadero.
- No dar dosis, antibioticos, vacunas ni tiempos de retirada sin veterinario o ficha del producto.

## Fuentes externas de referencia
- WOAH Bluetongue: https://www.woah.org/en/disease/bluetongue/
- WOAH Brucellosis: https://www.woah.org/en/disease/brucellosis/
- WOAH Foot and mouth disease: https://www.woah.org/en/disease/foot-and-mouth-disease/
- WOAH Contagious caprine pleuropneumonia: https://www.woah.org/en/disease/contagious-caprine-pleuropneumonia/
- WOAH Peste des petits ruminants: https://www.woah.org/en/disease/peste-des-petits-ruminants/

## Nota de uso para el RAG
Recuperar este documento ante sintomas, nombres de enfermedades, brotes, abortos, muerte subita, lesiones de boca/pezuna, respiratorio, diarrea, mamitis o dudas sanitarias. Responder siempre como orientacion y con umbral bajo de veterinario.
