@echo off
cd /d "%~dp0"
SET DATABASE_URL=file:./prisma/dev.db
SET JWT_SECRET=planta-mtto-secret-2024-xK9mP2qL
SET PORT=4000
SET FRONTEND_URL=*
SET SMTP_HOST=smtp.gmail.com
SET SMTP_PORT=587
SET SMTP_SECURE=false
SET SMTP_USER=u562uriartemartin@gmail.com
SET SMTP_PASS=vcuefyfiuliixwvb
SET SMTP_FROM=u562uriartemartin@gmail.com
echo Variables cargadas. Iniciando backend SENZ en puerto 4000...
npx tsx src/index.ts
