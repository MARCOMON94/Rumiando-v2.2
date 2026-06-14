# Movimientos de corral individuales y en lote

## Resumen
El movimiento de corral vigente se realiza en `/operations/movement`. La IA no ejecuta el cambio desde el chat: interpreta la orden, prepara un borrador visual y abre la pantalla de operacion. El ganadero configura destino y motivo, pasa crotales con el lector, revisa la lista y pulsa `Finalizar`.

## Reglas operativas
- Un movimiento necesita animales, corral destino y fecha interna. La fecha se toma como hoy salvo que el flujo permita cambiarla.
- La unidad REGA se deduce por el primer animal leido. Si hay conflicto, la pantalla debe advertirlo y no mezclar animales sin control.
- En movimiento por lote, clasificar crotales: encontrados, duplicados, no encontrados, dados de baja o bloqueados.
- Leer un crotal solo anade el animal a la lista. No registra movimiento hasta `Finalizar`.
- Si el destino tiene una regla de automatizacion asociada a estado o evento reproductivo, la app pregunta al finalizar si tambien se aplica ese cambio.
- Si el animal ya esta en el destino, puede mostrarse como incidencia o omitirse del lote final.
- Animales en baja no deben aceptar nuevos movimientos.
- El movimiento fisico no equivale por si solo a diagnostico ni tratamiento. Mover a Lazareto no abre enfermedad; mover a Paridera no registra parto salvo que el usuario acepte otro flujo.

## Frases frecuentes
- "Mueve estas al corral de paridas" -> abrir `/operations/movement`, destino Paridera si existe.
- "Pasar 3 cabras a produccion" -> destino Produccion, objetivo visual 3, especie esperada caprino/cabras.
- "Mete estas en cebo" -> destino Cebo si existe; si no existe, pedir elegir corral.
- "Estas van al lazareto" -> destino Lazareto/Enfermeria; sugerir crear Evento sanitario si el motivo es enfermedad.
- "Mover todo el corral A al B" -> no usar corral completo en movimiento salvo que exista soporte explicito; pedir confirmacion reforzada o indicar que debe leerse lote.

## Interaccion con el chat
La accion que debe devolver la IA es `ui_action.type = operation_flow`, `operation = movement` y un `draft` con los campos inferidos: destino, objetivo, especie esperada, motivo o texto original. El frontend guarda el borrador y navega a `/operations/movement?aiDraft=...`.

## Limites y cautelas
La IA no debe prometer que el movimiento se ha hecho hasta recibir resultado real de la pantalla/backend. En movimientos masivos o con animales sanitariamente sensibles debe recordar revisar avisos, tratamientos activos y retirada.

## Fuentes internas
- Flujo vigente RumiAndo: `/operations/movement`.
- Decision de producto: pantalla real + lector + lista + `Finalizar`.
- Backend vivo: `POST /movements`.

## Nota de uso para el RAG
Recuperar este documento para ordenes como pasar, mover, meter, echar, apartar, mandar o cambiar de corral.
