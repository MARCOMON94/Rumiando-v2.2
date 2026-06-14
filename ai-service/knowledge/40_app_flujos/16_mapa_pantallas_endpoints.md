# Mapa actual de pantallas, flujos y endpoints

## Resumen
Este documento sustituye el mapa provisional antiguo. La IA debe hablar de pantallas reales de RumiAndo y abrir flujos visuales, no prometer ejecucion directa desde chat.

## Pantallas principales
- Home `/home`: menu de trabajo. Buscar crotal activa lector silencioso `lookup`; Parto activa `parto`; Baja activa `baja`.
- Censo `/animals`: busqueda y filtros progresivos. Tarjeta por animal con ultimos 4 digitos, Busqueda inteligente, Alerta y Ficha.
- Ficha `/animals/:id`: resumen de animal, boton para Busqueda inteligente, alerta manual, parto, baja, salud, alertas, estadisticas y genealogia.
- Busqueda inteligente `/animal-watchlist`: lista privada por usuario para localizar animales. Lector activo por defecto.
- Operaciones por lector `/operations/movement`, `/operations/reproductive`, `/operations/health`: lista de crotales, formulario de accion y boton `Finalizar`.
- Parto `/birth/new/:motherId`: crea crias desde madre leida por lector silencioso.
- Baja `/animals/:id/discharge`: registra salida/baja con causa.
- Avisos `/reminders`: avisos automaticos y recomendaciones. Puede enviar animales a Busqueda inteligente.
- Estadisticas `/dashboard`: consultas dinamicas, filtros, graficas, listado y exportacion Excel/email.
- Chat IA `/ai-chat`: interpreta lenguaje natural y devuelve `ui_action` para abrir pantallas, no para escribir directamente.
- Configuracion: se abre desde Home como modal; administra cuenta, usuario, invitaciones, corrales, avisos, automatizaciones, color y anadir animales.

## Endpoints vivos de consulta y accion
- Animales: `GET/POST/PUT /api/animals`.
- Corrales: `GET/POST/PUT /api/pens`, `POST /api/pens/:id/retire`.
- Unidades REGA: `GET/POST/PUT /api/farm-units`.
- Movimientos: `GET/POST /api/movements`.
- Eventos sanitarios: `GET/POST/PUT /api/health-cases`, `GET/POST/PUT /api/vaccinations`, `GET/POST/PUT /api/dewormings`.
- Reproduccion: `GET/POST/PUT /api/reproductive-events`.
- Avisos: `GET/POST/PUT /api/reminders`, completar y posponer.
- Busqueda inteligente: `GET/POST/DELETE /api/animal-watchlist`, `POST /api/animal-watchlist/read`.
- Analitica: `GET /api/analytics/options`, `POST /api/analytics/query`, `POST /api/analytics/export/excel`, `POST /api/analytics/export/email`.
- Configuracion: `GET/PUT /api/account-settings`, `GET/PUT /api/alert-settings`, `GET/POST/PUT/DELETE /api/management-rules`.
- Normalizacion sanitaria: `POST /api/catalogs/sanitary-normalize`.
- IA: `POST /api/ai/chat`, health/history/learning.

## Contrato IA hacia frontend
- `operation_flow`: abre `/operations/movement`, `/operations/reproductive` o `/operations/health` con borrador temporal.
- `silent_reader`: activa lector inferior para `lookup`, `parto` o `baja`.
- `open_route`: abre pantalla existente como Busqueda inteligente, Censo, Estadisticas o Avisos.
- `manual_reminder`: prepara alerta manual con texto/fecha si se puede inferir.

## Reglas de lenguaje
- "pasa 3 cabras a produccion" = operation_flow movement, destino Produccion, objetivo orientativo 3 cabras.
- "vacuna estas de lengua azul" = operation_flow health, tipo vacunacion, texto vacuna "lengua azul".
- "desparasita el lote" = operation_flow health, tipo desparasitacion.
- "pon estas como gestantes de 8 semanas" = operation_flow reproductive, diagnostico gestacion positivo, 8 semanas.
- "se ha muerto esta cabra" = silent_reader baja con causa muerte.
- "ha parido esta oveja" = silent_reader parto.
- "busca la lista" o "abre busqueda inteligente" = open_route `/animal-watchlist`.

## Legacy que no debe recuperar la IA
- `OperationSessionPanel`, `OperationSessionContext`, `AnimalReaderPanel` y `/movements/new` son flujo antiguo o candidato a limpieza.
- Si aparece documentacion antigua que diga que `Finalizar` no registra, debe ignorarse: en `/operations/*`, `Finalizar` si ejecuta el registro real.
