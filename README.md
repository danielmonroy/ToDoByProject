# Mapa mental de proyectos y tareas

Tablero personal de proyectos y tareas. La interfaz sigue siendo la misma, pero los datos ya no dependen del navegador: se guardan en el servidor, con una contraseña, para abrirlos desde cualquier dispositivo.

El archivo de datos es `DATA_DIR/board.json`. Cada vez que se reemplaza, la versión anterior queda en `board.json.bak`.

## Requisitos

- Node.js 22.18 o posterior. En el droplet lo instala `deploy/install.sh` si no está.
- El proceso corre directo con systemd. No hace falta Docker.

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
sudo chown kanban:kanban /opt/kanban/data/board.json
sudo systemctl restart kanban
```

Si la app ya está en marcha, también puedes entrar y usar **Importar** con ese JSON. Importar reemplaza el tablero del servidor.

## Desplegar en el servidor

Estas instrucciones son para un droplet con Ubuntu. El programa es un proceso de Node gestionado por systemd. No hace falta una base de datos ni Docker.

### 1. Preparar el servidor

Entra por SSH e instala git:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw enable
```

Cuando más adelante uses nginx y HTTPS, cierra el 3000 público y deja 80 y 443. El puerto 22 de SSH tiene que seguir abierto.

### 2. Instalar el servicio

```bash
git clone https://github.com/danielmonroy/ToDoByProject /opt/kanban
cd /opt/kanban
sudo bash deploy/install.sh
```

La primera vez el script crea `/opt/kanban/.env` y se detiene. Edita ese archivo y cambia `APP_PASSWORD` y `SESSION_SECRET`. Puedes generar el secreto con:

```bash
openssl rand -base64 32
```

Vuelve a lanzar la instalación:

```bash
sudo bash deploy/install.sh
```

Eso instala Node.js 22 en `/opt/nodejs` si el sistema no tiene una versión suficiente, compila la app con el usuario `kanban` y la deja arrancada. Queda en `http://IP_DEL_DROPLET:3000`. Los datos persisten en `/opt/kanban/data`.

Para ver si está corriendo y qué escribe:

```bash
sudo systemctl status kanban
journalctl -u kanban -f
```

### 3. Actualizar

En el servidor, dentro de `/opt/kanban`:

```bash
sudo bash deploy/update.sh
```

Baja el código nuevo, vuelve a compilar y reinicia el proceso. La carpeta `data` no se toca.

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

En `/opt/kanban/.env` pon `HOST=127.0.0.1` y `TRUST_PROXY=true`, y si el sitio se usa siempre por HTTPS, `COOKIE_SECURE=true`. Reinicia la app y cierra el puerto directo:

```bash
sudo systemctl restart kanban
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
| `HOST` | Interfaz de escucha. `0.0.0.0` para abrir el puerto. `127.0.0.1` cuando nginx está delante. |
| `PORT` | Puerto. Por defecto `3000`. |
| `TRUST_PROXY` | `true` solo detrás de nginx, para la IP real y la cookie segura. |
| `COOKIE_SECURE` | `true`, `false` o vacío. Vacío la marca `Secure` solo si la petición llega como HTTPS. |

## Copias

Para guardar una copia basta con copiar `data/board.json`. Si un reemplazo sale mal, `data/board.json.bak` es el tablero anterior. La herramienta de migración también deja un `.bak` cuando sobrescribe un archivo.
