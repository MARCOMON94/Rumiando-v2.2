# RumiAndo v2

RumiAndo v2 es una aplicacion web full-stack para gestion ganadera. Esta pensada para trabajo real en explotaciones: consultar censo, abrir fichas por crotal, mover animales, registrar estados reproductivos, crear eventos sanitarios, revisar avisos, generar estadisticas/exportaciones y usar un chat IA que prepara flujos de la app sin ejecutar cambios a ciegas.

El proyecto esta organizado como monorepo con tres servicios:

- `frontend`: React + Vite.
- `backend`: Node.js + Express + Prisma + PostgreSQL.
- `ai-service`: FastAPI + RAG local/Chroma + herramientas de app.

## Estado Actual

La app esta en fase activa de evolucion. Los flujos vigentes son:

- Home como menu principal de trabajo.
- Lector silencioso global desde la lupa inferior o el boton "Buscar crotal".
- Busqueda inteligente en `/animal-watchlist`.
- Operaciones nuevas con lector y lista en `/operations/movement`, `/operations/reproductive` y `/operations/health`.
- Parto en `/birth/new/:motherId`.
- Baja en `/animals/:id/discharge`.
- Censo, ficha animal, avisos, estadisticas, configuracion y chat IA actualizados.

Hay piezas legacy conservadas temporalmente para limpieza segura. Estan documentadas en `docs/cleanup-inventario-frontend.md`.

## Despliegue

- Frontend: `https://rumiando.netlify.app`
- Backend API: `https://rumiando-v2-production.up.railway.app`
- Health check API: `https://rumiando-v2-production.up.railway.app/api/health`

Las credenciales, tokens y claves privadas no deben documentarse en este README.

## Funcionalidades Principales

### Autenticacion y cuentas

- Acceso con Google.
- Sesion protegida con JWT/cookie.
- Roles `ADMIN` y `OPERARIO`.
- Invitaciones por cuenta ganadera.
- Configuracion compartida por cuenta ganadera para corrales, REGA, avisos, automatizaciones y usuarios.
- Preferencias visuales como modo claro/oscuro mantenidas como preferencia de usuario/dispositivo.

### Home y navegacion movil

- Home es el menu principal de trabajo.
- Barra inferior movil fija tipo app.
- Lupa central para lector silencioso.
- Badge de avisos en el cencerro.
- Boton `+` con accesos rapidos a Parto, Baja, Movimiento de corral, Estado reproductivo y Evento sanitario.

### Lector silencioso

El lector silencioso global permite leer un crotal desde casi cualquier pantalla.

- `lookup`: abre ficha animal en segundo plano y se apaga al encontrar animal.
- `parto`: al leer madre abre el flujo de parto.
- `baja`: al leer animal abre el flujo de baja.

Si se activa desde una operacion con lista, debe volver a la operacion sin perder la lista.

### Censo y ficha animal

- Censo con busqueda y filtros progresivos.
- Tarjetas compactas con ultimos digitos del crotal, Busqueda inteligente, Alerta y Ficha.
- Ficha individual con datos resumidos y accesos a:
  - Busqueda inteligente.
  - Alerta manual.
  - Parto.
  - Baja.
  - Salud, alertas, estadisticas, genealogia, estado reproductivo y corral.

### Busqueda inteligente

Ruta: `/animal-watchlist`.

Busqueda inteligente es una lista privada por usuario para localizar animales fisicamente con el lector.

- Se puede anadir desde avisos, ficha y censo.
- El motivo puede venir de un aviso o ser manual/opcional.
- La pantalla tiene lector activo por defecto.
- Al leer un crotal incluido, avisa, parpadea en naranja y muestra tarjeta flotante.
- El animal queda visto/tachado, pero no desaparece hasta que el usuario lo quite.
- La API prepara contadores `total`, `seenTotal` y `pendingTotal`.

Internamente puede aparecer como `animal-watchlist`, pero el nombre visible para el ganadero es Busqueda inteligente.

### Operaciones por lector

Las operaciones actuales no usan el panel antiguo. Funcionan como pantallas reales:

- `/operations/movement`: Movimiento de corral.
- `/operations/reproductive`: Estado/evento reproductivo.
- `/operations/health`: Evento sanitario.

Patron comun:

