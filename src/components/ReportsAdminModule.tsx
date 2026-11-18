import React, { useEffect, useState } from 'react';
import { FileDown, Users, History, Plus, Trash2, Save } from 'lucide-react';
import {
  AuditAlert,
  AuditFinding,
  CafeteriaSupply,
  ChangeHistoryEntry,
  CharacterizationData,
  ConsumptionRecord,
  DamageReport,
  EquipmentDelivery,
  FlowchartStep,
  LegalMatrixRow,
  ProcessMapData,
  ProductItem,
  Role,
  ScheduleActivity,
  Space,
  User,
  WasteBin,
  WasteRecord,
} from '../types/cesge';
import { apiFetch } from '../utils/api';
import { exportToExcel, exportToPdf } from '../utils/exporters';

interface ReportsAdminModuleProps {
  user: User;
  spaces: Space[];
  schedules: ScheduleActivity[];
  products: ProductItem[];
  consumptions: ConsumptionRecord[];
  deliveries: EquipmentDelivery[];
  cafeteriaSupplies: CafeteriaSupply[];
  damages: DamageReport[];
  wasteBins: WasteBin[];
  wasteRecords: WasteRecord[];
  audits: AuditAlert[];
  findings: AuditFinding[];
  legalMatrix: LegalMatrixRow[];
  onRefresh: () => Promise<void>;
}

const ROLES: Role[] = ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO', 'AUDITOR', 'DIRECTIVO'];

