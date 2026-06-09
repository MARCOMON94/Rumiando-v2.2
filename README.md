# RumiAndo v2

Aplicación web full-stack para la gestión ganadera de explotaciones ovinas y caprinas. El proyecto permite consultar animales, registrar altas, revisar fichas individuales, controlar corrales, sanidad, movimientos, avisos automáticos y datos operativos desde un panel web conectado a un backend real.

## Despliegue

* Frontend: `https://rumiando.netlify.app`
* Backend API: `https://rumiando-v2-production.up.railway.app`
* Health check API: `https://rumiando-v2-production.up.railway.app/api/health`

> Las credenciales de demostración no se incluyen en este README por seguridad. Se facilitarán durante la presentación o evaluación.

## Objetivo del proyecto

RumiAndo v2 adapta el patrón de los laboratorios de clase a un dominio ganadero real. En lugar de gestionar películas, eventos o productos genéricos, la aplicación trabaja con animales identificados por crotal, unidades REGA, corrales, registros sanitarios, movimientos, reproducción y avisos automáticos.

El objetivo principal es ofrecer una herramienta sencilla y trazable para que una explotación pueda localizar animales, consultar su historial, registrar movimientos y recibir avisos operativos calculados desde el backend.

## Funcionalidades principales

### Autenticación

* Inicio de sesión con JWT.
* Persistencia de sesión en `localStorage`.
* Rutas protegidas en frontend.
* Middleware de autenticación en backend.
* Roles de usuario: `ADMIN` y `OPERARIO`.

### Animales

* Listado y búsqueda de animales.
* Búsqueda en tiempo real por crotal, número interno, raza, corral o estado reproductivo.
* Apertura automática de ficha cuando el valor introducido coincide exactamente con un crotal.
* Alta de animales mediante formulario controlado.
* Ficha individual con datos organizados por bloques:

  * Identificación.
  * Manejo actual.
  * Reproducción.
  * Genealogía.
  * Eventos reproductivos.
  * Movimientos.
  * Casos sanitarios.
  * Tratamientos.
  * Vacunaciones.
  * Desparasitaciones.
  * Recordatorios.
  * Descendencia.
* Navegación interna entre animales relacionados, por ejemplo madre, padre o descendencia.

### Corrales

* Consulta de corrales registrados.
* Visualización de unidad REGA asociada, tipo funcional, capacidad, estado reproductivo sugerido y estado activo/inactivo.

### Sanidad

* Consulta de casos sanitarios.
* Visualización de casos abiertos/cerrados.
* Identificación de casos asociados a enfermedades de declaración obligatoria.
* Relación con animales, corrales, tratamientos y enfermedades.

### Movimientos

* Listado de movimientos registrados.
* Alta de movimientos individuales o en lote.
* Introducción de crotales por línea, coma o punto y coma.
* Actualización del corral actual del animal desde backend.
* Registro de detalles por crotal: procesado, no encontrado o ya en destino.

### Avisos automáticos

* Consulta de avisos calculados por backend.
* Avisos basados en estado reproductivo, tiempo transcurrido y sanidad.
* Priorización visual de avisos.
* Acceso directo desde cada aviso a la ficha del animal asociado.
* Los avisos desaparecen cuando deja de cumplirse la condición que los genera, por ejemplo tras registrar el movimiento o cambio correspondiente.

### Dashboard

* Resumen general de explotación.
* Métricas principales:

  * Total de animales.
  * Animales activos.
  * Hembras.
  * Machos.
  * Casos sanitarios abiertos.
  * Recordatorios pendientes.
  * Movimientos registrados.
  * Corrales.
* Gráficas simples realizadas con CSS para:

  * Animales por especie.
  * Animales por corral.
  * Estados reproductivos.
  * Casos sanitarios por corral.

### Asistente IA

* Pantalla protegida `/ai-chat`.
* Proxy backend `/api/ai` hacia un servicio FastAPI independiente.
* Endpoints de IA: health, chat e historial de conversación.
* RAG preparado para documentos locales en `ai-service/knowledge/`.
* Tools iniciales para buscar animales, listar avisos, consultar dashboard y preparar movimientos con confirmación del usuario.

