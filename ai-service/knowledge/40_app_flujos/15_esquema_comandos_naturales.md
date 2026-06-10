# Esquema de comandos naturales

## Resumen
Recopila frases que el ganadero podria usar con la IA y como interpretarlas. Sirve para guiar movimientos, busquedas, avisos, reproduccion, sanidad, tratamientos y dashboard. Traduce lenguaje natural a intencion, datos requeridos y siguiente paso seguro.

## Reglas operativas
- Comandos de movimiento usan pasar, meter, llevar, apartar, sacar o mover: "pasa estas al corral de paridas", "mete estas en cebo", "estas van al lazareto". Intencion: abrir operacion de Corral.
- Para movimientos, datos requeridos: animales, destino y si implica cambio de estado. Si falta algo, abrir panel guiado o preguntar lo minimo. La ejecucion real requiere confirmacion.
- Comandos de busqueda: "busca esta oveja", "donde esta la 3482", "ensename su ficha". Intencion: lectura. Requiere crotal, RFID o seleccion.
- Comandos reproductivos: "cuanto lleva prenada", "cuando deberia parir", "ponla como cubierta", "ha abortado". Distinguir consulta de cambio de estado.
- Comandos sanitarios: "no come", "esta tumbada", "tiene diarrea", "tose", "cojea", "creo que tiene lengua azul". Intencion: orientacion sanitaria o apertura de caso.
- Comandos de tratamiento: "le puse antibiotico", "vacune estas", "desparasite el lote", "cuando vendo leche". Requiere producto, fecha, dosis, via, retirada y animales/corral.
- Comandos de avisos: "ponme un aviso", "recuerdame revisarla", "que tengo pendiente", "por que salta esto", "posponlo tres dias".
- Comandos de dashboard: "cuantas hay en produccion", "que hay en lazareto", "resumen de hoy", "animales con retirada". Intencion: consulta agregada.
- El parser debe aceptar lenguaje coloquial, pero no ejecutar acciones por intuicion. Primero entender, luego pedir datos, luego confirmar.

## OperationSession
- Todas las acciones guiadas se abren con la misma base: Unitario, Lote o Corral completo.
- Unitario: una lectura identifica un animal y se prepara la accion.
- Lote: cada lectura valida se anade; duplicados se ignoran; Finalizar prepara resumen.
- Corral completo: se selecciona uno o varios corrales y la accion se aplica al corral completo.
- Finalizar no registra nada. Confirmar es el unico paso que ejecuta endpoint real.

## Casos frecuentes
- "Pasa estas al corral de paridas": abrir OperationSession de Corral, pedir modo, leer crotales y confirmar.
- "Baja este animal": abrir OperationSession de Baja; pedir crotal/RFID, fecha y causa opcional.
- "Se ha muerto una cabra": detectar muerte, pedir crotal/RFID y preparar baja por muerte sin ejecutar.
- "Vacuna este corral": abrir OperationSession de Vacunacion en modo Corral completo; pedir vacuna, fecha y corral.
- "Desparasita el lote": abrir OperationSession de Desparasitacion en modo Lote; pedir producto, tipo y fecha.
- "Abre caso sanitario para esta oveja": responder triaje si hay sintomas y abrir OperationSession de Sanitario si el usuario quiere registrar.
- "Dime cuanto lleva prenada": consulta reproductiva; calcular desde cubricion/inseminacion o diagnostico registrado.
- "Pon aviso en 15 dias": preparar recordatorio; confirmar animal/lote, fecha y texto.
- "Tiene basquilla": usar diccionario, preguntar signos y recomendar veterinario si hay urgencia.

## Limites y cautelas
El parser no debe convertir nombres populares en diagnosticos ni frases ambiguas en acciones ejecutadas. La IA no sustituye diagnostico veterinario. Si hay postracion, fiebre alta, dificultad respiratoria, sangre, aborto, mortalidad, dolor intenso, sospecha zoonotica o varios animales afectados, debe recomendar contactar con veterinario.

## Nota de uso para el RAG
Este documento debe recuperarse cuando la pregunta del ganadero use lenguaje cotidiano y necesite una respuesta operativa. La IA debe responder con pasos concretos, prudentes y verificables, evitando tecnicismos innecesarios. Si faltan datos, debe pedir el minimo imprescindible o dejar claro que la respuesta es orientativa.
