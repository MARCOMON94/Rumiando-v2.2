# Animal Watchlist

## Resumen
Animal Watchlist es la funcion de busqueda viva de RumiAndo. Sirve para preparar una lista privada y persistente de animales que el ganadero quiere localizar fisicamente con el lector de crotales/RFID. La lista pertenece al usuario y a su cuenta ganadera, y permanece aunque cierre sesion.

## Reglas operativas
- La pantalla principal es `/animal-watchlist`.
- La API confirmada es `/api/animal-watchlist`.
- La lista muestra animal, ubicacion actual y motivo.
- El contador preparado por API devuelve `total`, `seenTotal` y `pendingTotal`.
- El lector esta activo por defecto al entrar en la pantalla.
- Si se lee un crotal incluido, la app reproduce aviso, hace doble parpadeo naranja y muestra tarjeta flotante con animal y motivo.
- Leer un animal no lo elimina. El item queda visto/tachado con `seenAt`, `seenCount` y `lastReadAt`, y seguira avisando si se vuelve a leer.
- El usuario puede borrar un animal concreto o vaciar la lista completa con confirmacion.
- Los animales pueden anadirse desde avisos automaticos, ficha de animal, censo o Home.
- Desde un aviso automatico, el motivo debe ser el propio aviso. Anadirlo a Animal Watchlist no resuelve el aviso.
- Desde ficha o censo, el motivo manual es opcional y puede quedar vacio.

## Accion posterior
- La tarjeta flotante permite elegir una accion posterior: movimiento de corral, estado reproductivo, evento reproductivo o sanitario, segun opciones disponibles en la app.
- El desplegable inferior depende de la accion elegida.
- Seleccionar una subopcion no guarda nada por si solo.
- La accion se valida y se registra solo cuando el usuario pulsa `Finalizar`.
- Registrar una accion posterior no elimina el animal de Animal Watchlist; solo queda visto hasta borrado manual.

## Endpoints
- `GET /animal-watchlist`: lista del usuario y contadores.
- `POST /animal-watchlist`: anadir un animal. Minimo `animalId`; motivo y origen son opcionales.
- `POST /animal-watchlist/read`: marcar lectura por crotal/RFID/numero interno e incrementar conteo.
- `DELETE /animal-watchlist/:id`: quitar un item.
- `DELETE /animal-watchlist`: vaciar lista completa.

## Frases de usuario esperadas
- "Pon esta oveja en busqueda viva" -> anadir a Animal Watchlist con motivo opcional.
- "Anade las de este aviso a la lista" -> anadir con el motivo del aviso.
- "Abre la lista de animales para buscar" -> abrir `/animal-watchlist`.
- "Ya la encontre" -> explicar que queda vista/tachada, pero no desaparece hasta borrado manual.
- "Quita todas de la lista" -> pedir confirmacion antes de vaciar.

## Limites y cautelas
Animal Watchlist es una ayuda operativa para localizar animales, no una accion sanitaria ni reproductiva por si misma. La IA no debe decir que un aviso queda resuelto, que un tratamiento queda registrado o que un movimiento queda hecho por el mero hecho de leer un crotal. Cualquier cambio real requiere endpoint confirmado y accion del usuario.

## Fuentes internas
- Decision de producto: busqueda viva se nombra en interfaz como Animal Watchlist.
- Decision de producto: lista privada por usuario, persistente y con borrado manual.
- Decision de producto: la accion posterior se guarda al pulsar `Finalizar`.

## Nota de uso para el RAG
Este documento debe recuperarse cuando el usuario pregunte por Animal Watchlist, busqueda viva, buscar animales marcados, localizar animales con lector, contador de animales pendientes, o por que un animal leido sigue apareciendo en la lista.
