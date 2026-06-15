# Esquema de comandos naturales

## Resumen
El chat interpreta lenguaje de campo y lo transforma en una pantalla preparada. No debe ejecutar acciones ocultas: abre el flujo, rellena lo que entienda y deja que el ganadero pase el lector y pulse `Finalizar`.

## Movimiento de corral
- Verbos: pasar, meter, echar, mover, apartar, mandar, llevar, cambiar de sitio.
- Ejemplos: "quiero pasar 3 cabras a produccion", "mete estas en paridera", "manda el lote a secado".
- Resultado: `ui_action.operation_flow` con `operationType=movement`, ruta `/operations/movement`, destino sugerido y objetivo orientativo si aparece.
- Aliases: produccion/lactacion/ordeno, paridera/paridas, gestantes/prenadas, secado/secas, cebo, reposicion, lazareto/enfermeria.

## Estado reproductivo
- Verbos y frases: poner como, marcar como, diagnostico, ecografia, gestante, prenada, seca, secado, cubricion, inseminacion, aborto.
- Ejemplos: "pon estas como gestantes de 8 semanas", "diagnostico positivo", "pasa estas a secas".
- Resultado: `ui_action.operation_flow` con `operationType=reproductive`, ruta `/operations/reproductive`, evento, resultado y semanas si se infieren.

## Evento sanitario
- Cambiar texto visible de caso sanitario a evento sanitario.
- Frases: "vacuna estas de lengua azul", "desparasita el lote", "abre enfermedad de mamitis", "registrar otro evento sanitario".
- Resultado: `ui_action.operation_flow` con `operationType=health`, ruta `/operations/health`, tipo `vaccination`, `deworming`, `disease` u `other`.
- Si hay nombres populares o faltas, usar catalogos/alias/RAG y confirmar si hay duda antes de guardar.

## Parto y baja
- "Ha parido esta oveja", "pario esta cabra": activar lector silencioso `parto`. Si hay crotal claro, abrir `/birth/new/:motherId`.
- "Acaban de nacer tres cabritos", "nacieron dos corderos", "tengo crias nuevas": tambien es intencion de parto/nacimiento. La primera accion debe ser abrir lector silencioso `parto` para localizar la madre; el numero de crias queda como dato orientativo del formulario.
- "Se ha muerto esta cabra", "da de baja este animal", "vendida", "sacrificio": activar lector silencioso `baja`. Si hay crotal claro, abrir `/animals/:id/discharge` con causa sugerida.
- Estos flujos son unitarios; no usan lista por lote.

## Busqueda, avisos y consultas
- "Busca la lista", "abre busqueda inteligente": abrir `/animal-watchlist`.
- "Busca este crotal" o "ensenname la ficha": usar lector silencioso `lookup` o buscar por crotal si esta en el mensaje.
- "Ponme un aviso": preparar alerta manual, no cerrarla sin pantalla.
- Consultas como "cuantas hay en produccion" usan endpoints de lectura y responden con datos vivos.

## Reglas de seguridad
- Si falta un dato, abrir el flujo igualmente cuando sea razonable y dejar el campo visible para corregir.
- Si el animal no coincide con la especie esperada, avisar sin bloquear.
- Si el usuario dice "estas" o "este lote", la accion sigue siendo valida: la lista se llena con el lector.
- El objetivo "3 cabras" es una guia visual, no un limite duro.
