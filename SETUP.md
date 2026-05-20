# MyBrAIn — Arranque local

## Requisitos

- Node.js 18+
- **MySQL** — bien con **Docker** (recomendado si lo tienes instalado) o **servidor MySQL/MariaDB en el sistema**

Si ejecutas `npm run db:up` y sale **`docker: not found`**, Docker no está instalado: usa la **Opción A** (instalar Docker) u **Opción B** (MySQL sin Docker) más abajo.

### Crear `.env` del backend (solo la primera vez)

```bash
cp backend/server/.env.example backend/server/.env
```

Luego edita `backend/server/.env` y rellena `DB_*` (y opcional `GROQ_API_KEY` para IA).

### MySQL desde Cursor (sin DBeaver / Workbench)

1. **Ctrl+Shift+X** → Extensiones → busca **MySQL** e instala la de **cweijan** (u otra cliente MySQL que prefieras).
2. En la barra lateral aparece el icono de base de datos → **Add Connection**:
   - **Host:** `localhost` · **Port:** `3306`
   - **User:** `root` · **Password:** la que hayas definido en tu servidor MySQL
   - **Database:** `mi_app_db` (u otra; debe coincidir con `DB_NAME` en `.env`)
3. Crea la base y las tablas del proyecto (usuario por defecto web **admin** / **1234**):

```bash
mysql -u root -p < backend/database/mi_app_db_init.sql
```

4. En `backend/server/.env` usa los mismos host, usuario, contraseña y nombre de base que en la conexión de Cursor.

## 0. Ya tengo la base de datos en DBeaver (recomendado para ti)

1. En **DBeaver**: conexión activa → **Edit Connection** (o propiedades). Anota:
   - **Server Host** → `DB_HOST` (suele ser `127.0.0.1` o `localhost`)
   - **Port** → `DB_PORT` (casi siempre `3306`)
   - **Username** → `DB_USER`
   - **Password** → `DB_PASSWORD`
   - El **nombre de la base de datos** que usas en el panel izquierdo → `DB_NAME`

2. Pega esos valores en `backend/server/.env` (mismos nombres de variable que arriba).

3. **Tablas de MyBrAIn** (solo la primera vez, si la base está vacía o faltan tablas):
   - En DBeaver, selecciona tu base en el árbol.
   - Abre un **SQL Editor** y carga `backend/database/init.sql`.
   - Si tu base **no** se llama `mybrain`, sustituye la primera línea `USE mybrain;` por `USE tu_nombre_de_base;` o bórrala y deja la base ya seleccionada al ejecutar.
   - Ejecuta el script (Ctrl+Enter / Play).

4. Arranca el backend: `cd backend/server && npm run dev` — debería decir que conecta a MySQL.

**No hace falta Docker** si MySQL ya lo tienes con DBeaver.

## 1. Base de datos (MySQL)

### Opción A — Docker (recomendado)

En la **raíz del repo** (`My_BrAIn/`):

```bash
npm run db:up
```

Espera ~20–30 s a que MySQL esté listo (primer arranque inicializa tablas con `backend/database/init.sql`).

Si el puerto **3306** ya está ocupado por otro MySQL, para ese servicio o cambia el puerto en `docker-compose.yml` (ej. `"3307:3306"`) y pon `DB_PORT=3307` en `backend/server/.env`.

### Opción B — MySQL ya instalado (sin Docker)

#### Recrear todo desde cero (recomendado si la base está corrupta o desincronizada)

**Borra `mybrain`, recrea usuarios en `localhost` y `127.0.0.1`, y crea tablas + usuario `admin`.**

Desde la **raíz del repo**:

```bash
sudo mysql < backend/database/setup_desde_cero.sql
```

Copia la plantilla del backend y arranca (los valores por defecto ya coinciden con el script):

```bash
cp backend/server/.env.example backend/server/.env
```

Si editaste la contraseña dentro de `setup_desde_cero.sql`, pon la misma en `DB_PASSWORD` (entre comillas si lleva `!`).

#### Solo crear base + usuario (sin borrar nada)

Si prefieres no usar el script destructivo:

```bash
sudo mysql << 'EOF'
CREATE DATABASE IF NOT EXISTS mybrain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mybrain_user'@'localhost' IDENTIFIED BY 'MyBr4in_S3cur3!';
CREATE USER IF NOT EXISTS 'mybrain_user'@'127.0.0.1' IDENTIFIED BY 'MyBr4in_S3cur3!';
GRANT ALL PRIVILEGES ON mybrain.* TO 'mybrain_user'@'localhost';
GRANT ALL PRIVILEGES ON mybrain.* TO 'mybrain_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
```

Importa tablas y datos iniciales:

```bash
mysql -u mybrain_user -p'MyBr4in_S3cur3!' mybrain < backend/database/init.sql
```

Si no tienes `mysql` en PATH: `sudo apt install mysql-client` (solo cliente).

#### DBeaver

Si aparece **Public Key Retrieval is not allowed**, en la conexión → pestaña **Driver properties** → `allowPublicKeyRetrieval` = `true`. Usa el mismo host, usuario y contraseña que en `.env` (`127.0.0.1` suele coincidir mejor con Node que `localhost`).

### Opción C — Instalar Docker en Ubuntu / Debian

Si prefieres usar `npm run db:up`:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker "$USER"
```

Cierra sesión y vuelve a entrar (o `newgrp docker`). Luego:

```bash
npm run db:up
```

## 2. Backend

```bash
cd backend/server
npm install
npm run dev
```

Debe mostrar conexión a MySQL y el puerto **3001**.

Variables en **`backend/server/.env`** (ya hay una plantilla lista):

| Variable        | Uso                          |
|----------------|------------------------------|
| `DB_*`         | Conexión MySQL               |
| `PORT`         | API (por defecto 3001)       |
| `GROQ_API_KEY` | Opcional: menú e informes IA (Groq) |

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5275/** — el proxy envía `/api` al backend.

## 4. Entrar en la app

Usuario por defecto (tras `init.sql`):

- **Usuario:** `admin`
- **Contraseña:** `1234`

## 5. IA (opcional)

1. Clave gratuita: [Google AI Studio](https://aistudio.google.com/apikey)
2. Pégala en `backend/server/.env` como `GROQ_API_KEY=...` (Groq Console).
3. Reinicia el backend

## Reinicio limpio de la BD

### Docker

```bash
npm run db:reset
```

Borra el volumen con datos y vuelve a crear la base con `init.sql`.

### MySQL en el sistema (sin Docker)

Usa el script que borra y recrea base, usuarios y tablas:

```bash
sudo mysql < backend/database/setup_desde_cero.sql
```
