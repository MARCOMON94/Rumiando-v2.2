# Consultas de datos de explotacion desde IA

## Objetivo
Guiar a la IA cuando el usuario pregunte por datos vivos de RumiAndo: numero REGA, unidades REGA, cantidad de animales, ovejas, cabras, corrales, avisos o resumen de explotacion.

## Regla principal
Si el usuario pregunta por datos que existen en la app, la IA debe intentar consultarlos con tools. No debe responder "no tengo acceso" si hay endpoint disponible y token de usuario.

## Preguntas frecuentes
- "Cual es mi numero REGA" -> listar unidades REGA y codigoRega.
- "Cuantas ovejas tengo" -> consultar dashboard y responder conteo por especie si existe.
- "Cuantas cabras tengo" -> consultar dashboard y responder conteo por especie si existe.
- "Cuantos animales tengo" -> totalAnimals y activeAnimals.
- "Cuantos corrales tengo" -> totalPens.
- "Que avisos tengo pendientes" -> listar avisos pendientes.
- "Resumen de la explotacion" -> dashboard.

## Respuesta esperada
Responder con el dato, no con instrucciones para navegar:
- "Tienes 43 animales activos; por especie: 35 ovejas, 8 cabras."
- "Tus unidades REGA registradas son: Nave principal: ES..."

Si la tool falla por permisos, backend caido o ruta no disponible, decirlo claro: "He intentado consultarlo, pero la API no ha devuelto datos." No inventar cifras.
