import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin1234!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@planta.com' },
    update: {},
    create: { email: 'admin@planta.com', name: 'Administrador', password: passwordHash, role: 'ADMIN' },
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@planta.com' },
    update: {},
    create: { email: 'supervisor@planta.com', name: 'Supervisor Planta', password: passwordHash, role: 'SUPERVISOR' },
  });

  await prisma.user.upsert({
    where: { email: 'tecnico@planta.com' },
    update: {},
    create: { email: 'tecnico@planta.com', name: 'Tecnico Juan', password: passwordHash, role: 'TECHNICIAN' },
  });

  await prisma.user.upsert({
    where: { email: 'directivo@planta.com' },
    update: {},
    create: { email: 'directivo@planta.com', name: 'Director Operaciones', password: passwordHash, role: 'EXECUTIVE' },
  });

  const asset1 = await prisma.asset.upsert({
    where: { code: 'COMP-001' },
    update: {},
    create: {
      code: 'COMP-001', name: 'Compresor Principal', location: 'Sala de Maquinas A',
      area: 'Produccion', status: 'OPERATIONAL', manufacturer: 'Atlas Copco', model: 'GA 37',
    },
  });

  const asset2 = await prisma.asset.upsert({
    where: { code: 'BOMB-001' },
    update: {},
    create: {
      code: 'BOMB-001', name: 'Bomba Hidraulica #1', location: 'Sala de Bombas',
      area: 'Utilidades', status: 'OPERATIONAL', manufacturer: 'Grundfos', model: 'CR 10',
    },
  });

  const asset3 = await prisma.asset.upsert({
    where: { code: 'CONV-001' },
    update: {},
    create: {
      code: 'CONV-001', name: 'Banda Transportadora L1', location: 'Linea de Produccion 1',
      area: 'Produccion', status: 'UNDER_MAINTENANCE', manufacturer: 'Interroll', model: 'Series 3000',
    },
  });

  // Solo crear planes si no existen
  const planCount = await prisma.maintenancePlan.count();
  if (planCount === 0) await prisma.maintenancePlan.createMany({
    data: [
      {
        name: 'PM Mensual Compresor', type: 'PREVENTIVE', frequency: 1,
        frequencyUnit: 'months', nextDue: new Date(Date.now() + 7 * 86400000),
        assetId: asset1.id,
      },
      {
        name: 'Inspeccion Semanal Bomba', type: 'INSPECTION', frequency: 1,
        frequencyUnit: 'weeks', nextDue: new Date(Date.now() + 2 * 86400000),
        assetId: asset2.id,
      },
      {
        name: 'Lubricacion Banda Transportadora', type: 'PREVENTIVE', frequency: 15,
        frequencyUnit: 'days', nextDue: new Date(Date.now() - 1 * 86400000),
        assetId: asset3.id,
      },
    ],
  });

  // Solo crear OTs si no existen
  const otCount = await prisma.workOrder.count();
  if (otCount === 0) await prisma.workOrder.createMany({
    data: [
      {
        title: 'Cambio de filtros compresor', description: 'Reemplazar filtros de aire y aceite segun PM mensual.',
        type: 'PREVENTIVE', priority: 'MEDIUM', status: 'PENDING',
        assetId: asset1.id, createdById: admin.id, scheduledAt: new Date(Date.now() + 3 * 86400000),
        estimatedHours: 2,
      },
      {
        title: 'Revision de sellos bomba hidraulica', description: 'Fuga detectada en sello mecanico frontal. Revisar y reemplazar si es necesario.',
        type: 'CORRECTIVE', priority: 'HIGH', status: 'IN_PROGRESS',
        assetId: asset2.id, createdById: admin.id, startedAt: new Date(),
        estimatedHours: 4,
      },
      {
        title: 'Ajuste de tension banda transportadora', description: 'La banda presenta holgura. Ajustar segun especificacion del fabricante.',
        type: 'CORRECTIVE', priority: 'CRITICAL', status: 'PENDING',
        assetId: asset3.id, createdById: admin.id,
        estimatedHours: 3,
      },
      {
        title: 'Inspeccion electrica compresor', description: 'Verificar conexiones, fusibles y estado del motor electrico.',
        type: 'INSPECTION', priority: 'LOW', status: 'COMPLETED',
        assetId: asset1.id, createdById: admin.id,
        startedAt: new Date(Date.now() - 2 * 86400000),
        completedAt: new Date(Date.now() - 1 * 86400000),
        actualHours: 1.5,
      },
    ],
  });

  // ── Plantillas de Auditoría ──────────────────────────────────────────────
  const templateCount = await prisma.auditTemplate.count();
  if (templateCount === 0) {

    // ── Plantilla 5S ──────────────────────────────────────────────────────
    await prisma.auditTemplate.create({
      data: {
        name: 'Auditoría 5S Estándar',
        type: 'FIVE_S',
        isDefault: true,
        sections: {
          create: [
            {
              order: 1, name: 'Clasificar — Seiri (1S)', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿Se identifican y eliminan materiales innecesarios del área de trabajo?' },
                  { order: 2, description: '¿Las herramientas y materiales presentes son solo los necesarios para la tarea actual?' },
                  { order: 3, description: '¿El área está libre de equipos obsoletos, en desuso o sin identificar?' },
                  { order: 4, description: '¿Los objetos en el piso tienen una razón válida para estar ahí?' },
                  { order: 5, description: '¿Existe un proceso documentado para decidir qué conservar y qué eliminar?' },
                ],
              },
            },
            {
              order: 2, name: 'Ordenar — Seiton (2S)', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿Cada herramienta, material y equipo tiene un lugar designado y señalizado?' },
                  { order: 2, description: '¿Los artículos están correctamente identificados y etiquetados?' },
                  { order: 3, description: '¿Los pasillos, salidas de emergencia y zonas de tránsito están completamente despejados?' },
                  { order: 4, description: '¿Las herramientas de uso frecuente están al alcance inmediato del operador?' },
                  { order: 5, description: '¿Se utilizan señalizaciones visuales (líneas, letreros, sombras) para indicar ubicaciones?' },
                ],
              },
            },
            {
              order: 3, name: 'Limpiar — Seiso (3S)', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El área de trabajo está limpia al inicio del turno?' },
                  { order: 2, description: '¿Los equipos están libres de polvo, aceite, virutas y derrames?' },
                  { order: 3, description: '¿Los operadores realizan limpieza al final de cada turno sin necesidad de supervisión?' },
                  { order: 4, description: '¿Existen registros de limpieza vigentes y firmados?' },
                  { order: 5, description: '¿Las áreas comunes (pasillos, baños, comedor) se mantienen en condiciones limpias?' },
                ],
              },
            },
            {
              order: 4, name: 'Estandarizar — Seiketsu (4S)', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿Existen procedimientos escritos y actualizados para mantener las 3S?' },
                  { order: 2, description: '¿Las normas de limpieza y orden están visibles en el área (gestión visual)?' },
                  { order: 3, description: '¿Los operadores conocen y pueden describir los estándares de su área?' },
                  { order: 4, description: '¿Se realizan auditorías periódicas de 5S con registros?' },
                  { order: 5, description: '¿Las mejoras implementadas están documentadas y comunicadas al equipo?' },
                ],
              },
            },
            {
              order: 5, name: 'Disciplina — Shitsuke (5S)', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿Los operadores siguen los procedimientos establecidos de forma autónoma y sin supervisión?' },
                  { order: 2, description: '¿Se respetan los horarios y rutinas de limpieza y orden?' },
                  { order: 3, description: '¿El personal participa activamente en la identificación y solución de problemas de 5S?' },
                  { order: 4, description: '¿Las desviaciones a los estándares son reportadas proactivamente?' },
                  { order: 5, description: '¿La dirección y supervisión promueven activamente la cultura 5S con su ejemplo?' },
                ],
              },
            },
            {
              order: 6, name: 'Factor Humano y Comportamiento', isBehavior: true,
              items: {
                create: [
                  { order: 1, description: '¿El operador usa correctamente todos los EPP requeridos para su área?' },
                  { order: 2, description: '¿El operador llena correctamente y al día el registro de producción/OEE?' },
                  { order: 3, description: '¿Se respetan todas las señalizaciones y restricciones de seguridad del área?' },
                  { order: 4, description: '¿El operador mantiene su área organizada durante el turno (no solo al inicio)?' },
                  { order: 5, description: '¿El operador reporta fallas, anomalías o riesgos de forma oportuna a su supervisor?' },
                ],
              },
            },
          ],
        },
      },
    });

    // ── Plantilla Procesos ────────────────────────────────────────────────
    await prisma.auditTemplate.create({
      data: {
        name: 'Auditoría de Procesos Estándar',
        type: 'PROCESS',
        isDefault: true,
        sections: {
          create: [
            {
              order: 1, name: 'Preparación y Setup', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El operador verifica las especificaciones del trabajo (orden, plano, instrucción) antes de iniciar?' },
                  { order: 2, description: '¿Las herramientas, materiales e insumos necesarios están disponibles y en buen estado?' },
                  { order: 3, description: '¿El equipo fue encendido y verificado según el procedimiento de arranque?' },
                  { order: 4, description: '¿Los parámetros de proceso (temperatura, presión, velocidad) están configurados correctamente?' },
                  { order: 5, description: '¿La primera pieza fue inspeccionada y aprobada antes de iniciar la producción en serie?' },
                ],
              },
            },
            {
              order: 2, name: 'Ejecución del Proceso', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El proceso sigue la secuencia definida en el procedimiento de trabajo?' },
                  { order: 2, description: '¿Los tiempos de ciclo se mantienen dentro del estándar establecido?' },
                  { order: 3, description: '¿El operador monitorea continuamente la calidad de las piezas durante la producción?' },
                  { order: 4, description: '¿Los rechazos y piezas no conformes son identificados, separados y etiquetados inmediatamente?' },
                  { order: 5, description: '¿Los datos de producción (cantidad, tiempo, paros) se registran en tiempo real?' },
                ],
              },
            },
            {
              order: 3, name: 'Control de Calidad', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El operador utiliza los instrumentos de medición correctos para la operación?' },
                  { order: 2, description: '¿Los instrumentos de medición están calibrados (etiqueta vigente) y en buen estado?' },
                  { order: 3, description: '¿Las piezas son inspeccionadas con la frecuencia establecida en el plan de control?' },
                  { order: 4, description: '¿Las muestras tomadas para control son representativas del lote/turno?' },
                  { order: 5, description: '¿Las no conformidades detectadas son reportadas según el procedimiento de calidad?' },
                ],
              },
            },
            {
              order: 4, name: 'Registro y Documentación', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El registro de OEE está siendo llenado correctamente con todos los campos requeridos?' },
                  { order: 2, description: '¿Los paros de producción se registran con causa identificada y duración exacta?' },
                  { order: 3, description: '¿El operador firma el registro de producción al finalizar el turno?' },
                  { order: 4, description: '¿Los registros están legibles, sin enmendaduras y ubicados en el lugar correcto?' },
                  { order: 5, description: '¿Los documentos de proceso (hojas de ruta, instrucciones) están actualizados y accesibles?' },
                ],
              },
            },
            {
              order: 5, name: 'Factor Humano y Comportamiento', isBehavior: true,
              items: {
                create: [
                  { order: 1, description: '¿El operador puede describir correctamente los pasos críticos de su operación?' },
                  { order: 2, description: '¿El operador puede distinguir visualmente una pieza buena de una no conforme?' },
                  { order: 3, description: '¿El operador reacciona de forma correcta y controlada ante una falla del equipo?' },
                  { order: 4, description: '¿Se respetan los tiempos de descanso sin abandonar el proceso de forma no programada?' },
                  { order: 5, description: '¿El operador muestra iniciativa para mejorar el proceso y reportar problemas potenciales?' },
                ],
              },
            },
            {
              order: 6, name: 'Seguridad en Proceso', isBehavior: false,
              items: {
                create: [
                  { order: 1, description: '¿El operador usa los EPP específicos requeridos para esta operación?' },
                  { order: 2, description: '¿Las guardas, protecciones y dispositivos de seguridad del equipo están en su lugar y funcionando?' },
                  { order: 3, description: '¿El área está correctamente señalizada para los riesgos asociados a esta operación?' },
                  { order: 4, description: '¿El operador conoce y puede describir el procedimiento de emergencia de su área?' },
                  { order: 5, description: '¿No se observan condiciones inseguras (derrames, cables sueltos, bloqueos de salidas)?' },
                ],
              },
            },
          ],
        },
      },
    });

    console.log('✅ Plantillas de auditoría creadas');
  }

  console.log('✅ Seed completado');
}

main().catch(console.error).finally(() => prisma.$disconnect());
