#!/bin/bash
set -e

# En Windows, Node.js está en C:\Program Files\nodejs
export PATH="/c/Program Files/nodejs:$PATH"

echo "=== Instalando dependencias ==="
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

echo "=== Levantando PostgreSQL ==="
docker compose up -d postgres

echo "=== Esperando DB (10s) ==="
sleep 10

echo "=== Ejecutando migraciones y seed ==="
cd backend
cp -n .env.example .env 2>/dev/null || true
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
cd ..

echo ""
echo "✅ Configuración completada. Abre 2 terminales:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && npm run dev"
echo ""
echo "   App: http://localhost:5173"
echo "   API: http://localhost:4000"
echo ""
echo "Credenciales (contraseña: Admin1234!):"
echo "  admin@planta.com      → Administrador (acceso total)"
echo "  supervisor@planta.com → Supervisor"
echo "  tecnico@planta.com    → Técnico"
echo "  directivo@planta.com  → Directivo (solo lectura / dashboard)"
