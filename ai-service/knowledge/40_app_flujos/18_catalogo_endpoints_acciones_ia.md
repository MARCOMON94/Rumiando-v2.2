# Catalogo de endpoints y acciones desde IA

## Principio
El chat no llama endpoints de escritura para modificar la explotacion. Devuelve `ui_action` para que el frontend abra el flujo actual de la app. Los endpoints de escritura se ejecutan desde la pantalla cuando el ganadero pulsa `Finalizar` o `Guardar`.

## Consultas vivas
- GET /dashboard
- GET /animals y GET /animals/:id
- GET /catalogs
- GET /pens
- GET /farm-units
- GET /movements
- GET /health-cases
- GET /vaccinations
- GET /dewormings
- GET /reproductive-events
- GET /reminders
- GET /animal-watchlist
- GET /automation/daily-operational-summary/app
- GET /api/analytics/options y POST /api/analytics/query
- GET /api/alert-settings
- GET /api/management-rules

## Pantallas que abre la IA
- Movimiento de corral: `/operations/movement`, usa POST /movements al finalizar.
- Estado reproductivo: `/operations/reproductive`, usa POST /reproductive-events y, si se acepta regla, POST /movements.
- Evento sanitario: `/operations/health`, usa POST /vaccinations, POST /dewormings o POST /health-cases segun tipo.
- Parto: lector silencioso `parto`, luego `/birth/new/:motherId`; crea crias, evento PARTO y movimientos si se confirman.
- Baja: lector silencioso `baja`, luego `/animals/:id/discharge`; actualiza `estadoRegistro=BAJA`.
- Busqueda inteligente: `/animal-watchlist`; la lista es privada por usuario.
- Aviso manual: pantalla de avisos/recordatorios con motivo y fecha sugeridos.

## Endpoints nuevos relevantes
- GET/POST/DELETE /api/animal-watchlist y POST /api/animal-watchlist/read.
- GET/PUT /api/alert-settings para configuracion de avisos por cuenta/REGA.
- GET/POST/PUT/DELETE /api/management-rules para automatizaciones corral/reproduccion.
- POST /api/catalogs/sanitary-normalize para normalizar vacunas, desparasitantes y enfermedades.
- POST /api/analytics/export/excel y POST /api/analytics/export/email para exportar el listado visible.

## Frases esperadas
- "Quiero pasar 3 cabras a produccion" -> `operation_flow` movement, destino Produccion, objetivo 3 cabras.
- "Vacuna estas de lengua azul" -> `operation_flow` health, tipo vacunacion, texto lengua azul.
- "Desparasita el lote" -> `operation_flow` health, tipo desparasitacion.
- "Pon estas como gestantes de 8 semanas" -> `operation_flow` reproductive, diagnostico positivo, 8 semanas.
- "Se ha muerto esta cabra" -> `silent_reader` baja, causa muerte.
- "Ha parido esta oveja" -> `silent_reader` parto.
- "Busca la lista" -> `open_route` `/animal-watchlist`.

## Nota para el RAG
No hablar de `OperationSessionPanel` salvo como sistema antiguo. El flujo vigente es pantalla real + lector + lista + `Finalizar`.