## Tecnologías utilizadas

### Frontend

* React.
* Vite.
* React Router.
* Context API.
* CSS puro con Grid, Flexbox y media queries.
* Fetch API centralizada en `apiClient`.

### Backend

* Node.js.
* Express.
* PostgreSQL.
* Prisma ORM.
* JWT.
* bcrypt.
* CORS.
* dotenv.

### Servicio IA

* FastAPI.
* Pydantic v2.
* Memoria conversacional de sesion y almacenamiento opcional para desarrollo.
* RAG local sobre documentos Markdown o TXT.
* ChromaDB para vector store local.
* LangGraph como orquestador del flujo IA, con fallback secuencial si la dependencia no esta disponible en local.

### Testing y herramientas

* Jest.
* Supertest.
* Nodemon.
* Prisma CLI.
* Thunder Client / Postman para pruebas manuales de endpoints.

### Despliegue

* Frontend desplegado en Netlify.
* Backend desplegado en Railway.
* Base de datos PostgreSQL en Railway.

## Arquitectura general

El proyecto usa una estructura de monorepo con dos carpetas principales:

```txt
Rumiando-v2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── _redirects
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
```

## Estructura del backend

El backend sigue el patrón trabajado en los laboratorios:

```txt
routes -> middlewares -> controllers -> services -> Prisma -> PostgreSQL
```

### Rutas principales

* `/api/auth`
* `/api/animals`
* `/api/catalogs`
* `/api/pens`
* `/api/farm-units`
* `/api/movements`
* `/api/health-cases`
* `/api/treatments`
* `/api/vaccinations`
* `/api/dewormings`
* `/api/reproductive-events`
* `/api/reminders`
* `/api/exports`
* `/api/dashboard`
* `/api/ai`
* `/api/automation`

### Middlewares principales

* Autenticación JWT.
* Control de roles.
* Manejo centralizado de errores.
* Manejo de rutas no encontradas.
* Validación de clave para integraciones externas.

## Estructura del frontend

El frontend sigue el patrón trabajado en los laboratorios de React:

```txt
pages -> components -> context -> api -> routes -> styles
```

### Rutas principales

* `/login`
* `/animals`
* `/animals/new`
* `/animals/:id`
* `/dashboard`
* `/reminders`
* `/pens`
* `/health`
* `/movements`
* `/movements/new`
* `/ai-chat`

La ruta raíz `/` redirige a `/animals`, porque la pantalla principal de trabajo es el censo animal.

## Variables de entorno

### Backend

Archivo `backend/.env`:

```env
DATABASE_URL="postgresql://usuario:password@host:puerto/base_de_datos"
JWT_SECRET="clave_secreta"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="https://rumiando.netlify.app"
N8N_API_KEY="clave_para_integraciones"
AI_SERVICE_URL="http://localhost:8000"
LEARNING_QUEUE_TOKEN="mismo_token_que_ai_service_si_se_usan_endpoints_learning"
NODE_ENV="development"
PORT=3000
```

### Frontend local

Archivo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### Frontend producción en Netlify

Variable configurada en Netlify:

```env
VITE_API_URL=https://rumiando-v2-production.up.railway.app/api
```

### Servicio IA local

Archivo `ai-service/.env`:

```env
AI_SERVICE_NAME="RumiAndo AI Service"
RUMIANDO_API_URL="http://localhost:3000/api"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000"
CHAT_HISTORY_MODE=none
MAX_HISTORY_MESSAGES=20
SAVE_UNRESOLVED_QUESTIONS=true
ANONYMIZE_UNRESOLVED_QUESTIONS=true
LEARNING_USE_OPENAI_REFORMULATION=false
LEARNING_QUEUE_TOKEN="token_largo_para_n8n_o_admin"
USE_LLM=false
OPENAI_FALLBACK_ON_UNKNOWN=true
OPENAI_STORE=false
```

