import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Eliminar OTs del primer seed (timestamps más antiguos)
  const old = [
    'cmo92pam2000adsltyzwujcc7', 'cmo92pam2000cdslt1y5dgmrg',
    'cmo92pam2000edsltzodg4vqc', 'cmo92pam2000gdslta0m23fs0',
  ];
  await prisma.workOrder.deleteMany({ where: { id: { in: old } } });

  // Eliminar planes duplicados — conservar el más reciente de cada nombre+asset
  const plans = await prisma.maintenancePlan.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const p of plans) {
    const key = p.name + p.assetId;
    if (seen.has(key)) toDelete.push(p.id);
    else seen.add(key);
  }
  if (toDelete.length) await prisma.maintenancePlan.deleteMany({ where: { id: { in: toDelete } } });

  const otCount = await prisma.workOrder.count();
  const planCount = await prisma.maintenancePlan.count();
  console.log(`✅ Limpieza completa — OTs: ${otCount} | Planes: ${planCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
