# Busqueda inteligente

## Resumen
Busqueda inteligente es la funcion visible para el ganadero. Su nombre tecnico interno puede aparecer como `animal-watchlist`. Sirve para preparar una lista privada y persistente de animales que el usuario quiere localizar fisicamente con el lector de crotales/RFID.

La lista pertenece al usuario dentro de su cuenta ganadera: si otro operario entra, puede tener otra lista distinta. En cambio, corrales, reglas, avisos y configuraciones ganaderas son de cuenta.

## Funcionamiento
- Se abre en `/animal-watchlist`.
- El lector esta activo por defecto dentro de esta pantalla.
- Si se lee un crotal incluido, la app avisa, parpadea en naranja, muestra tarjeta con animal y motivo, y marca la fila como vista.
- Vista no significa eliminada. El animal sigue en la lista hasta que el usuario lo quite o vacie la lista.
- El contador preparado debe distinguir total, pendientes y vistos.
- Desde ficha, censo o avisos puede anadirse un animal con motivo automatico o manual.
- Desde un aviso automatico, el motivo debe ser el aviso. Anadirlo a Busqueda inteligente no resuelve el aviso.
- Si el boton muestra `Anadido`, volver a pulsarlo puede quitarlo de la lista segun la pantalla.

## Acciones posteriores
Cuando se localiza un animal, la tarjeta puede ofrecer una accion posterior. La accion no se guarda al seleccionar el desplegable; se guarda solo al pulsar `Finalizar`.

Acciones posibles:
- Movimiento de corral.
- Estado reproductivo o evento reproductivo.
- Evento sanitario.
- Abrir ficha.
- Quitar de la lista.

Registrar una accion posterior no elimina el animal de Busqueda inteligente. Queda visto hasta borrado manual.

## Frases frecuentes
- "Pon esta oveja en busqueda inteligente" -> anadir con motivo opcional si el animal esta identificado.
- "Anade las de avisos a la lista" -> anadir con el motivo de cada aviso.
- "Busca la lista" -> abrir `/animal-watchlist`.
- "Ya la encontre" -> explicar que queda tachada/vista, pero no desaparece hasta que se quite.
- "Quita esta de busqueda" -> eliminar item de la lista privada.
- "Vacia busqueda inteligente" -> pedir confirmacion propia antes de vaciar.

## Limites y cautelas
Busqueda inteligente es una ayuda operativa para localizar animales. No es por si misma un movimiento, tratamiento, baja ni diagnostico. La IA no debe decir que un aviso queda resuelto, que un tratamiento queda registrado o que un movimiento queda hecho por leer un crotal. Cualquier cambio real requiere la pantalla correspondiente y accion del usuario.

## Fuentes internas
- Decision de producto: nombre visible `Busqueda inteligente`.
- Decision de producto: lista privada por usuario.
- Decision de producto: leer marca visto, no elimina.
- Backend: `/api/animal-watchlist`.

## Nota de uso para el RAG
Recuperar este documento cuando el usuario pregunte por Busqueda inteligente, lista de animales marcados, localizar animales con lector, contador de pendientes/vistos o por que un animal leido sigue apareciendo.
