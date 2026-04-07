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

El servidor guarda los datos en:
- `.divertysound-data/users.db`
- `.divertysound-data/sessions.db`
- `.divertysound-data/state.db`


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