1. El ganadero elige/configura la accion.
2. Pasa crotales con el lector.
3. La pantalla crea una lista editable sin duplicados.
4. Puede quitar animales de la lista con confirmacion.
5. Al pulsar `Finalizar`, se registran acciones individuales.
6. Se muestra resumen de procesados y fallidos.

El lector de estas pantallas debe capturar pegado/lectura aunque haya foco en controles, salvo campos manuales marcados explicitamente.

### Movimiento de corral

- Seleccion de corral destino.
- Motivo opcional.
- Lista de animales por crotal.
- Si existe regla de automatizacion asociada al corral, se pregunta al finalizar si se aplica tambien el cambio reproductivo.

### Estado reproductivo

- Seleccion de estado/evento destino.
- Diagnostico de gestacion con resultado y semanas estimadas.
- Si existe regla de automatizacion asociada al estado/evento, se pregunta al finalizar si tambien se mueve al corral configurado.

### Evento sanitario

Nombre visible: Evento sanitario. Nombres internos/API pueden seguir usando `health`.

Tipos previstos:

- Vacunacion.
- Desparasitacion.
- Enfermedad.
- Otro.

Solo en Evento sanitario existe la opcion de corral completo. Si se usa, se expande a registros individuales por animal para que cada ficha conserve historial.

La normalizacion sanitaria usa catalogos/alias/RAG y, si procede, confirmacion antes de guardar un nombre nuevo.

### Parto

Ruta: `/birth/new/:motherId`.

- Se abre desde lector silencioso en modo parto o desde ficha.
- Permite crear una o varias crias.
- Prepara crotal provisional editable.
- Padre opcional.
- Hereda REGA, especie y raza cuando corresponde.
- Crea evento reproductivo `PARTO`.
- Pregunta destino de crias/madre si existen corrales como Paridera o Produccion.

### Baja

Ruta: `/animals/:id/discharge`.

- Se abre desde lector silencioso en modo baja o desde ficha.
- Permite seleccionar causa.
- Marca `estadoRegistro=BAJA`.
- Debe bloquear nuevas acciones operativas sobre ese animal.
- Al dar de baja, se deben limpiar Busqueda inteligente y recordatorios pendientes asociados.

### Avisos y recordatorios

- Avisos automaticos calculados por backend.
- Recordatorios manuales creados por el usuario.
- Configuracion de avisos por cuenta ganadera/REGA.
- Badge movil con avisos pendientes.
- Desde avisos se puede abrir ficha o anadir a Busqueda inteligente.

Los avisos automaticos no se borran manualmente como si fueran tareas aisladas: desaparecen al resolver la condicion que los genera.

### Configuracion

Configuracion se abre como modal propio desde Home.

Orden actual recomendado:

1. Cuenta ganadera.
2. Usuario.
3. Invitaciones.
4. Corrales.
5. Avisos.
6. Automatizacion.
7. Anadir animales.
8. Modo de color.
9. Cerrar sesion.

Solo admin puede modificar ajustes de explotacion. Operarios pueden recibir el efecto de esos ajustes.

### Corrales y automatizaciones

- Corrales persistentes por cuenta/REGA.
- Evitar nombres duplicados normalizando mayusculas, espacios y variantes.
- Eliminacion segura de corral con traslado obligatorio si tiene animales.
- Reglas de manejo:
  - Corral -> reproduccion.
  - Reproduccion -> corral.
- Las reglas preguntan al finalizar; no deben aplicar cambios silenciosos sin confirmacion.

### Anadir animales e importacion

Configuracion incluye `Anadir animales` con dos modos:

- Lista por lectura: se pasan crotales y se dan de alta en REGA/corral inicial.
- Importar Excel/CSV: se carga archivo, se mapean columnas y se limpian datos antes de crear animales.

La primera vez que entra un admin puede aparecer el aviso para importar ganado actual. Debe mostrarse una sola vez por cuenta (`livestockImportPromptSeenAt`).

Para animales importados de golpe, se puede meter todo en un corral inicial como Produccion y explicar que luego se deben mover desde la interfaz si hace falta.

### Estadisticas y Excel

- Panel de estadisticas con filtros progresivos.
- Vistas como circular, barras, linea y listado.
- El listado es la base exacta de exportacion.
- Exportacion Excel real con columnas utiles para el ganadero, evitando IDs internos.
- Envio por email si Brevo/email esta configurado.

