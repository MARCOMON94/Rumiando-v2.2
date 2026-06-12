# Catalogo de endpoints y acciones confirmables desde IA

## Principio
La IA puede consultar datos vivos y preparar borradores de acciones, pero no debe ejecutar cambios de explotacion sin confirmacion explicita del usuario. Si faltan datos minimos, debe pedirlos.

## Consultas vivas disponibles
- GET /dashboard: totales de animales, activos, corrales, casos sanitarios abiertos, desglose por especie, corral y estado reproductivo.
- GET /animals: listado y busqueda por crotal/RFID, especie, sexo, estado, corral o unidad REGA.
- GET /animals/:id: ficha completa de animal con historial.
- GET /catalogs: unidades REGA, especies, razas, estados reproductivos, corrales y enfermedades.
- GET /pens: corrales, capacidad, estado sugerido y conteo de animales.
- GET /farm-units: unidades REGA y codigos REGA.
- GET /movements: movimientos de corral/lote.
- GET /health-cases: casos sanitarios.
- GET /treatments: tratamientos veterinarios.
- GET /vaccinations: vacunaciones.
- GET /dewormings: desparasitaciones.
- GET /reproductive-events: celos, cubriciones, gestaciones, partos, abortos y cambios de estado.
- GET /reminders: avisos pendientes, pospuestos, vencidos o completados.
- GET /animal-watchlist: lista privada del usuario para localizar animales, con `total`, `seenTotal`, `pendingTotal`, animal, ubicacion actual, motivo y marcas de visto.
- GET /exports/animals, /exports/health-cases, /exports/movements, /exports/reminders: exportaciones CSV.

## Acciones que requieren confirmacion
- POST /movements: cambio de corral o lote. Minimos: tipoOperacion, unidadRegaId, corralDestinoId, crotales. Opcionales: aplicarEstadoReproductivo, estadoReproductivoDestinoId, fecha, motivo.
- POST /animals: alta de animal. Minimos: crotal, sexo, unidadRegaId, especieId.
- PUT /animals/:id: modificar animal o dar baja. Para baja usar estadoRegistro=BAJA y, si existe, fechaSalida/destinoSalida.
- POST /pens y PUT /pens/:id: alta o modificacion de corral. Minimos de alta: nombre y unidadRegaId.
- POST /farm-units y PUT /farm-units/:id: alta o modificacion de unidad REGA.
- POST /health-cases y PUT /health-cases/:id: abrir, actualizar o cerrar caso sanitario. Minimos de alta: fechaInicio y unidadRegaId.
- POST /treatments y PUT /treatments/:id: registrar o actualizar tratamiento. Minimos de alta: fechaInicio, medicamentoProducto y caso/animal/corral.
- POST /vaccinations y PUT /vaccinations/:id: registrar o actualizar vacunacion. Minimos de alta: fecha, vacuna, unidadRegaId y animal/corral.
- POST /dewormings y PUT /dewormings/:id: registrar o actualizar desparasitacion. Minimos de alta: fecha, tipo, producto, unidadRegaId y animal/corral.
- POST /reproductive-events y PUT /reproductive-events/:id: registrar o actualizar evento reproductivo o estado gestacional. Minimos de alta: tipoEvento, fecha y animalId.
- POST /reminders, PUT /reminders/:id, PUT /reminders/:id/complete y PUT /reminders/:id/snooze: crear, actualizar, completar o posponer avisos.
- POST /animal-watchlist: anadir animal a la lista de busqueda viva del usuario. Minimos: animalId. Opcionales: motivoTipo, motivoTexto, sourceType y sourceRef.
- POST /animal-watchlist/read: marcar como leido un crotal/RFID incluido en la lista. Incrementa `seenCount` y actualiza `seenAt`/`lastReadAt`; no elimina el animal.
- DELETE /animal-watchlist/:id y DELETE /animal-watchlist: quitar un item o vaciar la lista completa, con confirmacion en UI.
- POST /exports/send-request: solicitud de exportacion CENSO o VETERINARIO. Minimos: tipoExportacion, fechaDesde, fechaHasta y emailDestino.

## Frases de usuario esperadas
- "Mueve estas ovejas al corral de paridas" -> preparar POST /movements y pedir crotales/RFID, unidad REGA, corral destino y fecha.
- "Da de alta esta cabra" -> preparar POST /animals y pedir crotal, sexo, especie, unidad REGA y corral si aplica.
- "Abre un caso sanitario para esta oveja con diarrea" -> responder primero triaje sanitario y preparar POST /health-cases pendiente de confirmacion.
- "Registra tratamiento" -> no inventar medicacion; pedir producto, fecha, retirada y asociacion a caso/animal/corral.
- "Pon aviso para revacunar" -> preparar POST /reminders o POST /vaccinations si ya se esta registrando la vacuna.
- "Cierra este aviso" -> preparar PUT /reminders/:id/complete y pedir identificador del aviso si no esta claro.
- "Pon esta oveja en Animal Watchlist" -> preparar POST /animal-watchlist con motivo opcional.
- "Busca los animales de la lista" -> abrir `/animal-watchlist`; el lector queda activo por defecto.
- "Ya encontre este animal" -> explicar que se marca como visto, pero sigue en la lista hasta borrado manual.

## Flujo UI comun
- El chat no ejecuta acciones directamente: abre la misma OperationSession que los botones de Home.
- La IA debe mostrar o pedir modo: Unitario, Lote o Corral completo.
- El lector solo pega crotales; la app los interpreta, ignora duplicados y separa no encontrados.
- Al pulsar Finalizar, la IA resume encontrados, no encontrados, duplicados, operacion y destino/producto/estado.
- Solo al confirmar se llama al endpoint real.
- En Animal Watchlist, la tarjeta flotante muestra la accion posterior y su subopcion. Seleccionar destino/subopcion no guarda; solo `Finalizar` ejecuta el endpoint correspondiente.
