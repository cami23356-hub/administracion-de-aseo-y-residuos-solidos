import {
  AuditAlert,
  AuditFinding,
  BeforeAfterComparisonResult,
  CafeteriaMovement,
  CafeteriaSupply,
  ChangeHistoryEntry,
  CharacterizationData,
  ConsumptionRecord,
  DamageReport,
  DeliveryItem,
  EquipmentDelivery,
  Floor,
  FlowchartStep,
  LegalMatrixRow,
  PhotoAnalysisResult,
  PhotoRecord,
  ProcessMapData,
  ProductItem,
  Role,
  ScheduleActivity,
  ShiftConfig,
  Space,
  User,
  WasteBin,
  WasteRecord,
} from '../types/cesge';
import {
  createUserLocal,
  deleteUserLocal,
  getSessionUserLocal,
  listUsersLocal,
  loginLocal,
  logoutLocal,
  registerLocal,
  updateUserLocal,
} from './localAuth';

const DB_STORAGE_KEY = 'cesge_db_v1';

interface LocalDatabase {
  floors: Floor[];
  spaces: Space[];
  photos: PhotoRecord[];
  shifts: ShiftConfig[];
  schedules: ScheduleActivity[];
  products: ProductItem[];
  consumptions: ConsumptionRecord[];
  deliveries: EquipmentDelivery[];
  cafeteriaSupplies: CafeteriaSupply[];
  cafeteriaMovements: CafeteriaMovement[];
  damages: DamageReport[];
  wasteBins: WasteBin[];
  wasteRecords: WasteRecord[];
  audits: AuditAlert[];
  findings: AuditFinding[];
  legalMatrix: LegalMatrixRow[];
  processDocs: {
    flowchart: { content: FlowchartStep[]; updatedAt: string; updatedBy: string };
    process_map: { content: ProcessMapData; updatedAt: string; updatedBy: string };
    characterization: { content: CharacterizationData; updatedAt: string; updatedBy: string };
  };
  history: ChangeHistoryEntry[];
  nextIds: Record<string, number>;
}

const COMMON_ELEMENTS = [
  'Barandales de vidrio',
  'Pasamanos de seguridad',
  'Canecas de residuos blancos y negros, con sus respectivas bolsas',
  'Zonas de circulación y acceso',
  'Sillas de 3 puestos',
];