### Chat IA

Ruta: `/ai-chat`.

El chat IA no debe ejecutar cambios directamente. Interpreta lenguaje natural y devuelve acciones UI:

- `operation_flow`: abre `/operations/movement`, `/operations/reproductive` o `/operations/health`.
- `silent_reader`: activa lector para `lookup`, `parto` o `baja`.
- `open_route`: abre rutas como `/animal-watchlist`, ficha o estadisticas.
- `manual_reminder`: prepara una alerta manual.

Ejemplos:

- "Quiero pasar 3 cabras a produccion" -> abre Movimiento de corral con destino Produccion y objetivo visual 3.
- "Vacuna estas de lengua azul" -> abre Evento sanitario tipo Vacunacion.
- "Desparasita el lote" -> abre Evento sanitario tipo Desparasitacion.
- "Pon estas como gestantes de 8 semanas" -> abre Estado reproductivo con diagnostico positivo y semanas.
- "Se ha muerto esta cabra" -> activa lector de baja.
- "Ha parido esta oveja" -> activa lector de parto.
- "Busca la lista" -> abre Busqueda inteligente.

## Arquitectura

```txt
Rumiando v2/
|-- backend/
|   |-- prisma/
|   |   |-- schema.prisma
|   |   |-- migrations/
|   |   `-- seed.js
|   |-- src/
|   |   |-- app.js
|   |   |-- server.js
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- tests/
|   |   `-- utils/
|   `-- package.json
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- context/
|   |   |-- hooks/
|   |   |-- pages/
|   |   |-- routes/
|   |   |-- styles/
|   |   |-- App.jsx
|   |   `-- main.jsx
|   `-- package.json
|
|-- ai-service/
|   |-- app/
|   |-- knowledge/
|   |-- storage/
|   |-- tests/
|   `-- README.md
|
|-- docs/
|   `-- cleanup-inventario-frontend.md
|
`-- README.md
```

## Stack

### Frontend

- React.
- Vite.
- React Router.
- Context API.
- CSS propio.
- `xlsx` para importaciones de Excel.

### Backend

- Node.js.
- Express.
- PostgreSQL.
- Prisma ORM.
- JWT.
- Google Auth.
- Brevo/email opcional.
- Jest + Supertest.

### IA

- FastAPI.
- Pydantic.
- RAG sobre Markdown/TXT.
- ChromaDB local si esta disponible.
- Fallback lexical.
- OpenAI opcional como fallback si se configura.

## Rutas Frontend Vigentes

- `/login`
- `/invite/:token`
- `/home`
- `/dashboard`
- `/animals`
- `/animals/new`
- `/animals/:id`
- `/animals/:id/discharge`
- `/birth/new/:motherId`
- `/operations/:type`
- `/animal-watchlist`
- `/reminders`
- `/ai-chat`
- `/admin/invitations`
- `/pens`
- `/health`
- `/movements`

Rutas alias:

- `/ai-vet` -> `/ai-chat`
- `/ai-manager` -> `/ai-chat`
- `/movements/new` -> `/operations/movement` como compatibilidad legacy.

## Endpoints Backend

Base local habitual: `http://localhost:3000/api`.

Principales grupos:

- `/api/auth`
- `/api/invitations`
- `/api/animals`
- `/api/catalogs`
- `/api/pens`
- `/api/farm-units`
- `/api/movements`
- `/api/health-cases`
- `/api/treatments`
- `/api/vaccinations`
- `/api/dewormings`
- `/api/reproductive-events`
- `/api/reminders`
- `/api/exports`
- `/api/dashboard`
- `/api/ai`
- `/api/animal-watchlist`
- `/api/management-rules`
- `/api/account-settings`
- `/api/analytics`
- `/api/alert-settings`
- `/api/automation`
- `/api/health`

## Modelo de Datos Principal

Entidades destacadas:

