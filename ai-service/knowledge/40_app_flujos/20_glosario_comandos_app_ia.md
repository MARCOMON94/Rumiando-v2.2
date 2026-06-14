# Glosario de comandos de la app para la IA

## Resumen
Mapa compacto entre frases naturales del ganadero y acciones visuales de RumiAndo. La IA debe preparar pantalla, no ejecutar en silencio.

## Movimiento de corral
- pasar, meter, echar, llevar, mandar, mover, apartar, cambiar de sitio = abrir `/operations/movement`.
- produccion, lactacion, lactancia, ordeno = corral/estado productivo de produccion si existe.
- paridera, paridas, partos = zona de parto/paridera si existe.
- gestantes, prenadas = corral o estado de gestacion segun contexto.
- secado, secas = corral/estado seco.
- lazareto, enfermeria = corral sanitario/aislamiento.
- "3 cabras", "dos ovejas", "estas", "el lote" = objetivo orientativo; la lista real se llena con lector.

## Estado reproductivo
- poner como gestante, diagnostico positivo, ecografia positiva = `/operations/reproductive`, evento `DIAGNOSTICO_GESTACION`, resultado positivo.
- "de 8 semanas" = semanas estimadas de gestacion.
- secar, pasar a seca = evento `SECADO` o estado seca.
- cubierta, cubricion, inseminada = evento reproductivo correspondiente.
- aborto, ha abortado = evento `ABORTO`; si hay restos, fiebre o varios casos, recomendar veterinario.

## Evento sanitario
- vacunar, pinchar vacuna, revacunar = `/operations/health`, tipo vacunacion.
- desparasitar, antiparasitario, echar producto = `/operations/health`, tipo desparasitacion.
- enfermedad, caso, incidencia, mamitis, cojeras, diarrea, tos = `/operations/health`, tipo enfermedad si quiere registrar.
- corral completo, todo el corral = solo valido en Evento sanitario; seleccionar corral y expandir animales.

## Parto, baja y busqueda
- ha parido, parto, nacimiento = activar lector silencioso `parto`; al leer madre abrir `/birth/new/:motherId`.
- se ha muerto, baja, venta, sacrificio, desaparecida = activar lector silencioso `baja`; al leer animal abrir `/animals/:id/discharge`.
- buscar crotal, abrir ficha, donde esta = lector silencioso `lookup`.
- busqueda inteligente, lista de busqueda, animales marcados = abrir `/animal-watchlist`.
- ponme un aviso, recuerdame, alerta en X dias = preparar alerta manual.

## Respuesta esperada
- Respuesta breve: "Te abro el flujo..." o "Activo el lector...".
- Si faltan datos, abrir igualmente si el lector puede completarlos.
- Nunca decir "ya esta registrado" hasta que el usuario pulse `Finalizar` o `Guardar` y el backend responda bien.