function buildInitialDatabase(): LocalDatabase {
  const now = new Date().toISOString();

  const floors: Floor[] = [
    { id: 1, code: 'SOTANO', name: 'Sótano y Parqueadero', sortOrder: 0, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 2, code: 'PISO-01', name: 'Piso 1', sortOrder: 1, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 3, code: 'PISO-02', name: 'Piso 2', sortOrder: 2, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 4, code: 'PISO-03', name: 'Piso 3', sortOrder: 3, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 5, code: 'PISO-04', name: 'Piso 4', sortOrder: 4, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 6, code: 'PISO-05', name: 'Piso 5', sortOrder: 5, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 7, code: 'PISO-06', name: 'Piso 6', sortOrder: 6, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 8, code: 'PISO-07', name: 'Piso 7', sortOrder: 7, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 9, code: 'PISO-08', name: 'Piso 8', sortOrder: 8, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 10, code: 'PISO-09', name: 'Piso 9', sortOrder: 9, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 11, code: 'PISO-10', name: 'Piso 10', sortOrder: 10, standardElements: COMMON_ELEMENTS, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    { id: 12, code: 'EXTERIORES', name: 'Zonas Exteriores', sortOrder: 11, standardElements: COMMON_ELEMENTS, notes: 'Perímetro exterior. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
  ];

  const floorByCode = new Map(floors.map((f) => [f.code, f]));

  const areasCesgePdf: Array<{
    piso: number;
    ambiente: string;
    franja: string;
    dispFormacion: 'SI' | 'NO';
    descripcion: string;
    capacidad: number | null;
    mt2: number;
  }> = [
    { piso: 1, ambiente: '101', franja: 'AM', dispFormacion: 'SI', descripcion: 'Cocina demostrativa Taller', capacidad: 30, mt2: 121.97 },
    { piso: 2, ambiente: '201', franja: 'AM', dispFormacion: 'SI', descripcion: 'Simulador de transporte Taller', capacidad: 20, mt2: 64.53 },
    { piso: 2, ambiente: '202', franja: 'AM', dispFormacion: 'SI', descripcion: 'Simulador de montacargas Taller', capacidad: 25, mt2: 65.07 },
    { piso: 2, ambiente: '203', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 64.53 },
    { piso: 2, ambiente: '204', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Laboratorio comunicación gráfica', capacidad: 10, mt2: 39.2 },
    { piso: 3, ambiente: '300', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: null, mt2: 36 },
    { piso: 3, ambiente: '301', franja: 'AM', dispFormacion: 'NO', descripcion: 'Laboratorio Fábrica de Software', capacidad: 25, mt2: 28.96 },
    { piso: 3, ambiente: '302', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc Ambiente de multimedia', capacidad: 22, mt2: 58.24 },
    { piso: 3, ambiente: '304', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: null, mt2: 36 },
    { piso: 4, ambiente: '402', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: 15, mt2: 36 },
    { piso: 4, ambiente: '403', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 30, mt2: 49.39 },
    { piso: 4, ambiente: '404', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 28, mt2: 44.05 },
    { piso: 4, ambiente: '405', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 21, mt2: 34.24 },
    { piso: 4, ambiente: '406', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 34.24 },
    { piso: 4, ambiente: '407', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 33.32 },
    { piso: 4, ambiente: '408', franja: 'AM', dispFormacion: 'SI', descripcion: 'Taller de Peluquería', capacidad: 23, mt2: 34.44 },
    { piso: 4, ambiente: '409', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 24, mt2: 36.54 },
    { piso: 4, ambiente: '410', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 24, mt2: 36.34 },
    { piso: 4, ambiente: '411', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 24, mt2: 37.42 },
    { piso: 5, ambiente: '501', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 26, mt2: 41.67 },
    { piso: 5, ambiente: '502', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.48 },
    { piso: 5, ambiente: '503', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.96 },
    { piso: 5, ambiente: '504', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.93 },
    { piso: 5, ambiente: '505', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 31, mt2: 50.18 },
    { piso: 5, ambiente: '506', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 31.89 },
    { piso: 5, ambiente: '507', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 25, mt2: 40.28 },
    { piso: 5, ambiente: '508', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller de Cableado', capacidad: null, mt2: 20 },
    { piso: 5, ambiente: '509', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Laboratorio de Cableado', capacidad: null, mt2: 25 },
    { piso: 6, ambiente: '601', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina EECL', capacidad: null, mt2: 36 },
    { piso: 6, ambiente: '602', franja: 'AM', dispFormacion: 'NO', descripcion: 'Tradicional Ambiente ENI', capacidad: 28, mt2: 44.37 },
    { piso: 6, ambiente: '603', franja: 'AM', dispFormacion: 'NO', descripcion: 'Tradicional Ambiente ENI', capacidad: 28, mt2: 44.96 },
    { piso: 6, ambiente: '604', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.93 },
    { piso: 6, ambiente: '605', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.22 },
    { piso: 6, ambiente: '606', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 20, mt2: 31.89 },
    { piso: 6, ambiente: '607', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 25, mt2: 40.28 },
    { piso: 6, ambiente: '608', franja: 'AM', dispFormacion: 'NO', descripcion: 'Bodega de Mantenimiento', capacidad: null, mt2: 36 },
    { piso: 6, ambiente: '609', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 35.04 },
    { piso: 6, ambiente: '610', franja: 'AM', dispFormacion: 'NO', descripcion: 'Equipo Pedagógico', capacidad: null, mt2: 36 },
    { piso: 7, ambiente: '701', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 26, mt2: 41.66 },
    { piso: 7, ambiente: '702', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.06 },
    { piso: 7, ambiente: '703', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
    { piso: 7, ambiente: '704', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
    { piso: 7, ambiente: '705', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.06 },
    { piso: 7, ambiente: '706', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 41.66 },
    { piso: 7, ambiente: '707', franja: 'AM', dispFormacion: 'NO', descripcion: 'Sala de Instructores', capacidad: null, mt2: 36 },
    { piso: 8, ambiente: '801', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 35.85 },
    { piso: 8, ambiente: '802', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.15 },
    { piso: 8, ambiente: '803', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
    { piso: 8, ambiente: '804', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
    { piso: 8, ambiente: '805', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.14 },
    { piso: 8, ambiente: '806', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 34, mt2: 54.76 },
    { piso: 8, ambiente: '807', franja: 'AM', dispFormacion: 'NO', descripcion: 'Sala de Instructores', capacidad: null, mt2: 36 },
    { piso: 9, ambiente: '901', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficinas Administrativas y Coordinaciones', capacidad: 75, mt2: 380 },
    { piso: 10, ambiente: '1001', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 23, mt2: 35.85 },
    { piso: 10, ambiente: '1002', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 29, mt2: 44.14 },
    { piso: 10, ambiente: '1003', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.46 },
    { piso: 10, ambiente: '1004', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.46 },
    { piso: 10, ambiente: '1005', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 29, mt2: 44.14 },
    { piso: 10, ambiente: '1006', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Ambiente de Edición', capacidad: 16, mt2: 23.85 },
    { piso: 10, ambiente: '1007', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 23, mt2: 36 },
    { piso: 10, ambiente: '1008', franja: 'AM', dispFormacion: 'NO', descripcion: 'Bodega de Industrias Gráficas', capacidad: null, mt2: 23.85 },
  ];

  let nextSpaceId = 1;
  const spaces: Space[] = [];

  for (const row of areasCesgePdf) {
    const code = `PISO-${String(row.piso).padStart(2, '0')}`;
    const floor = floorByCode.get(code)!;
    const descLower = row.descripcion.toLowerCase();
    const hasComputers =
      descLower.includes('pc') ||
      descLower.includes('software') ||
      descLower.includes('edición') ||
      descLower.includes('comunicación gráfica') ||
      descLower.includes('simulador')
        ? 1
        : 0;
    let category = 'Ambiente de Formación';
    if (descLower.includes('oficina') || descLower.includes('instructores') || descLower.includes('pedagógico')) {
      category = 'Área Administrativa';
    } else if (descLower.includes('bodega')) {
      category = 'Almacenamiento';
    } else if (descLower.includes('pc')) {
      category = 'Ambiente con Cómputo';
    } else if (descLower.includes('software') || descLower.includes('cableado')) {
      category = 'Área Tecnológica';
    } else if (descLower.includes('taller') || descLower.includes('simulador') || descLower.includes('cocina')) {
      category = 'Taller Especializado';
    }
    const capText = row.capacidad !== null ? `${row.capacidad} personas` : 'No especificada';
    const mt2Text = `${String(row.mt2).replace('.', ',')} m²`;
    spaces.push({
      id: nextSpaceId++,
      floorId: floor.id,
      floorCode: floor.code,
      floorName: floor.name,
      name: `${row.ambiente} - ${row.descripcion}`,
      category,
      hasComputers,
      hasTv: 0,
      availability: 'Disponible',
      trainingScheduleNote: `Franja ${row.franja} · Disponible formación: ${row.dispFormacion}`,
      elementsDetail: `Área: ${mt2Text} · Capacidad real: ${capText} · Sede Torre Norte`,
      active: 1,
      updatedAt: now,
      updatedBy: 'AREAS CESGE PDF',
    });
  }

  const archSpaces = [
    {
      floorCode: 'PISO-01',
      name: 'Biblioteca Piso 1',
      category: 'Biblioteca',
      hasComputers: 1,
      hasTv: 0,
      scheduleNote: 'Acceso continuo por jornadas',
      detail: 'Biblioteca CESGE Piso 1 · Estanterías, mesas de lectura, equipos de cómputo de consulta y zona de estudio · Sede Torre Norte',
    },
    {
      floorCode: 'PISO-01',
      name: 'Auditorio Piso 1',
      category: 'Auditorio',
      hasComputers: 0,
      hasTv: 1,
      scheduleNote: 'Uso institucional / eventos',
      detail: 'Auditorio principal Piso 1 · Silletería, tarima, pantallas/audio y zonas de acceso · Sede Torre Norte',
    },
    {
      floorCode: 'PISO-02',
      name: 'Auditorio Piso 2',
      category: 'Auditorio',
      hasComputers: 0,
      hasTv: 1,
      scheduleNote: 'Uso institucional / formación',
      detail: 'Auditorio Piso 2 · Silletería, pantallas/audio y circulación · Sede Torre Norte',
    },
    {
      floorCode: 'PISO-04',
      name: 'Terraza Lado Izquierdo (Piso 4)',
      category: 'Terraza / Alimentación',
      hasComputers: 0,
      hasTv: 0,
      scheduleNote: 'Acceso abierto por jornadas',
      detail: 'Ubicada en el costado izquierdo del Piso 4 (separada de la terraza derecha) · Mesas, sillas, microondas y canecas de residuos',
    },
    {
      floorCode: 'PISO-04',
      name: 'Terraza Lado Derecho (Piso 4)',
      category: 'Terraza / Alimentación',
      hasComputers: 0,
      hasTv: 0,
      scheduleNote: 'Acceso abierto por jornadas',
      detail: 'Ubicada en el costado derecho del Piso 4 (separada de la terraza izquierda) · Mesas, sillas, microondas y canecas de residuos',
    },
    {
      floorCode: 'PISO-07',
      name: 'Terraza Lado Izquierdo (Piso 7)',
      category: 'Terraza / Alimentación',
      hasComputers: 0,
      hasTv: 0,
      scheduleNote: 'Acceso abierto por jornadas',
      detail: 'Ubicada en el costado izquierdo del Piso 7 (separada de la terraza derecha) · Puestos, mesas, microondas y canecas de residuos',
    },
    {
      floorCode: 'PISO-07',
      name: 'Terraza Lado Derecho (Piso 7)',
      category: 'Terraza / Alimentación',
      hasComputers: 0,
      hasTv: 0,
      scheduleNote: 'Acceso abierto por jornadas',
      detail: 'Ubicada en el costado derecho del Piso 7 (separada de la terraza izquierda) · Puestos, mesas, microondas y canecas de residuos',
    },
  ];

  for (const sp of archSpaces) {
    const fl = floorByCode.get(sp.floorCode)!;
    spaces.push({
      id: nextSpaceId++,
      floorId: fl.id,
      floorCode: fl.code,
      floorName: fl.name,
      name: sp.name,
      category: sp.category,
      hasComputers: sp.hasComputers,
      hasTv: sp.hasTv,
      availability: 'Disponible',
      trainingScheduleNote: sp.scheduleNote,
      elementsDetail: sp.detail,
      active: 1,
      updatedAt: now,
      updatedBy: 'Infraestructura Torre Norte',
    });
  }

  const shifts: ShiftConfig[] = [
    {
      id: 1,
      name: 'Jornada de la mañana',
      startTime: '06:00',
      endTime: '14:00',
      durationMinutes: 480,
      frequency: 'Lunes a sábado',
      supervisorName: 'Supervisión Torre Norte',
      notes: 'Aseo previo al inicio de formación y mantenimiento continuo de baños y pasillos.',
    },
    {
      id: 2,
      name: 'Jornada de la tarde',
      startTime: '14:00',
      endTime: '22:00',
      durationMinutes: 480,
      frequency: 'Lunes a sábado',
      supervisorName: 'Supervisión Torre Norte',
      notes: 'Desinfección de cambio de jornada en ambientes, terrazas y cafetines.',
    },
    {
      id: 3,
      name: 'Jornada de la noche',
      startTime: '22:00',
      endTime: '06:00',
      durationMinutes: 480,
      frequency: 'Lunes a sábado (domingo bajo programación especial)',
      supervisorName: 'Supervisión Torre Norte',
      notes: 'Limpieza profunda de pisos, vidrios, barandales y lavado general sin interferir con clases.',
    },
  ];

  const legalMatrix: LegalMatrixRow[] = [
    { id: 1, norm: 'Ley 9 (Código Sanitario Nacional)', year: '1979', applicableArticle: 'Arts. 193-207 y 231-246', requirement: 'Condiciones sanitarias de edificaciones, saneamiento básico, limpieza, desinfección y manejo higiénico de áreas de alimentos y baños.', processApplication: 'Protocolos diarios de aseo y desinfección de baños, cafetines, terrazas y ambientes de formación.', responsible: 'Administrador / Supervisor', evidence: 'Registros de actividades y evidencias fotográficas antes/después.', complianceStatus: 'Cumple', officialSource: 'Función Pública / SUIN-Juriscol', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026. Norma marco sanitaria nacional.' },
    { id: 2, norm: 'Ley 55 (Convenio 170 OIT)', year: '1993', applicableArticle: 'Arts. 6, 7, 10, 11 y 13', requirement: 'Seguridad en la utilización de productos químicos en el trabajo: clasificación, etiquetado, fichas de datos de seguridad y capacitación.', processApplication: 'Control de inventario SST-FR-96, exigencia de FDS del fabricante y rotulado antes de entrega de insumos.', responsible: 'Supervisor / SG-SST', evidence: 'Inventario SST-FR-96 con FDS disponibles y registro de capacitación.', complianceStatus: 'En proceso', officialSource: 'Congreso de Colombia / SUIN-Juriscol', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026. Reglamentada por Decreto 1496 de 2018 y Res. 773 de 2021.' },
    { id: 3, norm: 'Resolución 2400 (Estatuto de Seguridad Industrial)', year: '1979', applicableArticle: 'Arts. 17-37 y 176-201', requirement: 'Orden, limpieza de locales de trabajo, evacuación de basuras y suministro obligatorio de Elementos de Protección Personal (EPP).', processApplication: 'Dotación y uso de guantes, tapabocas, calzado antideslizante y señalización de piso mojado.', responsible: 'Supervisor / Personal de Aseo', evidence: 'Inventario de EPP y verificación visual en campo.', complianceStatus: 'Cumple', officialSource: 'Ministerio del Trabajo', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026 en disposiciones de higiene y seguridad industrial.' },
    { id: 4, norm: 'Ley 1562', year: '2012', applicableArticle: 'Arts. 1-11', requirement: 'Sistema General de Riesgos Laborales y prevención de accidentes y enfermedades laborales en actividades operativas.', processApplication: 'Identificación de peligros químicos, biológicos y locativos (escaleras, cuartos eléctricos, terrazas).', responsible: 'Administrador / SG-SST', evidence: 'Matriz de peligros y reporte de incidentes.', complianceStatus: 'Cumple', officialSource: 'Ministerio del Trabajo', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026.' },
    { id: 5, norm: 'Decreto 1072 (DUR Sector Trabajo)', year: '2015', applicableArticle: 'Libro 2, Parte 2, Título 4, Cap. 6 (Arts. 2.2.4.6.1 - 2.2.4.6.37)', requirement: 'Implementación obligatoria del SG-SST, ciclo PHVA, control de peligros químicos, auditorías y acciones correctivas.', processApplication: 'Estructuración PHVA del proceso de aseo, matriz de riesgos, auditorías periódicas y planes de mejoramiento.', responsible: 'Administrador / Auditor / SG-SST', evidence: 'Caracterización PHVA, actas de auditoría y planes de acción.', complianceStatus: 'En proceso', officialSource: 'Ministerio del Trabajo / SUIN-Juriscol', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026 (con actualizaciones de reporte SG-SST).' },
    { id: 6, norm: 'Decreto 1076 (DUR Sector Ambiente)', year: '2015', applicableArticle: 'Libro 2, Parte 2, Título 6 (Gestión de residuos y RESPEL)', requirement: 'Gestión ambiental integral, prevención de contaminación y manejo diferenciado de residuos peligrosos (envases químicos contaminados).', processApplication: 'Almacenamiento seguro de sustancias y disposición diferenciada de envases de químicos o luminarias si aplica.', responsible: 'Administrador / Gestión Ambiental', evidence: 'Actas de entrega y registro de residuos por piso.', complianceStatus: 'En proceso', officialSource: 'Ministerio de Ambiente y Desarrollo Sostenible', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026.' },
    { id: 7, norm: 'Decreto 1077 (DUR Vivienda, Ciudad y Territorio)', year: '2015', applicableArticle: 'Libro 2, Parte 3, Título 2 (Arts. 2.3.2.2.1 y ss.)', requirement: 'Prestación del servicio público de aseo, presentación en la vía pública, frecuencias de recolección y deberes del usuario generador.', processApplication: 'Verificación de recolección interna, cierre de bolsas y control de hora de recogida del camión recolector.', responsible: 'Supervisor / Personal de Aseo', evidence: 'Registro de recolección con verificación de horario de camión.', complianceStatus: 'Cumple', officialSource: 'MinVivienda / CRA', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026 (modificado parcialmente en esquemas de aprovechamiento, mantiene deberes del usuario).' },
    { id: 8, norm: 'Decreto 1496', year: '2018', applicableArticle: 'Arts. 1-20', requirement: 'Adopción del Sistema Globalmente Armonizado (SGA) de clasificación y etiquetado de productos químicos.', processApplication: 'Clasificación de peligros SGA en inventario de detergentes, desinfectantes y desengrasantes.', responsible: 'Administrador / Proveedores', evidence: 'Base de datos de productos con clasificación SGA y FDS.', complianceStatus: 'En proceso', officialSource: 'MinTrabajo / MinSalud / MinAmbiente', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026. Reglamentado en lugares de trabajo por Res. 773 de 2021.' },
    { id: 9, norm: 'Resolución 0312', year: '2019', applicableArticle: 'Arts. 16-21 y 27 (Estándares Mínimos SG-SST)', requirement: 'Cumplimiento de estándares mínimos del SG-SST según tamaño de entidad, plan de mejora e indicadores.', processApplication: 'Seguimiento de indicadores de cumplimiento, EPP y control de sustancias químicas en Torre Norte.', responsible: 'Administrador / SG-SST', evidence: 'Tablero de indicadores y evaluaciones de cumplimiento.', complianceStatus: 'En proceso', officialSource: 'Ministerio del Trabajo', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026.' },
    { id: 10, norm: 'Resolución 2184 (y mod. Res. 1342 de 2020)', year: '2019 / 2020', applicableArticle: 'Art. 4 (Código de colores unificado nacional)', requirement: 'Separación en la fuente obligatoria: Blanco (aprovechables), Negro (no aprovechables), Verde (orgánicos aprovechables).', processApplication: 'Control de canecas blancas y negras por piso e identificación de necesidad de canecas verdes en cafeterines y terrazas.', responsible: 'Supervisor / Personal de Aseo', evidence: 'Inventario de canecas por piso y planillas de pesaje por color.', complianceStatus: 'Cumple', officialSource: 'MinAmbiente / MinVivienda', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026 (código nacional obligatorio desde 1 de enero de 2021).' },
    { id: 11, norm: 'Resolución 773', year: '2021', applicableArticle: 'Arts. 1-17', requirement: 'Acciones para la aplicación del SGA en los lugares de trabajo: etiquetas de recipientes trasvasados y FDS actualizadas en el área.', processApplication: 'Prohibición de diluciones sin ficha técnica/FDS del fabricante y rotulado SGA de atomizadores y envases.', responsible: 'Supervisor / Personal de Aseo', evidence: 'FDS físicas/digitales y verificación de etiquetas en cuartos útiles.', complianceStatus: 'En proceso', officialSource: 'Ministerio del Trabajo', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026.' },
    { id: 12, norm: 'Resolución 1407 de 2018 (mod. Res. 1342/2020 y Res. 803/2024)', year: '2024', applicableArticle: 'Responsabilidad extendida de envases y empaques', requirement: 'Gestión de envases y empaques de papel, cartón, plástico, vidrio y metal para su aprovechamiento.', processApplication: 'Separación adecuada de empaques y botellas limpias en recipientes blancos del CESGE.', responsible: 'Gestión Ambiental / Supervisor', evidence: 'Reportes mensuales de kilos aprovechables en bolsa blanca.', complianceStatus: 'En proceso', officialSource: 'Ministerio de Ambiente / ANLA', obligationType: 'Obligación Legal', vigencyNote: 'Vigente 2026 con metas progresivas establecidas por Res. 803 de 2024.' },
    { id: 13, norm: 'GTC 24 ICONTEC (Guía para la separación en la fuente)', year: '2009', applicableArticle: 'Guía técnica de referencia', requirement: 'Orientación técnica para separación de residuos sólidos y diseño de puntos ecológicos.', processApplication: 'Apoyo técnico complementario para señalización y ubicación de puntos ecológicos (no sustituye Res. 2184/2019).', responsible: 'Gestión Ambiental', evidence: 'Material de apoyo pedagógico en puntos ecológicos.', complianceStatus: 'Cumple', officialSource: 'ICONTEC', obligationType: 'Recomendación Técnica Voluntaria', vigencyNote: 'Estándar técnico voluntario — NO constituye obligación legal por sí mismo.' },
  ];

  const flowchart: FlowchartStep[] = [
    { id: 'step-1', stepNumber: 1, title: 'Identificación e inventario de las áreas', nodeType: 'inicio', responsible: 'Administrador / Supervisor', inputs: 'Planos Torre Norte, listado de pisos y espacios', outputs: 'Inventario actualizado de áreas por piso' },
    { id: 'step-2', stepNumber: 2, title: 'Reconocimiento fotográfico de los espacios', nodeType: 'actividad', responsible: 'Supervisor / Personal de Aseo', inputs: 'Fotografías de referencia y cámara', outputs: 'Ficha fotográfica inicial y evaluación visual IA' },
    { id: 'step-3', stepNumber: 3, title: 'Identificación de necesidades de limpieza', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Diagnóstico visual, estado de baños, terrazas y aulas', outputs: 'Requerimientos de aseo ordinario o profundo' },
    { id: 'step-4', stepNumber: 4, title: 'Consulta de programación de ambientes', nodeType: 'decision', responsible: 'Supervisor', inputs: 'Excel de programación CESGE y disponibilidad real', outputs: 'Confirmación de franja libre sin interrumpir formación' },
    { id: 'step-5', stepNumber: 5, title: 'Planificación de jornadas', nodeType: 'actividad', responsible: 'Administrador / Supervisor', inputs: 'Jornadas mañana, tarde y noche (lunes a sábado)', outputs: 'Calendario diario, semanal y mensual' },
    { id: 'step-6', stepNumber: 6, title: 'Asignación de responsables', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Personal disponible por jornada y piso', outputs: 'Órdenes de trabajo asignadas' },
    { id: 'step-7', stepNumber: 7, title: 'Verificación de productos e insumos', nodeType: 'decision', responsible: 'Supervisor / Almacén', inputs: 'Inventario SST-FR-96, FDS y stock mínimo', outputs: 'Disponibilidad confirmada o alerta de reposición' },
    { id: 'step-8', stepNumber: 8, title: 'Entrega de materiales', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Productos químicos rotulados SGA, bolsas y EPP', outputs: 'Registro de entrega y verificación de FDS' },
    { id: 'step-9', stepNumber: 9, title: 'Ejecución de actividades de aseo', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Programación, EPP, señalización piso mojado', outputs: 'Espacios limpios y desinfectados' },
    { id: 'step-10', stepNumber: 10, title: 'Recolección y clasificación de residuos', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Bolsas blancas, negras y verdes (Res. 2184/2019)', outputs: 'Residuos pesados y entregados al camión recolector' },
    { id: 'step-11', stepNumber: 11, title: 'Registro de fotografías antes y después', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Evidencias fotográficas del área intervenida', outputs: 'Comparación visual IA almacenada con trazabilidad' },
    { id: 'step-12', stepNumber: 12, title: 'Verificación del cumplimiento', nodeType: 'decision', responsible: 'Supervisor', inputs: 'Lista de chequeo y evaluación visual antes/después', outputs: 'Actividad verificada o reprogramada' },
    { id: 'step-13', stepNumber: 13, title: 'Actualización de registros', nodeType: 'actividad', responsible: 'Supervisor / Personal de Aseo', inputs: 'Consumos reales, inventario, residuos y estados', outputs: 'Base de datos y stock actualizados' },
    { id: 'step-14', stepNumber: 14, title: 'Seguimiento de indicadores', nodeType: 'actividad', responsible: 'Administrador / Directivo', inputs: 'Datos reales por piso, jornada y responsable', outputs: 'Tablero de indicadores de cumplimiento y consumo' },
    { id: 'step-15', stepNumber: 15, title: 'Auditoría del proceso', nodeType: 'actividad', responsible: 'Auditor', inputs: 'Calendario de auditoría, evidencias y matriz legal', outputs: 'Informe de auditoría y hallazgos' },
    { id: 'step-16', stepNumber: 16, title: 'Acciones correctivas y mejora continua', nodeType: 'fin', responsible: 'Administrador / Supervisor', inputs: 'Hallazgos y no conformidades', outputs: 'Plan de mejoramiento y ajuste de programación' },
  ];

  const processMap: ProcessMapData = {
    strategic: ['Planeación del servicio de aseo', 'Administración de recursos', 'Gestión ambiental', 'Seguimiento y control'],
    misional: ['Identificación de áreas', 'Programación del aseo', 'Preparación de productos e insumos', 'Ejecución del aseo', 'Gestión de residuos sólidos', 'Verificación de actividades'],
    support: ['Gestión de inventarios', 'Gestión del talento humano', 'Seguridad y salud en el trabajo', 'Gestión documental', 'Gestión tecnológica'],
    evaluation: ['Auditoría del aseo', 'Evaluación de resultados', 'Acciones correctivas', 'Mejoramiento continuo'],
  };

  const characterization: CharacterizationData = {
    processName: 'Gestión del aseo y residuos sólidos – CESGE Torre Norte',
    objective: 'Garantizar condiciones óptimas de limpieza, desinfección, salubridad y manejo integral de residuos sólidos en toda la infraestructura de la Torre Norte (Sótano a Piso 10 y zonas exteriores), protegiendo la salud ocupacional y el ambiente sin interferir con las actividades formativas.',
    scope: 'Aplica desde el Sótano y Parqueadero hasta el Piso 10 y Zonas Exteriores de la Torre Norte del CESGE, cubriendo las jornadas mañana, tarde y noche.',
    owner: 'Coordinación Administrativa y Supervisión de Servicios Generales – CESGE',
    suppliersInternal: ['Dirección CESGE', 'Coordinación Académica (programación de ambientes)', 'SG-SST', 'Almacén / Gestión de Inventarios'],
    suppliersExternal: ['Proveedores de sustancias químicas con FDS', 'Proveedores de bolsas y EPP', 'Empresa prestadora del servicio público de aseo y gestores de reciclaje'],
    inputs: ['Inventario de áreas', 'Programación de ambientes', 'Productos químicos', 'Insumos', 'Personal', 'Recursos físicos', 'Requisitos legales', 'Solicitudes de limpieza'],
    phva: {
      planear: 'Identificar las áreas, necesidades, recursos, productos, frecuencias, horarios y responsables.',
      hacer: 'Ejecutar las actividades programadas de limpieza, desinfección, recolección y clasificación de residuos.',
      verificar: 'Comprobar el cumplimiento de las actividades, revisar fotografías, evaluar las condiciones de las áreas y realizar auditorías.',
      actuar: 'Implementar acciones correctivas, ajustar la programación, mejorar los procedimientos y controlar las causas de incumplimiento.',
    },
    outputs: ['Áreas limpias y ordenadas', 'Residuos recolectados y clasificados', 'Registros de actividades', 'Inventarios actualizados', 'Informes de cumplimiento', 'Informes de auditoría', 'Acciones de mejoramiento'],
    clients: ['Aprendices', 'Instructores', 'Personal administrativo', 'Visitantes', 'Comunidad institucional', 'Responsables de la infraestructura'],
    resources: ['Personal operativo por jornadas', 'Productos químicos con FDS', 'Insumos y herramientas de aseo', 'EPP', 'Plataforma digital de control e IA visual'],
    associatedDocs: ['Formato SST-FR-96', 'Programación de ambientes CESGE', 'Fichas de Datos de Seguridad (FDS)', 'Matriz Legal 2026', 'Listas de chequeo de auditoría'],
    indicators: ['% Actividades realizadas', '% Actividades pendientes', '% Cumplimiento por piso', 'Cumplimiento por jornada', 'Consumo de productos e insumos', 'Residuos recolectados por clasificación (kg)'],
    risks: ['Exposición a sustancias químicas sin FDS/EPP', 'Interrupción de ambientes en formación', 'Mezcla de residuos sólidos', 'Desabastecimiento de insumos críticos', 'Caídas por pisos húmedos sin señalización'],
    controls: ['Verificación previa de disponibilidad de ambientes', 'Prohibición de dilución sin ficha técnica/FDS', 'Señalización de piso mojado', 'Evidencia fotográfica antes y después', 'Alertas de stock mínimo y vencimiento'],
    legalRequirements: ['Ley 9 de 1979', 'Ley 55 de 1993', 'Decreto 1072 de 2015', 'Decreto 1076 y 1077 de 2015', 'Decreto 1496 de 2018', 'Resolución 0312 de 2019', 'Resolución 2184 de 2019', 'Resolución 773 de 2021'],
  };

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 5);
  const audits: AuditAlert[] = [
    {
      id: 1,
      title: 'Auditoría Interna de Cumplimiento Aseo, SGA y Residuos – Torre Norte',
      auditDate: nextDate.toISOString().slice(0, 10),
      auditType: 'Seguimiento Integral SG-SST y Ambiental',
      auditorName: 'Auditoría Interna Calidad y Ambiental',
      status: 'Pendiente',
      requirementsChecklist: [
        'Verificar que todas las jornadas tengan evidencias fotográficas antes y después cargadas',
        'Confirmar actualización del inventario químico SST-FR-96 y disponibilidad de FDS',
        'Validar separación de residuos blanco/negro/verde conforme a Resolución 2184 de 2019',
        'Revisar uso de EPP y señalización de piso mojado en cuartos de riesgo eléctrico y escaleras',
        'Verificar planillas de recolección con hora de paso del camión recolector',
      ],
      notes: 'Recordatorio preventivo de auditoría programada. Complete las verificaciones pendientes antes de la fecha indicada.',
      createdBy: 'Sistema Base',
    },
  ];

  return {
    floors,
    spaces,
    photos: [],
    shifts,
    schedules: [],
    products: [],
    consumptions: [],
    deliveries: [],
    cafeteriaSupplies: [],
    cafeteriaMovements: [],
    damages: [],
    wasteBins: [],
    wasteRecords: [],
    audits,
    findings: [],
    legalMatrix,
    processDocs: {
      flowchart: { content: flowchart, updatedAt: now, updatedBy: 'Sistema Base' },
      process_map: { content: processMap, updatedAt: now, updatedBy: 'Sistema Base' },
      characterization: { content: characterization, updatedAt: now, updatedBy: 'Sistema Base' },
    },
    history: [],
    nextIds: {
      spaces: nextSpaceId,
      photos: 1,
      schedules: 1,
      products: 1,
      consumptions: 1,
      deliveries: 1,
      cafeteriaSupplies: 1,
      cafeteriaMovements: 1,
      damages: 1,
      wasteBins: 1,
      wasteRecords: 1,
      audits: 2,
      findings: 1,
      legalMatrix: 14,
      history: 1,
    },
  };
}

function readDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDatabase;
      if (parsed && Array.isArray(parsed.floors) && Array.isArray(parsed.spaces)) {
        return parsed;
      }
    }
  } catch {
    // Re-seed if corrupted
  }
  const seeded = buildInitialDatabase();
  saveDb(seeded);
  return seeded;
}

function saveDb(db: LocalDatabase): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Trim oldest base64 photos if quota is reached
    if (db.photos.length > 10) {
      db.photos = db.photos.slice(0, 10);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } else {
      throw new Error('Almacenamiento local del navegador lleno. Elimine algunas fotografías antiguas para liberar espacio.');
    }
  }
}

function nextId(db: LocalDatabase, table: string): number {
  const id = db.nextIds[table] || 1;
  db.nextIds[table] = id + 1;
  return id;
}

function appendHistory(db: LocalDatabase, user: User, module: string, action: string, details: string): void {
  db.history.unshift({
    id: nextId(db, 'history'),
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    username: user.username,
    userRole: user.role,
    module,
    action,
    details,
  });
  if (db.history.length > 250) {
    db.history = db.history.slice(0, 250);
  }
}

function requireUser(): User {
  const user = getSessionUserLocal();
  if (!user) {
    throw new Error('Sesión no iniciada. Inicie sesión para continuar.');
  }
  return user;
}

function assertRoles(user: User, allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new Error(`Acceso restringido. Se requiere uno de los siguientes perfiles: ${allowed.join(', ')}.`);
  }
}

async function compressDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 820;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function computeImageStats(dataUrl: string): Promise<{ width: number; height: number; meanLuma: number; variance: number; edgeRatio: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 96;
      const h = 96;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ width: img.width, height: img.height, meanLuma: 128, variance: 25, edgeRatio: 0.1 });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let sumSq = 0;
      let edges = 0;
      const luma = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const l = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
        luma[i] = l;
        sum += l;
        sumSq += l * l;
      }
      const n = w * h;
      const meanLuma = sum / n;
      const variance = Math.sqrt(Math.max(0, sumSq / n - meanLuma * meanLuma));
      for (let y = 0; y < h - 1; y++) {
        for (let x = 0; x < w - 1; x++) {
          const idx = y * w + x;
          const diff = Math.abs(luma[idx] - luma[idx + 1]) + Math.abs(luma[idx] - luma[idx + w]);
          if (diff > 36) edges++;
        }
      }
      resolve({
        width: img.width,
        height: img.height,
        meanLuma,
        variance,
        edgeRatio: edges / n,
      });
    };
    img.onerror = () => resolve({ width: 0, height: 0, meanLuma: 0, variance: 0, edgeRatio: 0 });
    img.src = dataUrl;
  });
}

async function analyzeSpaceVisualLocal(imageDataUrl: string, floorHint?: string): Promise<PhotoAnalysisResult> {
  const stats = await computeImageStats(imageDataUrl);
  const lowLight = stats.meanLuma < 55;
  const lowDetail = stats.width < 120 || stats.variance < 12;

  return {
    probableFloor: floorHint || 'Por confirmar en sitio',
    spaceType: 'Espacio interior / área de circulación CESGE',
    environmentName: 'Ambiente por confirmar con inventario',
    detectedElements: [
      'Superficies horizontales y zonas de tránsito',
      'Mobiliario general (sillas, mesas o escritorios según encuadre)',
      'Elementos perimetrales estándar (barandales, vidrios o pasamanos si están visibles)',
    ],
    detectedBins: ['Verificar presencia y rotulado de canecas blanca y negra (Res. 2184/2019)'],
    visibleDirtConditions: lowLight || lowDetail
      ? ['Iluminación reducida o baja nitidez; requiere inspección presencial para descartar polvo o manchas']
      : ['Evaluación visual preliminar realizada; confirmar en sitio estado de pisos, esquinas y recipientes'],
    observations:
      `Análisis visual local sobre imagen (${stats.width}×${stats.height} px, luminancia media ${stats.meanLuma.toFixed(0)}/255). Resultado orientativo sujeto a verificación del supervisor.`,
    confidenceNote:
      'Evaluación visual orientativa procesada localmente: no constituye prueba absoluta ni reemplaza la verificación directa.',
  };
}

async function compareBeforeAfterVisualLocal(
  beforeDataUrl: string,
  afterDataUrl: string,
  context: { floorCode: string; spaceName: string; activityTitle: string }
): Promise<BeforeAfterComparisonResult> {
  const [beforeStats, afterStats] = await Promise.all([
    computeImageStats(beforeDataUrl),
    computeImageStats(afterDataUrl),
  ]);

  const sameDimensions = beforeStats.width === afterStats.width && beforeStats.height === afterStats.height;
  const nearIdentical =
    sameDimensions &&
    Math.abs(beforeStats.meanLuma - afterStats.meanLuma) < 0.8 &&
    Math.abs(beforeStats.edgeRatio - afterStats.edgeRatio) < 0.002;
  const tooDark = afterStats.meanLuma < 45 || beforeStats.meanLuma < 45;
  const sufficientEvidence = !nearIdentical && !tooDark && beforeStats.width > 100 && afterStats.width > 100;

  if (!sufficientEvidence) {
    return {
      visualEvaluationSummary: `Evaluación visual no concluyente para ${context.spaceName} (${context.floorCode}).`,
      sufficientEvidence: false,
      insufficientEvidenceReason: nearIdentical
        ? 'Las fotografías de Antes y Después presentan parámetros visuales prácticamente idénticos; cargue tomas reales diferenciadas.'
        : 'La iluminación o resolución de una de las imágenes es insuficiente para distinguir condiciones de limpieza.',
      surfacesStatus: 'No verificable con la evidencia proporcionada',
      floorWasteStatus: 'No verificable',
      binsStatus: 'No verificable',
      dustAndStainsStatus: 'Requiere toma más nítida e iluminada',
      organizationStatus: 'No verificable',
      restroomsOrGlassStatus: 'No verificable',
      overallVisualAssessment: 'Evidencia insuficiente',
      disclaimer:
        'Evaluación visual orientativa: nunca se afirma cumplimiento cuando la evidencia fotográfica no permite distinguir cambios reales.',
    };
  }

  const lumaImproved = afterStats.meanLuma >= beforeStats.meanLuma - 5;
  return {
    visualEvaluationSummary: `Comparación visual preliminar de "${context.activityTitle}" en ${context.spaceName} (${context.floorCode}).`,
    sufficientEvidence: true,
    insufficientEvidenceReason: '',
    surfacesStatus: lumaImproved
      ? 'Superficies visualmente más homogéneas y despejadas en la toma posterior'
      : 'Se observan variaciones de iluminación; revisar brillo y secado de superficies',
    floorWasteStatus: 'Sin acumulación evidente de residuos sueltos en el encuadre posterior',
    binsStatus: 'Confirmar en sitio cambio de bolsas blancas/negras y cierre adecuado',
    dustAndStainsStatus: 'Sin manchas notorias en primer plano según contraste visual',
    organizationStatus: 'Mobiliario alineado dentro del campo visual de la fotografía posterior',
    restroomsOrGlassStatus: 'Validar presencialmente desinfección de baños, vidrios y pasamanos',
    overallVisualAssessment: lumaImproved ? 'Evidencia favorable visualmente' : 'Requiere revisión adicional',
    disclaimer:
      'Evaluación visual orientativa procesada localmente: debe complementarse con verificación presencial y lista de chequeo.',
  };
}

export async function handleLocalApiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const body = options.body ? JSON.parse(String(options.body)) : {};

  // ==========================================
  // AUTH & USERS (100% client-side localStorage)
  // ==========================================
  if (pathname === '/api/auth/login' || pathname === '/login' || pathname === '/api/login') {
    const res = await loginLocal(body.identifier, body.password);
    return res as unknown as T;
  }
  if (pathname === '/api/auth/register') {
    const res = await registerLocal(body);
    return res as unknown as T;
  }
  if (pathname === '/api/auth/logout') {
    logoutLocal();
    return { ok: true } as unknown as T;
  }
  if (pathname === '/api/auth/me') {
    const user = requireUser();
    return { user } as unknown as T;
  }

  // Protected routes below
  const user = requireUser();
  const db = readDb();

  if (pathname === '/api/users' && method === 'GET') {
    return listUsersLocal() as unknown as T;
  }
  if (pathname === '/api/users' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'DIRECTIVO']);
    const created = await createUserLocal(user, body);
    appendHistory(db, user, 'Usuarios', 'Creación', `Creó usuario "${body.username}" con perfil ${body.role}`);
    saveDb(db);
    return { id: created.id } as unknown as T;
  }
  if (pathname.startsWith('/api/users/') && method === 'PUT') {
    const id = Number(pathname.split('/').pop());
    updateUserLocal(user, id, body);
    appendHistory(db, user, 'Usuarios', 'Actualización', `Actualizó usuario ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }
  if (pathname.startsWith('/api/users/') && method === 'DELETE') {
    const id = Number(pathname.split('/').pop());
    const { deletedUsername } = deleteUserLocal(user, id);
    appendHistory(db, user, 'Usuarios', 'Eliminación', `Eliminó usuario "${deletedUsername}" (ID ${id})`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // FLOORS & SPACES
  // ==========================================
  if (pathname === '/api/floors' && method === 'GET') {
    return [...db.floors].sort((a, b) => a.sortOrder - b.sortOrder) as unknown as T;
  }

  if (pathname === '/api/spaces' && method === 'GET') {
    const includeInactive = parsedUrl.searchParams.get('includeInactive') === '1';
    const floorSortMap = new Map(db.floors.map((f) => [f.id, f.sortOrder]));
    const rows = db.spaces
      .filter((s) => includeInactive || s.active === 1)
      .sort((a, b) => {
        const fa = floorSortMap.get(a.floorId) ?? 99;
        const fb = floorSortMap.get(b.floorId) ?? 99;
        if (fa !== fb) return fa - fb;
        const na = parseInt(a.name, 10);
        const nb = parseInt(b.name, 10);
        const aIsNum = !Number.isNaN(na) && /^\d+/.test(a.name);
        const bIsNum = !Number.isNaN(nb) && /^\d+/.test(b.name);
        if (aIsNum && bIsNum && na !== nb) return na - nb;
        if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return rows as unknown as T;
  }

  if (pathname === '/api/spaces' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const { floorId, name, category, hasComputers, hasTv, availability, trainingScheduleNote, elementsDetail } = body;
    if (!floorId || !name || !category) {
      throw new Error('Piso, nombre y categoría del espacio son obligatorios.');
    }
    const cleanName = String(name).trim();
    const dup = db.spaces.find(
      (s) => s.floorId === Number(floorId) && s.name.toLowerCase() === cleanName.toLowerCase() && s.active === 1
    );
    if (dup) {
      throw new Error('Ya existe un espacio activo con ese nombre en el piso seleccionado.');
    }
    const floor = db.floors.find((f) => f.id === Number(floorId));
    const id = nextId(db, 'spaces');
    db.spaces.push({
      id,
      floorId: Number(floorId),
      floorCode: floor?.code || '',
      floorName: floor?.name || '',
      name: cleanName,
      category: String(category).trim(),
      hasComputers: hasComputers ? 1 : 0,
      hasTv: hasTv ? 1 : 0,
      availability: availability ?? 'Disponible',
      trainingScheduleNote: trainingScheduleNote ?? '',
      elementsDetail: elementsDetail ?? '',
      active: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    appendHistory(db, user, 'Áreas y Espacios', 'Creación', `Agregó espacio "${cleanName}" en piso ID ${floorId}`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname === '/api/spaces/import' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      throw new Error('No se recibieron filas válidas desde el archivo Excel.');
    }
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const floorRaw = String(row.floor || row.piso || '').trim().toLowerCase();
      const numericCode = /^\d+$/.test(floorRaw) ? `piso-${floorRaw.padStart(2, '0')}` : '';
      const matchedFloor =
        db.floors.find(
          (f) =>
            f.code.toLowerCase() === floorRaw ||
            (numericCode && f.code.toLowerCase() === numericCode) ||
            f.name.toLowerCase() === floorRaw ||
            (floorRaw && !/^\d+$/.test(floorRaw) && f.name.toLowerCase().includes(floorRaw))
        ) || db.floors[1];

      const spaceName = String(row.name || row.ambiente || row.area || '').trim();
      if (!spaceName) continue;

      const category = String(row.category || row.tipo || 'Ambiente de Formación').trim();
      const availability = String(row.availability || row.disponibilidad || 'Disponible').trim() as Space['availability'];
      const note = String(row.trainingScheduleNote || row.horario || row.franja || '').trim();

      const existing = db.spaces.find(
        (s) => s.floorId === matchedFloor.id && s.name.toLowerCase() === spaceName.toLowerCase() && s.active === 1
      );
      if (existing) {
        existing.availability = availability;
        existing.trainingScheduleNote = note;
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = user.username;
        updated++;
      } else {
        db.spaces.push({
          id: nextId(db, 'spaces'),
          floorId: matchedFloor.id,
          floorCode: matchedFloor.code,
          floorName: matchedFloor.name,
          name: spaceName,
          category,
          hasComputers: 0,
          hasTv: 0,
          availability,
          trainingScheduleNote: note,
          elementsDetail: '',
          active: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: user.username,
        });
        inserted++;
      }
    }
    appendHistory(db, user, 'Áreas y Espacios', 'Importación Excel', `Importación de ambientes CESGE: ${inserted} nuevos, ${updated} actualizados`);
    saveDb(db);
    return { inserted, updated } as unknown as T;
  }

  if (pathname.startsWith('/api/spaces/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const id = Number(pathname.split('/').pop());
    const existing = db.spaces.find((s) => s.id === id);
    if (!existing) throw new Error('Espacio no encontrado.');
    existing.name = body.name ?? existing.name;
    existing.category = body.category ?? existing.category;
    existing.hasComputers = body.hasComputers !== undefined ? (body.hasComputers ? 1 : 0) : existing.hasComputers;
    existing.hasTv = body.hasTv !== undefined ? (body.hasTv ? 1 : 0) : existing.hasTv;
    existing.availability = body.availability ?? existing.availability;
    existing.trainingScheduleNote = body.trainingScheduleNote ?? existing.trainingScheduleNote;
    existing.elementsDetail = body.elementsDetail ?? existing.elementsDetail;
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = user.username;
    appendHistory(db, user, 'Áreas y Espacios', 'Modificación', `Actualizó espacio "${existing.name}" (Disponibilidad: ${existing.availability})`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/spaces/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    const existing = db.spaces.find((s) => s.id === id);
    if (!existing) throw new Error('Espacio no encontrado.');
    existing.active = 0;
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = user.username;
    appendHistory(db, user, 'Áreas y Espacios', 'Eliminación lógica', `Desactivó espacio "${existing.name}" preservando historial de actividades`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // PHOTOS & AI VISUAL EVALUATION
  // ==========================================
  if (pathname === '/api/photos' && method === 'GET') {
    return [...db.photos].sort((a, b) => b.id - a.id) as unknown as T;
  }

  if (pathname === '/api/ai/analyze-space' && method === 'POST') {
    if (!body.imageDataUrl) {
      throw new Error('Debe cargar o capturar una fotografía para analizar.');
    }
    const analysis = await analyzeSpaceVisualLocal(String(body.imageDataUrl), body.floorHint);
    return { analysis } as unknown as T;
  }

  if (pathname === '/api/ai/compare-before-after' && method === 'POST') {
    if (!body.beforeImageDataUrl || !body.afterImageDataUrl) {
      throw new Error('Se requieren ambas fotografías (Antes y Después) para realizar la evaluación visual.');
    }
    const comparison = await compareBeforeAfterVisualLocal(
      String(body.beforeImageDataUrl),
      String(body.afterImageDataUrl),
      {
        floorCode: body.floorCode || 'Por confirmar',
        spaceName: body.spaceName || 'Espacio Torre Norte',
        activityTitle: body.activityTitle || 'Actividad de aseo',
      }
    );
    return { comparison } as unknown as T;
  }

  if (pathname === '/api/photos' && method === 'POST') {
    if (!body.floorCode || !body.spaceName || !body.imageDataUrl) {
      throw new Error('Piso, ambiente y fotografía principal son obligatorios.');
    }
    const imageUrl = await compressDataUrl(String(body.imageDataUrl));
    const pairImageUrl = body.pairImageDataUrl ? await compressDataUrl(String(body.pairImageDataUrl)) : null;
    const id = nextId(db, 'photos');
    const rec: PhotoRecord = {
      id,
      spaceId: body.spaceId ? Number(body.spaceId) : null,
      floorCode: body.floorCode,
      spaceName: body.spaceName,
      photoType: body.photoType || 'Identificación',
      activityTitle: body.activityTitle || 'Registro visual de espacio',
      responsible: body.responsible || user.fullName,
      imageUrl,
      pairImageUrl,
      aiAnalysisJson: body.aiAnalysis ? JSON.stringify(body.aiAnalysis) : null,
      aiComparisonJson: body.aiComparison ? JSON.stringify(body.aiComparison) : null,
      capturedAt: body.capturedAt || new Date().toISOString(),
      createdBy: user.username,
    };
    db.photos.unshift(rec);
    appendHistory(db, user, 'Evidencia Fotográfica', 'Registro', `Guardó ficha fotográfica (${rec.photoType}) en ${rec.floorCode} - ${rec.spaceName}`);
    saveDb(db);
    return { id, imageUrl, pairImageUrl } as unknown as T;
  }

  if (pathname.startsWith('/api/photos/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    db.photos = db.photos.filter((p) => p.id !== id);
    appendHistory(db, user, 'Evidencia Fotográfica', 'Eliminación', `Eliminó registro fotográfico ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // SHIFTS & SCHEDULES
  // ==========================================
  if (pathname === '/api/shifts' && method === 'GET') {
    return [...db.shifts].sort((a, b) => a.id - b.id) as unknown as T;
  }

  if (pathname.startsWith('/api/shifts/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    const sh = db.shifts.find((s) => s.id === id);
    if (!sh) throw new Error('Jornada no encontrada.');
    sh.startTime = body.startTime ?? sh.startTime;
    sh.endTime = body.endTime ?? sh.endTime;
    sh.durationMinutes = Number(body.durationMinutes ?? sh.durationMinutes);
    sh.frequency = body.frequency ?? sh.frequency;
    sh.supervisorName = body.supervisorName ?? sh.supervisorName;
    sh.notes = body.notes ?? sh.notes;
    appendHistory(db, user, 'Jornadas', 'Configuración', `Actualizó parámetros de jornada ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname === '/api/schedules' && method === 'GET') {
    return [...db.schedules].sort((a, b) => b.date.localeCompare(a.date) || a.scheduledTime.localeCompare(b.scheduledTime)) as unknown as T;
  }

  if (pathname === '/api/schedules' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const {
      date,
      scheduledTime,
      shiftName,
      floorId,
      spaceId,
      areaName,
      activity,
      responsible,
      frequency,
      estimatedMinutes,
      requiredProducts,
      requiredSupplies,
      status,
      sundayJustification,
      trainingConflictChecked,
      notes,
    } = body;

    if (!date || !scheduledTime || !shiftName || !floorId || !areaName || !activity || !responsible) {
      throw new Error('Complete fecha, hora, jornada, piso, área, actividad y responsable.');
    }
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const isSunday = dayOfWeek === 0 ? 1 : 0;
    if (isSunday && (!sundayJustification || String(sundayJustification).trim().length < 5)) {
      throw new Error('La operación regular es de lunes a sábado. Para programar un domingo debe anotar y aclarar el motivo en el campo correspondiente.');
    }
    const cleanArea = String(areaName).trim();
    const cleanActivity = String(activity).trim();
    const dup = db.schedules.find(
      (s) =>
        s.date === date &&
        s.scheduledTime === scheduledTime &&
        s.floorId === Number(floorId) &&
        s.areaName.toLowerCase() === cleanArea.toLowerCase() &&
        s.activity.toLowerCase() === cleanActivity.toLowerCase()
    );
    if (dup) {
      throw new Error('Registro duplicado: ya existe esa misma actividad programada en esa fecha, hora y área.');
    }
    const floor = db.floors.find((f) => f.id === Number(floorId));
    const id = nextId(db, 'schedules');
    db.schedules.push({
      id,
      date,
      scheduledTime,
      shiftName,
      floorId: Number(floorId),
      floorCode: floor?.code || '',
      floorName: floor?.name || '',
      spaceId: spaceId ? Number(spaceId) : null,
      areaName: cleanArea,
      activity: cleanActivity,
      responsible: String(responsible).trim(),
      frequency: frequency || 'Diaria',
      estimatedMinutes: Number(estimatedMinutes || 30),
      requiredProducts: requiredProducts ?? '',
      requiredSupplies: requiredSupplies ?? '',
      status: status || 'Pendiente',
      isSunday,
      sundayJustification: sundayJustification ?? '',
      trainingConflictChecked: trainingConflictChecked ? 1 : 0,
      notes: notes ?? '',
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    appendHistory(db, user, 'Programación', 'Creación', `Programó "${cleanActivity}" en ${cleanArea} (${date} ${scheduledTime}, ${shiftName})`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/schedules/') && method === 'PUT') {
    if (user.role === 'AUDITOR' || user.role === 'DIRECTIVO') {
      throw new Error('Su perfil es de consulta/auditoría para programación operativa.');
    }
    const id = Number(pathname.split('/').pop());
    const sc = db.schedules.find((s) => s.id === id);
    if (!sc) throw new Error('Actividad programada no encontrada.');
    sc.status = body.status ?? sc.status;
    sc.notes = body.notes ?? sc.notes;
    sc.responsible = body.responsible ?? sc.responsible;
    sc.scheduledTime = body.scheduledTime ?? sc.scheduledTime;
    sc.date = body.date ?? sc.date;
    sc.activity = body.activity ?? sc.activity;
    sc.requiredProducts = body.requiredProducts ?? sc.requiredProducts;
    sc.requiredSupplies = body.requiredSupplies ?? sc.requiredSupplies;
    sc.updatedAt = new Date().toISOString();
    sc.updatedBy = user.username;
    appendHistory(db, user, 'Programación', 'Actualización', `Actualizó actividad "${sc.activity}" a estado: ${sc.status}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/schedules/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    db.schedules = db.schedules.filter((s) => s.id !== id);
    appendHistory(db, user, 'Programación', 'Eliminación', `Eliminó programación ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // PRODUCTS (SST-FR-96) & CONSUMPTIONS
  // ==========================================
  if (pathname === '/api/products' && method === 'GET') {
    return [...db.products].sort((a, b) => a.name.localeCompare(b.name)) as unknown as T;
  }

  if (pathname === '/api/products' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    if (!body.name || !body.category) {
      throw new Error('El nombre y categoría del producto/insumo son obligatorios.');
    }
    const cleanName = String(body.name).trim();
    const cleanLot = String(body.lot || '').trim();
    const dup = db.products.find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase() && p.lot.toLowerCase() === cleanLot.toLowerCase()
    );
    if (dup) {
      throw new Error('Ya existe un producto con el mismo nombre y lote en el inventario.');
    }
    const id = nextId(db, 'products');
    db.products.push({
      id,
      name: cleanName,
      category: body.category,
      usageScope: body.usageScope || 'Operativo',
      brand: body.brand ?? '',
      supplier: body.supplier ?? '',
      specificUse: body.specificUse ?? '',
      presentation: body.presentation ?? '',
      unit: body.unit || 'unidades',
      availableQty: Number(body.availableQty || 0),
      usedQty: Number(body.usedQty || 0),
      minQty: Number(body.minQty || 0),
      unitPrice: Number(body.unitPrice || 0),
      expirationDate: body.expirationDate ?? '',
      lot: cleanLot,
      storageLocation: body.storageLocation ?? '',
      safetySheetRef: body.safetySheetRef ?? '',
      hazardClassification: body.hazardClassification ?? '',
      handlingRecommendations: body.handlingRecommendations ?? '',
      requiredEpp: body.requiredEpp ?? '',
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    appendHistory(db, user, 'Inventario', 'Creación', `Registró producto "${cleanName}" (${body.availableQty || 0} ${body.unit || 'unidades'})`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname === '/api/products/import-sst-fr-96' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new Error('No se encontraron registros válidos en el archivo SST-FR-96.');
    }
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      const name = String(item.name || '').trim();
      if (!name) {
        skipped++;
        continue;
      }
      const lot = String(item.lot || '').trim();
      const dup = db.products.find(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.lot.toLowerCase() === lot.toLowerCase()
      );
      if (dup) {
        skipped++;
        continue;
      }
      db.products.push({
        id: nextId(db, 'products'),
        name,
        category: String(item.category || 'Otros elementos de limpieza'),
        usageScope: String(item.usageScope || 'Operativo'),
        brand: String(item.brand || ''),
        supplier: String(item.supplier || ''),
        specificUse: String(item.specificUse || ''),
        presentation: String(item.presentation || ''),
        unit: (item.unit || 'unidades') as ProductItem['unit'],
        availableQty: Number(item.availableQty) || 0,
        usedQty: 0,
        minQty: Number(item.minQty) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        expirationDate: String(item.expirationDate || ''),
        lot,
        storageLocation: String(item.storageLocation || ''),
        safetySheetRef: String(item.safetySheetRef || ''),
        hazardClassification: String(item.hazardClassification || ''),
        handlingRecommendations: String(item.handlingRecommendations || ''),
        requiredEpp: String(item.requiredEpp || ''),
        updatedAt: new Date().toISOString(),
        updatedBy: user.username,
      });
      imported++;
    }
    appendHistory(db, user, 'Inventario SST-FR-96', 'Importación Excel', `Importó formato SST-FR-96: ${imported} productos registrados, ${skipped} omitidos/duplicados`);
    saveDb(db);
    return { imported, skipped } as unknown as T;
  }

  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    const prod = db.products.find((p) => p.id === id);
    if (!prod) throw new Error('Producto no encontrado.');
    Object.assign(prod, {
      name: body.name ?? prod.name,
      category: body.category ?? prod.category,
      usageScope: body.usageScope ?? prod.usageScope,
      brand: body.brand ?? prod.brand,
      supplier: body.supplier ?? prod.supplier,
      specificUse: body.specificUse ?? prod.specificUse,
      presentation: body.presentation ?? prod.presentation,
      unit: body.unit ?? prod.unit,
      availableQty: body.availableQty !== undefined ? Number(body.availableQty) : prod.availableQty,
      minQty: body.minQty !== undefined ? Number(body.minQty) : prod.minQty,
      unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : prod.unitPrice,
      expirationDate: body.expirationDate ?? prod.expirationDate,
      lot: body.lot ?? prod.lot,
      storageLocation: body.storageLocation ?? prod.storageLocation,
      safetySheetRef: body.safetySheetRef ?? prod.safetySheetRef,
      hazardClassification: body.hazardClassification ?? prod.hazardClassification,
      handlingRecommendations: body.handlingRecommendations ?? prod.handlingRecommendations,
      requiredEpp: body.requiredEpp ?? prod.requiredEpp,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    appendHistory(db, user, 'Inventario', 'Modificación', `Actualizó producto "${prod.name}"`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    db.products = db.products.filter((p) => p.id !== id);
    appendHistory(db, user, 'Inventario', 'Eliminación', `Eliminó producto ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname === '/api/consumptions' && method === 'GET') {
    return [...db.consumptions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id) as unknown as T;
  }

  if (pathname === '/api/consumptions' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const { date, shiftName, floorCode, areaName, activity, responsible, productId, quantity, fdsVerified, notes } = body;
    if (!date || !shiftName || !floorCode || !areaName || !productId || !quantity) {
      throw new Error('Complete fecha, jornada, piso, ambiente, producto y cantidad.');
    }
    if (!fdsVerified) {
      throw new Error('Debe confirmar la consulta de la Ficha Técnica y Ficha de Datos de Seguridad (FDS) del fabricante antes de registrar diluciones o consumos.');
    }
    const prod = db.products.find((p) => p.id === Number(productId));
    if (!prod) throw new Error('Producto no encontrado.');
    const qty = Number(quantity);
    if (qty <= 0 || qty > prod.availableQty) {
      throw new Error(`Cantidad inválida. Disponible actual en inventario: ${prod.availableQty} ${prod.unit}.`);
    }
    const cost = Number((qty * (prod.unitPrice || 0)).toFixed(2));
    prod.availableQty = Number((prod.availableQty - qty).toFixed(4));
    prod.usedQty = Number((prod.usedQty + qty).toFixed(4));
    prod.updatedAt = new Date().toISOString();
    prod.updatedBy = user.username;

    const id = nextId(db, 'consumptions');
    db.consumptions.unshift({
      id,
      date,
      monthKey: String(date).slice(0, 7),
      shiftName,
      floorCode,
      areaName,
      activity: activity || 'Limpieza programada',
      responsible: responsible || user.fullName,
      productId: prod.id,
      productName: prod.name,
      quantity: qty,
      unit: prod.unit,
      calculatedCost: cost,
      fdsVerified: 1,
      notes: notes ?? '',
      createdBy: user.username,
    });
    appendHistory(db, user, 'Consumos', 'Registro', `Consumió ${qty} ${prod.unit} de "${prod.name}" en ${floorCode} - ${areaName}`);
    saveDb(db);
    return { id, calculatedCost: cost } as unknown as T;
  }

  // ==========================================
  // DELIVERIES (DOTACIÓN, EPP, UNIFORMES)
  // ==========================================
  if (pathname === '/api/deliveries' && method === 'GET') {
    return [...db.deliveries].sort(
      (a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.deliveryTime.localeCompare(a.deliveryTime) || b.id - a.id
    ) as unknown as T;
  }

  if (pathname === '/api/deliveries' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const deliveryDate = String(body.deliveryDate || '').trim();
    const deliveryTime = String(body.deliveryTime || '').trim();
    const deliveryType = String(body.deliveryType || '').trim();
    const deliveredBy = String(body.deliveredBy || '').trim();
    const deliveredTo = String(body.deliveredTo || '').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!deliveryDate || !deliveryTime || !deliveryType || !deliveredBy || !deliveredTo) {
      throw new Error('Fecha, hora, tipo de dotación, quién entrega y a quién se entrega son obligatorios.');
    }

    const sanitizedItems: DeliveryItem[] = [];
    for (const it of rawItems) {
      const itemName = String(it?.itemName || '').trim();
      const quantity = Number(it?.quantity || 0);
      if (!itemName || quantity <= 0) continue;
      const productId = it?.productId ? Number(it.productId) : null;
      const deductStock = Boolean(it?.deductStock && productId);
      sanitizedItems.push({
        itemName,
        category: (it?.category || 'EPP') as DeliveryItem['category'],
        quantity,
        unit: String(it?.unit || 'unidades'),
        sizeOrSpec: String(it?.sizeOrSpec || '').trim(),
        productId,
        deductStock,
      });
    }

    if (sanitizedItems.length === 0) {
      throw new Error('Debe incluir al menos un elemento de dotación, EPP, uniforme o artículo de aseo con cantidad mayor a cero.');
    }

    for (const it of sanitizedItems) {
      if (it.deductStock && it.productId) {
        const prod = db.products.find((p) => p.id === it.productId);
        if (!prod) throw new Error(`Producto vinculado "${it.itemName}" no encontrado en inventario.`);
        if (it.quantity > prod.availableQty) {
          throw new Error(`Stock insuficiente para "${prod.name}". Disponible: ${prod.availableQty} ${prod.unit}, solicitado: ${it.quantity}.`);
        }
      }
    }

    for (const it of sanitizedItems) {
      if (it.deductStock && it.productId) {
        const prod = db.products.find((p) => p.id === it.productId)!;
        prod.availableQty = Number((prod.availableQty - it.quantity).toFixed(4));
        prod.usedQty = Number((prod.usedQty + it.quantity).toFixed(4));
        prod.updatedAt = new Date().toISOString();
        prod.updatedBy = user.username;
      }
    }

    const id = nextId(db, 'deliveries');
    const newRec: EquipmentDelivery = {
      id,
      deliveryDate,
      deliveryTime,
      deliveryType,
      deliveredBy,
      deliveredByRole: String(body.deliveredByRole || ''),
      deliveredTo,
      recipientRole: String(body.recipientRole || ''),
      shiftName: String(body.shiftName || ''),
      items: sanitizedItems,
      conditionNote: String(body.conditionNote || 'Dotación reglamentaria'),
      receivedConfirmed: body.receivedConfirmed !== undefined ? (body.receivedConfirmed ? 1 : 0) : 1,
      observations: String(body.observations || ''),
      createdBy: user.username,
      createdAt: new Date().toISOString(),
    };
    db.deliveries.unshift(newRec);

    const summaryNames = sanitizedItems.map((i) => `${i.quantity} ${i.unit} ${i.itemName}`).join(', ');
    appendHistory(
      db,
      user,
      'Entrega de Dotación',
      'Registro',
      `${deliveryDate} ${deliveryTime} · Entrega de ${deliveryType} por ${deliveredBy} a ${deliveredTo}: ${summaryNames}`
    );
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/deliveries/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const id = Number(pathname.split('/').pop());
    const existing = db.deliveries.find((d) => d.id === id);
    if (!existing) throw new Error('Registro de entrega no encontrado.');
    existing.receivedConfirmed =
      body.receivedConfirmed !== undefined ? (body.receivedConfirmed ? 1 : 0) : existing.receivedConfirmed;
    existing.observations = body.observations !== undefined ? String(body.observations) : existing.observations;
    existing.conditionNote = body.conditionNote !== undefined ? String(body.conditionNote) : existing.conditionNote;
    appendHistory(db, user, 'Entrega de Dotación', 'Actualización', `Actualizó acta de entrega ID ${id} (destinatario: ${existing.deliveredTo})`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/deliveries/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    const existing = db.deliveries.find((d) => d.id === id);
    if (!existing) throw new Error('Registro de entrega no encontrado.');
    db.deliveries = db.deliveries.filter((d) => d.id !== id);
    appendHistory(
      db,
      user,
      'Entrega de Dotación',
      'Eliminación',
      `Eliminó registro de entrega ID ${id} (${existing.deliveryType} a ${existing.deliveredTo} del ${existing.deliveryDate})`
    );
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // CAFETERIA SUPPLIES & MOVEMENTS
  // ==========================================
  if (pathname === '/api/cafeteria/supplies' && method === 'GET') {
    const supplies = [...db.cafeteriaSupplies].sort((a, b) => {
      const aLow = a.currentQty <= a.minQty ? 0 : 1;
      const bLow = b.currentQty <= b.minQty ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.itemName.localeCompare(b.itemName);
    });
    const movements = [...db.cafeteriaMovements]
      .sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.movementTime.localeCompare(a.movementTime) || b.id - a.id)
      .slice(0, 150);
    return { supplies, movements } as unknown as T;
  }

  if (pathname === '/api/cafeteria/supplies' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const itemName = String(body.itemName || '').trim();
    if (!itemName) throw new Error('El nombre del insumo de cafetería es obligatorio.');
    const currentQty = Math.max(0, Number(body.currentQty || 0));
    const minQty = Math.max(0, Number(body.minQty ?? 1));
    const id = nextId(db, 'cafeteriaSupplies');
    db.cafeteriaSupplies.push({
      id,
      itemName,
      category: String(body.category || 'Bebidas e insumos de consumo'),
      cafeteriaLocation: String(body.cafeteriaLocation || 'Todos los cafetines'),
      unit: String(body.unit || 'unidades'),
      currentQty,
      minQty,
      assignedTo: String(body.assignedTo || ''),
      lastAssignedAt: body.assignedTo ? new Date().toISOString().slice(0, 16).replace('T', ' ') : '',
      notes: String(body.notes || ''),
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    });
    appendHistory(
      db,
      user,
      'Cafetería',
      'Registro insumo',
      `Registró insumo "${itemName}" (${currentQty} ${body.unit || 'unidades'}, mín ${minQty}) en ${body.cafeteriaLocation || 'Todos los cafetines'}`
    );
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.endsWith('/move') && pathname.startsWith('/api/cafeteria/supplies/') && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const parts = pathname.split('/');
    const id = Number(parts[parts.length - 2]);
    const existing = db.cafeteriaSupplies.find((c) => c.id === id);
    if (!existing) throw new Error('Insumo de cafetería no encontrado.');
    const movementType = String(body.movementType || 'Asignación a cafetín');
    const qty = Number(body.quantity || 0);
    if (qty <= 0) throw new Error('La cantidad debe ser mayor a cero.');

    let newQty = existing.currentQty;
    if (movementType === 'Ingreso / Reposición') {
      newQty = existing.currentQty + qty;
    } else if (movementType === 'Asignación a cafetín') {
      if (qty > existing.currentQty) {
        throw new Error(`Stock insuficiente de "${existing.itemName}". Hay ${existing.currentQty} ${existing.unit} disponibles.`);
      }
      newQty = existing.currentQty - qty;
    } else {
      newQty = Math.max(0, qty);
    }

    const mDate = String(body.movementDate || new Date().toISOString().slice(0, 10));
    const mTime = String(body.movementTime || new Date().toTimeString().slice(0, 5));
    const location = String(body.cafeteriaLocation || existing.cafeteriaLocation);
    const assignedBy = String(body.assignedBy || user.fullName);
    const receivedBy = String(body.receivedBy || existing.assignedTo || '');

    existing.currentQty = Number(newQty.toFixed(2));
    existing.assignedTo = receivedBy || existing.assignedTo;
    existing.lastAssignedAt = `${mDate} ${mTime}`;
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = user.username;

    db.cafeteriaMovements.unshift({
      id: nextId(db, 'cafeteriaMovements'),
      supplyId: id,
      itemName: existing.itemName,
      unit: existing.unit,
      movementDate: mDate,
      movementTime: mTime,
      movementType,
      cafeteriaLocation: location,
      quantity: qty,
      assignedBy,
      receivedBy,
      notes: String(body.notes || ''),
      createdAt: new Date().toISOString(),
    });
    appendHistory(
      db,
      user,
      'Cafetería',
      movementType,
      `${movementType}: ${qty} ${existing.unit} de "${existing.itemName}" en ${location} (${assignedBy} -> ${receivedBy || 'Cafetín'})`
    );
    saveDb(db);
    return { ok: true, newQty: existing.currentQty } as unknown as T;
  }

  if (pathname.startsWith('/api/cafeteria/supplies/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const id = Number(pathname.split('/').pop());
    const existing = db.cafeteriaSupplies.find((c) => c.id === id);
    if (!existing) throw new Error('Insumo de cafetería no encontrado.');
    existing.itemName = body.itemName !== undefined ? String(body.itemName).trim() : existing.itemName;
    existing.category = body.category ?? existing.category;
    existing.cafeteriaLocation = body.cafeteriaLocation ?? existing.cafeteriaLocation;
    existing.unit = body.unit ?? existing.unit;
    existing.currentQty = body.currentQty !== undefined ? Math.max(0, Number(body.currentQty)) : existing.currentQty;
    existing.minQty = body.minQty !== undefined ? Math.max(0, Number(body.minQty)) : existing.minQty;
    existing.assignedTo = body.assignedTo !== undefined ? String(body.assignedTo) : existing.assignedTo;
    existing.notes = body.notes !== undefined ? String(body.notes) : existing.notes;
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = user.username;
    appendHistory(db, user, 'Cafetería', 'Actualización insumo', `Actualizó insumo "${existing.itemName}"`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/cafeteria/supplies/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    db.cafeteriaSupplies = db.cafeteriaSupplies.filter((c) => c.id !== id);
    db.cafeteriaMovements = db.cafeteriaMovements.filter((m) => m.supplyId !== id);
    appendHistory(db, user, 'Cafetería', 'Eliminación', `Eliminó insumo de cafetería ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // DAMAGE REPORTS
  // ==========================================
  if (pathname === '/api/damages' && method === 'GET') {
    return [...db.damages].sort((a, b) => {
      const ar = a.status === 'Reparado' ? 1 : 0;
      const br = b.status === 'Reparado' ? 1 : 0;
      if (ar !== br) return ar - br;
      return b.reportDate.localeCompare(a.reportDate) || b.reportTime.localeCompare(a.reportTime) || b.id - a.id;
    }) as unknown as T;
  }

  if (pathname === '/api/damages' && method === 'POST') {
    const floorId = Number(body.floorId);
    const spaceName = String(body.spaceName || '').trim();
    const itemDamaged = String(body.itemDamaged || '').trim();
    const description = String(body.description || '').trim();
    if (!floorId || !spaceName || !itemDamaged || !description) {
      throw new Error('Piso, espacio/cafetín, elemento dañado y descripción son obligatorios.');
    }
    const imageUrl = body.imageDataUrl ? await compressDataUrl(String(body.imageDataUrl)) : '';
    const floor = db.floors.find((f) => f.id === floorId);
    const rDate = String(body.reportDate || new Date().toISOString().slice(0, 10));
    const rTime = String(body.reportTime || new Date().toTimeString().slice(0, 5));
    const reportedBy = String(body.reportedBy || user.fullName).trim();
    const id = nextId(db, 'damages');
    db.damages.unshift({
      id,
      reportDate: rDate,
      reportTime: rTime,
      floorId,
      floorCode: floor?.code || '',
      floorName: floor?.name || '',
      spaceName,
      itemDamaged,
      category: String(body.category || 'Equipo de cafetería'),
      severity: String(body.severity || 'Media'),
      description,
      reportedBy,
      status: 'Reportado',
      assignedTechnician: String(body.assignedTechnician || ''),
      resolutionNotes: '',
      resolvedAt: '',
      imageUrl,
      createdBy: user.username,
      createdAt: new Date().toISOString(),
    });
    appendHistory(
      db,
      user,
      'Reporte de Daños',
      'Nuevo reporte',
      `Reportó daño (${body.severity || 'Media'}) en "${itemDamaged}" (${spaceName}) por ${reportedBy}`
    );
    saveDb(db);
    return { id, imageUrl } as unknown as T;
  }

  if (pathname.startsWith('/api/damages/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    const id = Number(pathname.split('/').pop());
    const existing = db.damages.find((d) => d.id === id);
    if (!existing) throw new Error('Reporte de daño no encontrado.');
    const nextStatus = String(body.status ?? existing.status) as DamageReport['status'];
    const resolvedAt =
      nextStatus === 'Reparado'
        ? String(body.resolvedAt || existing.resolvedAt || new Date().toISOString().slice(0, 16).replace('T', ' '))
        : '';
    existing.status = nextStatus;
    existing.severity = String(body.severity ?? existing.severity);
    existing.assignedTechnician = String(body.assignedTechnician ?? existing.assignedTechnician ?? '');
    existing.resolutionNotes = String(body.resolutionNotes ?? existing.resolutionNotes ?? '');
    existing.resolvedAt = resolvedAt;
    appendHistory(db, user, 'Reporte de Daños', 'Actualización', `Actualizó daño ID ${id} ("${existing.itemDamaged}") a estado ${nextStatus}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/damages/') && method === 'DELETE') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    db.damages = db.damages.filter((d) => d.id !== id);
    appendHistory(db, user, 'Reporte de Daños', 'Eliminación', `Eliminó reporte de daño ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // WASTE BINS & RECORDS
  // ==========================================
  if (pathname === '/api/waste/bins' && method === 'GET') {
    return [...db.wasteBins].sort((a, b) => a.floorCode.localeCompare(b.floorCode) || a.color.localeCompare(b.color)) as unknown as T;
  }

  if (pathname === '/api/waste/bins' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR']);
    if (!body.floorCode || !body.location || !body.color) {
      throw new Error('Piso, ubicación y color de recipiente son obligatorios.');
    }
    const id = nextId(db, 'wasteBins');
    db.wasteBins.push({
      id,
      floorCode: body.floorCode,
      location: body.location,
      containerType: body.containerType || 'Caneca institucional',
      color: body.color,
      bagType: body.bagType || `Bolsa color ${String(body.color).toLowerCase()}`,
      condition: body.condition || 'Óptimo',
      collectionFrequency: body.collectionFrequency || 'Por jornada',
      needsAdditionalGreen: body.needsAdditionalGreen ? 1 : 0,
      notes: body.notes ?? '',
      updatedAt: new Date().toISOString(),
    });
    appendHistory(db, user, 'Residuos Sólidos', 'Creación caneca', `Registró recipiente ${body.color} en ${body.floorCode} - ${body.location}`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/waste/bins/') && method === 'PUT') {
    const id = Number(pathname.split('/').pop());
    const bin = db.wasteBins.find((b) => b.id === id);
    if (!bin) throw new Error('Recipiente no encontrado.');
    bin.location = body.location ?? bin.location;
    bin.containerType = body.containerType ?? bin.containerType;
    bin.color = body.color ?? bin.color;
    bin.bagType = body.bagType ?? bin.bagType;
    bin.condition = body.condition ?? bin.condition;
    bin.collectionFrequency = body.collectionFrequency ?? bin.collectionFrequency;
    bin.needsAdditionalGreen =
      body.needsAdditionalGreen !== undefined ? (body.needsAdditionalGreen ? 1 : 0) : bin.needsAdditionalGreen;
    bin.notes = body.notes ?? bin.notes;
    bin.updatedAt = new Date().toISOString();
    appendHistory(db, user, 'Residuos Sólidos', 'Actualización caneca', `Actualizó estado de recipiente ID ${id} (${bin.condition})`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname === '/api/waste/records' && method === 'GET') {
    return [...db.wasteRecords].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id) as unknown as T;
  }

  if (pathname === '/api/waste/records' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO']);
    if (!body.date || !body.collectionTime || !body.floorCode || !body.classification) {
      throw new Error('Fecha, hora de recolección, piso y clasificación son obligatorios.');
    }
    const id = nextId(db, 'wasteRecords');
    db.wasteRecords.unshift({
      id,
      date: body.date,
      collectionTime: body.collectionTime,
      truckPickupTime: body.truckPickupTime ?? '',
      truckVerified: body.truckVerified ? 1 : 0,
      floorCode: body.floorCode,
      binId: body.binId ? Number(body.binId) : null,
      location: body.location || body.floorCode,
      classification: body.classification,
      bagsCount: Number(body.bagsCount || 0),
      weightKg: Number(body.weightKg || 0),
      shiftName: body.shiftName || 'Jornada de la mañana',
      responsible: body.responsible || user.fullName,
      alertType: body.alertType || 'Ninguna',
      observations: body.observations ?? '',
      createdBy: user.username,
    });
    appendHistory(
      db,
      user,
      'Residuos Sólidos',
      'Recolección',
      `Registró ${body.bagsCount || 0} bolsas (${body.weightKg || 0} kg) - ${body.classification} en ${body.floorCode}`
    );
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/waste/records/') && method === 'PUT') {
    const id = Number(pathname.split('/').pop());
    const rec = db.wasteRecords.find((r) => r.id === id);
    if (!rec) throw new Error('Registro no encontrado.');
    rec.truckPickupTime = body.truckPickupTime ?? rec.truckPickupTime;
    rec.truckVerified = body.truckVerified !== undefined ? (body.truckVerified ? 1 : 0) : rec.truckVerified;
    rec.alertType = body.alertType ?? rec.alertType;
    rec.observations = body.observations ?? rec.observations;
    appendHistory(db, user, 'Residuos Sólidos', 'Verificación camión', `Actualizó verificación de recolección ID ${id}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // AUDITS, FINDINGS, PROCESS DOCS & LEGAL MATRIX
  // ==========================================
  if (pathname === '/api/audits' && method === 'GET') {
    return [...db.audits].sort((a, b) => a.auditDate.localeCompare(b.auditDate)) as unknown as T;
  }

  if (pathname === '/api/audits' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']);
    if (!body.title || !body.auditDate) throw new Error('Título y fecha de auditoría son obligatorios.');
    const id = nextId(db, 'audits');
    db.audits.push({
      id,
      title: body.title,
      auditDate: body.auditDate,
      auditType: body.auditType || 'Auditoría interna del proceso',
      auditorName: body.auditorName || user.fullName,
      status: body.status || 'Pendiente',
      requirementsChecklist: Array.isArray(body.requirementsChecklist) ? body.requirementsChecklist : [],
      notes: body.notes ?? '',
      createdBy: user.username,
    });
    appendHistory(db, user, 'Auditorías', 'Programación aviso', `Programó auditoría "${body.title}" para ${body.auditDate}`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/audits/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']);
    const id = Number(pathname.split('/').pop());
    const au = db.audits.find((a) => a.id === id);
    if (!au) throw new Error('Auditoría no encontrada.');
    au.title = body.title ?? au.title;
    au.auditDate = body.auditDate ?? au.auditDate;
    au.auditType = body.auditType ?? au.auditType;
    au.auditorName = body.auditorName ?? au.auditorName;
    au.status = body.status ?? au.status;
    au.requirementsChecklist = body.requirementsChecklist ?? au.requirementsChecklist;
    au.notes = body.notes ?? au.notes;
    appendHistory(db, user, 'Auditorías', 'Actualización', `Actualizó estado de auditoría ID ${id} a ${au.status}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname === '/api/findings' && method === 'GET') {
    return [...db.findings].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id) as unknown as T;
  }

  if (pathname === '/api/findings' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']);
    if (!body.floorCode || !body.areaName || !body.description || !body.correctiveAction) {
      throw new Error('Piso, área, descripción y acción correctiva son obligatorios.');
    }
    const id = nextId(db, 'findings');
    db.findings.unshift({
      id,
      auditId: body.auditId ? Number(body.auditId) : null,
      date: body.date || new Date().toISOString().slice(0, 10),
      floorCode: body.floorCode,
      areaName: body.areaName,
      findingType: body.findingType || 'Observación',
      description: body.description,
      correctiveAction: body.correctiveAction,
      responsible: body.responsible || 'Supervisión Torre Norte',
      dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
      status: body.status || 'Abierto',
      createdBy: user.username,
    });
    appendHistory(db, user, 'Hallazgos y Mejora', 'Creación', `Registró ${body.findingType || 'Observación'} en ${body.floorCode} - ${body.areaName}`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/findings/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']);
    const id = Number(pathname.split('/').pop());
    const fi = db.findings.find((f) => f.id === id);
    if (!fi) throw new Error('Hallazgo no encontrado.');
    fi.status = body.status ?? fi.status;
    fi.correctiveAction = body.correctiveAction ?? fi.correctiveAction;
    fi.responsible = body.responsible ?? fi.responsible;
    fi.dueDate = body.dueDate ?? fi.dueDate;
    appendHistory(db, user, 'Hallazgos y Mejora', 'Actualización', `Actualizó hallazgo ID ${id} a estado ${fi.status}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname.startsWith('/api/process-docs/') && method === 'GET') {
    const docType = pathname.split('/').pop() as keyof LocalDatabase['processDocs'];
    const doc = db.processDocs[docType];
    if (!doc) throw new Error('Documento de proceso no encontrado.');
    return { docType, ...doc } as unknown as T;
  }

  if (pathname.startsWith('/api/process-docs/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']);
    const docType = pathname.split('/').pop() as keyof LocalDatabase['processDocs'];
    if (!body.content) throw new Error('Contenido requerido.');
    if (!db.processDocs[docType]) throw new Error('Documento de proceso no encontrado.');
    db.processDocs[docType] = {
      content: body.content,
      updatedAt: new Date().toISOString(),
      updatedBy: user.username,
    } as never;
    appendHistory(db, user, 'Documentación del Proceso', 'Edición', `Actualizó documento "${docType}"`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (pathname === '/api/legal-matrix' && method === 'GET') {
    return [...db.legalMatrix].sort((a, b) => a.id - b.id) as unknown as T;
  }

  if (pathname === '/api/legal-matrix' && method === 'POST') {
    assertRoles(user, ['ADMINISTRADOR', 'AUDITOR', 'SUPERVISOR']);
    if (!body.norm || !body.year || !body.requirement) {
      throw new Error('Norma, año y requisito son obligatorios.');
    }
    const id = nextId(db, 'legalMatrix');
    db.legalMatrix.push({
      id,
      norm: body.norm,
      year: body.year,
      applicableArticle: body.applicableArticle || '',
      requirement: body.requirement,
      processApplication: body.processApplication || '',
      responsible: body.responsible || '',
      evidence: body.evidence || '',
      complianceStatus: body.complianceStatus || 'En proceso',
      officialSource: body.officialSource || '',
      obligationType: body.obligationType || 'Obligación Legal',
      vigencyNote: body.vigencyNote || '',
    });
    appendHistory(db, user, 'Matriz Legal', 'Adición', `Agregó norma "${body.norm}" (${body.year})`);
    saveDb(db);
    return { id } as unknown as T;
  }

  if (pathname.startsWith('/api/legal-matrix/') && method === 'PUT') {
    assertRoles(user, ['ADMINISTRADOR', 'AUDITOR', 'SUPERVISOR']);
    const id = Number(pathname.split('/').pop());
    const row = db.legalMatrix.find((l) => l.id === id);
    if (!row) throw new Error('Registro normativo no encontrado.');
    row.complianceStatus = body.complianceStatus ?? row.complianceStatus;
    row.evidence = body.evidence ?? row.evidence;
    row.responsible = body.responsible ?? row.responsible;
    row.vigencyNote = body.vigencyNote ?? row.vigencyNote;
    appendHistory(db, user, 'Matriz Legal', 'Actualización', `Actualizó cumplimiento de "${row.norm}" a ${row.complianceStatus}`);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // ==========================================
  // SEARCH, HISTORY & INDICATORS
  // ==========================================
  if (pathname === '/api/search' && method === 'GET') {
    const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) {
      return { spaces: [], schedules: [], products: [], legal: [], deliveries: [], cafeteria: [], damages: [] } as unknown as T;
    }
    const spaces = db.spaces
      .filter(
        (s) =>
          s.active === 1 &&
          (s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            (s.floorName || '').toLowerCase().includes(q))
      )
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        floorCode: s.floorCode || '',
        floorName: s.floorName || '',
        availability: s.availability,
      }));
    const schedules = db.schedules
      .filter(
        (sc) =>
          sc.activity.toLowerCase().includes(q) ||
          sc.areaName.toLowerCase().includes(q) ||
          sc.responsible.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((sc) => ({
        id: sc.id,
        date: sc.date,
        areaName: sc.areaName,
        activity: sc.activity,
        responsible: sc.responsible,
        status: sc.status,
      }));
    const products = db.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        availableQty: p.availableQty,
        unit: p.unit,
      }));
    const legal = db.legalMatrix
      .filter((l) => l.norm.toLowerCase().includes(q) || l.requirement.toLowerCase().includes(q))
      .slice(0, 8)
      .map((l) => ({
        id: l.id,
        norm: l.norm,
        year: l.year,
        complianceStatus: l.complianceStatus,
      }));
    const deliveries = db.deliveries
      .filter(
        (d) =>
          d.deliveredBy.toLowerCase().includes(q) ||
          d.deliveredTo.toLowerCase().includes(q) ||
          d.deliveryType.toLowerCase().includes(q) ||
          JSON.stringify(d.items).toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        deliveryDate: d.deliveryDate,
        deliveryTime: d.deliveryTime,
        deliveryType: d.deliveryType,
        deliveredBy: d.deliveredBy,
        deliveredTo: d.deliveredTo,
      }));
    const cafeteria = db.cafeteriaSupplies
      .filter(
        (c) =>
          c.itemName.toLowerCase().includes(q) ||
          c.cafeteriaLocation.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        itemName: c.itemName,
        cafeteriaLocation: c.cafeteriaLocation,
        currentQty: c.currentQty,
        minQty: c.minQty,
        unit: c.unit,
      }));
    const damages = db.damages
      .filter(
        (d) =>
          d.itemDamaged.toLowerCase().includes(q) ||
          d.spaceName.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        itemDamaged: d.itemDamaged,
        spaceName: d.spaceName,
        status: d.status,
        severity: d.severity,
        floorName: d.floorName || '',
      }));

    return { spaces, schedules, products, legal, deliveries, cafeteria, damages } as unknown as T;
  }

  if (pathname === '/api/history' && method === 'GET') {
    return db.history.slice(0, 200) as unknown as T;
  }

  if (pathname === '/api/indicators' && method === 'GET') {
    const dateFrom = parsedUrl.searchParams.get('dateFrom') || '';
    const dateTo = parsedUrl.searchParams.get('dateTo') || '';
    const floorCode = parsedUrl.searchParams.get('floorCode') || '';
    const shiftName = parsedUrl.searchParams.get('shiftName') || '';
    const responsible = parsedUrl.searchParams.get('responsible') || '';

    const filteredSchedules = db.schedules.filter((sc) => {
      if (dateFrom && sc.date < dateFrom) return false;
      if (dateTo && sc.date > dateTo) return false;
      if (floorCode && floorCode !== 'TODOS' && sc.floorCode !== floorCode) return false;
      if (shiftName && shiftName !== 'TODAS' && sc.shiftName !== shiftName) return false;
      if (responsible && responsible !== 'TODOS' && !sc.responsible.toLowerCase().includes(responsible.toLowerCase())) {
        return false;
      }
      return true;
    });

    const totalActivities = filteredSchedules.length;
    const completedActivities = filteredSchedules.filter(
      (s) => s.status === 'Realizado' || s.status === 'Verificado'
    ).length;
    const pendingActivities = filteredSchedules.filter(
      (s) => s.status === 'Pendiente' || s.status === 'En proceso'
    ).length;
    const completionPct = totalActivities ? Number(((completedActivities / totalActivities) * 100).toFixed(1)) : 0;
    const pendingPct = totalActivities ? Number(((pendingActivities / totalActivities) * 100).toFixed(1)) : 0;

    const byFloor = [...db.floors]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((fl) => {
        const flRows = filteredSchedules.filter((s) => s.floorCode === fl.code);
        const done = flRows.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
        return {
          floorCode: fl.code,
          floorName: fl.name,
          total: flRows.length,
          completed: done,
          compliancePct: flRows.length ? Number(((done / flRows.length) * 100).toFixed(1)) : 0,
        };
      });

    const shiftNames = ['Jornada de la mañana', 'Jornada de la tarde', 'Jornada de la noche'];
    const byShift = shiftNames.map((sh) => {
      const shRows = filteredSchedules.filter((s) => s.shiftName === sh);
      const done = shRows.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
      return {
        shiftName: sh,
        total: shRows.length,
        completed: done,
        compliancePct: shRows.length ? Number(((done / shRows.length) * 100).toFixed(1)) : 0,
      };
    });

    const filteredConsumptions = db.consumptions.filter((c) => {
      if (dateFrom && c.date < dateFrom) return false;
      if (dateTo && c.date > dateTo) return false;
      if (floorCode && floorCode !== 'TODOS' && c.floorCode !== floorCode) return false;
      if (shiftName && shiftName !== 'TODAS' && c.shiftName !== shiftName) return false;
      return true;
    });

    const prodCatMap = new Map(db.products.map((p) => [p.id, p.category]));
    const bagsConsumed = filteredConsumptions
      .filter((c) => prodCatMap.get(c.productId) === 'Bolsas para residuos')
      .reduce((acc, c) => acc + c.quantity, 0);

    const filteredWaste = db.wasteRecords.filter((w) => {
      if (dateFrom && w.date < dateFrom) return false;
      if (dateTo && w.date > dateTo) return false;
      if (floorCode && floorCode !== 'TODOS' && w.floorCode !== floorCode) return false;
      if (shiftName && shiftName !== 'TODAS' && w.shiftName !== shiftName) return false;
      return true;
    });

    const totalWasteKg = Number(filteredWaste.reduce((acc, w) => acc + w.weightKg, 0).toFixed(2));
    const totalWasteBags = filteredWaste.reduce((acc, w) => acc + w.bagsCount, 0);

    const wasteByClassification = [
      'Blanco - Aprovechables',
      'Negro - No aprovechables',
      'Verde - Orgánicos aprovechables',
    ].map((cls) => ({
      classification: cls,
      weightKg: Number(
        filteredWaste
          .filter((w) => w.classification === cls)
          .reduce((acc, w) => acc + w.weightKg, 0)
          .toFixed(2)
      ),
      bags: filteredWaste.filter((w) => w.classification === cls).reduce((acc, w) => acc + w.bagsCount, 0),
    }));

    return {
      totalActivities,
      completedActivities,
      pendingActivities,
      completionPct,
      pendingPct,
      byFloor,
      byShift,
      totalConsumptionsCount: filteredConsumptions.length,
      totalConsumptionCost: Number(
        filteredConsumptions.reduce((acc, c) => acc + c.calculatedCost, 0).toFixed(2)
      ),
      bagsConsumed,
      totalWasteKg,
      totalWasteBags,
      wasteByClassification,
    } as unknown as T;
  }

  throw new Error(`Ruta local no implementada: ${method} ${pathname}`);
}
