import React, { useState } from 'react';
import {
  Coffee,
  Wrench,
  Plus,
  Save,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Download,
  FileDown,
  Camera,
} from 'lucide-react';
import {
  CafeteriaMovement,
  CafeteriaSupply,
  DamageReport,
  DamageSeverity,
  DamageStatus,
  Floor,
  Space,
  User,
} from '../types/cesge';
import { apiFetch } from '../utils/api';
import { exportToExcel, exportToPdf } from '../utils/exporters';

interface CafeteriaDamagesModuleProps {
  user: User;
  floors: Floor[];
  spaces: Space[];
  supplies: CafeteriaSupply[];
  movements: CafeteriaMovement[];
  damages: DamageReport[];
  usersList: User[];
  onRefresh: () => Promise<void>;
}

const CAFETERIA_CATEGORIES = [
  'Bebidas e insumos de consumo',
  'Desechables y menaje',
  'Limpieza de cafetería',
  'Agua y botellones',
];

const CAFETERIA_LOCATIONS = [
  'Todos los cafetines / Bodega general',
  'Cafetín Piso 2',
  'Cafetín Piso 3',
  'Cafetín y Terrazas Piso 4',
  'Cafetín Piso 5',
  'Cafetín y Nevera Piso 6',
  'Cafetín y Terrazas Piso 7',
  'Cafetín Piso 8',
  'Cafetín Piso 9',
  'Cuarto de Cafetín Piso 10',
];

const CAFETERIA_PRESETS = [
  { itemName: 'Café molido institucional', category: 'Bebidas e insumos de consumo', unit: 'bolsas' },
  { itemName: 'Azúcar / endulzante', category: 'Bebidas e insumos de consumo', unit: 'kg' },
  { itemName: 'Aromáticas / té en sobres', category: 'Bebidas e insumos de consumo', unit: 'cajas' },
  { itemName: 'Vasos desechables / biodegradables', category: 'Desechables y menaje', unit: 'paquetes' },
  { itemName: 'Mezcladores / pitillos de madera', category: 'Desechables y menaje', unit: 'paquetes' },
  { itemName: 'Servilletas de papel', category: 'Desechables y menaje', unit: 'paquetes' },
  { itemName: 'Filtros para greca / cafetera', category: 'Desechables y menaje', unit: 'paquetes' },
  { itemName: 'Jabón lavaloza líquido', category: 'Limpieza de cafetería', unit: 'L' },
  { itemName: 'Esponjas / fibras de cocina', category: 'Limpieza de cafetería', unit: 'unidades' },
  { itemName: 'Botellón de agua purificada', category: 'Agua y botellones', unit: 'unidades' },
];

const DAMAGE_CATEGORIES = [
  'Equipo de cafetería',
  'Mobiliario y terrazas',
  'Plomería y baños',
  'Eléctrico e iluminación',
  'Vidrios, puertas y barandales',
  'Implementos y canecas de aseo',
];

const DAMAGE_ITEM_SUGGESTIONS = [
  'Greca eléctrica de café',
  'Horno microondas',
  'Nevera / refrigerador de cafetín',
  'Dispensador de agua fría/caliente',
  'Llave o grifo de lavaplatos',
  'Lavamanos / sanitario',
  'Toma eléctrica o interruptor',
  'Caneca de residuos / tapa',
  'Mesa o silla de terraza / cafetín',
  'Barandal de vidrio / pasamanos',
  'Puerta o cerradura',
];

