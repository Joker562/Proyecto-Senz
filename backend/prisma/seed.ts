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

  // ── Áreas de planta ──────────────────────────────────────────────────────
  const areaNames = [
    'Corte', 'Ensamble', 'Pintura', 'Almacén', 'Calidad',
    'Mantenimiento', 'Logística', 'Producción General',
  ];
  const areaMap: Record<string, string> = {}; // name → id
  for (const name of areaNames) {
    const a = await prisma.area.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    areaMap[name] = a.id;
  }
  console.log('✅ Áreas creadas:', Object.keys(areaMap).join(', '));

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

  // ── Auditorías de demostración ────────────────────────────────────────────
  const auditCount = await prisma.audit.count();
  if (auditCount === 0) {
    const [template5S, templateProc] = await Promise.all([
      prisma.auditTemplate.findFirst({ where: { type: 'FIVE_S' }, include: { sections: { include: { items: true }, orderBy: { order: 'asc' } } } }),
      prisma.auditTemplate.findFirst({ where: { type: 'PROCESS' }, include: { sections: { include: { items: true }, orderBy: { order: 'asc' } } } }),
    ]);

    const supervisor = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } });
    const tecnico    = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
    const admin2     = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!supervisor || !tecnico || !admin2 || !template5S || !templateProc) {
      console.log('⚠️  Faltan usuarios o plantillas para seed de auditorías');
    } else {
      // Helper: crea los ítems de una sección con resultados dados
      type ItemResult = 'PASS' | 'FAIL' | 'NA';
      type SeedSection = { name: string; isBehavior: boolean; weight: number; items: { description: string; weight: number; order: number }[] };

      function buildSections(template: NonNullable<typeof template5S>, results: ItemResult[][]): object[] {
        return template.sections.map((sec, si) => ({
          order: sec.order,
          name: sec.name,
          isBehavior: sec.isBehavior,
          weight: sec.weight,
          items: {
            create: sec.items.map((item, ii) => ({
              order: item.order,
              description: item.description,
              weight: item.weight,
              result: (results[si]?.[ii]) ?? 'PASS',
              checkedAt: new Date(),
              checkedById: supervisor.id,
            })),
          },
        }));
      }

      // Función para calcular score igual que el backend
      function calcScore(template: NonNullable<typeof template5S>, results: ItemResult[][]): number {
        let weightedSum = 0, totalWeight = 0;
        template.sections.forEach((sec, si) => {
          sec.items.forEach((item, ii) => {
            const r = results[si]?.[ii] ?? 'PASS';
            if (r === 'NA') return;
            const secW = sec.weight, itemW = item.weight;
            totalWeight += secW * itemW;
            if (r === 'PASS') weightedSum += secW * itemW;
          });
        });
        return totalWeight > 0 ? Math.round(weightedSum / totalWeight * 100 * 10) / 10 : 0;
      }

      // ── Datos: [área, tipo de template, resultados por sección, mes atrás] ─
      const auditDefs: Array<{
        area: string; template: NonNullable<typeof template5S>;
        results: ItemResult[][]; monthsAgo: number; auditorId: string;
      }> = [
        // Últimos 6 meses — Corte (5S, mejora progresiva)
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 5,
          results: [['PASS','PASS','FAIL','PASS','FAIL'],['PASS','FAIL','PASS','PASS','FAIL'],['PASS','PASS','PASS','FAIL','PASS'],['FAIL','FAIL','PASS','PASS','PASS'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','FAIL','PASS','PASS','PASS']] },
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 4,
          results: [['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','FAIL','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','FAIL','PASS','PASS','PASS']] },
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 3,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 2,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 1,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Corte', template: template5S,  auditorId: supervisor.id, monthsAgo: 0,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },

        // Últimos 6 meses — Ensamble (5S, irregular)
        { area: 'Ensamble', template: template5S, auditorId: supervisor.id, monthsAgo: 5,
          results: [['PASS','FAIL','FAIL','PASS','FAIL'],['FAIL','FAIL','PASS','PASS','FAIL'],['PASS','PASS','FAIL','FAIL','PASS'],['FAIL','FAIL','FAIL','PASS','PASS'],['PASS','PASS','FAIL','PASS','FAIL'],['PASS','FAIL','FAIL','PASS','PASS']] },
        { area: 'Ensamble', template: template5S, auditorId: supervisor.id, monthsAgo: 4,
          results: [['PASS','PASS','FAIL','PASS','FAIL'],['PASS','FAIL','PASS','PASS','FAIL'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','FAIL','PASS','PASS','PASS'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','FAIL','PASS','PASS','PASS']] },
        { area: 'Ensamble', template: template5S, auditorId: tecnico.id, monthsAgo: 3,
          results: [['PASS','PASS','PASS','FAIL','FAIL'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','PASS','FAIL','PASS','PASS']] },
        { area: 'Ensamble', template: template5S, auditorId: tecnico.id, monthsAgo: 2,
          results: [['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','FAIL','PASS','PASS']] },
        { area: 'Ensamble', template: template5S, auditorId: supervisor.id, monthsAgo: 1,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Ensamble', template: template5S, auditorId: supervisor.id, monthsAgo: 0,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },

        // Pintura (Procesos, con algunos fallos)
        { area: 'Pintura', template: templateProc, auditorId: tecnico.id, monthsAgo: 4,
          results: [['PASS','PASS','FAIL','PASS','PASS'],['PASS','FAIL','PASS','PASS','PASS'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Pintura', template: templateProc, auditorId: tecnico.id, monthsAgo: 2,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','FAIL','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
        { area: 'Pintura', template: templateProc, auditorId: supervisor.id, monthsAgo: 0,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },

        // Almacén (5S, mediocre)
        { area: 'Almacén', template: template5S, auditorId: supervisor.id, monthsAgo: 3,
          results: [['PASS','FAIL','FAIL','PASS','FAIL'],['FAIL','PASS','PASS','FAIL','FAIL'],['PASS','FAIL','PASS','FAIL','PASS'],['FAIL','FAIL','PASS','PASS','FAIL'],['PASS','FAIL','PASS','FAIL','PASS'],['PASS','FAIL','FAIL','PASS','PASS']] },
        { area: 'Almacén', template: template5S, auditorId: supervisor.id, monthsAgo: 1,
          results: [['PASS','PASS','FAIL','PASS','FAIL'],['PASS','FAIL','PASS','PASS','FAIL'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','FAIL','PASS','PASS','PASS'],['PASS','PASS','FAIL','PASS','PASS'],['PASS','FAIL','PASS','PASS','PASS']] },

        // Calidad (Procesos, excelente)
        { area: 'Calidad', template: templateProc, auditorId: supervisor.id, monthsAgo: 2,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','FAIL']] },
        { area: 'Calidad', template: templateProc, auditorId: supervisor.id, monthsAgo: 0,
          results: [['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS'],['PASS','PASS','PASS','PASS','PASS']] },
      ];

      let auditSeq = 1;
      const createdAudits: { id: string; area: string; sections: any[] }[] = [];

      for (const def of auditDefs) {
        const completedDate = new Date();
        completedDate.setMonth(completedDate.getMonth() - def.monthsAgo);
        completedDate.setDate(12 + Math.floor(Math.random() * 10));
        completedDate.setHours(9, 30, 0, 0);

        const score = calcScore(def.template, def.results);
        const code  = `AUD-${String(auditSeq++).padStart(4, '0')}`;
        const typeLabel = def.template.type === 'FIVE_S' ? '5S' : 'Proc';

        const created = await prisma.audit.create({
          data: {
            code,
            title: `Auditoría ${typeLabel} — ${def.area}`,
            type: def.template.type as 'FIVE_S' | 'PROCESS',
            status: 'CLOSED',
            area: def.area,
            score,
            scheduledAt: completedDate,
            startedAt: completedDate,
            completedAt: completedDate,
            auditorId: def.auditorId,
            templateId: def.template.id,
            sections: {
              create: buildSections(def.template, def.results) as any,
            },
          },
          include: { sections: { include: { items: true } } },
        });

        createdAudits.push({ id: created.id, area: def.area, sections: created.sections });
      }

      console.log(`✅ ${createdAudits.length} auditorías creadas`);

      // ── CAPAs asociadas a las auditorías con FAILs ────────────────────────
      let capaSeq = 1;
      const capaData = [
        // CAPAs del área Ensamble (mes -5, puntaje bajo)
        { auditIdx: 6, severity: 'CRITICAL', type: 'CORRECTIVE', status: 'CLOSED', daysAgo: 150, assignedId: tecnico.id,
          desc: 'Retirar material obsoleto acumulado en zona de ensamble línea 2',
          rootCause: 'Falta de rutina de clasificación semanal en área de ensamble.',
          closingNotes: 'Se estableció programa semanal de clasificación 5S. Material retirado y catalogado.' },
        { auditIdx: 6, severity: 'MAJOR', type: 'CORRECTIVE', status: 'CLOSED', daysAgo: 145, assignedId: tecnico.id,
          desc: 'Reasignar ubicaciones de herramientas con gestión visual (sombras y etiquetas)',
          rootCause: 'No existían ubicaciones fijas definidas para herramientas de ensamble.',
          closingNotes: 'Tablero de sombras instalado. Todas las herramientas tienen ubicación asignada.' },
        { auditIdx: 7, severity: 'MAJOR', type: 'CORRECTIVE', status: 'CLOSED', daysAgo: 115, assignedId: supervisor.id,
          desc: 'Actualizar procedimiento de limpieza turno noche — ensamble',
          rootCause: 'El procedimiento no especificaba responsable de limpieza en turno noche.',
          closingNotes: 'Procedimiento actualizado. Responsable de turno firmó compromiso.' },
        // CAPAs del área Almacén (mes -3, puntaje bajo)
        { auditIdx: 15, severity: 'CRITICAL', type: 'CORRECTIVE', status: 'IN_PROGRESS', daysAgo: 5, assignedId: tecnico.id,
          desc: 'Limpiar y reorganizar zona de recepción: pasillos bloqueados por tarimas',
          rootCause: 'No existe procedimiento de ingreso y acomodo de recepción de materiales.' },
        { auditIdx: 15, severity: 'MAJOR', type: 'CORRECTIVE', status: 'OPEN', daysAgo: -10, assignedId: tecnico.id,
          desc: 'Instalar señalización de pasillos y zonas de tráfico en almacén',
          rootCause: 'El almacén no cuenta con demarcación de áreas ni señalización de flujo.' },
        { auditIdx: 15, severity: 'MINOR', type: 'PREVENTIVE', status: 'OPEN', daysAgo: 20, assignedId: supervisor.id,
          desc: 'Implementar tarjetas rojas para identificar artículos sin clasificar en almacén',
          rootCause: 'No se aplica metodología 5S de forma sistemática en el almacén.' },
        // CAPAs de Ensamble recientes (mes -1)
        { auditIdx: 11, severity: 'MINOR', type: 'PREVENTIVE', status: 'PENDING_VERIFICATION', daysAgo: 15, assignedId: supervisor.id,
          desc: 'Actualizar estándar visual de limpieza para turno nocturno — ensamble',
          rootCause: 'El estándar existente no contempla el turno nocturno.' },
        { auditIdx: 11, severity: 'OBSERVATION', type: 'PREVENTIVE', status: 'OPEN', daysAgo: -5, assignedId: tecnico.id,
          desc: 'Colocar recordatorio visual de EPP en entrada del área de ensamble',
          rootCause: 'Observación en auditoría: algunos operadores no usan lentes de seguridad.' },
        // CAPAs de Corte (mes -5)
        { auditIdx: 0, severity: 'MAJOR', type: 'CORRECTIVE', status: 'CLOSED', daysAgo: 155, assignedId: supervisor.id,
          desc: 'Rediseñar zona de materiales en proceso — área de corte',
          rootCause: 'Materiales en proceso no tenían ubicación definida, generando desorden.',
          closingNotes: 'Área rediseñada con marcas en piso y estantes identificados.' },
      ];

      for (const c of capaData) {
        const audit = createdAudits[c.auditIdx];
        if (!audit) continue;

        // Encuentra el primer ítem FAIL en el audit para asociar la CAPA
        let failItemId: string | undefined;
        for (const sec of audit.sections) {
          const failItem = (sec as any).items?.find((i: any) => i.result === 'FAIL');
          if (failItem) { failItemId = failItem.id; break; }
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + c.daysAgo);

        await prisma.capaAction.create({
          data: {
            code: `CAPA-${String(capaSeq++).padStart(4, '0')}`,
            type: c.type as 'CORRECTIVE' | 'PREVENTIVE',
            description: c.desc,
            rootCause: c.rootCause ?? null,
            severity: c.severity as 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION',
            status: c.status as 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'CLOSED',
            dueDate,
            closedAt: c.status === 'CLOSED' ? new Date(dueDate.getTime() - 5 * 86400000) : null,
            closingNotes: c.closingNotes ?? null,
            auditId: audit.id,
            auditItemId: failItemId ?? null,
            assignedToId: c.assignedId,
            createdById: admin2.id,
          },
        });
      }

      console.log(`✅ ${capaSeq - 1} CAPAs creadas`);
    }
  }

  console.log('✅ Seed completado');
}

main().catch(console.error).finally(() => prisma.$disconnect());