## Instalación local

### 1. Clonar repositorio

```bash
git clone https://github.com/MARCOMON94/Rumiando-v2.git
cd Rumiando-v2
```

### 2. Instalar backend

```bash
cd backend
npm install
```

### 3. Configurar variables de entorno backend

Crear `backend/.env` con las variables necesarias.

### 4. Preparar Prisma

```bash
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

### 5. Arrancar backend

```bash
npm run dev
```

El backend local queda disponible en:

```txt
http://localhost:3000
```

### 6. Instalar frontend

En otra terminal:

```bash
cd frontend
npm install
```

### 7. Configurar variables frontend

Crear `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 8. Arrancar frontend

```bash
npm run dev
```

El frontend local queda disponible en:

```txt
http://localhost:5173
```

### 9. Instalar y arrancar servicio IA

En otra terminal:

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Crear ai-service/.env con las variables necesarias
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Los documentos RAG se colocan en `ai-service/knowledge/`. La guia de generacion
esta en `docs/rag-documentos-necesarios.md`.

## Scripts disponibles

### Backend

```bash
npm run dev              # Ejecutar backend en desarrollo con nodemon
npm start                # Ejecutar backend en producción
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Ejecutar migraciones en desarrollo
npm run prisma:studio    # Abrir Prisma Studio
npm run prisma:seed      # Insertar datos de demostración
npm test                 # Ejecutar tests
```

### Frontend

```bash
npm run dev      # Ejecutar frontend en desarrollo
npm run build    # Generar build de producción
npm run preview  # Previsualizar build
npm run lint     # Ejecutar ESLint
```

## Modelo de datos principal

El modelo se centra en una cuenta ganadera que contiene usuarios, unidades REGA, animales, corrales, catálogos, registros sanitarios, movimientos y recordatorios.

Entidades principales:

* `User`
* `CuentaGanadera`
* `UnidadRega`
* `Animal`
* `Corral`
* `CatalogoEspecie`
* `CatalogoRaza`
* `CatalogoEstadoReproductivo`
* `CatalogoEnfermedad`
* `MovimientoTransaccion`
* `MovimientoAnimalDetalle`
* `CasoSanitario`
* `TratamientoVeterinario`
* `Vacunacion`
* `Desparasitacion`
* `EventoReproductivo`
* `Recordatorio`
* `ExportacionRegistro`

## Adaptación de los laboratorios

El proyecto reutiliza patrones trabajados en los laboratorios del bootcamp:

### Backend

* Servidor Express.
* Separación de responsabilidades en rutas, controladores y servicios.
* Prisma ORM para acceso a PostgreSQL.
* Relaciones entre tablas.
* Autenticación JWT.
* Middleware de roles.
* Manejo centralizado de errores.
* Variables de entorno.
* Integración externa mediante endpoint de automatización.

### Frontend

* React con Vite.
* React Router.
* Rutas dinámicas como `/animals/:id`.
* Context API para sesión y catálogos.
* Formularios controlados.
* Estados de carga, error y vacío.
* Consumo de API con token.
* Renderizado condicional.
* Búsquedas y filtros con arrays.
* Navegación programática con `useNavigate`.
* Responsive con CSS puro.

## Funcionalidades destacadas de React

### Buscador por crotal exacto

La página de animales permite escribir o pegar un crotal. Si el valor coincide exactamente con un animal cargado desde la API, se redirige automáticamente a la ficha mediante `useNavigate`.

Esto simula un uso real con lector de crotales: el ganadero puede leer un crotal y abrir directamente la ficha del animal.

### Menú responsive

En escritorio se utiliza un menú lateral fijo. En dispositivos pequeños se transforma en menú hamburguesa mediante `useState`, renderizado condicional y clases CSS.

### Dashboard visual sin librerías externas

El dashboard representa datos mediante cards y barras CSS sencillas, sin depender de librerías de gráficos. Esto mantiene el proyecto más ligero y se ajusta al alcance del MVP.

