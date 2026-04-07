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

- Carlos (DJ principal)
- Jose Manuel (Técnico)
- Ismael (Técnico)

## Cómo hacer cambios (paso a paso)

### 1) Cambiar código en tu ordenador

1. Entra al proyecto:
   - `cd /Users/yellowskinalmacen/Documents/DIVERTYSOUND`
2. Edita los archivos que necesites (`index.html`, `app.js`, `styles.css`, etc.).
3. Guarda los cambios.

### 2) Subir cambios a GitHub

1. Añade cambios:
   - `git add .`
2. Crea commit:
   - `git commit -m "describe tu cambio"`
3. Sube al repo:
   - `git push`

### 3) Aplicar cambios en el VPS

1. Entra al VPS:
   - `ssh root@82.223.139.48`
2. Entra a la app:
   - `cd /opt/divertysound`
3. Trae cambios de GitHub:
   - `git pull`
4. Reinstala dependencias (por si cambió `package.json`):
   - `npm install`
5. Reinicia servicio:
   - `systemctl restart divertysound-crm`
6. Verifica estado:
   - `systemctl status divertysound-crm --no-pager`

### 4) Si cambias Nginx

1. Edita la config:
   - `nano /etc/nginx/sites-available/divertysound`
2. Valida y recarga:
   - `nginx -t`
   - `systemctl reload nginx`

### 5) Si cambias variables de entorno

1. Edita:
   - `nano /opt/divertysound/.env`
2. Reinicia app:
   - `systemctl restart divertysound-crm`

### 6) Verificación rápida final

1. API local:
   - `curl -i http://127.0.0.1:8080/api/health`
2. Web pública:
   - `curl -I https://divertysound.s291ab4e.alojamientovirtual.com`