export default function ReportsAdminModule({
  user,
  spaces,
  schedules,
  products,
  consumptions,
  deliveries,
  cafeteriaSupplies,
  damages,
  wasteBins,
  wasteRecords,
  audits,
  findings,
  legalMatrix,
  onRefresh,
}: ReportsAdminModuleProps) {
  const [subTab, setSubTab] = useState<'reports' | 'users' | 'history'>('reports');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [historyList, setHistoryList] = useState<ChangeHistoryEntry[]>([]);

  // New user form
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uFull, setUFull] = useState('');
  const [uPass, setUPass] = useState('');
  const [uRole, setURole] = useState<Role>('PERSONAL DE ASEO');
  const [uShift, setUShift] = useState('Jornada de la mañana');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const canManageUsers = user.role === 'ADMINISTRADOR' || user.role === 'DIRECTIVO';

  async function loadAdminData() {
    const [u, h] = await Promise.all([
      apiFetch<User[]>('/api/users'),
      apiFetch<ChangeHistoryEntry[]>('/api/history'),
    ]);
    setUsersList(u);
    setHistoryList(h);
  }

  useEffect(() => {
    loadAdminData().catch(() => {});
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: uName,
          email: uEmail,
          fullName: uFull,
          password: uPass,
          role: uRole,
          shiftPreference: uShift,
        }),
      });
      setUName('');
      setUEmail('');
      setUFull('');
      setUPass('');
      setFeedback({ type: 'ok', msg: 'Usuario creado y guardado correctamente.' });
      await loadAdminData();
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error creando usuario.' });
    }
  }

  async function handleDeleteUser(target: User) {
    setFeedback(null);
    try {
      await apiFetch(`/api/users/${target.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: `Usuario "${target.username}" eliminado del sistema.` });
      await loadAdminData();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'No se pudo eliminar el usuario.' });
    }
  }

  // All 17 Reports using real DB records
  async function generateReport(reportId: string, format: 'pdf' | 'xlsx') {
    const today = new Date().toISOString().slice(0, 10);
    let title = '';
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    switch (reportId) {
      case 'areas':
        title = 'Inventario General de Áreas – Torre Norte';
        headers = ['Piso', 'Espacio', 'Categoría', 'Disponibilidad', 'Cómputo', 'TV', 'Horario Formación'];
        rows = spaces.map((s) => [s.floorName || s.floorCode || '', s.name, s.category, s.availability, s.hasComputers ? 'Sí' : 'No', s.hasTv ? 'Sí' : 'No', s.trainingScheduleNote]);
        break;
      case 'chemicals':
        title = 'Inventario de Productos Químicos (SST-FR-96)';
        headers = ['Producto', 'Categoría', 'Uso', 'Disponible', 'Mínimo', 'Unidad', 'Lote', 'Vencimiento', 'SGA', 'FDS'];
        rows = products
          .filter((p) => ['Detergentes', 'Desinfectantes', 'Desengrasantes', 'Limpiavidrios', 'Productos para baños', 'Productos para pisos', 'Productos para superficies', 'Productos para cafeterines'].includes(p.category))
          .map((p) => [p.name, p.category, p.usageScope, p.availableQty, p.minQty, p.unit, p.lot, p.expirationDate, p.hazardClassification, p.safetySheetRef]);
        break;
      case 'supplies':
        title = 'Inventario de Insumos y Elementos de Aseo';
        headers = ['Insumo', 'Categoría', 'Alcance', 'Disponible', 'Mínimo', 'Unidad', 'Ubicación'];
        rows = products
          .filter((p) => !['Detergentes', 'Desinfectantes', 'Desengrasantes', 'Limpiavidrios', 'Productos para baños', 'Productos para pisos', 'Productos para superficies', 'Productos para cafeterines'].includes(p.category))
          .map((p) => [p.name, p.category, p.usageScope, p.availableQty, p.minQty, p.unit, p.storageLocation]);
        break;
      case 'sched_daily':
        title = `Programación Diaria de Aseo (${today})`;
        headers = ['Fecha', 'Hora', 'Jornada', 'Piso', 'Área', 'Actividad', 'Responsable', 'Estado'];
        rows = schedules.filter((s) => s.date === today).map((s) => [s.date, s.scheduledTime, s.shiftName, s.floorCode || '', s.areaName, s.activity, s.responsible, s.status]);
        break;
      case 'sched_weekly':
        title = 'Programación Semanal de Aseo';
        headers = ['Fecha', 'Hora', 'Jornada', 'Piso', 'Área', 'Actividad', 'Responsable', 'Estado'];
        rows = schedules.slice(0, 100).map((s) => [s.date, s.scheduledTime, s.shiftName, s.floorCode || '', s.areaName, s.activity, s.responsible, s.status]);
        break;
      case 'sched_monthly':
        title = `Programación Mensual de Aseo (${today.slice(0, 7)})`;
        headers = ['Fecha', 'Hora', 'Jornada', 'Piso', 'Área', 'Actividad', 'Responsable', 'Estado'];
        rows = schedules.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)).map((s) => [s.date, s.scheduledTime, s.shiftName, s.floorCode || '', s.areaName, s.activity, s.responsible, s.status]);
        break;
      case 'activities':
        title = 'Registro General de Actividades de Aseo';
        headers = ['Fecha', 'Hora', 'Jornada', 'Piso', 'Área', 'Actividad', 'Responsable', 'Estado', 'Actualizado por'];
        rows = schedules.map((s) => [s.date, s.scheduledTime, s.shiftName, s.floorCode || '', s.areaName, s.activity, s.responsible, s.status, s.updatedBy]);
        break;
      case 'consumption':
        title = 'Control de Consumo de Productos e Insumos';
        headers = ['Fecha', 'Jornada', 'Piso', 'Ambiente', 'Producto', 'Cantidad', 'Unidad', 'Costo ($)', 'Responsable'];
        rows = consumptions.map((c) => [c.date, c.shiftName, c.floorCode, c.areaName, c.productName || '', c.quantity, c.unit, c.calculatedCost, c.responsible]);
        break;
      case 'waste':
        title = 'Reporte de Gestión de Residuos Sólidos (Res. 2184/2019)';
        headers = ['Fecha', 'Hora', 'Piso', 'Ubicación', 'Clasificación', 'Bolsas', 'Peso (kg)', 'Jornada', 'Responsable', 'Camión Verificado'];
        rows = wasteRecords.map((w) => [w.date, w.collectionTime, w.floorCode, w.location, w.classification, w.bagsCount, w.weightKg, w.shiftName, w.responsible, w.truckVerified ? `Sí (${w.truckPickupTime})` : 'Pendiente']);
        break;
      case 'characterization': {
        const ch = await apiFetch<{ content: CharacterizationData }>('/api/process-docs/characterization');
        title = 'Caracterización del Proceso de Gestión del Aseo';
        headers = ['Elemento', 'Descripción'];
        rows = [
          ['Proceso', ch.content.processName],
          ['Objetivo', ch.content.objective],
          ['Alcance', ch.content.scope],
          ['Planear', ch.content.phva.planear],
          ['Hacer', ch.content.phva.hacer],
          ['Verificar', ch.content.phva.verificar],
          ['Actuar', ch.content.phva.actuar],
        ];
        break;
      }
      case 'process_map': {
        const pm = await apiFetch<{ content: ProcessMapData }>('/api/process-docs/process_map');
        title = 'Mapa del Proceso de Gestión del Aseo';
        headers = ['Tipo', 'Proceso'];
        rows = [
          ...pm.content.strategic.map((x) => ['Estratégico', x]),
          ...pm.content.misional.map((x) => ['Misional', x]),
          ...pm.content.support.map((x) => ['Apoyo', x]),
          ...pm.content.evaluation.map((x) => ['Evaluación', x]),
        ];
        break;
      }
      case 'flowchart': {
        const fc = await apiFetch<{ content: FlowchartStep[] }>('/api/process-docs/flowchart');
        title = 'Flujograma Operativo del Proceso';
        headers = ['Paso', 'Tipo', 'Actividad', 'Responsable', 'Entradas', 'Salidas'];
        rows = fc.content.map((s) => [s.stepNumber, s.nodeType, s.title, s.responsible, s.inputs, s.outputs]);
        break;
      }
      case 'checklists':
        title = 'Listas de Chequeo y Verificación de Auditorías';
        headers = ['Auditoría', 'Fecha', 'Estado', 'Requisitos a verificar'];
        rows = audits.map((a) => [a.title, a.auditDate, a.status, a.requirementsChecklist.join(' | ')]);
        break;
      case 'audit_reports':
        title = 'Informe de Auditorías y Hallazgos';
        headers = ['Fecha', 'Piso', 'Área', 'Tipo', 'Descripción', 'Responsable', 'Estado'];
        rows = findings.map((f) => [f.date, f.floorCode, f.areaName, f.findingType, f.description, f.responsible, f.status]);
        break;
      case 'improvement':
        title = 'Planes de Mejoramiento y Acciones Correctivas';
        headers = ['Piso', 'Área', 'Acción Correctiva', 'Responsable', 'Fecha Límite', 'Estado'];
        rows = findings.map((f) => [f.floorCode, f.areaName, f.correctiveAction, f.responsible, f.dueDate, f.status]);
        break;
      case 'legal':
        title = 'Matriz Legal Colombiana Vigente 2026';
        headers = ['Norma', 'Año', 'Artículo', 'Tipo', 'Requisito', 'Estado', 'Fuente'];
        rows = legalMatrix.map((l) => [l.norm, l.year, l.applicableArticle, l.obligationType, l.requirement, l.complianceStatus, l.officialSource]);
        break;
      case 'indicators': {
        const done = schedules.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
        const pct = schedules.length ? ((done / schedules.length) * 100).toFixed(1) : '0';
        const kg = wasteRecords.reduce((a, b) => a + b.weightKg, 0).toFixed(2);
        title = 'Reporte General de Indicadores CESGE Torre Norte';
        headers = ['Indicador', 'Valor Real'];
        rows = [
          ['Total espacios activos Torre Norte', spaces.length],
          ['Actividades programadas', schedules.length],
          ['% Actividades realizadas', `${pct}%`],
          ['Productos registrados en inventario', products.length],
          ['Registros de consumo', consumptions.length],
          ['Entregas de dotación, EPP y uniformes', deliveries.length],
          ['Insumos de cafetería por reponer', cafeteriaSupplies.filter((c) => c.currentQty <= c.minQty).length],
          ['Daños abiertos / pendientes', damages.filter((d) => d.status !== 'Reparado').length],
          ['Recipientes registrados', wasteBins.length],
          ['Total residuos recolectados (kg)', kg],
        ];
        break;
      }
      case 'deliveries':
        title = 'Entrega de Dotación, EPP, Uniformes y Artículos de Aseo';
        headers = ['Fecha', 'Hora', 'Tipo', 'Quién entrega', 'A quién se entregó', 'Jornada', 'Elementos / Tallas', 'Recibido conforme'];
        rows = deliveries.map((d) => [
          d.deliveryDate,
          d.deliveryTime,
          d.deliveryType,
          `${d.deliveredBy}${d.deliveredByRole ? ` (${d.deliveredByRole})` : ''}`,
          `${d.deliveredTo}${d.recipientRole ? ` (${d.recipientRole})` : ''}`,
          d.shiftName || 'N/A',
          d.items.map((it) => `${it.quantity} ${it.unit} ${it.itemName}${it.sizeOrSpec ? ` [${it.sizeOrSpec}]` : ''}`).join(' | '),
          d.receivedConfirmed ? 'Sí' : 'Pendiente',
        ]);
        break;
      case 'cafeteria_damages':
        title = 'Insumos de Cafetería y Reporte de Daños';
        headers = ['Tipo de registro', 'Ubicación / Piso', 'Elemento / Insumo', 'Detalle / Qué hay / Qué falta', 'Responsable / Reporta', 'Estado'];
        rows = [
          ...cafeteriaSupplies.map((c) => {
            const miss = Math.max(0, Number((c.minQty - c.currentQty).toFixed(2)));
            return [
              'Insumo Cafetería',
              c.cafeteriaLocation,
              c.itemName,
              `Hay: ${c.currentQty} ${c.unit} · Mín: ${c.minQty} · Falta: ${miss} ${c.unit}`,
              c.assignedTo || 'Sin asignar',
              c.currentQty <= 0 ? 'Agotado' : c.currentQty <= c.minQty ? 'Por reponer' : 'Suficiente',
            ];
          }),
          ...damages.map((d) => [
            `Daño (${d.severity})`,
            `${d.floorName || ''} - ${d.spaceName}`,
            d.itemDamaged,
            `${d.reportDate} ${d.reportTime} · ${d.description}`,
            d.reportedBy,
            d.status,
          ]),
        ];
        break;
    }

    if (format === 'pdf') {
      exportToPdf(`Reporte_${reportId}_${today}.pdf`, title, 'CESGE Torre Norte – Datos reales de base de datos', headers, rows);
    } else {
      exportToExcel(`Reporte_${reportId}_${today}.xlsx`, title.slice(0, 31), headers, rows);
    }
  }

  const reportDefinitions = [
    { id: 'areas', label: '1. Inventario general de áreas' },
    { id: 'chemicals', label: '2. Inventario de productos químicos' },
    { id: 'supplies', label: '3. Inventario de insumos' },
    { id: 'sched_daily', label: '4. Programación diaria de aseo' },
    { id: 'sched_weekly', label: '5. Programación semanal' },
    { id: 'sched_monthly', label: '6. Programación mensual' },
    { id: 'activities', label: '7. Registro de actividades' },
    { id: 'consumption', label: '8. Control de consumo' },
    { id: 'waste', label: '9. Reporte de residuos' },
    { id: 'characterization', label: '10. Caracterización del proceso' },
    { id: 'process_map', label: '11. Mapa del proceso' },
    { id: 'flowchart', label: '12. Flujograma' },
    { id: 'checklists', label: '13. Listas de chequeo' },
    { id: 'audit_reports', label: '14. Informes de auditoría' },
    { id: 'improvement', label: '15. Planes de mejoramiento' },
    { id: 'legal', label: '16. Matriz legal' },
    { id: 'indicators', label: '17. Reporte general de indicadores' },
    { id: 'deliveries', label: '18. Entrega de dotación, EPP y uniformes' },
    { id: 'cafeteria_damages', label: '19. Insumos de cafetería y reporte de daños' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Reportes PDF/Excel, Usuarios y Trazabilidad de Cambios
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Exportación oficial en PDF y Excel a partir de registros reales, administración de perfiles y auditoría de modificaciones.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubTab('reports')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'reports' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileDown className="w-3.5 h-3.5" /> Reportes PDF y Excel (19)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Usuarios y Perfiles ({usersList.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('history')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Historial de Cambios ({historyList.length})
        </button>
      </div>

      {subTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportDefinitions.map((rep) => (
            <div key={rep.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-900">{rep.label}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => generateReport(rep.id, 'pdf')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => generateReport(rep.id, 'xlsx')}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md"
                >
                  Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'users' && (
        <div className="space-y-5">
          {canManageUsers ? (
            <form onSubmit={handleCreateUser} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-700" /> Crear Nuevo Usuario (Administrador / Directivo)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <input required value={uFull} onChange={(e) => setUFull(e.target.value)} placeholder="Nombre completo" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input required value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Usuario (ej. maria.gomez)" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input type="email" required value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder="Correo Gmail (usuario@gmail.com)" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input type="password" required minLength={6} value={uPass} onChange={(e) => setUPass(e.target.value)} placeholder="Contraseña (mín. 6)" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <select value={uRole} onChange={(e) => setURole(e.target.value as Role)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={uShift} onChange={(e) => setUShift(e.target.value)} placeholder="Jornada asignada" className="px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                  <Save className="w-3.5 h-3.5" /> Guardar Usuario
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
              Solo los altos cargos (<strong>ADMINISTRADOR</strong> y <strong>DIRECTIVO</strong>) pueden crear o eliminar cuentas de usuario.
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Usuario / Gmail</th>
                  <th className="py-2.5 px-3">Perfil</th>
                  <th className="py-2.5 px-3">Jornada</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{u.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {u.username} · {u.email}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-blue-800">{u.role}</td>
                    <td className="py-2.5 px-3 text-slate-600">{u.shiftPreference || 'Todas'}</td>
                    <td className="py-2.5 px-3 text-right">
                      {canManageUsers && u.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Usuario / Perfil</th>
                <th className="py-2.5 px-3">Módulo</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyList.map((h) => (
                <tr key={h.id}>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">{h.timestamp}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{h.username}</span>{' '}
                    <span className="text-slate-500">({h.userRole})</span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-blue-800">{h.module}</td>
                  <td className="py-2.5 px-3">{h.action}</td>
                  <td className="py-2.5 px-3 text-slate-700">{h.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
