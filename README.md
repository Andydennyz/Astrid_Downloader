# Local Docker setup

Docker Compose builds the React app as a static SPA and runs Nginx to serve its
files directly. Nginx publishes port `5175` on this machine and on the local
network, serves client-side routes and assets, and forwards `/api/` requests to
the private FastAPI/yt-dlp backend. Vite is used only during the image build;
`npm run dev` remains available for local development on port `5174`. This
Docker stack uses HTTP and is intended for local/LAN use, not direct public
internet exposure. It does not change the existing Cloudflare Worker
configuration or deploy anything to Cloudflare.

Other devices on your LAN can reach the host Vite development server using this
computer's LAN IP and port `5174`, or the Nginx-served Docker app using the PC's
LAN IP and port `5175`. On a phone, use `http://<PC-LAN-IP>:5175` (for example,
`http://192.168.100.83:5175`) while both devices are on the same network. If
Windows Firewall blocks access on a trusted home network, set that Wi-Fi network
to the Private profile in Windows and allow Docker Desktop or TCP port `5175` on
the Private profile only. Do not open the port on a Public network. The LAN IP may
change; reserve it on your router or update the Supabase redirect allow-list when
it changes. For LAN sign-in, allow
`http://<PC-LAN-IP>:5175/auth/callback` in Supabase Auth redirect URLs.

LAN access is not public internet access. Do not forward the development server
port through your router; use a production deployment or an authenticated TLS
tunnel/reverse proxy for internet access.

Create the local backend settings file once:

```powershell
Copy-Item backend\docker.env.example backend\docker.env
```

Set `SECRET_KEY` in `backend\docker.env` to a unique random value. For optional
Supabase sign-in, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or
`VITE_SUPABASE_ANON_KEY`) in the repository-root `.env`. Those `VITE_` values are
public browser configuration; never put a Supabase service-role key or other
server secret in the root `.env`.

Start the app:

```powershell
docker compose up --build -d
docker compose ps
```

Stop it with `docker compose down`. The browser writes completed media to the
folder you select in **Settings**. The backend temporarily stages each download
under the ignored `data\` folder and, when folder access is available, streams it
to that browser folder when complete and removes its server copy while keeping
the user's media metadata in the database. Back up the selected device folder
to preserve your media. The backend
uses the PostgreSQL database configured by `DATABASE_URL` in
`backend\docker.env`; Compose does not create that database. If `DATABASE_URL`
is unset, the backend falls back to SQLite in the persisted storage folder.

Signed-in library and history metadata remains in the database; media bytes are
kept in the selected device folder. Guest sessions are isolated per tab and are
cleared when the tab closes (with a seven-day server-side expiry as a fallback).
Already-saved device files are intentionally left in place when a guest tab
closes. The browser does not expose total drive capacity/free space, so the app
reports the size of its own tracked media rather than claiming the whole drive's
free space.

Direct folder access requires a browser with the File System Access API
(currently Chrome or Edge) and a secure context: use `http://localhost:5175` on
the Docker host, or serve the app over HTTPS for access from another device.
The plain HTTP LAN address (`http://<PC-LAN-IP>:5175`) can serve the app, but
browsers do not permit this folder API there. When folder access is supported,
choose the folder in Settings before starting a download; the app asks for
permission and automatically transfers each completed download. If folder
access is unavailable, the app sends completed files through the browser's
standard download flow instead. The browser chooses the download location, and
whether it shows a Save As prompt depends on the browser's "Ask where to save
each file" preference (Chrome: `chrome://settings/downloads`; Edge:
`edge://settings/downloads`). The app keeps its staged server copy because it
cannot confirm that the browser saved the file.

Backend settings are read from `backend\docker.env`, mounted read-only at runtime
as a Docker secret. They are not copied into either image or passed as container
environment variables. Docker build contexts exclude local environment files,
dependencies, and downloaded media. A Docker host administrator can still access
the mounted source file, so keep the host secure and do not commit it.

The frontend build only receives the Supabase URL and publishable/anon key,
which are intended to be visible to browsers. `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `SUPABASE_JWT_SECRET`, and `SECRET_KEY` must remain in the
backend settings file.

## Vite template notes

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
