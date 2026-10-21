# Mapa mental de proyectos y tareas

Tablero personal de proyectos y tareas. La interfaz sigue siendo la misma, pero los datos ya no dependen del navegador: se guardan en el servidor, con una contraseña, para abrirlos desde cualquier dispositivo.

El archivo de datos es `DATA_DIR/board.json`. Cada vez que se reemplaza, la versión anterior queda en `board.json.bak`.

## Requisitos

- Node.js 22.18 o posterior (el servidor se ejecuta con el soporte de TypeScript incluido en Node)
- Para el droplet, Docker o Node 22 más nginx

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Si no creas un archivo `.env`, la contraseña de desarrollo es `dev-password`. Los datos de desarrollo se guardan en `./data/board.json`.

```bash
npm test
npm run lint
npm run build
npm start
```

`npm start` sirve la carpeta `dist/` y la API en el puerto 3000.

## Acceso

Hay un único usuario. La contraseña es la variable `APP_PASSWORD`. La sesión dura 30 días y va en una cookie `HttpOnly`. En producción la app no arranca si la contraseña mide menos de 8 caracteres o si sigue siendo la del ejemplo.

El tema y si el orden del día está abierto siguen guardados en cada navegador. El tablero es lo que se comparte entre dispositivos.

## Migrar lo que ya tienes en local

Los datos actuales están en el `localStorage` de este navegador, en la clave `kanban-board`. Esa copia no viaja sola a otro dominio. Hay tres formas de pasarla al servidor.

### Desde el mismo navegador

Si abres la versión nueva en el mismo origen donde ya usabas el tablero (por ejemplo `http://localhost:5173`), al entrar verás un aviso con el número de proyectos y tareas. **Subir al servidor** copia esa información a `board.json`. También puedes hacerlo después con el botón **Subir copia local**.

### Desde un archivo exportado

En la app actual pulsa **Exportar** y guarda `kanban-board.json`. Luego, desde esta carpeta:

```bash
npm run migrate -- --file /ruta/kanban-board.json --url https://tu-dominio --password "$APP_PASSWORD"
```

La contraseña también puede ir en la variable `APP_PASSWORD` en vez de en el comando. Si el servidor ya tiene datos, la herramienta pide confirmación. `--force` reemplaza sin preguntar y `--dry-run` solo muestra el resumen.

Para dejar el archivo listo y copiarlo al droplet:

```bash
npm run migrate -- --file /ruta/kanban-board.json --out ./data/board.json
scp ./data/board.json root@IP_DEL_DROPLET:/opt/kanban/data/board.json
```

Si la app ya está en marcha, también puedes entrar y usar **Importar** con ese JSON. Importar reemplaza el tablero del servidor.

## Desplegar en DigitalOcean

Estas instrucciones son para un droplet con Ubuntu. No hace falta una base de datos aparte.

### 1. Preparar el servidor

Entra por SSH y abre los puertos que vayas a usar.

```bash
sudo apt update
sudo apt install -y ca-certificates curl
```

Para una prueba directa por el puerto 3000:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw enable
```

Cuando pongas nginx y HTTPS, cierra el 3000 público y deja 80 y 443. El puerto 22 de SSH tiene que seguir abierto.

### 2. Con Docker

Instala Docker siguiendo la guía de DigitalOcean para Ubuntu, o el paquete de la distribución si ya lo tienes. En el droplet:

```bash
git clone https://github.com/danielmonroy/ToDoByProject /opt/kanban
cd /opt/kanban
cp .env.example .env
```

Edita `.env` y cambia `APP_PASSWORD` y `SESSION_SECRET`. Puedes generar el secreto con:

```bash
openssl rand -base64 32
```

Arranca:

```bash
docker compose up -d --build
```

La app queda en `http://IP_DEL_DROPLET:3000`. Los datos persisten en `/opt/kanban/data` aunque recrees el contenedor. El proceso dentro del contenedor baja a un usuario sin privilegios de root después de ajustar los permisos de esa carpeta.

Para actualizar:

```bash
git pull
docker compose up -d --build
```

### 3. Con Node y systemd

Instala Node.js 22 y clona el repo en `/opt/kanban`. Crea el usuario, compila y copia la unidad:

```bash
sudo useradd --system --create-home --home-dir /opt/kanban kanban || true
sudo chown -R kanban:kanban /opt/kanban
sudo -u kanban npm ci
sudo -u kanban npm run build
sudo cp deploy/kanban.service /etc/systemd/system/kanban.service
sudo systemctl daemon-reload
sudo systemctl enable --now kanban
```

`/opt/kanban/.env` tiene que existir antes de arrancar, con `NODE_ENV` ya definido por la unidad. Revisa el estado con `sudo systemctl status kanban`.

### 4. HTTPS con nginx

Cuando tengas un dominio apuntando al droplet:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kanban
```

Edita `server_name`, actívalo y pide el certificado:

```bash
sudo ln -s /etc/nginx/sites-available/kanban /etc/nginx/sites-enabled/kanban
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tablero.ejemplo.com
```

En `.env` pon `TRUST_PROXY=true`. Si el sitio se usa siempre por HTTPS, puedes poner también `COOKIE_SECURE=true`. En `docker-compose.yml` cambia el puerto a `127.0.0.1:3000:3000` para que solo nginx llegue a la app, y vuelve a crear el contenedor.

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw delete allow 3000/tcp
```

## Variables

| Variable | Uso |
| --- | --- |
| `APP_PASSWORD` | Contraseña de entrada. Obligatoria en producción. |
| `SESSION_SECRET` | Secreto para firmar la cookie. Obligatorio en producción, 16 caracteres o más. |
| `DATA_DIR` | Carpeta de `board.json`. Por defecto `./data`. |
| `HOST` | Interfaz de escucha. En el servidor usa `0.0.0.0`. |
| `PORT` | Puerto. Por defecto `3000`. |
| `TRUST_PROXY` | `true` solo detrás de nginx, para la IP real y la cookie segura. |
| `COOKIE_SECURE` | `true`, `false` o vacío. Vacío la marca `Secure` solo si la petición llega como HTTPS. |

## Copias

Para guardar una copia basta con copiar `data/board.json`. Si un reemplazo sale mal, `data/board.json.bak` es el tablero anterior. La herramienta de migración también deja un `.bak` cuando sobrescribe un archivo.
