import React, { useState } from 'react';
import { Recycle, Plus, Save, AlertTriangle, Truck, CheckCircle2 } from 'lucide-react';
import { Floor, ShiftConfig, User, WasteBin, WasteRecord } from '../types/cesge';
import { apiFetch } from '../utils/api';

interface WasteModuleProps {
  user: User;
  floors: Floor[];
  shifts: ShiftConfig[];
  bins: WasteBin[];
  records: WasteRecord[];
  onRefresh: () => Promise<void>;
}

const ALERT_TYPES: Array<WasteRecord['alertType']> = [
  'Ninguna',
  'Caneca llena',
  'Falta bolsa',
  'Mezcla de residuos',
  'Residuos fuera de recipientes',
  'Recolección no realizada',
];

export default function WasteModule({
  user,
  floors,
  shifts,
  bins,
  records,
  onRefresh,
}: WasteModuleProps) {
  const [subTab, setSubTab] = useState<'records' | 'bins'>('records');
  const [filterFloor, setFilterFloor] = useState('TODOS');

  // Record form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [collectionTime, setCollectionTime] = useState('12:00');
  const [truckPickupTime, setTruckPickupTime] = useState('');
  const [truckVerified, setTruckVerified] = useState(false);
  const [floorCode, setFloorCode] = useState(floors[1]?.code || 'PISO-01');
  const [location, setLocation] = useState('Punto ecológico principal');
  const [classification, setClassification] = useState<WasteRecord['classification']>('Blanco - Aprovechables');
  const [bagsCount, setBagsCount] = useState(1);
  const [weightKg, setWeightKg] = useState(2.5);
  const [shiftName, setShiftName] = useState('Jornada de la mañana');
  const [responsible, setResponsible] = useState(user.fullName);
  const [alertType, setAlertType] = useState<WasteRecord['alertType']>('Ninguna');
  const [observations, setObservations] = useState('');

  // New bin form
  const [binFloor, setBinFloor] = useState(floors[1]?.code || 'PISO-01');
  const [binLocation, setBinLocation] = useState('');
  const [binColor, setBinColor] = useState<WasteBin['color']>('Verde');
  const [binType, setBinType] = useState('Caneca con pedal y tapa');
  const [binBagType, setBinBagType] = useState('Bolsa verde calibre industrial (orgánicos)');
  const [needsGreen, setNeedsGreen] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canManageBins = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR';
  const canLogWaste = canManageBins || user.role === 'PERSONAL DE ASEO';

  async function handleSaveRecord(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/waste/records', {
        method: 'POST',
        body: JSON.stringify({
          date,
          collectionTime,
          truckPickupTime,
          truckVerified,
          floorCode,
          location,
          classification,
          bagsCount,
          weightKg,
          shiftName,
          responsible,
          alertType,
          observations,
        }),
      });
      setFeedback({ type: 'ok', msg: 'Recolección de residuos registrada correctamente.' });
      setObservations('');
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando registro.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyTruck(rec: WasteRecord) {
    const timeNow = new Date().toTimeString().slice(0, 5);
    try {
      await apiFetch(`/api/waste/records/${rec.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          truckVerified: true,
          truckPickupTime: rec.truckPickupTime || timeNow,
        }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error verificando camión.' });
    }
  }

  async function handleCreateBin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/waste/bins', {
        method: 'POST',
        body: JSON.stringify({
          floorCode: binFloor,
          location: binLocation,
          containerType: binType,
          color: binColor,
          bagType: binBagType,
          needsAdditionalGreen: needsGreen,
        }),
      });
      setFeedback({ type: 'ok', msg: `Recipiente ${binColor} registrado en ${binFloor}.` });
      setBinLocation('');
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error registrando recipiente.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateBinCondition(bin: WasteBin, condition: WasteBin['condition']) {
    try {
      await apiFetch(`/api/waste/bins/${bin.id}`, {
        method: 'PUT',
        body: JSON.stringify({ condition }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando caneca.' });
    }
  }

  const filteredRecords = records.filter((r) => (filterFloor === 'TODOS' ? true : r.floorCode === filterFloor));
  const filteredBins = bins.filter((b) => (filterFloor === 'TODOS' ? true : b.floorCode === filterFloor));

  const whiteKg = filteredRecords
    .filter((r) => r.classification === 'Blanco - Aprovechables')
    .reduce((a, b) => a + b.weightKg, 0);
  const blackKg = filteredRecords
    .filter((r) => r.classification === 'Negro - No aprovechables')
    .reduce((a, b) => a + b.weightKg, 0);
  const greenKg = filteredRecords
    .filter((r) => r.classification === 'Verde - Orgánicos aprovechables')
    .reduce((a, b) => a + b.weightKg, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Gestión de Residuos Sólidos – Resolución 2184 de 2019
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Código de colores nacional: Blanco (aprovechables), Negro (no aprovechables), Verde (orgánicos aprovechables). Control de bolsas, peso, alertas y verificación del camión recolector.
          </p>
        </div>
        <select
          value={filterFloor}
          onChange={(e) => setFilterFloor(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        >
          <option value="TODOS">Todos los pisos de Torre Norte</option>
          {floors.map((f) => (
            <option key={f.code} value={f.code}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* RESUMEN RESOLUCIÓN 2184 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">BLANCO · Residuos Aprovechables</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{whiteKg.toFixed(1)} kg</div>
          <div className="text-[11px] text-slate-500 mt-1">Plástico, cartón, vidrio, papel y metales limpios</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500">NEGRO · Residuos No Aprovechables</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{blackKg.toFixed(1)} kg</div>
          <div className="text-[11px] text-slate-500 mt-1">Papel higiénico, servilletas, cartón contaminado</div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-800">VERDE · Orgánicos Aprovechables</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 mt-1">{greenKg.toFixed(1)} kg</div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {bins.filter((b) => b.needsAdditionalGreen === 1).length} puntos identificados con necesidad de caneca verde adicional
          </div>
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

      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubTab('records')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'records' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Recolección y Verificación Camión ({filteredRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('bins')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
            subTab === 'bins' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Canecas y Puntos Ecológicos ({filteredBins.length})
        </button>
      </div>

      {subTab === 'records' ? (
        <div className="space-y-5">
          {canLogWaste && (
            <form onSubmit={handleSaveRecord} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Recycle className="w-4 h-4 text-emerald-700" />
                Registrar Recolección, Pesaje y Bolsas Sacadas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha</label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hora recolección interna</label>
                  <input type="time" required value={collectionTime} onChange={(e) => setCollectionTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Piso</label>
                  <select value={floorCode} onChange={(e) => setFloorCode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {floors.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ubicación</label>
                  <input required value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Clasificación (Res. 2184/2019)</label>
                  <select value={classification} onChange={(e) => setClassification(e.target.value as WasteRecord['classification'])} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="Blanco - Aprovechables">Blanco - Aprovechables</option>
                    <option value="Negro - No aprovechables">Negro - No aprovechables</option>
                    <option value="Verde - Orgánicos aprovechables">Verde - Orgánicos aprovechables</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bolsas sacadas</label>
                  <input type="number" min={0} required value={bagsCount} onChange={(e) => setBagsCount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Peso total (kg)</label>
                  <input type="number" step="0.1" min={0} required value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jornada</label>
                  <select value={shiftName} onChange={(e) => setShiftName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsable</label>
                  <input required value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alerta operativa</label>
                  <select value={alertType} onChange={(e) => setAlertType(e.target.value as WasteRecord['alertType'])} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {ALERT_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hora recogida camión</label>
                  <input type="time" value={truckPickupTime} onChange={(e) => setTruckPickupTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={truckVerified} onChange={(e) => setTruckVerified(e.target.checked)} className="rounded border-slate-300" />
                    Camión recolector verificado
                  </label>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <input
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observaciones adicionales (ej. mezcla detectada, necesidad de bolsa verde)..."
                  className="w-full sm:flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap">
                  <Save className="w-3.5 h-3.5" />
                  Guardar Recolección
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Historial de Recolección y Salida al Camión</h4>
            {filteredRecords.length === 0 ? (
              <p className="text-xs text-slate-500">No hay registros de recolección para el filtro seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Fecha / Hora</th>
                      <th className="py-2.5 px-3">Piso / Ubicación</th>
                      <th className="py-2.5 px-3">Clasificación</th>
                      <th className="py-2.5 px-3 text-right">Bolsas / Peso</th>
                      <th className="py-2.5 px-3">Alerta</th>
                      <th className="py-2.5 px-3">Camión Recolector</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <div>{r.date} · {r.collectionTime}</div>
                          <div className="text-[11px] text-slate-500 font-sans">{r.shiftName} · {r.responsible}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{r.floorCode}</div>
                          <div className="text-slate-600">{r.location}</div>
                        </td>
                        <td className="py-2.5 px-3">{r.classification}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {r.bagsCount} bolsas · {r.weightKg} kg
                        </td>
                        <td className="py-2.5 px-3">
                          {r.alertType === 'Ninguna' ? (
                            <span className="text-slate-500">Sin novedad</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> {r.alertType}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.truckVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verificado {r.truckPickupTime}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVerifyTruck(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                            >
                              <Truck className="w-3 h-3" /> Confirmar camión
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
      ) : (
        <div className="space-y-5">
          {canManageBins && (
            <form onSubmit={handleCreateBin} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-700" />
                Agregar Caneca o Recipiente Verde/Blanco/Negro
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Piso</label>
                  <select value={binFloor} onChange={(e) => setBinFloor(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {floors.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ubicación exacta</label>
                  <input required value={binLocation} onChange={(e) => setBinLocation(e.target.value)} placeholder="Ej. Terraza 1 / Cafetín" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Color (Res. 2184/2019)</label>
                  <select value={binColor} onChange={(e) => setBinColor(e.target.value as WasteBin['color'])} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="Blanco">Blanco (Aprovechables)</option>
                    <option value="Negro">Negro (No aprovechables)</option>
                    <option value="Verde">Verde (Orgánicos aprovechables)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de recipiente y bolsa</label>
                  <input value={binBagType} onChange={(e) => setBinBagType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={needsGreen} onChange={(e) => setNeedsGreen(e.target.checked)} className="rounded border-slate-300" />
                  Requiere recipiente verde adicional en esta zona
                </label>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                  <Save className="w-3.5 h-3.5" />
                  Guardar Recipiente
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-3">
              Inventario de Recipientes Blancos, Negros y Verdes por Piso
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Piso</th>
                    <th className="py-2.5 px-3">Ubicación</th>
                    <th className="py-2.5 px-3">Color / Bolsa</th>
                    <th className="py-2.5 px-3">Necesidad Verde</th>
                    <th className="py-2.5 px-3">Estado actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBins.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{b.floorCode}</td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <div>{b.location}</div>
                        <div className="text-[11px] text-slate-500">{b.notes}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold">{b.color}</div>
                        <div className="text-[11px] text-slate-500">{b.bagType}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {b.needsAdditionalGreen ? (
                          <span className="text-emerald-800 font-semibold">Requiere caneca verde adicional</span>
                        ) : (
                          <span className="text-slate-500">Cubierto</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={b.condition}
                          onChange={(e) => handleUpdateBinCondition(b, e.target.value as WasteBin['condition'])}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="Óptimo">Óptimo</option>
                          <option value="Lleno">Lleno</option>
                          <option value="Requiere bolsa">Requiere bolsa</option>
                          <option value="Deteriorado">Deteriorado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
