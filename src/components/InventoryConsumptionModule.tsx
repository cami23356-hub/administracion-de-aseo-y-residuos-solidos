import React, { useState } from 'react';
import {
  FlaskConical,
  Upload,
  Download,
  Plus,
  Save,
  Trash2,
  Edit3,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  HardHat,
  CheckCircle2,
  FileDown,
  Search,
} from 'lucide-react';
import {
  ConsumptionRecord,
  DeliveryCategory,
  DeliveryItem,
  EquipmentDelivery,
  Floor,
  ProductCategory,
  ProductItem,
  ShiftConfig,
  UsageScope,
  User,
} from '../types/cesge';
import { apiFetch } from '../utils/api';
import {
  downloadSstFr96Template,
  exportToExcel,
  exportToPdf,
  parseExcelFile,
} from '../utils/exporters';

interface InventoryConsumptionModuleProps {
  user: User;
  floors: Floor[];
  shifts: ShiftConfig[];
  products: ProductItem[];
  consumptions: ConsumptionRecord[];
  deliveries: EquipmentDelivery[];
  usersList: User[];
  onRefresh: () => Promise<void>;
}

const CATEGORIES: ProductCategory[] = [
  'Detergentes',
  'Desinfectantes',
  'Desengrasantes',
  'Limpiavidrios',
  'Productos para baños',
  'Productos para pisos',
  'Productos para superficies',
  'Productos para cafeterines',
  'Bolsas para residuos',
  'Escobas',
  'Traperos',
  'Cepillos',
  'Guantes',
  'Paños de microfibra',
  'Señalización de piso mojado',
  'EPP (Protección personal)',
  'Uniformes y dotación',
  'Otros elementos de limpieza',
];

const USAGE_SCOPES: UsageScope[] = [
  'Operativo',
  'Administración',
  'Ambientes con cómputo',
  'Ambientes sin cómputo',
  'Ambientes con televisores',
  'Ambientes sin televisores',
];

const UNITS: Array<ProductItem['unit']> = ['mL', 'L', 'g', 'kg', 'unidades'];

const DELIVERY_TYPES: DeliveryCategory[] = [
  'EPP',
  'Uniformes',
  'Artículos de aseo',
  'Dotación Completa',
];

