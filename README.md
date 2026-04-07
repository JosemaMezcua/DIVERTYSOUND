# DIVERTYSOUND CRM (Bodas)

CRM de operativa de bodas con backend real (Node + base de datos persistente local) para uso multiusuario:

- Agenda de bodas con estado operativo.
- Ficha completa por evento.
- Bloques de boda: ceremonia, copa de bienvenida y barra libre.
- Checklist de material por evento con opciones de `truss 2m`, `truss 1m` y `escenario modular por paneles`.
- Marcado de `cargado` por tick verde (toque rápido, pensado para móvil).
- Gestión de personal.
- Nueva página de **Gestión de inventario** para controlar stock real.
- Exportación del evento seleccionado a PDF con formato visual.
- Login único compartido para el equipo.

## Arranque (modo pro multiusuario)

1. Instala dependencias:
   - `npm install`
2. Arranca el servidor:
   - `npm start`
   - Si el `8080` está ocupado: `PORT=8090 npm start`
3. Abre:
   - `http://localhost:8080`

El servidor guarda los datos en:
- `.divertysound-data/users.db`
- `.divertysound-data/sessions.db`
- `.divertysound-data/state.db`

## Despliegue recomendado: Vercel + Render

### 1) Backend en Render

1. Crea un nuevo **Web Service** en Render conectado a este repo.
2. Configura:
   - Runtime: `Node`
   - Build command: `npm install`
   - Start command: `npm start`
3. Variables de entorno en Render:
   - `NODE_ENV=production`
   - `ADMIN_PASSWORD=tu_password_seguro`
   - `FRONTEND_ORIGIN=https://tu-frontend.vercel.app`
   - Opcional: `ALLOW_VERCEL_PREVIEWS=true`
4. Despliega y copia tu URL final, por ejemplo:
   - `https://divertysound-backend.onrender.com`

### 2) Frontend en Vercel

1. Importa el repo en Vercel.
2. Framework preset: `Other`.
3. Deploy.
4. En [index.html](/Users/yellowskinalmacen/Documents/DIVERTYSOUND/index.html:230), cambia:
   - `https://TU-SERVICIO.onrender.com/api`
   - por tu URL real de Render + `/api`, por ejemplo:
   - `https://divertysound-backend.onrender.com/api`
5. Redeploy en Vercel.

### 3) Verificación rápida

1. Abre el frontend de Vercel.
2. Login con `admin` + tu contraseña.
3. Crea o edita una boda.
4. Refresca la página: los cambios deben seguir ahí.


## Login

- Usuario: `admin`
- Contraseña: `divertysound1`
- Opcional: puedes cambiar la contraseña inicial arrancando con `ADMIN_PASSWORD=tu_clave npm start`

## Páginas del CRM

- `Operativa bodas`: agenda, ficha de evento, equipo asignado y material necesario por boda.
- `Gestión inventario`: alta de productos, edición de nombre/categoría y control de stock real.

## PDF de boda

Incluye solo:

- Información de la boda
- Equipo asignado
- Material necesario
- Servicios de Boda

## Equipo por defecto

- Carlos (DJ principal)
- Jose Manuel (Técnico)
- Ismael (Técnico)
