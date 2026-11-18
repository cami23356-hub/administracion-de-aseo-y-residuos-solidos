import React, { useState } from 'react';
import { Calendar, Clock, Plus, Save, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { ActivityStatus, Floor, ScheduleActivity, ShiftConfig, Space, User } from '../types/cesge';
import { apiFetch } from '../utils/api';

interface ScheduleModuleProps {
  user: User;
  floors: Floor[];
  spaces: Space[];
  shifts: ShiftConfig[];
  schedules: ScheduleActivity[];
  onRefresh: () => Promise<void>;
}

const STATUS_LIST: ActivityStatus[] = [
  'Pendiente',
  'En proceso',
  'Realizado',
  'Verificado',
  'No realizado',
  'Reprogramado',
];

export default function ScheduleModule({
  user,
  floors,
  spaces,
  shifts,
  schedules,
  onRefresh,
}: ScheduleModuleProps) {
  const [viewMode, setViewMode] = useState<'Diario' | 'Semanal' | 'Mensual'>('Diario');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterShift, setFilterShift] = useState<string>('TODAS');
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState('07:00');
  const [shiftName, setShiftName] = useState('Jornada de la mañana');
  const [floorId, setFloorId] = useState<number>(floors[1]?.id || 1);
  const [spaceId, setSpaceId] = useState<string>('');
  const [areaName, setAreaName] = useState('');
  const [activity, setActivity] = useState('');
  const [responsible, setResponsible] = useState('');
  const [frequency, setFrequency] = useState('Diaria');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [requiredProducts, setRequiredProducts] = useState('');
  const [requiredSupplies, setRequiredSupplies] = useState('');
  const [sundayJustification, setSundayJustification] = useState('');
  const [trainingConflictChecked, setTrainingConflictChecked] = useState(false);
  const [notes, setNotes] = useState('');

  const [editingShift, setEditingShift] = useState<ShiftConfig | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR';
  const canUpdateStatus = canManage || user.role === 'PERSONAL DE ASEO';

  const floorSpaces = spaces.filter((s) => s.floorId === floorId);
  const selectedSpaceObj = floorSpaces.find((s) => String(s.id) === spaceId);
  const isSundayDate = new Date(`${date}T12:00:00`).getDay() === 0;

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          date,
          scheduledTime,
          shiftName,
          floorId,
          spaceId: spaceId ? Number(spaceId) : null,
          areaName: selectedSpaceObj?.name || areaName,
          activity,
          responsible,
          frequency,
          estimatedMinutes,
          requiredProducts,
          requiredSupplies,
          sundayJustification,
          trainingConflictChecked,
          notes,
        }),
      });
      setFeedback({ type: 'ok', msg: 'Actividad programada y guardada en el calendario.' });
      setShowForm(false);
      setActivity('');
      setNotes('');
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error programando actividad.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(id: number, status: ActivityStatus) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando estado.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveShift(e: React.FormEvent) {
    e.preventDefault();
    if (!editingShift) return;
    setBusy(true);
    try {
      await apiFetch(`/api/shifts/${editingShift.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingShift),
      });
      setEditingShift(null);
      setFeedback({ type: 'ok', msg: 'Configuración de jornada guardada.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando jornada.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSchedule(id: number) {
    try {
      await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error eliminando registro.' });
    }
  }

  const filteredSchedules = schedules.filter((sc) => {
    if (filterShift !== 'TODAS' && sc.shiftName !== filterShift) return false;
    if (viewMode === 'Diario') return sc.date === filterDate;
    if (viewMode === 'Semanal') {
      const target = new Date(`${filterDate}T12:00:00`);
      const day = target.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monday = new Date(target);
      monday.setDate(target.getDate() + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const d = new Date(`${sc.date}T12:00:00`);
      return d >= monday && d <= sunday;
    }
    return sc.date.slice(0, 7) === filterDate.slice(0, 7);
  });

  const statusColor = (st: ActivityStatus) => {
    switch (st) {
      case 'Verificado':
      case 'Realizado':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'En proceso':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'No realizado':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'Reprogramado':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Programación de Jornadas y Calendario Operativo
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Jornadas mañana, tarde y noche (lunes a sábado). Todo trabajo en domingo requiere anotación y aclaración expresa.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFeedback(null);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cerrar Formulario' : 'Programar Actividad'}
          </button>
        )}
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

      {/* CONFIGURACIÓN DE LAS 3 JORNADAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shifts.map((sh) => (
          <div key={sh.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Clock className="w-4 h-4 text-blue-700" />
                <span>{sh.name}</span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setEditingShift(sh)}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Configurar
                </button>
              )}
            </div>
            <div className="text-xs font-mono text-slate-700 tabular-nums">
              {sh.startTime} – {sh.endTime} ({sh.durationMinutes} min)
            </div>
            <div className="text-xs text-slate-600">
              Frecuencia: {sh.frequency} · Líder: {sh.supervisorName}
            </div>
            <p className="text-[11px] text-slate-500">{sh.notes}</p>
          </div>
        ))}
      </div>

      {editingShift && (
        <form onSubmit={handleSaveShift} className="bg-white border border-blue-300 rounded-xl p-5 space-y-4">
          <div className="text-sm font-bold text-slate-900">Configurar {editingShift.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora inicio</label>
              <input
                type="time"
                value={editingShift.startTime}
                onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora fin</label>
              <input
                type="time"
                value={editingShift.endTime}
                onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frecuencia</label>
              <input
                type="text"
                value={editingShift.frequency}
                onChange={(e) => setEditingShift({ ...editingShift, frequency: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsable líder</label>
              <input
                type="text"
                value={editingShift.supervisorName}
                onChange={(e) => setEditingShift({ ...editingShift, supervisorName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingShift(null)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Jornada
            </button>
          </div>
        </form>
      )}

      {/* FORMULARIO DE PROGRAMACIÓN */}
      {showForm && (
        <form onSubmit={handleCreateSchedule} className="bg-white border border-emerald-300 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Nueva Actividad Programada</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora programada</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jornada</label>
              <select
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Piso</label>
              <select
                value={floorId}
                onChange={(e) => {
                  setFloorId(Number(e.target.value));
                  setSpaceId('');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Área / Espacio</label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Seleccionar área --</option>
                {floorSpaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.availability})
                  </option>
                ))}
              </select>
            </div>
            {!spaceId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre manual del área</label>
                <input
                  type="text"
                  required={!spaceId}
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="Ej. Pasillo y barandales"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Actividad de aseo</label>
              <input
                type="text"
                required
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="Ej. Desinfección de baños y reposición de bolsas"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsable asignado</label>
              <input
                type="text"
                required
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nombre del operario o equipo"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frecuencia</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Diaria">Diaria</option>
                <option value="Por jornada">Por jornada</option>
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal</option>
                <option value="Mensual">Mensual</option>
                <option value="Extraordinaria">Extraordinaria</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tiempo estimado (minutos)</label>
              <input
                type="number"
                min={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {selectedSpaceObj && selectedSpaceObj.availability === 'En formación' && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Atención: El espacio «{selectedSpaceObj.name}» figura actualmente <strong>En formación</strong>{' '}
                {selectedSpaceObj.trainingScheduleNote ? `(${selectedSpaceObj.trainingScheduleNote})` : ''}. Verifique disponibilidad real o programe en cambio de jornada/noche para no interrumpir clases.
              </span>
            </div>
          )}

          {isSundayDate && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2">
              <div className="text-xs font-bold text-amber-900">
                Día Domingo seleccionado — Aclaración obligatoria
              </div>
              <input
                type="text"
                required
                value={sundayJustification}
                onChange={(e) => setSundayJustification(e.target.value)}
                placeholder="Explique el motivo por el cual se trabaja este domingo (ej. jornada especial, evento institucional, lavado profundo)..."
                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Productos químicos requeridos</label>
              <input
                type="text"
                value={requiredProducts}
                onChange={(e) => setRequiredProducts(e.target.value)}
                placeholder="Según FDS (ej. Desinfectante multiusos, limpiavidrios)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Insumos y EPP requeridos</label>
              <input
                type="text"
                value={requiredSupplies}
                onChange={(e) => setRequiredSupplies(e.target.value)}
                placeholder="Ej. Bolsas blancas/negras, microfibra, guantes, señalización"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={trainingConflictChecked}
              onChange={(e) => setTrainingConflictChecked(e.target.checked)}
              className="rounded border-slate-300"
            />
            Confirmo haber verificado la programación de ambientes y disponibilidad real para no interrumpir formación ni talleres.
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Programación
            </button>
          </div>
        </form>
      )}

      {/* CALENDARIO Y FILTROS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['Diario', 'Semanal', 'Mensual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="TODAS">Todas las jornadas</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
            No hay actividades programadas en el rango {viewMode.toLowerCase()} seleccionado ({filterDate}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Jornada</th>
                  <th className="py-2.5 px-3">Piso / Área</th>
                  <th className="py-2.5 px-3">Actividad e Insumos</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchedules.map((sc) => (
                  <tr key={sc.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{sc.date}</div>
                      <div className="text-slate-500">
                        {sc.scheduledTime} · {sc.estimatedMinutes} min
                      </div>
                      {Boolean(sc.isSunday) && (
                        <div className="text-[11px] text-amber-800 font-sans mt-0.5">
                          Domingo: {sc.sundayJustification}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-700">{sc.shiftName}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{sc.floorName}</div>
                      <div className="text-slate-600">{sc.areaName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{sc.activity}</div>
                      <div className="text-[11px] text-slate-500">
                        {sc.requiredProducts ? `Químicos: ${sc.requiredProducts}` : ''}
                        {sc.requiredSupplies ? ` · Insumos: ${sc.requiredSupplies}` : ''}
                      </div>
                      {Boolean(sc.trainingConflictChecked) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Disponibilidad verificada
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{sc.responsible}</td>
                    <td className="py-3 px-3">
                      {canUpdateStatus ? (
                        <select
                          value={sc.status}
                          onChange={(e) => handleStatusChange(sc.id, e.target.value as ActivityStatus)}
                          className={`px-2 py-1 text-xs font-semibold rounded-lg border ${statusColor(sc.status)}`}
                        >
                          {STATUS_LIST.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${statusColor(sc.status)}`}>
                          {sc.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(sc.id)}
                          className="p-1.5 text-slate-500 hover:text-red-700 rounded-lg"
                          title="Eliminar programación"
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
  );
}