const DELIVERY_SUGGESTIONS: Record<DeliveryItem['category'], string[]> = {
  EPP: [
    'Guantes de nitrilo',
    'Guantes de caucho calibre industrial',
    'Tapabocas N95 / respirador particulado',
    'Mascarilla quirúrgica desechable',
    'Gafas de seguridad antiempañantes',
    'Careta de protección facial',
    'Botas / calzado antideslizante impermeable',
    'Delantal impermeable PVC',
    'Protección auditiva',
  ],
  Uniformes: [
    'Camisa polo institucional',
    'Camisa manga larga dotación',
    'Pantalón antifluido operativo',
    'Bata / blusa de servicio',
    'Overol de trabajo',
    'Chaqueta impermeable / cortavientos',
    'Calzado reglamentario antideslizante',
    'Gorra / cofia institucional',
  ],
  'Artículos de aseo': [
    'Escoba industrial de cerda dura',
    'Escoba suave para interiores',
    'Trapero de microfibra',
    'Trapero tradicional',
    'Recogedor metálico / plástico con cabo',
    'Balde escurridor con ruedas',
    'Paños de microfibra codificados por color',
    'Atomizador rotulado SGA',
    'Cepillo sanitario / escobillón',
    'Chupa / destapador sanitario',
    'Aviso de señalización piso mojado',
    'Rollo de bolsas blancas (aprovechables)',
    'Rollo de bolsas negras (no aprovechables)',
    'Rollo de bolsas verdes (orgánicos)',
  ],
};

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function InventoryConsumptionModule({
  user,
  floors,
  shifts,
  products,
  consumptions,
  deliveries,
  usersList,
  onRefresh,
}: InventoryConsumptionModuleProps) {
  const [subTab, setSubTab] = useState<'inventory' | 'consumption' | 'deliveries' | 'replenishment'>('inventory');
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingProd, setEditingProd] = useState<ProductItem | null>(null);
  const [filterScope, setFilterScope] = useState<string>('TODOS');
  const [filterCategory, setFilterCategory] = useState<string>('TODAS');

  // Product form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [usageScope, setUsageScope] = useState<string>(USAGE_SCOPES[0]);
  const [brand, setBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [specificUse, setSpecificUse] = useState('');
  const [presentation, setPresentation] = useState('');
  const [unit, setUnit] = useState<ProductItem['unit']>('L');
  const [availableQty, setAvailableQty] = useState<number>(0);
  const [minQty, setMinQty] = useState<number>(5);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [expirationDate, setExpirationDate] = useState('');
  const [lot, setLot] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [safetySheetRef, setSafetySheetRef] = useState('');
  const [hazardClassification, setHazardClassification] = useState('');
  const [handlingRecommendations, setHandlingRecommendations] = useState('');
  const [requiredEpp, setRequiredEpp] = useState('');

  // Consumption form state
  const [cDate, setCDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cShift, setCShift] = useState('Jornada de la mañana');
  const [cFloor, setCFloor] = useState(floors[1]?.code || 'PISO-01');
  const [cArea, setCArea] = useState('');
  const [cActivity, setCActivity] = useState('Limpieza general');
  const [cResponsible, setCResponsible] = useState(user.fullName);
  const [cProductId, setCProductId] = useState<string>('');
  const [cQty, setCQty] = useState<number>(1);
  const [cFdsVerified, setCFdsVerified] = useState(false);
  const [cNotes, setCNotes] = useState('');

  // Delivery of Dotación, EPP, Uniforms & Cleaning Supplies state
  const [dDate, setDDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dTime, setDTime] = useState(() => currentTimeHHMM());
  const [dType, setDType] = useState<DeliveryCategory>('Dotación Completa');
  const [dDeliveredBy, setDDeliveredBy] = useState(user.fullName);
  const [dDeliveredByRole, setDDeliveredByRole] = useState<string>(user.role);
  const [dDeliveredTo, setDDeliveredTo] = useState('');
  const [dRecipientRole, setDRecipientRole] = useState('PERSONAL DE ASEO');
  const [dShift, setDShift] = useState('Jornada de la mañana');
  const [dCondition, setDCondition] = useState('Dotación inicial / reglamentaria');
  const [dReceivedConfirmed, setDReceivedConfirmed] = useState(true);
  const [dObservations, setDObservations] = useState('');
  const [dItems, setDItems] = useState<DeliveryItem[]>([
    {
      itemName: 'Guantes de nitrilo',
      category: 'EPP',
      quantity: 1,
      unit: 'pares',
      sizeOrSpec: 'Talla M',
      productId: null,
      deductStock: false,
    },
  ]);
  const [deliveryFilterType, setDeliveryFilterType] = useState<string>('TODOS');
  const [deliverySearch, setDeliverySearch] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canManageInventory = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR';
  const canLogConsumption = canManageInventory || user.role === 'PERSONAL DE ASEO';

  function openNewProduct() {
    setEditingProd(null);
    setName('');
    setCategory(CATEGORIES[0]);
    setUsageScope(USAGE_SCOPES[0]);
    setBrand('');
    setSupplier('');
    setSpecificUse('');
    setPresentation('');
    setUnit('L');
    setAvailableQty(0);
    setMinQty(5);
    setUnitPrice(0);
    setExpirationDate('');
    setLot('');
    setStorageLocation('Cuarto de almacenamiento Sótano');
    setSafetySheetRef('');
    setHazardClassification('');
    setHandlingRecommendations('');
    setRequiredEpp('');
    setShowProdForm(true);
    setFeedback(null);
  }

  function openEditProduct(p: ProductItem) {
    setEditingProd(p);
    setName(p.name);
    setCategory(p.category);
    setUsageScope(p.usageScope);
    setBrand(p.brand);
    setSupplier(p.supplier);
    setSpecificUse(p.specificUse);
    setPresentation(p.presentation);
    setUnit(p.unit);
    setAvailableQty(p.availableQty);
    setMinQty(p.minQty);
    setUnitPrice(p.unitPrice);
    setExpirationDate(p.expirationDate);
    setLot(p.lot);
    setStorageLocation(p.storageLocation);
    setSafetySheetRef(p.safetySheetRef);
    setHazardClassification(p.hazardClassification);
    setHandlingRecommendations(p.handlingRecommendations);
    setRequiredEpp(p.requiredEpp);
    setShowProdForm(true);
    setFeedback(null);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const payload = {
      name,
      category,
      usageScope,
      brand,
      supplier,
      specificUse,
      presentation,
      unit,
      availableQty,
      minQty,
      unitPrice,
      expirationDate,
      lot,
      storageLocation,
      safetySheetRef,
      hazardClassification,
      handlingRecommendations,
      requiredEpp,
    };
    try {
      if (editingProd) {
        await apiFetch(`/api/products/${editingProd.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: `Producto "${name}" actualizado y guardado correctamente.` });
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: `Producto "${name}" registrado en inventario.` });
      }
      setShowProdForm(false);
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando producto.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProduct(id: number) {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error eliminando producto.' });
    }
  }

  async function handleImportSstFr96(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const raw = await parseExcelFile(file);
      const items = raw.map((r) => ({
        name: String(
          r['Nombre del producto'] ??
            r['Producto'] ??
            r['Sustancia Química'] ??
            r['NOMBRE DEL PRODUCTO'] ??
            r['Sustancia'] ??
            ''
        ).trim(),
        category: String(r['Categoría'] ?? r['Categoria'] ?? 'Otros elementos de limpieza').trim(),
        usageScope: String(r['Clasificación de uso'] ?? r['Uso'] ?? 'Operativo').trim(),
        brand: String(r['Marca'] ?? '').trim(),
        supplier: String(r['Fabricante o proveedor'] ?? r['Proveedor'] ?? r['Fabricante'] ?? '').trim(),
        specificUse: String(r['Uso específico'] ?? r['Uso especifico'] ?? '').trim(),
        presentation: String(r['Presentación'] ?? r['Presentacion'] ?? '').trim(),
        unit: String(r['Unidad de medida'] ?? r['Unidad'] ?? 'unidades').trim(),
        availableQty: Number(r['Cantidad disponible'] ?? r['Cantidad'] ?? 0) || 0,
        minQty: Number(r['Cantidad mínima'] ?? r['Minimo'] ?? 0) || 0,
        unitPrice: Number(r['Precio unitario'] ?? r['Precio'] ?? 0) || 0,
        expirationDate: String(r['Fecha de vencimiento'] ?? r['Vencimiento'] ?? '').trim(),
        lot: String(r['Lote'] ?? '').trim(),
        storageLocation: String(r['Ubicación de almacenamiento'] ?? r['Ubicacion'] ?? '').trim(),
        safetySheetRef: String(r['Ficha de datos de seguridad'] ?? r['FDS'] ?? '').trim(),
        hazardClassification: String(
          r['Clasificación de peligros SGA'] ?? r['Clasificación de peligros'] ?? r['SGA'] ?? ''
        ).trim(),
        handlingRecommendations: String(
          r['Recomendaciones de manipulación'] ?? r['Manipulación'] ?? ''
        ).trim(),
        requiredEpp: String(
          r['Elementos de protección personal requeridos'] ?? r['EPP'] ?? ''
        ).trim(),
      }));
      const res = await apiFetch<{ imported: number; skipped: number }>('/api/products/import-sst-fr-96', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      setFeedback({
        type: 'ok',
        msg: `Archivo SST-FR-96 importado: ${res.imported} productos registrados sin alterar composiciones químicas, ${res.skipped} omitidos/duplicados.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error leyendo archivo Excel SST-FR-96.' });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handleLogConsumption(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ id: number; calculatedCost: number }>('/api/consumptions', {
        method: 'POST',
        body: JSON.stringify({
          date: cDate,
          shiftName: cShift,
          floorCode: cFloor,
          areaName: cArea,
          activity: cActivity,
          responsible: cResponsible,
          productId: Number(cProductId),
          quantity: Number(cQty),
          fdsVerified: cFdsVerified,
          notes: cNotes,
        }),
      });
      setFeedback({
        type: 'ok',
        msg: `Consumo registrado y descontado del inventario (Costo calculado: $${res.calculatedCost.toLocaleString('es-CO')}).`,
      });
      setCArea('');
      setCNotes('');
      setCFdsVerified(false);
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error registrando consumo.' });
    } finally {
      setBusy(false);
    }
  }

  function addDeliveryRow(cat: DeliveryItem['category']) {
    const defaultName =
      cat === 'EPP'
        ? 'Tapabocas N95 / respirador particulado'
        : cat === 'Uniformes'
        ? 'Camisa polo institucional'
        : 'Escoba industrial de cerda dura';
    const defaultUnit = cat === 'Uniformes' ? 'unidades' : cat === 'EPP' ? 'pares' : 'unidades';
    const defaultSpec = cat === 'Uniformes' ? 'Talla M' : '';
    setDItems((prev) => [
      ...prev,
      {
        itemName: defaultName,
        category: cat,
        quantity: 1,
        unit: defaultUnit,
        sizeOrSpec: defaultSpec,
        productId: null,
        deductStock: false,
      },
    ]);
  }

  function updateDeliveryRow(idx: number, patch: Partial<DeliveryItem>) {
    setDItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function removeDeliveryRow(idx: number) {
    setDItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function handleRecipientChange(value: string) {
    setDDeliveredTo(value);
    const matched = usersList.find(
      (u) => u.fullName.toLowerCase() === value.trim().toLowerCase()
    );
    if (matched) {
      setDRecipientRole(matched.role);
      if (matched.shiftPreference && matched.shiftPreference !== 'Todas') {
        setDShift(matched.shiftPreference);
      }
    }
  }

  function handleDelivererChange(value: string) {
    setDDeliveredBy(value);
    const matched = usersList.find(
      (u) => u.fullName.toLowerCase() === value.trim().toLowerCase()
    );
    if (matched) {
      setDDeliveredByRole(matched.role);
    }
  }

  async function handleSaveDelivery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch<{ id: number }>('/api/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          deliveryDate: dDate,
          deliveryTime: dTime,
          deliveryType: dType,
          deliveredBy: dDeliveredBy,
          deliveredByRole: dDeliveredByRole,
          deliveredTo: dDeliveredTo,
          recipientRole: dRecipientRole,
          shiftName: dShift,
          conditionNote: dCondition,
          receivedConfirmed: dReceivedConfirmed,
          observations: dObservations,
          items: dItems,
        }),
      });
      setFeedback({
        type: 'ok',
        msg: `Entrega de ${dType} registrada el ${dDate} a las ${dTime} por ${dDeliveredBy} para ${dDeliveredTo}.`,
      });
      setDDeliveredTo('');
      setDObservations('');
      setDTime(currentTimeHHMM());
      setDItems([
        {
          itemName: 'Guantes de nitrilo',
          category: 'EPP',
          quantity: 1,
          unit: 'pares',
          sizeOrSpec: 'Talla M',
          productId: null,
          deductStock: false,
        },
      ]);
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error registrando entrega de dotación.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleDeliveryConfirm(delivery: EquipmentDelivery) {
    try {
      await apiFetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        body: JSON.stringify({ receivedConfirmed: delivery.receivedConfirmed ? 0 : 1 }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error actualizando confirmación.',
      });
    }
  }

  async function handleDeleteDelivery(id: number) {
    try {
      await apiFetch(`/api/deliveries/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: 'Registro de entrega eliminado.' });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error eliminando registro de entrega.',
      });
    }
  }

  function exportSingleDeliveryPdf(d: EquipmentDelivery) {
    exportToPdf(
      `Acta_Entrega_Dotacion_${d.id}_${d.deliveryDate}.pdf`,
      `Acta de Entrega de Dotación, EPP y Aseo #${d.id}`,
      `Fecha: ${d.deliveryDate} · Hora: ${d.deliveryTime} | Entrega: ${d.deliveredBy} (${d.deliveredByRole || 'N/A'}) -> Recibe: ${d.deliveredTo} (${d.recipientRole || 'N/A'})`,
      ['Categoría', 'Elemento entregado', 'Cantidad', 'Unidad', 'Talla / Especificación'],
      d.items.map((it) => [it.category, it.itemName, it.quantity, it.unit, it.sizeOrSpec || 'Estándar'])
    );
  }

  function exportDeliveriesTable(format: 'pdf' | 'xlsx') {
    const today = new Date().toISOString().slice(0, 10);
    const headers = [
      'Fecha',
      'Hora',
      'Tipo',
      'Quién entrega',
      'A quién fue entregado',
      'Jornada',
      'Elementos entregados',
      'Motivo',
      'Recibido conforme',
      'Observaciones',
    ];
    const rows = filteredDeliveries.map((d) => [
      d.deliveryDate,
      d.deliveryTime,
      d.deliveryType,
      `${d.deliveredBy}${d.deliveredByRole ? ` (${d.deliveredByRole})` : ''}`,
      `${d.deliveredTo}${d.recipientRole ? ` (${d.recipientRole})` : ''}`,
      d.shiftName || 'N/A',
      d.items
        .map((it) => `${it.quantity} ${it.unit} ${it.itemName}${it.sizeOrSpec ? ` [${it.sizeOrSpec}]` : ''}`)
        .join(' | '),
      d.conditionNote || '',
      d.receivedConfirmed ? 'Sí' : 'Pendiente',
      d.observations || '',
    ]);
    if (format === 'pdf') {
      exportToPdf(
        `Entregas_Dotacion_EPP_CESGE_${today}.pdf`,
        'Control de Entrega de Dotación, EPP, Uniformes y Artículos de Aseo',
        'CESGE Torre Norte – Trazabilidad de entregas por fecha, hora, remitente y destinatario',
        headers,
        rows
      );
    } else {
      exportToExcel(`Entregas_Dotacion_EPP_CESGE_${today}.xlsx`, 'Entregas Dotación', headers, rows);
    }
  }

  const filteredProducts = products.filter((p) => {
    if (filterScope !== 'TODOS' && p.usageScope !== filterScope) return false;
    if (filterCategory !== 'TODAS' && p.category !== filterCategory) return false;
    return true;
  });

  // Consumption aggregations
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const dailyConsumptions = consumptions.filter((c) => c.date === todayStr);
  const monthlyConsumptions = consumptions.filter((c) => c.monthKey === currentMonthStr);
  const totalMonthlyCost = monthlyConsumptions.reduce((acc, c) => acc + c.calculatedCost, 0);

  const byFloorTotals = floors
    .map((fl) => ({
      floorName: fl.name,
      count: consumptions.filter((c) => c.floorCode === fl.code).length,
      cost: consumptions
        .filter((c) => c.floorCode === fl.code)
        .reduce((acc, c) => acc + c.calculatedCost, 0),
    }))
    .filter((x) => x.count > 0);

  const byShiftTotals = shifts.map((sh) => ({
    shiftName: sh.name,
    count: consumptions.filter((c) => c.shiftName === sh.name).length,
    cost: consumptions
      .filter((c) => c.shiftName === sh.name)
      .reduce((acc, c) => acc + c.calculatedCost, 0),
  }));

  const lowStock = products.filter((p) => p.availableQty <= p.minQty);
  const expiringSoon = products.filter((p) => {
    if (!p.expirationDate) return false;
    const days = (new Date(p.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  });

  const filteredDeliveries = deliveries.filter((d) => {
    if (deliveryFilterType !== 'TODOS' && d.deliveryType !== deliveryFilterType) return false;
    const q = deliverySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      d.deliveredBy.toLowerCase().includes(q) ||
      d.deliveredTo.toLowerCase().includes(q) ||
      d.deliveryType.toLowerCase().includes(q) ||
      d.items.some((it) => it.itemName.toLowerCase().includes(q))
    );
  });

  const eppDeliveriesCount = deliveries.filter(
    (d) => d.deliveryType === 'EPP' || d.items.some((it) => it.category === 'EPP')
  ).length;
  const uniformDeliveriesCount = deliveries.filter(
    (d) => d.deliveryType === 'Uniformes' || d.items.some((it) => it.category === 'Uniformes')
  ).length;
  const suppliesDeliveriesCount = deliveries.filter(
    (d) => d.deliveryType === 'Artículos de aseo' || d.items.some((it) => it.category === 'Artículos de aseo')
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Inventario Químico (SST-FR-96), Consumo y Entrega de Dotación / EPP / Uniformes
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Control por categoría, alcance, FDS, SGA, reposición y acta trazable de entrega de EPP, uniformes y artículos de aseo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('deliveries')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg whitespace-nowrap"
          >
            <HardHat className="w-3.5 h-3.5" />
            Entregas de Dotación y EPP ({deliveries.length})
          </button>
          <button
            type="button"
            onClick={downloadSstFr96Template}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Plantilla SST-FR-96
          </button>
          {canManageInventory && (
            <>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Importar Excel SST-FR-96
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportSstFr96} className="hidden" />
              </label>
              <button
                type="button"
                onClick={openNewProduct}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo Producto
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        <span>
          <strong>Regla obligatoria de seguridad química:</strong> No establezca cantidades de dilución o dosificación sin consultar previamente la{' '}
          <strong>Ficha Técnica y la Ficha de Datos de Seguridad (FDS)</strong> del fabricante.
        </span>
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
          onClick={() => setSubTab('inventory')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Inventario General ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('consumption')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'consumption' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Volumen y Consumo ({consumptions.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('deliveries')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'deliveries' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Entrega de Dotación, EPP y Uniformes ({deliveries.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('replenishment')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'replenishment' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Qué Hay / Qué Falta ({lowStock.length + expiringSoon.length})
        </button>
      </div>

      {showProdForm && (
        <form onSubmit={handleSaveProduct} className="bg-white border border-blue-300 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            {editingProd ? `Editar producto: ${editingProd.name}` : 'Registrar Producto Químico o Insumo'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nombre del producto *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Categoría *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clasificación de uso *</label>
              <select value={usageScope} onChange={(e) => setUsageScope(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {USAGE_SCOPES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Marca</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fabricante / Proveedor</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Presentación</label>
              <input value={presentation} onChange={(e) => setPresentation(e.target.value)} placeholder="Ej. Galón x 4L" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unidad de medida</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as ProductItem['unit'])} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cantidad disponible</label>
              <input type="number" step="0.01" min={0} value={availableQty} onChange={(e) => setAvailableQty(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cantidad mínima (alerta)</label>
              <input type="number" step="0.01" min={0} value={minQty} onChange={(e) => setMinQty(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Precio unitario ($ COP)</label>
              <input type="number" step="0.01" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha de vencimiento</label>
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lote</label>
              <input value={lot} onChange={(e) => setLot(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ubicación almacenamiento</label>
              <input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ficha Datos Seguridad (FDS)</label>
              <input value={safetySheetRef} onChange={(e) => setSafetySheetRef(e.target.value)} placeholder="Código o URL FDS" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clasificación de peligros SGA</label>
              <input value={hazardClassification} onChange={(e) => setHazardClassification(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Uso específico</label>
              <input value={specificUse} onChange={(e) => setSpecificUse(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recomendaciones de manipulación</label>
              <input value={handlingRecommendations} onChange={(e) => setHandlingRecommendations(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">EPP requeridos</label>
              <input value={requiredEpp} onChange={(e) => setRequiredEpp(e.target.value)} placeholder="Guantes, gafas, mascarilla..." className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowProdForm(false)} className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
              <Save className="w-3.5 h-3.5" />
              Guardar Producto
            </button>
          </div>
        </form>
      )}

      {subTab === 'inventory' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Catálogo de Productos Químicos e Insumos</h3>
            <div className="flex flex-wrap gap-2">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="TODAS">Todas las categorías</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="TODOS">Todos los usos</option>
                {USAGE_SCOPES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              No hay productos registrados para los filtros actuales. Use «Importar Excel SST-FR-96» o «Nuevo Producto».
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Producto / Marca</th>
                    <th className="py-2.5 px-3">Categoría / Uso</th>
                    <th className="py-2.5 px-3 text-right">Disponible</th>
                    <th className="py-2.5 px-3 text-right">Utilizado</th>
                    <th className="py-2.5 px-3 text-right">Mínimo</th>
                    <th className="py-2.5 px-3">Vencimiento / Lote</th>
                    <th className="py-2.5 px-3">FDS / SGA / EPP</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isLow = p.availableQty <= p.minQty;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.brand || 'Sin marca'} · {p.presentation || p.unit} · {p.storageLocation}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800">{p.category}</div>
                          <div className="text-[11px] text-blue-700">{p.usageScope}</div>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${isLow ? 'text-red-700' : 'text-emerald-800'}`}>
                          {p.availableQty} {p.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {p.usedQty} {p.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                          {p.minQty} {p.unit}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                          <div>{p.expirationDate || 'N/A'}</div>
                          <div className="text-slate-500">Lote: {p.lot || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 max-w-[220px]">
                          <div>FDS: {p.safetySheetRef || 'Pendiente'}</div>
                          <div>SGA: {p.hazardClassification || 'Consultar FDS'}</div>
                          <div>EPP: {p.requiredEpp || 'Según FDS'}</div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {canManageInventory && (
                            <>
                              <button type="button" onClick={() => openEditProduct(p)} className="p-1.5 text-slate-500 hover:text-blue-700 rounded-lg">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-slate-500 hover:text-red-700 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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
      )}

      {subTab === 'consumption' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Consumos registrados hoy ({todayStr})</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{dailyConsumptions.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Consumos del mes ({currentMonthStr})</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{monthlyConsumptions.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Costo mensual calculado</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
                ${totalMonthlyCost.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {canLogConsumption && (
            <form onSubmit={handleLogConsumption} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-700" />
                Registrar Consumo de Producto o Insumo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha</label>
                  <input type="date" required value={cDate} onChange={(e) => setCDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jornada</label>
                  <select value={cShift} onChange={(e) => setCShift(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Piso</label>
                  <select value={cFloor} onChange={(e) => setCFloor(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {floors.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ambiente</label>
                  <input required value={cArea} onChange={(e) => setCArea(e.target.value)} placeholder="Nombre del ambiente o área" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Producto / Insumo</label>
                  <select required value={cProductId} onChange={(e) => setCProductId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="">-- Seleccione del inventario --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Disp: {p.availableQty} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cantidad utilizada</label>
                  <input type="number" step="0.01" min={0.01} required value={cQty} onChange={(e) => setCQty(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Actividad</label>
                  <input required value={cActivity} onChange={(e) => setCActivity(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsable</label>
                  <input required value={cResponsible} onChange={(e) => setCResponsible(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={cFdsVerified} onChange={(e) => setCFdsVerified(e.target.checked)} className="rounded border-slate-300" />
                  Confirmo consulta de Ficha Técnica y FDS del fabricante para la dosificación aplicada.
                </label>
                <button type="submit" disabled={busy || products.length === 0} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" />
                  Registrar Consumo y Descontar Stock
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Consumo acumulado por piso</h4>
              {byFloorTotals.length === 0 ? (
                <p className="text-xs text-slate-500">Sin consumos registrados por piso.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {byFloorTotals.map((b) => (
                    <div key={b.floorName} className="py-2 flex justify-between">
                      <span>{b.floorName}</span>
                      <span className="font-mono tabular-nums">{b.count} reg. · ${b.cost.toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Consumo acumulado por jornada</h4>
              <div className="divide-y divide-slate-100 text-xs">
                {byShiftTotals.map((s) => (
                  <div key={s.shiftName} className="py-2 flex justify-between">
                    <span>{s.shiftName}</span>
                    <span className="font-mono tabular-nums">{s.count} reg. · ${s.cost.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Historial de Consumos</h4>
            {consumptions.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no se han registrado consumos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Fecha / Jornada</th>
                      <th className="py-2 px-3">Piso / Ambiente</th>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3 text-right">Costo</th>
                      <th className="py-2 px-3">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consumptions.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{c.date} · {c.shiftName}</td>
                        <td className="py-2.5 px-3">{c.floorCode} · {c.areaName}</td>
                        <td className="py-2.5 px-3 font-semibold">{c.productName}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">{c.quantity} {c.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">${c.calculatedCost.toLocaleString('es-CO')}</td>
                        <td className="py-2.5 px-3">{c.responsible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'deliveries' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total actas de entrega</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{deliveries.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Entregas con EPP</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-800 mt-1">{eppDeliveriesCount}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Entregas de Uniformes</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">{uniformDeliveriesCount}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Entregas de Artículos de Aseo</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-800 mt-1">{suppliesDeliveriesCount}</div>
            </div>
          </div>

          {canLogConsumption && (
            <form onSubmit={handleSaveDelivery} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-amber-700" />
                  Registrar Entrega de Dotación, EPP, Uniformes y Artículos de Aseo
                </h3>
                <span className="text-[11px] text-slate-500">
                  Registro trazable con fecha, hora, quién entrega, destinatario y detalle por talla/cantidad
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de entrega *</label>
                  <input
                    type="date"
                    required
                    value={dDate}
                    onChange={(e) => setDDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hora de entrega *</label>
                  <input
                    type="time"
                    required
                    value={dTime}
                    onChange={(e) => setDTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de dotación *</label>
                  <select
                    value={dType}
                    onChange={(e) => setDType(e.target.value as DeliveryCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {DELIVERY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motivo / Condición</label>
                  <select
                    value={dCondition}
                    onChange={(e) => setDCondition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Dotación inicial / reglamentaria">Dotación inicial / reglamentaria</option>
                    <option value="Reposición periódica">Reposición periódica</option>
                    <option value="Reposición por desgaste o daño">Reposición por desgaste o daño</option>
                    <option value="Asignación por jornada">Asignación por jornada</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quién entrega *</label>
                  <input
                    required
                    list="cesge-users-deliverer"
                    value={dDeliveredBy}
                    onChange={(e) => handleDelivererChange(e.target.value)}
                    placeholder="Nombre de quien entrega"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <datalist id="cesge-users-deliverer">
                    {usersList.map((u) => (
                      <option key={`deliv-${u.id}`} value={u.fullName}>
                        {u.role}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cargo quien entrega</label>
                  <input
                    value={dDeliveredByRole}
                    onChange={(e) => setDDeliveredByRole(e.target.value)}
                    placeholder="Ej. SUPERVISOR / ALMACÉN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">A quién fue entregado *</label>
                  <input
                    required
                    list="cesge-users-recipient"
                    value={dDeliveredTo}
                    onChange={(e) => handleRecipientChange(e.target.value)}
                    placeholder="Nombre completo del operario o receptor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <datalist id="cesge-users-recipient">
                    {usersList.map((u) => (
                      <option key={`recip-${u.id}`} value={u.fullName}>
                        {u.role} · {u.shiftPreference || 'Todas'}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cargo receptor</label>
                    <input
                      value={dRecipientRole}
                      onChange={(e) => setDRecipientRole(e.target.value)}
                      placeholder="PERSONAL DE ASEO"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jornada</label>
                    <select
                      value={dShift}
                      onChange={(e) => setDShift(e.target.value)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {shifts.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                      <option value="Todas">Todas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dynamic list of delivered items */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-900">
                    Detalle de elementos entregados (EPP, Uniformes, Artículos de aseo)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => addDeliveryRow('EPP')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar EPP
                    </button>
                    <button
                      type="button"
                      onClick={() => addDeliveryRow('Uniformes')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar Uniforme
                    </button>
                    <button
                      type="button"
                      onClick={() => addDeliveryRow('Artículos de aseo')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar Artículo de Aseo
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {dItems.map((item, idx) => {
                    const datalistId = `deliv-suggestions-${idx}`;
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs"
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Grupo</label>
                          <select
                            value={item.category}
                            onChange={(e) =>
                              updateDeliveryRow(idx, {
                                category: e.target.value as DeliveryItem['category'],
                              })
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="EPP">EPP</option>
                            <option value="Uniformes">Uniformes</option>
                            <option value="Artículos de aseo">Artículos de aseo</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Elemento *</label>
                          <input
                            required
                            list={datalistId}
                            value={item.itemName}
                            onChange={(e) => updateDeliveryRow(idx, { itemName: e.target.value })}
                            placeholder="Nombre del EPP, uniforme o artículo"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                          />
                          <datalist id={datalistId}>
                            {DELIVERY_SUGGESTIONS[item.category].map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cant. *</label>
                          <input
                            type="number"
                            min={0.1}
                            step="0.1"
                            required
                            value={item.quantity}
                            onChange={(e) => updateDeliveryRow(idx, { quantity: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-mono"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unidad</label>
                          <select
                            value={item.unit}
                            onChange={(e) => updateDeliveryRow(idx, { unit: e.target.value })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="unidades">unid.</option>
                            <option value="pares">pares</option>
                            <option value="juegos">juegos</option>
                            <option value="cajas">cajas</option>
                            <option value="paquetes">paq.</option>
                            <option value="L">L</option>
                            <option value="mL">mL</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Talla / Especificación
                          </label>
                          <input
                            value={item.sizeOrSpec}
                            onChange={(e) => updateDeliveryRow(idx, { sizeOrSpec: e.target.value })}
                            placeholder="Ej. Talla M, #39, Nitrilo"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Vincular inventario (opcional)
                          </label>
                          <select
                            value={item.productId ?? ''}
                            onChange={(e) => {
                              const pid = e.target.value ? Number(e.target.value) : null;
                              const prod = products.find((p) => p.id === pid);
                              updateDeliveryRow(idx, {
                                productId: pid,
                                deductStock: Boolean(pid),
                                ...(prod ? { itemName: prod.name, unit: prod.unit } : {}),
                              });
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                          >
                            <option value="">-- Sin vínculo --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.availableQty} {p.unit})
                              </option>
                            ))}
                          </select>
                          {item.productId && (
                            <label className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-800">
                              <input
                                type="checkbox"
                                checked={Boolean(item.deductStock)}
                                onChange={(e) => updateDeliveryRow(idx, { deductStock: e.target.checked })}
                              />
                              Descontar stock
                            </label>
                          )}
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeDeliveryRow(idx)}
                            disabled={dItems.length <= 1}
                            className="p-2 text-slate-400 hover:text-red-700 disabled:opacity-30 rounded-md"
                            title="Quitar elemento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-center text-xs">
                <div className="lg:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Observaciones</label>
                  <input
                    value={dObservations}
                    onChange={(e) => setDObservations(e.target.value)}
                    placeholder="Notas sobre estado, reposición, tallas especiales o uso requerido..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row sm:items-center justify-end gap-3 pt-2 lg:pt-5">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={dReceivedConfirmed}
                      onChange={(e) => setDReceivedConfirmed(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Recibido conforme
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Registrar Entrega de Dotación
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Historial de Entregas de Dotación, EPP, Uniformes y Artículos de Aseo
                </h4>
                <p className="text-[11px] text-slate-500">
                  Consulte quién entregó, fecha, hora exacta, destinatario, tallas y confirmación de recibido.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={deliverySearch}
                    onChange={(e) => setDeliverySearch(e.target.value)}
                    placeholder="Buscar persona o artículo..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-48"
                  />
                </div>
                <select
                  value={deliveryFilterType}
                  onChange={(e) => setDeliveryFilterType(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TODOS">Todos los tipos</option>
                  {DELIVERY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => exportDeliveriesTable('pdf')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportDeliveriesTable('xlsx')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>

            {filteredDeliveries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                Aún no hay entregas de dotación, EPP o uniformes registradas para los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Tipo / Motivo</th>
                      <th className="py-2.5 px-3">Quién entrega</th>
                      <th className="py-2.5 px-3">A quién fue entregado</th>
                      <th className="py-2.5 px-3">Elementos, cantidades y tallas</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDeliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{d.deliveryDate}</div>
                          <div className="text-[11px] text-slate-600">{d.deliveryTime}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-blue-800">{d.deliveryType}</div>
                          <div className="text-[11px] text-slate-500">{d.conditionNote || 'Dotación'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{d.deliveredBy}</div>
                          <div className="text-[11px] text-slate-500">{d.deliveredByRole || 'Equipo CESGE'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-emerald-900">{d.deliveredTo}</div>
                          <div className="text-[11px] text-slate-500">
                            {d.recipientRole || 'Operario'} {d.shiftName ? `· ${d.shiftName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-md">
                          <ul className="space-y-1">
                            {d.items.map((it, idx) => (
                              <li key={idx} className="text-slate-700">
                                <span className="font-semibold text-slate-900">{it.category}:</span>{' '}
                                <span className="font-mono tabular-nums">
                                  {it.quantity} {it.unit}
                                </span>{' '}
                                {it.itemName}
                                {it.sizeOrSpec ? (
                                  <span className="text-slate-500"> ({it.sizeOrSpec})</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          {d.observations && (
                            <div className="mt-1 text-[11px] text-slate-500 italic">
                              Obs: {d.observations}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => canLogConsumption && handleToggleDeliveryConfirm(d)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              d.receivedConfirmed ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                            title="Cambiar estado de recibido conforme"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {d.receivedConfirmed ? 'Recibido conforme' : 'Pendiente firma'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => exportSingleDeliveryPdf(d)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 rounded-lg"
                            title="Descargar acta individual en PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          {canManageInventory && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDelivery(d.id)}
                              className="p-1.5 text-slate-500 hover:text-red-700 rounded-lg"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'replenishment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-red-800">
              <TrendingDown className="w-4 h-4" />
              <span>Productos próximos a agotarse y necesidades de reposición</span>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-xs text-slate-600">No hay productos por debajo de su stock mínimo.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {lowStock.map((p) => {
                  const needed = Math.max(p.minQty * 2 - p.availableQty, 1);
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-slate-500">{p.category} · {p.storageLocation}</div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-red-700 font-semibold">Hay: {p.availableQty} {p.unit} (Mín: {p.minQty})</div>
                        <div className="text-blue-700">Reponer sugerido: +{needed.toFixed(1)} {p.unit}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              <span>Productos próximos a vencer (≤ 30 días)</span>
            </div>
            {expiringSoon.length === 0 ? (
              <p className="text-xs text-slate-600">No hay productos próximos a vencer dentro de los próximos 30 días.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {expiringSoon.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-slate-500">Lote: {p.lot || 'N/A'} · Stock: {p.availableQty} {p.unit}</div>
                    </div>
                    <div className="font-mono font-semibold text-amber-800">{p.expirationDate}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