## Integración externa

El backend expone endpoints bajo `/api/automation` para que una herramienta externa como n8n pueda consultar resúmenes operativos o sanitarios.

Ejemplo:

```txt
GET /api/automation/daily-operational-summary?cuentaGanaderaId=1
```

Header requerido:

```txt
x-api-key: clave_configurada
```

Estos endpoints permiten crear automatizaciones externas, por ejemplo correos periódicos con avisos calculados por el backend.

## Cumplimiento de requisitos del proyecto

| Requisito                          | Implementación en RumiAndo v2                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| API REST con al menos 4 recursos   | Animales, corrales, movimientos, sanidad, recordatorios, catálogos, dashboard                                 |
| Autenticación JWT                  | Login, token, `/auth/me`, rutas protegidas                                                                    |
| Roles de usuario                   | `ADMIN`, `OPERARIO`                                                                                           |
| PostgreSQL con tablas relacionadas | Modelo Prisma con relaciones entre cuenta, usuarios, animales, corrales, sanidad, movimientos y recordatorios |
| Prisma ORM                         | Acceso a datos mediante Prisma Client                                                                         |
| Validaciones                       | Validaciones en servicios antes de crear o actualizar recursos                                                |
| Manejo centralizado de errores     | Middleware de errores y clase `AppError`                                                                      |
| Variables de entorno               | `.env` en backend y `VITE_API_URL` en frontend                                                                |
| Integración externa                | Endpoints `/api/automation` preparados para n8n                                                               |
| React + Vite                       | Frontend con Vite                                                                                             |
| React Router                       | Rutas públicas, protegidas y dinámicas                                                                        |
| Conexión API real                  | `apiClient` con fetch y JWT                                                                                   |
| Context API                        | `AuthContext` y `CatalogsContext`                                                                             |
| Formularios controlados            | Login, alta animal y alta movimiento                                                                          |
| Loading/error/empty states         | Implementados en páginas principales                                                                          |
| Deploy frontend                    | Netlify                                                                                                       |
| Deploy backend                     | Railway                                                                                                       |
| Base de datos en nube              | PostgreSQL en Railway                                                                                         |

## Pruebas manuales reaslizadas

1. Iniciar sesión.
2. Abrir `/animals`.
3. Buscar un animal por crotal.
4. Confirmar que la ficha se abre automáticamente si el crotal coincide exactamente.
5. Registrar un animal nuevo.
6. Consultar corrales.
7. Consultar casos sanitarios.
8. Registrar un movimiento con uno o varios crotales.
9. Verificar que el movimiento aparece en el listado.
10. Consultar avisos automáticos.
11. Abrir la ficha del animal desde un aviso.
12. Comprobar dashboard y métricas.

## Despliegue

### Netlify

Configuración del frontend:

```txt
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

Variable:

```env
VITE_API_URL=https://rumiando-v2-production.up.railway.app/api
```

El archivo `frontend/public/_redirects` permite que las rutas de React Router funcionen al refrescar:

```txt
/* /index.html 200
```

### Railway

Configuración del backend:

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
FRONTEND_URL=https://rumiando.netlify.app
N8N_API_KEY=...
NODE_ENV=production
```

## Mejoras futuras

* Integrar recordatorios pospuestos con el cálculo de avisos automáticos.
* Añadir formularios completos de sanidad, vacunaciones y reproducción.
* Añadir exportaciones descargables en frontend.
* Mejorar roles y permisos por explotación.
* Añadir paginación y búsqueda backend para censos grandes.
* Mejorar visualización de genealogía.
* Añadir pruebas automatizadas más completas.
* Integrar n8n Cloud o n8n desplegado para envío periódico de correos.

## Estado del proyecto

RumiAndo v2 funciona como MVP full-stack desplegado. El frontend se comunica con el backend en producción, el backend persiste datos en PostgreSQL mediante Prisma y la aplicación incluye autenticación, rutas protegidas, CRUD principal, formularios, dashboard, avisos automáticos y despliegue en la nube.
