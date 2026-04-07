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

## Despliegue recomendado: VPS (Node + DB local)

### 1) Preparar servidor (Ubuntu)

1. Instala Node 20 y utilidades:
   - `sudo apt update && sudo apt install -y nginx git curl`
2. Instala Node.js 20 (NodeSource):
   - `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`
   - `sudo apt install -y nodejs`
3. Crea carpeta del proyecto:
   - `sudo mkdir -p /var/www/divertysound`
   - `sudo chown -R $USER:$USER /var/www/divertysound`

### 2) Subir y arrancar app

1. Clona repo en VPS:
   - `git clone https://github.com/TU_USUARIO/TU_REPO.git /var/www/divertysound`
2. Instala dependencias:
   - `cd /var/www/divertysound && npm install`
3. Configura variables:
   - `cp .env.example .env`
   - Edita `.env` y cambia `ADMIN_PASSWORD`.
4. Prueba local en VPS:
   - `npm start`
   - Debe responder `http://127.0.0.1:8080/api/health`

### 3) Servicio permanente con systemd

1. Copia servicio:
   - `sudo cp deploy/divertysound-crm.service /etc/systemd/system/divertysound-crm.service`
2. Activa y arranca:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable divertysound-crm`
   - `sudo systemctl start divertysound-crm`
3. Logs:
   - `sudo journalctl -u divertysound-crm -f`

### 4) Nginx + dominio + HTTPS

1. Copia config Nginx:
   - `sudo cp deploy/nginx-divertysound.conf /etc/nginx/sites-available/divertysound`
2. Edita `server_name` en ese archivo con tu dominio real.
3. Activa sitio:
   - `sudo ln -s /etc/nginx/sites-available/divertysound /etc/nginx/sites-enabled/divertysound`
   - `sudo nginx -t && sudo systemctl reload nginx`
4. SSL con Certbot:
   - `sudo apt install -y certbot python3-certbot-nginx`
   - `sudo certbot --nginx -d crm.tudominio.com`

### 5) Actualizaciones futuras en VPS

1. `cd /var/www/divertysound`
2. `git pull`
3. `npm install`
4. `sudo systemctl restart divertysound-crm`


## Login

- Usuario: `admin`
- Contraseña: `divertysound1`
- En VPS se recomienda cambiarla en `.env` (`ADMIN_PASSWORD=...`)

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
