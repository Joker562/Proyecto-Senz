import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Eliminando todos los datos demo...');

  // Borrar en orden por dependencias
  await prisma.capaAction.deleteMany();
  await prisma.auditItem.deleteMany();
  await prisma.auditSection.deleteMany();
  await prisma.audit.deleteMany();
  await prisma.auditTemplateItem.deleteMany();
  await prisma.auditTemplateSection.deleteMany();
  await prisma.auditTemplate.deleteMany();
  await prisma.assetUsageLog.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.workOrderChecklistItem.deleteMany();
  await prisma.workOrderChecklist.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.maintenancePlan.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.area.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Base de datos limpia');

  // Crear usuario admin
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  await prisma.user.create({
    data: {
      email: 'admin@planta.com',
      name: 'Administrador',
      password: passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('✅ Usuario admin creado: admin@planta.com / Admin1234!');
  console.log('');
  console.log('La aplicación está lista. Ingresa con las credenciales admin y');
  console.log('registra tus activos, usuarios y órdenes de trabajo reales.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