- `User`
- `Invitation`
- `CuentaGanadera`
- `UnidadRega`
- `AlertSettings`
- `CatalogoEspecie`
- `CatalogoRaza`
- `CatalogoEnfermedad`
- `CatalogoVacuna`
- `CatalogoDesparasitante`
- `CatalogoEstadoReproductivo`
- `Corral`
- `Animal`
- `AnimalWatchlistItem`
- `ManagementRule`
- `MovimientoTransaccion`
- `MovimientoAnimalDetalle`
- `CasoSanitario`
- `TratamientoVeterinario`
- `Vacunacion`
- `Desparasitacion`
- `EventoReproductivo`
- `Recordatorio`
- `ExportacionRegistro`

## Persistencia: Usuario, Cuenta y Local

- Busqueda inteligente: privada por usuario.
- Corrales, REGA, catalogos, reglas, avisos, usuarios y cuenta ganadera: compartidos por cuenta ganadera.
- Modo de color: preferencia visual local/de usuario.
- Sesion: gestionada por autenticacion.
- Importacion inicial vista: `livestockImportPromptSeenAt` en cuenta ganadera.

## Desarrollo Local

### Requisitos

- Node.js compatible con el proyecto.
- npm.
- Python 3.11+ recomendado para `ai-service`.
- PostgreSQL local o una `DATABASE_URL` accesible.

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Backend local:

```txt
http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local:

```txt
http://localhost:5173
```

### Servicio IA

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

IA local:

```txt
http://localhost:8000
```

Reindexar RAG:

```bash
cd ai-service
python -m app.scripts.index_knowledge
```

## Variables de Entorno

### Frontend: `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=tu_google_client_id
```

### Backend: `backend/.env`

```env
DATABASE_URL=postgresql://...
JWT_SECRET=secreto_largo
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=tu_google_client_id
FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT_MS=20000
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_TRANSCRIPTION_TIMEOUT_MS=15000
AI_TRANSCRIPTION_MAX_BYTES=20mb
N8N_API_KEY=clave_integraciones
DEMO_CUENTA_GANADERA_ID=1
EMAIL_ENABLED=false
BREVO_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=RumiAndo
LEARNING_QUEUE_TOKEN=
```

La voz del chat se transcribe de forma temporal: el navegador graba un audio en memoria, el backend lo recibe como binario, lo envía al proveedor de transcripción y descarta el buffer al terminar la petición. RumiAndo no escribe esos audios en disco ni los guarda en base de datos.

### AI service: `ai-service/.env`

```env
AI_SERVICE_ENV=development
RUMIANDO_API_URL=http://localhost:3000/api
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
USE_CHROMA=true
CHAT_HISTORY_MODE=none
MAX_HISTORY_MESSAGES=20
USE_LLM=false
OPENAI_FALLBACK_ON_UNKNOWN=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_STORE=false
SAVE_UNRESOLVED_QUESTIONS=true
ANONYMIZE_UNRESOLVED_QUESTIONS=true
LEARNING_USE_OPENAI_REFORMULATION=false
LEARNING_QUEUE_TOKEN=
```

## Base de Datos Local y Railway

La app puede trabajar con base local y con PostgreSQL en Railway. La regla para no romper nada:

1. Todo cambio de modelo se hace en `backend/prisma/schema.prisma`.
2. En local se crea/aplica migracion con:

```bash
cd backend
npm run prisma:migrate
```

3. En Railway se aplican migraciones pendientes con:

```bash
cd backend
npm run prisma:migrate:deploy
```

4. El script `npm start` del backend ya ejecuta:

```bash
prisma migrate deploy && node src/server.js
```

Por eso, al desplegar backend en Railway, las migraciones versionadas se aplican sobre la base remota.

No editar manualmente tablas en una base y olvidar la otra salvo casos controlados. Si se hace una carga manual inicial, debe documentarse o repetirse con seed/importacion.

## Scripts

### Backend

```bash
npm run dev
npm start
npm run seed
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:studio
npm run prisma:seed
npm test
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

### AI service

```bash
python -m compileall app
python -m unittest discover -s tests
python -m app.scripts.index_knowledge
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Validacion Recomendada

Antes de cerrar una tanda:

```bash
npm --prefix frontend run lint -- --quiet
cd frontend
npm run build
```

```bash
cd backend
npx prisma validate
npm test -- --runInBand
```

```bash
cd ai-service
python -m compileall app
python -m unittest discover -s tests
python -m app.scripts.index_knowledge
```

Prueba manual minima:

1. Login.
2. Home.
3. Lector silencioso normal.
4. Busqueda inteligente.
5. Movimiento de corral.
6. Estado reproductivo.
7. Evento sanitario.
8. Parto.
9. Baja.
10. Censo.
11. Ficha animal.
12. Avisos.
13. Configuracion.
14. Estadisticas/exportacion.
15. Chat IA abriendo flujos.

## Despliegue

### Netlify

Configuracion del frontend:

```txt
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

