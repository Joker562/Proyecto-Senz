import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  BookOpen, Printer, Search, ChevronRight, ChevronDown,
  LayoutDashboard, ClipboardList, Factory, CalendarDays,
  CheckSquare, BarChart3, ClipboardCheck, Car, Settings,
  Wrench, Zap, AlertTriangle, Info, Lightbulb, ShieldCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'EXECUTIVE';

interface Task {
  title: string;
  steps: string[];
}

interface ManualSection {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  roles: Role[];           // quiénes usan este módulo
  summary: string;
  tasks: Task[];
  tips?: string[];
  warnings?: string[];
  notes?: string[];
}

// ─── Content ──────────────────────────────────────────────────────────────────

const MANUALS: ManualSection[] = [
  {
    id: 'inicio',
    label: 'Inicio rápido',
    icon: Zap,
    color: '#6366f1',
    roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'],
    summary: 'Acceso al sistema, navegación general y primeros pasos para cualquier rol.',
    tasks: [
      {
        title: 'Cómo iniciar sesión',
        steps: [
          'Abre el navegador y ve a la URL de la aplicación.',
          'Ingresa tu correo electrónico y contraseña proporcionados por el administrador.',
          'Haz clic en "Iniciar sesión". Si los datos son correctos serás redirigido al Panel principal.',
          'Si olvidaste tu contraseña contacta al administrador del sistema para que la restablezca.',
        ],
      },
      {
        title: 'Navegación por módulos',
        steps: [
          'En el panel lateral izquierdo encontrarás los módulos del sistema organizados por área.',
          'Haz clic en cualquier módulo (Mtto, Flota, OEE, Auditoría, Admin) para cambiar de sección.',
          'Dentro de cada módulo hay un submenú en el mismo lateral con las páginas disponibles.',
          'El logo "S" en la parte superior izquierda siempre te lleva al Panel de Control global.',
          'En dispositivos móviles usa el menú hamburguesa (☰) en la parte superior para abrir la navegación.',
        ],
      },
      {
        title: 'Cambiar el tema de color',
        steps: [
          'En la parte inferior del menú lateral verás círculos de colores.',
          'Haz clic en cualquier color para cambiar el tema de la aplicación.',
          'El tema se guarda automáticamente y se mantiene en la próxima sesión.',
        ],
      },
    ],
    tips: [
      'Usa Google Chrome o Microsoft Edge para la mejor experiencia.',
      'El sistema es responsivo — funciona en tabletas y teléfonos.',
      'Los datos se sincronizan en tiempo real; no es necesario recargar la página.',
    ],
  },
  {
    id: 'dashboard',
    label: 'Panel de Control',
    icon: LayoutDashboard,
    color: '#3b82f6',
    roles: ['ADMIN', 'SUPERVISOR', 'EXECUTIVE'],
    summary: 'Vista general del estado de todos los módulos: Mantenimiento, OEE, Flota y Auditorías.',
    tasks: [
      {
        title: 'Leer las tarjetas de módulo',
        steps: [
          'Cada tarjeta representa un módulo del sistema (Mantenimiento, OEE, Flota, Auditorías).',
          'Los tres indicadores dentro de cada tarjeta muestran los KPIs más importantes.',
          'Si un indicador tiene fondo rojo, significa que requiere atención inmediata.',
          'La barra de progreso de "Salud" al final de cada tarjeta es un resumen visual del estado.',
          'Haz clic en "Ver →" para ir directamente al módulo correspondiente.',
        ],
      },
      {
        title: 'Panel de atención',
        steps: [
          'La sección "Requieren Atención" lista los elementos críticos de todos los módulos.',
          'Cada ítem muestra el módulo de origen (badge de color) y un botón "Resolver →".',
          'Si aparece un escudo verde con "Todo en orden", no hay alertas activas.',
          'Usa el botón "Actualizar" (↻) en la esquina superior para recargar los datos.',
        ],
      },
      {
        title: 'Dashboard de Mantenimiento',
        steps: [
          'Ve al módulo Mtto → "Inicio" para ver el dashboard específico de mantenimiento.',
          'Muestra KPIs reales de la base de datos: total OTs, en proceso, vencidas, % completadas.',
          'La sección "Próximos 14 días" lista los planes de mantenimiento programados.',
          '"En Proceso — Críticas" muestra órdenes abiertas de alta prioridad.',
          'Haz clic en cualquier orden para ir directamente a su detalle.',
        ],
      },
    ],
    tips: [
      'El Panel se actualiza al cargar la página; usa el botón Actualizar si necesitas datos frescos.',
      'Los KPIs de OEE y Flota requieren datos reales registrados en sus módulos.',
    ],
  },
  {
    id: 'work-orders',
    label: 'Órdenes de Trabajo',
    icon: ClipboardList,
    color: '#f59e0b',
    roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'],
    summary: 'Gestión completa del ciclo de vida de las órdenes de trabajo: crear, asignar, actualizar y cerrar.',
    tasks: [
      {
        title: 'Crear una nueva orden de trabajo',
        steps: [
          'Ve a Mtto → "Órdenes" y haz clic en el botón azul "Nueva OT" (solo ADMIN y SUPERVISOR).',
          'PASO 1 — Información General: ingresa el título (mínimo 3 caracteres), selecciona el tipo (Preventivo, Correctivo, Predictivo, Inspección) y la prioridad.',
          'Si la OT es de tipo "Preventivo", aparece el campo "Periodicidad" para indicar la frecuencia (diaria, semanal, mensual, etc.).',
          'Establece la "Fecha programada" si ya sabes cuándo debe realizarse el trabajo.',
          'Haz clic en "Siguiente →" para avanzar.',
          'PASO 2 — Detalles Técnicos: selecciona el equipo (activo) al que aplica la orden.',
          'Asigna opcionalmente a un técnico responsable y registra las horas estimadas.',
          'Añade una descripción detallada del problema o trabajo a realizar.',
          'PASO 3 — Confirmación: revisa el resumen y haz clic en "Crear Orden" para guardar.',
        ],
      },
      {
        title: 'Ver y filtrar órdenes',
        steps: [
          'La tabla principal muestra todas las órdenes con columnas: código, título, equipo, área, técnico, tipo, prioridad, estado y fecha.',
          'Usa los filtros de "Estado" (Pendiente, En Progreso, En Espera, Completada, Cancelada) para segmentar.',
          'Usa los filtros de "Prioridad" (Crítica, Alta, Media, Baja) para enfocarte en urgentes.',
          'Escribe en el cuadro de búsqueda y presiona Enter para buscar por código, título o nombre de equipo.',
          'Las filas con fondo rojo claro y un "⚠" son órdenes vencidas (fecha pasada sin completar).',
          'Haz clic en cualquier fila para abrir el detalle completo de la orden.',
        ],
      },
      {
        title: 'Cambiar el estado de una orden',
        steps: [
          'Abre el detalle de la orden haciendo clic en ella en la tabla.',
          'En la vista de detalle encontrarás el selector de estado.',
          'Los estados disponibles son: Pendiente → En Proceso → Completada (o En Espera / Cancelada).',
          'Los técnicos solo pueden actualizar órdenes que tienen asignadas.',
          'El sistema registra automáticamente la fecha de inicio (al pasar a "En Proceso") y la fecha de cierre (al "Completar").',
        ],
      },
      {
        title: 'Agregar comentarios y fotos',
        steps: [
          'En el detalle de la orden desplázate hacia abajo para ver la sección de comentarios.',
          'Escribe tu comentario y haz clic en "Enviar". Los comentarios quedan registrados con hora y autor.',
          'Para adjuntar fotos, usa la sección de "Fotos" y selecciona o toma la imagen desde tu dispositivo.',
        ],
      },
    ],
    tips: [
      'El código de la OT (últimos 8 caracteres) es único — úsalo para buscar rápido.',
      'Las órdenes críticas generan una notificación automática al técnico asignado.',
      'Puedes ver hasta 20 órdenes por página; usa la paginación para navegar.',
    ],
    warnings: [
      'Solo ADMIN y SUPERVISOR pueden crear, asignar y cancelar órdenes.',
      'Una orden COMPLETADA o CANCELADA no puede regresar a estados anteriores.',
    ],
  },
  {
    id: 'assets',
    label: 'Equipos / Activos',
    icon: Factory,
    color: '#10b981',
    roles: ['ADMIN', 'SUPERVISOR'],
    summary: 'Registro y administración del inventario de equipos y activos de la planta.',
    tasks: [
      {
        title: 'Registrar un nuevo equipo',
        steps: [
          'Ve a Mtto → "Equipos" y haz clic en "Nuevo Equipo".',
          'Completa el formulario: código único (ej. COMP-001), nombre descriptivo, área de la planta y ubicación física.',
          'Selecciona el estado inicial: Operativo, En Mantenimiento, Fuera de Servicio o Dado de Baja.',
          'Opcionalmente ingresa fabricante, modelo, número de serie y fecha de instalación.',
          'Haz clic en "Guardar" para registrar el equipo.',
        ],
      },
      {
        title: 'Actualizar el estado de un equipo',
        steps: [
          'Busca el equipo en la lista o usa el filtro por área.',
          'Haz clic en el equipo para abrir su detalle.',
          'Cambia el estado según corresponda (ej. "En Mantenimiento" mientras se repara).',
          'Guarda el cambio. El estado se refleja inmediatamente en el Dashboard.',
        ],
      },
      {
        title: 'Ver el historial de mantenimiento',
        steps: [
          'En el detalle del equipo desplázate hacia abajo.',
          'La pestaña "Historial" muestra todas las órdenes de trabajo asociadas a ese equipo.',
          'La pestaña "Planes" muestra los planes de mantenimiento preventivo configurados.',
        ],
      },
    ],
    tips: [
      'El código del equipo debe ser único en todo el sistema. Usa una nomenclatura consistente (ej. TIPO-NNN).',
      'El campo "Área" permite filtrar equipos por zona de la planta en toda la aplicación.',
    ],
    warnings: [
      'Borrar un equipo es una acción lógica (no se elimina de la BD) — sus OTs históricas quedan intactas.',
    ],
  },
  {
    id: 'maintenance',
    label: 'Planes de Mantenimiento',
    icon: Wrench,
    color: '#8b5cf6',
    roles: ['ADMIN', 'SUPERVISOR'],
    summary: 'Configuración de mantenimientos preventivos automáticos por tiempo o uso.',
    tasks: [
      {
        title: 'Crear un plan de mantenimiento',
        steps: [
          'Ve a Mtto → "Mantenimiento" y haz clic en "Nuevo Plan".',
          'Ingresa el nombre del plan (ej. "Cambio de aceite trimestral") y selecciona el equipo.',
          'Elige el tipo: Preventivo, Inspección, Predictivo o Correctivo.',
          'Selecciona el disparador: "Por Tiempo" (ej. cada 3 meses), "Por Uso" (ej. cada 500 horas) o "Ambos".',
          'Establece la "Próxima fecha de vencimiento" (nextDue) para la primera ejecución.',
          'Opcionalmente vincula una plantilla de checklist que se adjuntará automáticamente.',
          'Activa el plan y haz clic en "Guardar".',
        ],
      },
      {
        title: 'Generación automática de OTs',
        steps: [
          'Cuando un plan de mantenimiento llega a su fecha de vencimiento, el sistema genera automáticamente una Orden de Trabajo.',
          'Las OTs autogeneradas aparecen marcadas con "Auto" en la lista de órdenes.',
          'Una vez completada la OT, la fecha "nextDue" del plan avanza al siguiente período.',
          'También puedes forzar la generación manual desde el botón "Generar OTs ahora" dentro del módulo.',
        ],
      },
    ],
    tips: [
      'Define bien la fecha inicial (nextDue) para que el sistema calcule correctamente los siguientes vencimientos.',
      'Vincula checklists a los planes para que las OTs autogeneradas ya traigan la lista de verificación.',
    ],
    warnings: [
      'Un plan desactivado NO genera OTs automáticas aunque llegue su fecha de vencimiento.',
    ],
  },
  {
    id: 'calendar',
    label: 'Calendario',
    icon: CalendarDays,
    color: '#ec4899',
    roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'],
    summary: 'Vista mensual de todas las órdenes y planes de mantenimiento programados.',
    tasks: [
      {
        title: 'Navegar el calendario',
        steps: [
          'Ve a Mtto → "Calendario".',
          'Usa las flechas ← → para navegar entre meses.',
          'Los eventos de colores representan órdenes de trabajo según su prioridad o estado.',
          'Haz clic en un evento para ver su resumen y acceder al detalle completo.',
        ],
      },
      {
        title: 'Interpretar los colores',
        steps: [
          'Los eventos se colorean según el estado de la orden: naranja = Pendiente, azul = En Proceso, verde = Completada.',
          'Los eventos rojos son órdenes vencidas (fecha pasada y sin completar).',
          'Los planes de mantenimiento próximos aparecen como recordatorios en las fechas programadas.',
        ],
      },
    ],
    tips: [
      'El calendario es de solo lectura — para crear o editar OTs ve a la sección "Órdenes de Trabajo".',
    ],
  },
  {
    id: 'checklists',
    label: 'Checklists',
    icon: CheckSquare,
    color: '#14b8a6',
    roles: ['ADMIN', 'SUPERVISOR'],
    summary: 'Plantillas de verificación que se adjuntan a órdenes de trabajo para guiar al técnico.',
    tasks: [
      {
        title: 'Crear una plantilla de checklist',
        steps: [
          'Ve a Mtto → "Checklists" y haz clic en "Nueva Plantilla".',
          'Ingresa el nombre de la plantilla (ej. "Inspección diaria compresor") y una descripción opcional.',
          'Agrega los ítems de verificación uno por uno usando el botón "+ Agregar ítem".',
          'Marca cada ítem como "Requerido" si es obligatorio completarlo.',
          'Reordena los ítems arrastrando para cambiar el orden de inspección.',
          'Guarda la plantilla cuando esté lista.',
        ],
      },
      {
        title: 'Ejecutar un checklist en una OT',
        steps: [
          'Al abrir el detalle de una OT que tiene un checklist asignado, verás la sección "Checklist".',
          'Marca cada ítem conforme lo vas verificando.',
          'Los ítems requeridos deben completarse antes de cerrar la orden.',
          'El porcentaje de avance se actualiza en tiempo real.',
        ],
      },
    ],
    tips: [
      'Vincula las plantillas a los Planes de Mantenimiento para que se adjunten automáticamente a las OTs generadas.',
      'Los checklists quedan registrados en el historial del equipo para trazabilidad.',
    ],
  },
  {
    id: 'oee',
    label: 'OEE — Eficiencia Global',
    icon: BarChart3,
    color: '#f97316',
    roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'],
    summary: 'Registro y análisis de la Efectividad Global de los Equipos (OEE = Disponibilidad × Rendimiento × Calidad).',
    tasks: [
      {
        title: 'Registrar un turno OEE',
        steps: [
          'Ve a OEE → "Registros" y haz clic en "Nuevo Registro".',
          'Selecciona el equipo, la fecha y el turno (Mañana, Tarde, Noche).',
          'Ingresa el Tiempo Planificado (minutos del turno, ej. 480 para 8 horas).',
          'Ingresa el Tiempo de Descanso/Paros planificados (minutos).',
          'Registra la Producción Total (piezas producidas) y la Producción Buena (piezas sin defecto).',
          'Ingresa el Tiempo de Ciclo Ideal (segundos por pieza a velocidad máxima).',
          'El sistema calcula automáticamente Disponibilidad, Rendimiento, Calidad y OEE.',
          'Guarda el registro.',
        ],
      },
      {
        title: 'Registrar eventos de paro',
        steps: [
          'Ve a OEE → "Paros" y haz clic en "Nuevo Paro".',
          'Selecciona el registro OEE al que pertenece (equipo + turno + fecha).',
          'Ingresa la hora de inicio del paro.',
          'Selecciona la categoría: Planificado, No Planificado, Configuración o Micro-paro.',
          'Selecciona el tipo de pérdida: Disponibilidad, Rendimiento o Calidad.',
          'Describe la causa del paro.',
          'Cuando el paro termine, regresa y registra la hora de fin.',
        ],
      },
      {
        title: 'Interpretar el Dashboard OEE',
        steps: [
          'Ve a OEE → "Dashboard" para ver el resumen del día actual.',
          'La métrica OEE se muestra como porcentaje — el estándar de clase mundial es ≥ 85%.',
          'Los tres componentes (A, R, C) indican dónde está la pérdida principal.',
          'La tendencia de 7 días muestra si el OEE está mejorando o deteriorándose.',
          'El ranking de activos identifica cuáles equipos tienen el OEE más bajo (requieren atención).',
        ],
      },
      {
        title: 'Generar reporte OEE',
        steps: [
          'Ve a OEE → "Reportes".',
          'Selecciona el período: este mes, mes anterior, últimos 3 meses o rango personalizado.',
          'Aplica filtros adicionales: turno, área, equipo.',
          'Haz clic en "Exportar CSV" para descargar los datos en Excel.',
          'Haz clic en "Generar PDF" para un reporte ejecutivo con gráficas y análisis.',
        ],
      },
    ],
    tips: [
      'Registra los datos del turno al finalizar, no al día siguiente, para mayor precisión.',
      'OEE < 65% es considerado bajo. Entre 65-75% es aceptable. > 85% es clase mundial.',
      'Los reportes PDF incluyen análisis comparativo vs. el benchmark del 85%.',
    ],
    notes: [
      'Fórmula OEE = Disponibilidad × Rendimiento × Calidad',
      'Disponibilidad = (Tiempo Planificado − Paros) / Tiempo Planificado',
      'Rendimiento = (Producción Real × Ciclo Ideal) / Tiempo Disponible',
      'Calidad = Producción Buena / Producción Total',
    ],
  },
  {
    id: 'audits',
    label: 'Auditorías',
    icon: ClipboardCheck,
    color: '#0ea5e9',
    roles: ['ADMIN', 'SUPERVISOR'],
    summary: 'Gestión del ciclo completo de auditorías internas: programar, ejecutar, hallazgos y acciones correctivas (CAPAs).',
    tasks: [
      {
        title: 'Crear una auditoría',
        steps: [
          'Ve a Auditoría → "Auditorías" y haz clic en "Nueva Auditoría".',
          'Ingresa el título, selecciona el tipo (5S, Proceso, Seguridad), el área y el auditor responsable.',
          'Establece la fecha programada.',
          'Selecciona la plantilla de auditoría que define los criterios de evaluación.',
          'Guarda. La auditoría queda en estado "Borrador".',
        ],
      },
      {
        title: 'Ejecutar una auditoría',
        steps: [
          'Abre la auditoría y cambia el estado a "En Progreso".',
          'Para cada ítem de la plantilla selecciona el resultado: Cumple (✓), No Cumple (✗) o N/A.',
          'Agrega notas de observación en los ítems que no cumplen.',
          'El puntaje se calcula automáticamente en tiempo real.',
          'Al terminar todos los ítems, haz clic en "Completar Auditoría".',
          'Revisa el puntaje final y cierra la auditoría.',
        ],
      },
      {
        title: 'Gestionar hallazgos (CAPAs)',
        steps: [
          'Los ítems marcados como "No Cumple" pueden generar Acciones Correctivas/Preventivas (CAPA).',
          'Ve a Auditoría → "Hallazgos" para ver todos los CAPAs activos.',
          'Cada CAPA tiene: descripción, severidad (Crítica, Mayor, Menor, Observación), responsable y fecha límite.',
          'Cambia el estado del CAPA conforme avanza: Abierto → En Proceso → Pendiente de Verificación → Cerrado.',
          'Al cerrar, agrega notas de cierre explicando la acción tomada.',
        ],
      },
      {
        title: 'Ver reportes de auditoría',
        steps: [
          'Ve a Auditoría → "CAPAs" para el reporte de acciones correctivas activas.',
          'Ve a Auditoría → "Cumplimiento Mensual" para la tendencia de puntajes por área.',
          'Usa el calendario de auditorías para ver la programación del mes.',
        ],
      },
    ],
    tips: [
      'Configura las plantillas de auditoría antes de comenzar (Auditoría → "Plantillas").',
      'Los CAPAs vencidos se resaltan en rojo en el reporte de hallazgos.',
    ],
  },
  {
    id: 'fleet',
    label: 'Flota',
    icon: Car,
    color: '#ef4444',
    roles: ['ADMIN', 'SUPERVISOR'],
    summary: 'Control integral de la flota vehicular: vehículos, combustible, mantenimiento y alertas.',
    tasks: [
      {
        title: 'Registrar un vehículo',
        steps: [
          'Ve a Flota → "Vehículos" y haz clic en "Nuevo Vehículo".',
          'Ingresa los datos del vehículo: placa, nombre, tipo, marca, modelo y año.',
          'Selecciona el tipo de combustible y el área a la que pertenece.',
          'Registra el kilometraje actual.',
          'Guarda el vehículo.',
        ],
      },
      {
        title: 'Registrar consumo de combustible',
        steps: [
          'Ve a Flota → "Combustible" y haz clic en "Nuevo Registro".',
          'Selecciona el vehículo, la fecha y el turno.',
          'Ingresa los litros cargados, el costo por litro y el kilometraje al momento de la carga.',
          'El sistema calcula el rendimiento (km/L) comparado con cargas anteriores.',
          'Guarda el registro.',
        ],
      },
      {
        title: 'Gestionar mantenimiento vehicular',
        steps: [
          'Ve a Flota → "Mantenimiento" para ver los servicios programados.',
          'Haz clic en "Nuevo Servicio" para registrar un mantenimiento realizado o programado.',
          'Indica el tipo de servicio, fecha, costo y proveedor.',
          'Los vehículos con mantenimiento próximo o vencido aparecen en el Dashboard de Flota.',
        ],
      },
      {
        title: 'Revisar alertas de flota',
        steps: [
          'Ve a Flota → "Alertas" para ver todas las alertas activas.',
          'Las alertas se generan automáticamente por: mantenimiento vencido, bajo rendimiento de combustible, documentos próximos a vencer, etc.',
          'Haz clic en una alerta para ver el detalle y marcarla como atendida.',
        ],
      },
    ],
    tips: [
      'Registra el combustible con regularidad para que el Dashboard de Flota muestre datos precisos de rendimiento.',
      'Las alertas de mantenimiento se calculan según el historial de servicios previos.',
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: Settings,
    color: '#6b7280',
    roles: ['ADMIN'],
    summary: 'Gestión de usuarios, roles y configuración general del sistema.',
    tasks: [
      {
        title: 'Crear un usuario',
        steps: [
          'Ve a Admin → "Usuarios" y haz clic en "Nuevo Usuario".',
          'Ingresa el nombre completo, correo electrónico y contraseña inicial.',
          'Selecciona el rol: Administrador, Supervisor, Técnico o Directivo.',
          'Haz clic en "Crear". El usuario podrá iniciar sesión de inmediato.',
          'Comunica las credenciales al usuario de forma segura.',
        ],
      },
      {
        title: 'Roles y permisos',
        steps: [
          'ADMINISTRADOR: acceso completo a todos los módulos y configuración.',
          'SUPERVISOR: puede crear/asignar órdenes, gestionar equipos, auditorías y flota. No puede administrar usuarios.',
          'TÉCNICO: solo ve y actualiza las órdenes asignadas a él. Acceso de solo lectura al resto.',
          'DIRECTIVO: acceso de lectura a dashboards y reportes. No puede crear ni modificar datos.',
        ],
      },
      {
        title: 'Cambiar contraseña de usuario',
        steps: [
          'Ve a Admin → "Usuarios" y haz clic en el usuario.',
          'Selecciona "Cambiar contraseña".',
          'Ingresa la nueva contraseña (mínimo 8 caracteres).',
          'Comunica la nueva contraseña al usuario.',
        ],
      },
      {
        title: 'Activar / desactivar usuario',
        steps: [
          'Un usuario desactivado no puede iniciar sesión pero sus datos históricos se conservan.',
          'Ve a Admin → "Usuarios", haz clic en el usuario y usa el interruptor "Activo/Inactivo".',
          'El cambio es inmediato — si el usuario tenía sesión abierta, será desconectado.',
        ],
      },
      {
        title: 'Configuración del sistema',
        steps: [
          'Ve a Admin → "Configuración" para ajustar los parámetros generales.',
          'Aquí puedes configurar el nombre de la empresa, zona horaria y otras preferencias globales.',
        ],
      },
    ],
    warnings: [
      'Solo existe un rol de Administrador — cuida quién tiene este acceso.',
      'No es posible cambiar tu propio rol desde la interfaz de usuario.',
      'La desactivación de un usuario es reversible; sus datos nunca se eliminan.',
    ],
  },
];

// ─── Role label ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', TECHNICIAN: 'Técnico', EXECUTIVE: 'Directivo',
};
const ROLE_COLOR: Record<Role, string> = {
  ADMIN: '#ef4444', SUPERVISOR: '#f59e0b', TECHNICIAN: '#3b82f6', EXECUTIVE: '#8b5cf6',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManualesPage() {
  const { user } = useAuth();
  const userRole = (user?.role ?? 'ADMIN') as Role;

  const [activeId,    setActiveId]    = useState('inicio');
  const [searchQuery, setSearchQuery] = useState('');
  const [openTasks,   setOpenTasks]   = useState<Record<string, boolean>>({});

  const toggleTask = (key: string) => setOpenTasks(prev => ({ ...prev, [key]: !prev[key] }));

  // Filter manuals by search query
  const visibleManuals = MANUALS.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.label.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.tasks.some(t => t.title.toLowerCase().includes(q) || t.steps.some(s => s.toLowerCase().includes(q)))
    );
  });

  const activeManual = MANUALS.find(m => m.id === activeId) ?? MANUALS[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'IBM Plex Sans, sans-serif', background: '#f9fafb' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex"
        style={{
          width: 240, flexShrink: 0, flexDirection: 'column',
          background: '#fff', borderRight: '1px solid #e5e7eb',
          height: '100%', overflowY: 'auto',
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={14} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Manuales de Uso</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>v1.0 · Mayo 2026</p>
            </div>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', borderRadius: 6, padding: '5px 10px' }}>
            <Search size={12} color="#9ca3af" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en manuales…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#374151', width: '100%', fontFamily: 'IBM Plex Sans, sans-serif' }}
            />
          </div>
        </div>

        {/* Tu rol */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Tu rol:</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR[userRole], background: ROLE_COLOR[userRole] + '15', padding: '1px 8px', borderRadius: 99 }}>
            {ROLE_LABEL[userRole]}
          </span>
        </div>

        {/* Nav list */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {visibleManuals.map(m => {
            const Icon = m.icon;
            const isActive = activeId === m.id;
            const hasAccess = m.roles.includes(userRole);
            return (
              <button
                key={m.id}
                onClick={() => { setActiveId(m.id); setSearchQuery(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 16px', textAlign: 'left', background: isActive ? '#eff6ff' : 'transparent',
                  border: 'none', borderLeft: `3px solid ${isActive ? '#1d4ed8' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: 5, background: m.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={12} color={m.color} />
                </div>
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? '#1d4ed8' : '#374151', flex: 1 }}>{m.label}</span>
                {!hasAccess && <span style={{ fontSize: 9, color: '#9ca3af' }}>ℹ</span>}
              </button>
            );
          })}
          {visibleManuals.length === 0 && (
            <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 16px' }}>
              Sin resultados para "{searchQuery}"
            </p>
          )}
        </nav>

        {/* Print button */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
              padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            <Printer size={13} />
            Imprimir / Guardar PDF
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', maxWidth: 860 }} id="manual-content">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: '#9ca3af' }}>
          <BookOpen size={13} />
          <span>Manuales</span>
          <ChevronRight size={11} />
          <span style={{ color: '#374151', fontWeight: 600 }}>{activeManual.label}</span>
        </div>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: activeManual.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <activeManual.icon size={22} color={activeManual.color} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{activeManual.label}</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{activeManual.summary}</p>
            </div>
          </div>
          {/* Roles badge */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {activeManual.roles.map(r => (
              <span key={r} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: ROLE_COLOR[r] + '15', color: ROLE_COLOR[r] }}>
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
        </div>

        {/* Access note for current user */}
        {!activeManual.roles.includes(userRole) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 20 }}>
            <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              Este módulo no está disponible para tu rol actual (<strong>{ROLE_LABEL[userRole]}</strong>), pero puedes leer la documentación como referencia.
            </p>
          </div>
        )}

        {/* Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {activeManual.tasks.map((task, ti) => {
            const taskKey = `${activeManual.id}-${ti}`;
            const isOpen = openTasks[taskKey] !== false; // open by default
            return (
              <div key={ti} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                {/* Task header */}
                <button
                  onClick={() => toggleTask(taskKey)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 18px',
                    background: isOpen ? '#f8faff' : '#fff',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: activeManual.color,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, flexShrink: 0,
                    }}>
                      {ti + 1}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{task.title}</span>
                  </div>
                  {isOpen
                    ? <ChevronDown size={16} color="#9ca3af" />
                    : <ChevronRight size={16} color="#9ca3af" />}
                </button>

                {/* Steps */}
                {isOpen && (
                  <div style={{ padding: '4px 18px 18px' }}>
                    <ol style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none' }}>
                      {task.steps.map((step, si) => (
                        <li key={si} style={{ display: 'flex', gap: 12, paddingBottom: si < task.steps.length - 1 ? 12 : 0, alignItems: 'flex-start' }}>
                          {/* Step number + vertical line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: '#f3f4f6', border: '2px solid #e5e7eb',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: '#6b7280', flexShrink: 0,
                            }}>
                              {si + 1}
                            </div>
                            {si < task.steps.length - 1 && (
                              <div style={{ width: 1, flex: 1, background: '#e5e7eb', marginTop: 3, minHeight: 20 }} />
                            )}
                          </div>
                          <p style={{ margin: '1px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Formulas / Notes */}
        {activeManual.notes && activeManual.notes.length > 0 && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Info size={15} color="#0ea5e9" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0c4a6e' }}>Fórmulas y definiciones</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeManual.notes.map((note, i) => (
                <li key={i} style={{ fontSize: 13, color: '#0c4a6e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#0ea5e9', fontWeight: 700, flexShrink: 0 }}>▸</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tips */}
        {activeManual.tips && activeManual.tips.length > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Lightbulb size={15} color="#16a34a" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#14532d' }}>Consejos prácticos</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeManual.tips.map((tip, i) => (
                <li key={i} style={{ fontSize: 13, color: '#14532d', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {activeManual.warnings && activeManual.warnings.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldCheck size={15} color="#dc2626" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7f1d1d' }}>Puntos importantes</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeManual.warnings.map((w, i) => (
                <li key={i} style={{ fontSize: 13, color: '#7f1d1d', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>!</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation between sections */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
          {(() => {
            const idx = MANUALS.findIndex(m => m.id === activeId);
            const prev = MANUALS[idx - 1];
            const next = MANUALS[idx + 1];
            return (
              <>
                {prev ? (
                  <button
                    onClick={() => setActiveId(prev.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #e5e7eb', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  >
                    ← {prev.label}
                  </button>
                ) : <div />}
                {next ? (
                  <button
                    onClick={() => setActiveId(next.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: 'IBM Plex Sans, sans-serif' }}
                  >
                    {next.label} →
                  </button>
                ) : <div />}
              </>
            );
          })()}
        </div>

      </main>

      {/* ── Print styles ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          aside { display: none !important; }
          main { padding: 20px !important; max-width: 100% !important; }
          button { display: none !important; }
          @page { margin: 2cm; }
        }
      `}</style>
    </div>
  );
}
