export type Role =
  | 'ADMINISTRADOR'
  | 'SUPERVISOR'
  | 'PERSONAL DE ASEO'
  | 'AUDITOR'
  | 'DIRECTIVO';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  shiftPreference?: string;
  active: number;
  createdAt: string;
}

export type SpaceAvailability =
  | 'Disponible'
  | 'En formación'
  | 'En limpieza'
  | 'Mantenimiento';

export interface Floor {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  standardElements: string[];
  notes: string;
}

export interface Space {
  id: number;
  floorId: number;
  floorCode?: string;
  floorName?: string;
  name: string;
  category: string;
  hasComputers: number;
  hasTv: number;
  availability: SpaceAvailability;
  trainingScheduleNote: string;
  elementsDetail: string;
  active: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PhotoAnalysisResult {
  probableFloor: string;
  spaceType: string;
  environmentName: string;
  detectedElements: string[];
  detectedBins: string[];
  visibleDirtConditions: string[];
  observations: string;
  confidenceNote: string;
}

export interface BeforeAfterComparisonResult {
  visualEvaluationSummary: string;
  sufficientEvidence: boolean;
  insufficientEvidenceReason: string;
  surfacesStatus: string;
  floorWasteStatus: string;
  binsStatus: string;
  dustAndStainsStatus: string;
  organizationStatus: string;
  restroomsOrGlassStatus: string;
  overallVisualAssessment: 'Evidencia favorable visualmente' | 'Requiere revisión adicional' | 'Evidencia insuficiente';
  disclaimer: string;
}

export interface PhotoRecord {
  id: number;
  spaceId: number | null;
  floorCode: string;
  spaceName: string;
  photoType: 'Identificación' | 'Antes' | 'Después' | 'Hallazgo';
  activityTitle: string;
  responsible: string;
  imageUrl: string;
  pairImageUrl: string | null;
  aiAnalysisJson: string | null;
  aiComparisonJson: string | null;
  capturedAt: string;
  createdBy: string;
}

export interface ShiftConfig {
  id: number;
  name: 'Jornada de la mañana' | 'Jornada de la tarde' | 'Jornada de la noche';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  frequency: string;
  supervisorName: string;
  notes: string;
}

export type ActivityStatus =
  | 'Pendiente'
  | 'En proceso'
  | 'Realizado'
  | 'Verificado'
  | 'No realizado'
  | 'Reprogramado';

export interface ScheduleActivity {
  id: number;
  date: string;
  scheduledTime: string;
  shiftName: string;
  floorId: number;
  floorCode?: string;
  floorName?: string;
  spaceId: number | null;
  areaName: string;
  activity: string;
  responsible: string;
  frequency: string;
  estimatedMinutes: number;
  requiredProducts: string;
  requiredSupplies: string;
  status: ActivityStatus;
  isSunday: number;
  sundayJustification: string;
  trainingConflictChecked: number;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

export type ProductCategory =
  | 'Detergentes'
  | 'Desinfectantes'
  | 'Desengrasantes'
  | 'Limpiavidrios'
  | 'Productos para baños'
  | 'Productos para pisos'
  | 'Productos para superficies'
  | 'Productos para cafeterines'
  | 'Bolsas para residuos'
  | 'Escobas'
  | 'Traperos'
  | 'Cepillos'
  | 'Guantes'
  | 'Paños de microfibra'
  | 'Señalización de piso mojado'
  | 'EPP (Protección personal)'
  | 'Uniformes y dotación'
  | 'Otros elementos de limpieza';

export type UsageScope =
  | 'Operativo'
  | 'Administración'
  | 'Ambientes con cómputo'
  | 'Ambientes sin cómputo'
  | 'Ambientes con televisores'
  | 'Ambientes sin televisores';

export interface ProductItem {
  id: number;
  name: string;
  category: ProductCategory | string;
  usageScope: UsageScope | string;
  brand: string;
  supplier: string;
  specificUse: string;
  presentation: string;
  unit: 'mL' | 'L' | 'g' | 'kg' | 'unidades';
  availableQty: number;
  usedQty: number;
  minQty: number;
  unitPrice: number;
  expirationDate: string;
  lot: string;
  storageLocation: string;
  safetySheetRef: string;
  hazardClassification: string;
  handlingRecommendations: string;
  requiredEpp: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ConsumptionRecord {
  id: number;
  date: string;
  monthKey: string;
  shiftName: string;
  floorCode: string;
  areaName: string;
  activity: string;
  responsible: string;
  productId: number;
  productName?: string;
  quantity: number;
  unit: string;
  calculatedCost: number;
  fdsVerified: number;
  notes: string;
  createdBy: string;
}

export type DeliveryCategory =
  | 'EPP'
  | 'Uniformes'
  | 'Artículos de aseo'
  | 'Dotación Completa';

export interface DeliveryItem {
  itemName: string;
  category: 'EPP' | 'Uniformes' | 'Artículos de aseo';
  quantity: number;
  unit: string;
  sizeOrSpec: string;
  productId?: number | null;
  deductStock?: boolean;
}

export interface EquipmentDelivery {
  id: number;
  deliveryDate: string;
  deliveryTime: string;
  deliveryType: DeliveryCategory | string;
  deliveredBy: string;
  deliveredByRole: string;
  deliveredTo: string;
  recipientRole: string;
  shiftName: string;
  items: DeliveryItem[];
  conditionNote: string;
  receivedConfirmed: number;
  observations: string;
  createdBy: string;
  createdAt: string;
}

export interface WasteBin {
  id: number;
  floorCode: string;
  location: string;
  containerType: string;
  color: 'Blanco' | 'Negro' | 'Verde';
  bagType: string;
  condition: 'Óptimo' | 'Requiere bolsa' | 'Deteriorado' | 'Lleno';
  collectionFrequency: string;
  needsAdditionalGreen: number;
  notes: string;
  updatedAt: string;
}

export interface WasteRecord {
  id: number;
  date: string;
  collectionTime: string;
  truckPickupTime: string;
  truckVerified: number;
  floorCode: string;
  binId: number | null;
  location: string;
  classification: 'Blanco - Aprovechables' | 'Negro - No aprovechables' | 'Verde - Orgánicos aprovechables';
  bagsCount: number;
  weightKg: number;
  shiftName: string;
  responsible: string;
  alertType:
    | 'Ninguna'
    | 'Caneca llena'
    | 'Falta bolsa'
    | 'Mezcla de residuos'
    | 'Residuos fuera de recipientes'
    | 'Recolección no realizada';
  observations: string;
  createdBy: string;
}

export interface AuditAlert {
  id: number;
  title: string;
  auditDate: string;
  auditType: string;
  auditorName: string;
  status: 'Pendiente' | 'En curso' | 'Completada' | 'Reprogramada';
  requirementsChecklist: string[];
  notes: string;
  createdBy: string;
}

export interface AuditFinding {
  id: number;
  auditId: number | null;
  date: string;
  floorCode: string;
  areaName: string;
  findingType: 'No conformidad' | 'Observación' | 'Oportunidad de mejora';
  description: string;
  correctiveAction: string;
  responsible: string;
  dueDate: string;
  status: 'Abierto' | 'En ejecución' | 'Cerrado';
  createdBy: string;
}

export interface LegalMatrixRow {
  id: number;
  norm: string;
  year: string;
  applicableArticle: string;
  requirement: string;
  processApplication: string;
  responsible: string;
  evidence: string;
  complianceStatus: 'Cumple' | 'En proceso' | 'Pendiente' | 'No aplica';
  officialSource: string;
  obligationType: 'Obligación Legal' | 'Recomendación Técnica Voluntaria';
  vigencyNote: string;
}

export interface FlowchartStep {
  id: string;
  stepNumber: number;
  title: string;
  nodeType: 'inicio' | 'actividad' | 'decision' | 'fin';
  responsible: string;
  inputs: string;
  outputs: string;
}

export interface ProcessMapData {
  strategic: string[];
  misional: string[];
  support: string[];
  evaluation: string[];
}

export interface CharacterizationData {
  processName: string;
  objective: string;
  scope: string;
  owner: string;
  suppliersInternal: string[];
  suppliersExternal: string[];
  inputs: string[];
  phva: {
    planear: string;
    hacer: string;
    verificar: string;
    actuar: string;
  };
  outputs: string[];
  clients: string[];
  resources: string[];
  associatedDocs: string[];
  indicators: string[];
  risks: string[];
  controls: string[];
  legalRequirements: string[];
}

export interface ChangeHistoryEntry {
  id: number;
  timestamp: string;
  username: string;
  userRole: string;
  module: string;
  action: string;
  details: string;
}

export interface CafeteriaSupply {
  id: number;
  itemName: string;
  category: string;
  cafeteriaLocation: string;
  unit: string;
  currentQty: number;
  minQty: number;
  assignedTo: string;
  lastAssignedAt: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CafeteriaMovement {
  id: number;
  supplyId: number;
  itemName?: string;
  unit?: string;
  movementDate: string;
  movementTime: string;
  movementType: 'Asignación a cafetín' | 'Ingreso / Reposición' | 'Ajuste' | string;
  cafeteriaLocation: string;
  quantity: number;
  assignedBy: string;
  receivedBy: string;
  notes: string;
  createdAt: string;
}

export type DamageStatus = 'Reportado' | 'En revisión' | 'En reparación' | 'Reparado';
export type DamageSeverity = 'Baja' | 'Media' | 'Alta' | 'Urgente';

export interface DamageReport {
  id: number;
  reportDate: string;
  reportTime: string;
  floorId: number;
  floorCode?: string;
  floorName?: string;
  spaceName: string;
  itemDamaged: string;
  category: string;
  severity: DamageSeverity | string;
  description: string;
  reportedBy: string;
  status: DamageStatus | string;
  assignedTechnician: string;
  resolutionNotes: string;
  resolvedAt: string;
  imageUrl: string;
  createdBy: string;
  createdAt: string;
}