const DAMAGE_SEVERITIES: DamageSeverity[] = ['Baja', 'Media', 'Alta', 'Urgente'];
const DAMAGE_STATUSES: DamageStatus[] = ['Reportado', 'En revisión', 'En reparación', 'Reparado'];

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function CafeteriaDamagesModule({
  user,
  floors,
  spaces,
  supplies,
  movements,
  damages,
  usersList,
  onRefresh,
}: CafeteriaDamagesModuleProps) {
  const [subTab, setSubTab] = useState<'supplies' | 'damages'>('supplies');
  const canManage = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR';
  const canOperate = canManage || user.role === 'PERSONAL DE ASEO';

  // Cafeteria supply filter & form
  const [supplyFilter, setSupplyFilter] = useState<'ALL' | 'AVAILABLE' | 'MISSING'>('ALL');
  const [supplySearch, setSupplySearch] = useState('');
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [editingSupply, setEditingSupply] = useState<CafeteriaSupply | null>(null);

  const [sName, setSName] = useState('');
  const [sCategory, setSCategory] = useState(CAFETERIA_CATEGORIES[0]);
  const [sLocation, setSLocation] = useState(CAFETERIA_LOCATIONS[0]);
  const [sUnit, setSUnit] = useState('unidades');
  const [sCurrentQty, setSCurrentQty] = useState<number>(0);
  const [sMinQty, setSMinQty] = useState<number>(2);
  const [sAssignedTo, setSAssignedTo] = useState('');
  const [sNotes, setSNotes] = useState('');

  // Quick move / assign modal inline
  const [movingSupply, setMovingSupply] = useState<CafeteriaSupply | null>(null);
  const [mType, setMType] = useState<'Asignación a cafetín' | 'Ingreso / Reposición'>('Asignación a cafetín');
  const [mQty, setMQty] = useState<number>(1);
  const [mLocation, setMLocation] = useState(CAFETERIA_LOCATIONS[1]);
  const [mAssignedBy, setMAssignedBy] = useState(user.fullName);
  const [mReceivedBy, setMReceivedBy] = useState('');
  const [mNotes, setMNotes] = useState('');

  // Damage report form state
  const [dDate, setDDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dTime, setDTime] = useState(() => currentTimeHHMM());
  const [dFloorId, setDFloorId] = useState<number>(floors[2]?.id || floors[1]?.id || floors[0]?.id || 1);
  const [dSpaceName, setDSpaceName] = useState('Cafetín');
  const [dItemDamaged, setDItemDamaged] = useState('');
  const [dCategory, setDCategory] = useState(DAMAGE_CATEGORIES[0]);
  const [dSeverity, setDSeverity] = useState<DamageSeverity>('Media');
  const [dDescription, setDDescription] = useState('');
  const [dReportedBy, setDReportedBy] = useState(user.fullName);
  const [dTechnician, setDTechnician] = useState('');
  const [dImageDataUrl, setDImageDataUrl] = useState<string>('');
  const [damageFilterStatus, setDamageFilterStatus] = useState<string>('TODOS');
  const [damageFilterFloor, setDamageFilterFloor] = useState<string>('TODOS');

  // Inline resolution editor
  const [editingDamageId, setEditingDamageId] = useState<number | null>(null);
  const [resStatus, setResStatus] = useState<DamageStatus>('En revisión');
  const [resTechnician, setResTechnician] = useState('');
  const [resNotes, setResNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const missingSupplies = supplies.filter((s) => s.currentQty <= s.minQty);
  const sufficientSupplies = supplies.filter((s) => s.currentQty > s.minQty);
  const visibleSupplies = supplies.filter((s) => {
    if (supplyFilter === 'MISSING' && s.currentQty > s.minQty) return false;
    if (supplyFilter === 'AVAILABLE' && s.currentQty <= 0) return false;
    const q = supplySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.itemName.toLowerCase().includes(q) ||
      s.cafeteriaLocation.toLowerCase().includes(q) ||
      s.assignedTo.toLowerCase().includes(q)
    );
  });

  const openDamages = damages.filter((d) => d.status !== 'Reparado');
  const urgentDamages = damages.filter(
    (d) => d.status !== 'Reparado' && (d.severity === 'Urgente' || d.severity === 'Alta')
  );
  const visibleDamages = damages.filter((d) => {
    if (damageFilterStatus !== 'TODOS' && d.status !== damageFilterStatus) return false;
    if (damageFilterFloor !== 'TODOS' && d.floorId !== Number(damageFilterFloor)) return false;
    return true;
  });

  const floorSpaces = spaces.filter((sp) => sp.floorId === dFloorId);

  function openNewSupply(preset?: { itemName: string; category: string; unit: string }) {
    setEditingSupply(null);
    setSName(preset?.itemName || '');
    setSCategory(preset?.category || CAFETERIA_CATEGORIES[0]);
    setSLocation(CAFETERIA_LOCATIONS[0]);
    setSUnit(preset?.unit || 'unidades');
    setSCurrentQty(0);
    setSMinQty(2);
    setSAssignedTo('');
    setSNotes('');
    setShowSupplyForm(true);
    setFeedback(null);
  }

  function openEditSupply(s: CafeteriaSupply) {
    setEditingSupply(s);
    setSName(s.itemName);
    setSCategory(s.category);
    setSLocation(s.cafeteriaLocation);
    setSUnit(s.unit);
    setSCurrentQty(s.currentQty);
    setSMinQty(s.minQty);
    setSAssignedTo(s.assignedTo);
    setSNotes(s.notes);
    setShowSupplyForm(true);
    setFeedback(null);
  }

  async function handleSaveSupply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const payload = {
      itemName: sName,
      category: sCategory,
      cafeteriaLocation: sLocation,
      unit: sUnit,
      currentQty: sCurrentQty,
      minQty: sMinQty,
      assignedTo: sAssignedTo,
      notes: sNotes,
    };
    try {
      if (editingSupply) {
        await apiFetch(`/api/cafeteria/supplies/${editingSupply.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: `Insumo "${sName}" actualizado.` });
      } else {
        await apiFetch('/api/cafeteria/supplies', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: `Insumo de cafetería "${sName}" registrado.` });
      }
      setShowSupplyForm(false);
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error guardando insumo de cafetería.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSupply(id: number) {
    try {
      await apiFetch(`/api/cafeteria/supplies/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: 'Insumo eliminado.' });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error eliminando insumo.',
      });
    }
  }

  function openMoveSupply(s: CafeteriaSupply, type: 'Asignación a cafetín' | 'Ingreso / Reposición') {
    setMovingSupply(s);
    setMType(type);
    setMQty(1);
    setMLocation(s.cafeteriaLocation === 'Todos los cafetines / Bodega general' ? 'Cafetín Piso 2' : s.cafeteriaLocation);
    setMAssignedBy(user.fullName);
    setMReceivedBy(s.assignedTo || '');
    setMNotes('');
    setFeedback(null);
  }

  async function handleExecuteMove(e: React.FormEvent) {
    e.preventDefault();
    if (!movingSupply) return;
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/cafeteria/supplies/${movingSupply.id}/move`, {
        method: 'POST',
        body: JSON.stringify({
          movementType: mType,
          quantity: mQty,
          cafeteriaLocation: mLocation,
          assignedBy: mAssignedBy,
          receivedBy: mReceivedBy,
          notes: mNotes,
        }),
      });
      setFeedback({
        type: 'ok',
        msg: `${mType} registrada para "${movingSupply.itemName}" (${mQty} ${movingSupply.unit}).`,
      });
      setMovingSupply(null);
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error registrando movimiento de cafetería.',
      });
    } finally {
      setBusy(false);
    }
  }

  function handleDamagePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDImageDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function handleSaveDamage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/damages', {
        method: 'POST',
        body: JSON.stringify({
          reportDate: dDate,
          reportTime: dTime,
          floorId: dFloorId,
          spaceName: dSpaceName,
          itemDamaged: dItemDamaged,
          category: dCategory,
          severity: dSeverity,
          description: dDescription,
          reportedBy: dReportedBy,
          assignedTechnician: dTechnician,
          imageDataUrl: dImageDataUrl || undefined,
        }),
      });
      setDItemDamaged('');
      setDDescription('');
      setDImageDataUrl('');
      setDTime(currentTimeHHMM());
      setFeedback({
        type: 'ok',
        msg: 'Reporte de daño guardado y notificado para seguimiento técnico.',
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error guardando reporte de daño.',
      });
    } finally {
      setBusy(false);
    }
  }

  function openDamageResolution(d: DamageReport) {
    setEditingDamageId(d.id);
    setResStatus((d.status as DamageStatus) || 'En revisión');
    setResTechnician(d.assignedTechnician || '');
    setResNotes(d.resolutionNotes || '');
  }

  async function saveDamageResolution(id: number) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/damages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: resStatus,
          assignedTechnician: resTechnician,
          resolutionNotes: resNotes,
        }),
      });
      setEditingDamageId(null);
      setFeedback({ type: 'ok', msg: 'Estado del daño actualizado.' });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error actualizando daño.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDamage(id: number) {
    try {
      await apiFetch(`/api/damages/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: 'Reporte de daño eliminado.' });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error eliminando reporte de daño.',
      });
    }
  }

  function exportSupplies(format: 'pdf' | 'xlsx') {
    const today = new Date().toISOString().slice(0, 10);
    const headers = [
      'Insumo',
      'Categoría',
      'Cafetín / Ubicación',
      'Qué hay (Actual)',
      'Mínimo requerido',
      'Qué falta',
      'Unidad',
      'Estado',
      'Asignado a',
    ];
    const rows = visibleSupplies.map((s) => {
      const missing = Math.max(0, Number((s.minQty - s.currentQty).toFixed(2)));
      const state = s.currentQty <= 0 ? 'Agotado' : s.currentQty <= s.minQty ? 'Por reponer' : 'Suficiente';
      return [
        s.itemName,
        s.category,
        s.cafeteriaLocation,
        s.currentQty,
        s.minQty,
        missing,
        s.unit,
        state,
        s.assignedTo || 'Sin asignar',
      ];
    });
    if (format === 'pdf') {
      exportToPdf(
        `Insumos_Cafeteria_CESGE_${today}.pdf`,
        'Control de Insumos de Cafetería – Qué Hay y Qué Falta',
        'CESGE Torre Norte – Cafetines y Terrazas',
        headers,
        rows
      );
    } else {
      exportToExcel(`Insumos_Cafeteria_CESGE_${today}.xlsx`, 'Insumos Cafetería', headers, rows);
    }
  }

  function exportDamages(format: 'pdf' | 'xlsx') {
    const today = new Date().toISOString().slice(0, 10);
    const headers = [
      'Fecha y Hora',
      'Piso',
      'Espacio / Cafetín',
      'Elemento dañado',
      'Categoría',
      'Severidad',
      'Descripción',
      'Reportado por',
      'Estado',
      'Responsable / Solución',
    ];
    const rows = visibleDamages.map((d) => [
      `${d.reportDate} ${d.reportTime}`,
      d.floorName || d.floorCode || '',
      d.spaceName,
      d.itemDamaged,
      d.category,
      d.severity,
      d.description,
      d.reportedBy,
      d.status,
      [d.assignedTechnician, d.resolutionNotes].filter(Boolean).join(' · ') || 'Pendiente',
    ]);
    if (format === 'pdf') {
      exportToPdf(
        `Reporte_Danos_CESGE_${today}.pdf`,
        'Reporte de Daños y Averías – Cafetines e Infraestructura',
        'CESGE Torre Norte',
        headers,
        rows
      );
    } else {
      exportToExcel(`Reporte_Danos_CESGE_${today}.xlsx`, 'Reporte de Daños', headers, rows);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Insumos de Cafetería (Qué Hay / Qué Falta) y Reporte de Daños
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Asigne y controle insumos en los cafetines de la Torre Norte, identifique faltantes y reporte equipos o elementos dañados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubTab('damages');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            Reportar Algo Dañado ({openDamages.length} abiertos)
          </button>
          {canOperate && (
            <button
              type="button"
              onClick={() => {
                setSubTab('supplies');
                openNewSupply();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Insumo de Cafetería
            </button>
          )}
        </div>
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

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubTab('supplies')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'supplies' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          Insumos de Cafetería: Qué Hay y Qué Falta ({supplies.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('damages')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'damages' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Reporte de Daños y Averías ({damages.length})
        </button>
      </div>

      {/* ========================================= */}
      {/* TAB 1: CAFETERIA SUPPLIES                 */}
      {/* ========================================= */}
      {subTab === 'supplies' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Insumos registrados</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {supplies.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Con stock suficiente</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
                {sufficientSupplies.length}
              </div>
            </div>
            <div className="bg-white border border-amber-300 rounded-xl p-4">
              <div className="text-xs text-amber-800 font-semibold">Insumos que faltan / por reponer</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                {missingSupplies.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Asignaciones / reposiciones</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-800 mt-1">
                {movements.length}
              </div>
            </div>
          </div>

          {canOperate && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Acceso rápido para registrar insumos frecuentes de cafetería:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CAFETERIA_PRESETS.map((preset) => (
                  <button
                    key={preset.itemName}
                    type="button"
                    onClick={() => openNewSupply(preset)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 rounded-md"
                  >
                    <Plus className="w-3 h-3" /> {preset.itemName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSupplyForm && (
            <form onSubmit={handleSaveSupply} className="bg-white border border-blue-300 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSupply
                  ? `Editar insumo: ${editingSupply.itemName}`
                  : 'Registrar Insumo de Cafetería'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Insumo *</label>
                  <input
                    required
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    placeholder="Ej. Café molido, azúcar, vasos..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={sCategory}
                    onChange={(e) => setSCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {CAFETERIA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cafetín / Ubicación</label>
                  <select
                    value={sLocation}
                    onChange={(e) => setSLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {CAFETERIA_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unidad</label>
                  <select
                    value={sUnit}
                    onChange={(e) => setSUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="unidades">unidades</option>
                    <option value="paquetes">paquetes</option>
                    <option value="cajas">cajas</option>
                    <option value="bolsas">bolsas</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cantidad actual (qué hay) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={sCurrentQty}
                    onChange={(e) => setSCurrentQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cantidad mínima (para alertar qué falta) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={sMinQty}
                    onChange={(e) => setSMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Responsable asignado
                  </label>
                  <input
                    list="cafeteria-users-list"
                    value={sAssignedTo}
                    onChange={(e) => setSAssignedTo(e.target.value)}
                    placeholder="Nombre del encargado"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <datalist id="cafeteria-users-list">
                    {usersList.map((u) => (
                      <option key={u.id} value={u.fullName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observaciones</label>
                  <input
                    value={sNotes}
                    onChange={(e) => setSNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplyForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Insumo
                </button>
              </div>
            </form>
          )}

          {movingSupply && (
            <form onSubmit={handleExecuteMove} className="bg-amber-50/70 border border-amber-300 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-700" />
                  {mType}: {movingSupply.itemName} (Disponible actual: {movingSupply.currentQty} {movingSupply.unit})
                </h4>
                <button
                  type="button"
                  onClick={() => setMovingSupply(null)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Movimiento</label>
                  <select
                    value={mType}
                    onChange={(e) =>
                      setMType(e.target.value as 'Asignación a cafetín' | 'Ingreso / Reposición')
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Asignación a cafetín">Asignación a cafetín (descuenta)</option>
                    <option value="Ingreso / Reposición">Ingreso / Reposición (suma)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cantidad ({movingSupply.unit}) *
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step="0.5"
                    required
                    value={mQty}
                    onChange={(e) => setMQty(Number(e.target.value))}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cafetín destino</label>
                  <select
                    value={mLocation}
                    onChange={(e) => setMLocation(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {CAFETERIA_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quién asigna</label>
                  <input
                    required
                    value={mAssignedBy}
                    onChange={(e) => setMAssignedBy(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quién recibe / responsable</label>
                  <input
                    list="cafeteria-users-list"
                    value={mReceivedBy}
                    onChange={(e) => setMReceivedBy(e.target.value)}
                    placeholder="Nombre del encargado"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
                <input
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
                  placeholder="Nota de entrega o reposición..."
                  className="w-full sm:flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" /> Confirmar Movimiento
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSupplyFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold border ${
                    supplyFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Todos ({supplies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSupplyFilter('MISSING')}
                  className={`px-3 py-1.5 rounded-lg font-semibold border ${
                    supplyFilter === 'MISSING'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  Qué Falta ({missingSupplies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSupplyFilter('AVAILABLE')}
                  className={`px-3 py-1.5 rounded-lg font-semibold border ${
                    supplyFilter === 'AVAILABLE'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  Qué Hay Disponible ({supplies.filter((s) => s.currentQty > 0).length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={supplySearch}
                  onChange={(e) => setSupplySearch(e.target.value)}
                  placeholder="Buscar insumo o cafetín..."
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-48"
                />
                <button
                  type="button"
                  onClick={() => exportSupplies('pdf')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportSupplies('xlsx')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>

            {visibleSupplies.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No hay insumos de cafetería registrados para este filtro. Use los botones rápidos superiores o «Nuevo Insumo de Cafetería».
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Insumo / Categoría</th>
                      <th className="py-2.5 px-3">Cafetín / Ubicación</th>
                      <th className="py-2.5 px-3 text-right">Qué hay</th>
                      <th className="py-2.5 px-3 text-right">Mínimo</th>
                      <th className="py-2.5 px-3 text-right">Qué falta</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Asignado a</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleSupplies.map((s) => {
                      const missingQty = Math.max(0, Number((s.minQty - s.currentQty).toFixed(2)));
                      const isOut = s.currentQty <= 0;
                      const isLow = s.currentQty <= s.minQty;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{s.itemName}</div>
                            <div className="text-[11px] text-slate-500">{s.category}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{s.cafeteriaLocation}</td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                              isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-800'
                            }`}
                          >
                            {s.currentQty} {s.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                            {s.minQty} {s.unit}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                              missingQty > 0 ? 'text-red-700' : 'text-slate-400'
                            }`}
                          >
                            {missingQty > 0 ? `${missingQty} ${s.unit}` : '0'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isOut ? (
                              <span className="font-semibold text-red-700">Agotado</span>
                            ) : isLow ? (
                              <span className="font-semibold text-amber-700">Por reponer</span>
                            ) : (
                              <span className="font-semibold text-emerald-700">Suficiente</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <div>{s.assignedTo || 'Sin asignar'}</div>
                            {s.lastAssignedAt && (
                              <div className="text-[10px] font-mono text-slate-400">{s.lastAssignedAt}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-1">
                            {canOperate && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openMoveSupply(s, 'Asignación a cafetín')}
                                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                                >
                                  Asignar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openMoveSupply(s, 'Ingreso / Reposición')}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded"
                                >
                                  Reponer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditSupply(s)}
                                  className="p-1 text-slate-500 hover:text-blue-700"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSupply(s.id)}
                                className="p-1 text-slate-500 hover:text-red-700"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {movements.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-900">
                Historial de Asignaciones y Reposiciones de Cafetería
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Fecha y Hora</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Insumo</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3">Cafetín</th>
                      <th className="py-2 px-3">Asignado por / Recibido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.slice(0, 25).map((m) => (
                      <tr key={m.id}>
                        <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                          {m.movementDate} {m.movementTime}
                        </td>
                        <td className="py-2 px-3 font-semibold text-blue-800">{m.movementType}</td>
                        <td className="py-2 px-3 font-semibold">{m.itemName}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {m.quantity} {m.unit}
                        </td>
                        <td className="py-2 px-3">{m.cafeteriaLocation}</td>
                        <td className="py-2 px-3">
                          {m.assignedBy} {m.receivedBy ? `→ ${m.receivedBy}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 2: DAMAGE REPORTS                     */}
      {/* ========================================= */}
      {subTab === 'damages' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total daños reportados</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {damages.length}
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-4">
              <div className="text-xs text-red-700 font-semibold">Daños abiertos / pendientes</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                {openDamages.length}
              </div>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-4">
              <div className="text-xs text-amber-800">Prioridad Alta / Urgente</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-1">
                {urgentDamages.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Reparados / cerrados</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
                {damages.filter((d) => d.status === 'Reparado').length}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveDamage} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              Reportar Elemento o Equipo Dañado (Cafetería o Infraestructura)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={dDate}
                  onChange={(e) => setDDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hora *</label>
                <input
                  type="time"
                  required
                  value={dTime}
                  onChange={(e) => setDTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Piso / Nivel *</label>
                <select
                  value={dFloorId}
                  onChange={(e) => setDFloorId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Espacio / Cafetín / Zona *
                </label>
                <input
                  required
                  list="damage-floor-spaces"
                  value={dSpaceName}
                  onChange={(e) => setDSpaceName(e.target.value)}
                  placeholder="Ej. Cafetín Piso 6, Terraza derecha..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <datalist id="damage-floor-spaces">
                  <option value="Cafetín del piso" />
                  <option value="Baños del piso" />
                  {floorSpaces.map((sp) => (
                    <option key={sp.id} value={sp.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ¿Qué se dañó? *
                </label>
                <input
                  required
                  list="damage-item-suggestions"
                  value={dItemDamaged}
                  onChange={(e) => setDItemDamaged(e.target.value)}
                  placeholder="Ej. Greca, microondas, llave, nevera..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <datalist id="damage-item-suggestions">
                  {DAMAGE_ITEM_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  value={dCategory}
                  onChange={(e) => setDCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {DAMAGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Severidad</label>
                <select
                  value={dSeverity}
                  onChange={(e) => setDSeverity(e.target.value as DamageSeverity)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {DAMAGE_SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>
                      {sev}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quién reporta *</label>
                <input
                  required
                  value={dReportedBy}
                  onChange={(e) => setDReportedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs items-end">
              <div className="lg:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción detallada del daño o falla *
                </label>
                <input
                  required
                  value={dDescription}
                  onChange={(e) => setDDescription(e.target.value)}
                  placeholder="Explique qué falló, si hay fuga, riesgo eléctrico o si requiere reemplazo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Responsable / Técnico sugerido (opcional)
                </label>
                <input
                  value={dTechnician}
                  onChange={(e) => setDTechnician(e.target.value)}
                  placeholder="Ej. Mantenimiento CESGE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100">
                <Camera className="w-4 h-4 text-blue-700" />
                {dImageDataUrl ? 'Foto adjuntada (clic para cambiar)' : 'Adjuntar foto del daño (opcional)'}
                <input type="file" accept="image/*" onChange={handleDamagePhotoSelect} className="hidden" />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Registrar Reporte de Daño
              </button>
            </div>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-900">Seguimiento de Daños Reportados</h4>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={damageFilterFloor}
                  onChange={(e) => setDamageFilterFloor(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TODOS">Todos los pisos</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={damageFilterStatus}
                  onChange={(e) => setDamageFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TODOS">Todos los estados</option>
                  {DAMAGE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => exportDamages('pdf')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportDamages('xlsx')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>

            {visibleDamages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No hay reportes de daños registrados para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleDamages.map((d) => {
                  const isEditing = editingDamageId === d.id;
                  const isClosed = d.status === 'Reparado';
                  return (
                    <div
                      key={d.id}
                      className={`p-4 rounded-xl border space-y-2 text-xs ${
                        isClosed
                          ? 'bg-slate-50/70 border-slate-200'
                          : d.severity === 'Urgente' || d.severity === 'Alta'
                          ? 'bg-red-50/40 border-red-200'
                          : 'bg-white border-amber-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{d.itemDamaged}</span>
                            <span className="font-semibold text-blue-800">· {d.category}</span>
                            <span
                              className={`font-semibold ${
                                d.severity === 'Urgente' || d.severity === 'Alta'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              · Severidad: {d.severity}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            {d.floorName} ({d.spaceName}) · Reportado el{' '}
                            <span className="font-mono tabular-nums">
                              {d.reportDate} {d.reportTime}
                            </span>{' '}
                            por <strong>{d.reportedBy}</strong>
                          </div>
                          <p className="text-slate-800">{d.description}</p>
                          {(d.assignedTechnician || d.resolutionNotes) && (
                            <div className="text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 mt-1">
                              <strong>Seguimiento:</strong> {d.assignedTechnician || 'Sin técnico'}{' '}
                              {d.resolutionNotes ? `— ${d.resolutionNotes}` : ''}
                              {d.resolvedAt ? ` (Solucionado: ${d.resolvedAt})` : ''}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isClosed ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isClosed ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            {d.status}
                          </span>
                          {canOperate && (
                            <button
                              type="button"
                              onClick={() => openDamageResolution(d)}
                              className="px-2.5 py-1 font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md"
                            >
                              Actualizar estado
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDamage(d.id)}
                              className="p-1.5 text-slate-400 hover:text-red-700"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {d.imageUrl && (
                        <div>
                          <img
                            src={d.imageUrl}
                            alt={d.itemDamaged}
                            className="max-h-40 rounded-lg border border-slate-200 object-cover"
                          />
                        </div>
                      )}

                      {isEditing && (
                        <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Estado</label>
                            <select
                              value={resStatus}
                              onChange={(e) => setResStatus(e.target.value as DamageStatus)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                            >
                              {DAMAGE_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Técnico / Encargado
                            </label>
                            <input
                              value={resTechnician}
                              onChange={(e) => setResTechnician(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Notas de reparación
                            </label>
                            <input
                              value={resNotes}
                              onChange={(e) => setResNotes(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingDamageId(null)}
                              className="px-2.5 py-1.5 bg-slate-100 rounded-md"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => saveDamageResolution(d.id)}
                              className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded-md"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
