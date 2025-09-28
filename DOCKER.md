Docker-first workflow

This project can be built and run entirely via Docker; no local builds or compiled files are needed on your host.

Key points
- Multi-stage Dockerfile builds backend (TypeScript + frontend assets) inside the container.
- The runtime image contains compiled `dist/` and `public/` only; your host code isn’t mounted.
- docker-compose proxies all traffic through nginx to the backend.

Build and run

1) Build images
   docker compose build backend

2) Start stack
   docker compose up -d postgres backend nginx

3) Open UI
   http://localhost:27102/

Environment toggles
- SKIP_DB_INIT=1 will skip DB-dependent initialization (useful for smoke checks).
- ENABLE_CALIBRE=1 enables calibre conversion (default in the image).

Notes
- Static assets are served by the backend container (nginx proxies /js, /css, etc. to backend).
- To ensure fresh assets, the image runs a stamping step; browsers should get a new version on each rebuild.