Variables:

```env
VITE_API_URL=https://rumiando-v2-production.up.railway.app/api
VITE_GOOGLE_CLIENT_ID=tu_google_client_id
```

El archivo `frontend/public/_redirects` debe conservar:

```txt
/* /index.html 200
```

### Railway Backend

Configuracion:

```txt
Root directory: backend
Build command: npm install && npx prisma generate
Start command: npm start
```

Variables principales:

```env
DATABASE_URL=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=...
FRONTEND_URL=https://rumiando.netlify.app
FRONTEND_URLS=https://rumiando.netlify.app,http://localhost:5173,http://127.0.0.1:5173
AI_SERVICE_URL=https://url-del-ai-service.up.railway.app
OPENAI_API_KEY=...
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_TRANSCRIPTION_TIMEOUT_MS=15000
AI_TRANSCRIPTION_MAX_BYTES=20mb
N8N_API_KEY=...
EMAIL_ENABLED=false
BREVO_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=RumiAndo
LEARNING_QUEUE_TOKEN=...
NODE_ENV=production
```

### Railway AI Service

Configuracion:

```txt
Root directory: ai-service
Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variables principales:

```env
AI_SERVICE_ENV=production
RUMIANDO_API_URL=https://rumiando-v2-production.up.railway.app/api
ALLOWED_ORIGINS=https://rumiando.netlify.app,https://rumiando-v2-production.up.railway.app
USE_CHROMA=true
CHAT_HISTORY_MODE=none
USE_LLM=false
OPENAI_FALLBACK_ON_UNKNOWN=true
OPENAI_API_KEY=
OPENAI_STORE=false
SAVE_UNRESOLVED_QUESTIONS=true
ANONYMIZE_UNRESOLVED_QUESTIONS=true
LEARNING_USE_OPENAI_REFORMULATION=false
LEARNING_QUEUE_TOKEN=...
```

## RAG y Conocimiento IA

Los documentos de conocimiento estan en:

```txt
ai-service/knowledge/
```

Bloques principales:

- `00_triaje`: urgencias y signos rojos.
- `10_sanidad`: sintomas, enfermedades, tratamientos, nombres populares.
- `20_manejo`: bioseguridad y manejo general.
- `30_reproduccion`: gestacion, partos, abortos, neonatos.
- `40_app_flujos`: funcionamiento de la app y acciones IA.

Reglas:

- No inventar dosis ni tratamientos cerrados.
- Priorizar fuentes oficiales o marcar pendiente de validacion veterinaria.
- La IA orienta y abre pantallas; no sustituye al veterinario.
- El chat no debe decir "registrado" hasta que la pantalla real confirme guardado.

## Limpieza Legacy

No borrar archivos legacy sin pasar por inventario y pruebas.

Actualmente son candidatos o legacy:

- `OperationSessionProvider`
- `OperationSessionPanel`
- `operationConfig`
- `AnimalReaderPanel`
- `CreateMovementPage`
- ruta `/movements/new`

El detalle esta en:

```txt
docs/cleanup-inventario-frontend.md
```

## Notas de Seguridad y Criterio Veterinario

RumiAndo ayuda a registrar y ordenar informacion, pero no sustituye criterio veterinario ni normativa oficial.

La app/IA debe recomendar veterinario si hay:

- Animal caido o no se levanta.
- Fiebre alta.
- Dificultad respiratoria.
- Sangre, aborto, mortalidad o varios afectados.
- Dolor intenso.
- Sospecha zoonotica.
- Sospecha de enfermedad de declaracion obligatoria.

## Estado del Proyecto

RumiAndo v2 funciona como MVP avanzado en evolucion. La prioridad actual es mantener los flujos nuevos estables, limpiar legacy con cuidado, alinear el RAG de IA con la app real y asegurar que los cambios de datos se aplican tanto en local como en Railway mediante migraciones Prisma.
