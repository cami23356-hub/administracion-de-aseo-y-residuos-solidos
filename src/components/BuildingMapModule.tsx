import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Upload,
  Download,
  Monitor,
  Tv,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Floor, Space, SpaceAvailability, User } from '../types/cesge';
import { apiFetch } from '../utils/api';
import { downloadCesgeSpacesTemplate, parseExcelFile } from '../utils/exporters';
import TorreNorte3DView from './TorreNorte3DView';

interface BuildingMapModuleProps {
  user: User;
  floors: Floor[];
  spaces: Space[];
  onRefresh: () => Promise<void>;
}

const CATEGORIES = [
  'Ambiente con Cómputo',
  'Ambiente de Formación',
  'Baño',
  'Baño Administrativo',
  'Cocina / Cafetín',
  'Terraza / Alimentación',
  'Área Administrativa',
  'Área Tecnológica',
  'Taller Especializado',
  'Auditorio',
  'Biblioteca',
  'Cuarto Útil / Aseo',
  'Riesgo Eléctrico / Técnico',
  'Archivo / Documental',
  'Escaleras y Circulación',
  'Punto Ecológico',
  'Parqueadero',
  'Almacenamiento',
  'Seguridad y Brigada',
  'Seguridad y Evacuación',
  'Zona de Estudio / Mobiliario',
  'Circulación y Zonas Comunes',
  'Equipo de Cafetín / Refrigeración',
  'Circulación Exterior',
];

const AVAILABILITY_OPTIONS: SpaceAvailability[] = [
  'Disponible',
  'En formación',
  'En limpieza',
  'Mantenimiento',
];

export default function BuildingMapModule({
  user,
  floors,
  spaces,
  onRefresh,
}: BuildingMapModuleProps) {
  const [selectedFloorId, setSelectedFloorId] = useState<number>(floors[0]?.id ?? 1);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formHasComputers, setFormHasComputers] = useState(false);
  const [formHasTv, setFormHasTv] = useState(false);
  const [formAvailability, setFormAvailability] = useState<SpaceAvailability>('Disponible');
  const [formScheduleNote, setFormScheduleNote] = useState('');
  const [formElementsDetail, setFormElementsDetail] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canEditStructure = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR';
  const canUpdateAvailability = canEditStructure || user.role === 'PERSONAL DE ASEO';

  const currentFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const floorSpaces = spaces.filter((s) => s.floorId === currentFloor?.id);

  function openAddModal() {
    setEditingSpace(null);
    setFormName('');
    setFormCategory(CATEGORIES[0]);
    setFormHasComputers(false);
    setFormHasTv(false);
    setFormAvailability('Disponible');
    setFormScheduleNote('');
    setFormElementsDetail('Incluye verificación de elementos estándar del piso.');
    setShowAddForm(true);
    setFeedback(null);
  }

  function openEditModal(space: Space) {
    setEditingSpace(space);
    setFormName(space.name);
    setFormCategory(space.category);
    setFormHasComputers(Boolean(space.hasComputers));
    setFormHasTv(Boolean(space.hasTv));
    setFormAvailability(space.availability);
    setFormScheduleNote(space.trainingScheduleNote || '');
    setFormElementsDetail(space.elementsDetail || '');
    setShowAddForm(true);
    setFeedback(null);
  }

  async function handleSaveSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFloor) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (editingSpace) {
        await apiFetch(`/api/spaces/${editingSpace.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName,
            category: formCategory,
            hasComputers: formHasComputers,
            hasTv: formHasTv,
            availability: formAvailability,
            trainingScheduleNote: formScheduleNote,
            elementsDetail: formElementsDetail,
          }),
        });
        setFeedback({ type: 'ok', msg: `Espacio "${formName}" actualizado y guardado correctamente.` });
      } else {
        await apiFetch('/api/spaces', {
          method: 'POST',
          body: JSON.stringify({
            floorId: currentFloor.id,
            name: formName,
            category: formCategory,
            hasComputers: formHasComputers,
            hasTv: formHasTv,
            availability: formAvailability,
            trainingScheduleNote: formScheduleNote,
            elementsDetail: formElementsDetail,
          }),
        });
        setFeedback({ type: 'ok', msg: `Espacio "${formName}" agregado en ${currentFloor.name}.` });
      }
      setShowAddForm(false);
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando espacio.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickAvailability(space: Space, newStatus: SpaceAvailability) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/spaces/${space.id}`, {
        method: 'PUT',
        body: JSON.stringify({ availability: newStatus }),
      });
      setFeedback({ type: 'ok', msg: `Disponibilidad de "${space.name}" actualizada a ${newStatus}.` });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando estado.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSpace(space: Space) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/spaces/${space.id}`, { method: 'DELETE' });
      setFeedback({
        type: 'ok',
        msg: `Espacio "${space.name}" retirado del mapa activo conservando intacto su historial de actividades.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error eliminando espacio.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const rawRows = await parseExcelFile(file);
      const mapped = rawRows.map((r) => ({
        floor: r['Piso'] ?? r['piso'] ?? r['FLOOR'] ?? '',
        name: r['Ambiente'] ?? r['Area'] ?? r['Área'] ?? r['Nombre'] ?? r['name'] ?? '',
        category: r['Tipo'] ?? r['Categoría'] ?? r['category'] ?? 'Ambiente de Formación',
        availability: r['Disponibilidad'] ?? r['Estado'] ?? r['availability'] ?? 'Disponible',
        trainingScheduleNote:
          r['Franja o Horario de Formación'] ?? r['Horario'] ?? r['Franja'] ?? r['trainingScheduleNote'] ?? '',
      }));
      const res = await apiFetch<{ inserted: number; updated: number }>('/api/spaces/import', {
        method: 'POST',
        body: JSON.stringify({ rows: mapped }),
      });
      setFeedback({
        type: 'ok',
        msg: `Archivo Excel CESGE procesado: ${res.inserted} ambientes nuevos y ${res.updated} actualizados.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error importando archivo Excel.' });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const availabilityBadgeStyle = (av: SpaceAvailability) => {
    switch (av) {
      case 'Disponible':
        return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      case 'En formación':
        return 'text-amber-900 bg-amber-50 border-amber-200';
      case 'En limpieza':
        return 'text-blue-800 bg-blue-50 border-blue-200';
      default:
        return 'text-red-800 bg-red-50 border-red-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Mapa Interactivo de la Torre Norte – Sótano a Piso 10 y Exteriores
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Seleccione cada nivel para visualizar espacios, actualizar disponibilidad en formación y administrar áreas sin alterar el historial.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadCesgeSpacesTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Plantilla Excel Ambientes
          </button>
          {canEditStructure && (
            <>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Importar Excel CESGE
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
              </label>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Espacio
              </button>
            </>
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

      <TorreNorte3DView
        floors={floors}
        spaces={spaces}
        selectedFloorId={currentFloor?.id ?? selectedFloorId}
        onSelectFloor={setSelectedFloorId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* TORRE VERTICAL INTERACTIVA */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 px-2 pb-2 border-b border-slate-100">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Estructura Vertical Torre Norte</span>
          </div>
          <div className="space-y-1.5">
            {[...floors]
              .sort((a, b) => b.sortOrder - a.sortOrder)
              .map((floor) => {
                const count = spaces.filter((s) => s.floorId === floor.id).length;
                const active = floor.id === currentFloor?.id;
                const busyTraining = spaces.filter(
                  (s) => s.floorId === floor.id && s.availability === 'En formación'
                ).length;
                return (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{floor.name}</div>
                      <div className={`text-[11px] truncate ${active ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {floor.code} · {busyTraining > 0 ? `${busyTraining} en formación` : 'Sin ocupación reportada'}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-semibold tabular-nums shrink-0 ${
                        active ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {count} áreas
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* DETALLE DEL PISO SELECCIONADO */}
        <div className="lg:col-span-8 space-y-5">
          {currentFloor && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-5 h-5 text-blue-700" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{currentFloor.name}</h3>
                      <p className="text-xs text-slate-600">{currentFloor.notes}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {floorSpaces.length} espacios activos
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Elementos presentes en este piso (verificación obligatoria):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentFloor.standardElements.map((el) => (
                      <div key={el} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{el}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {showAddForm && (
                <form
                  onSubmit={handleSaveSpace}
                  className="bg-white border border-blue-300 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      {editingSpace ? `Editar espacio: ${editingSpace.name}` : `Nuevo espacio en ${currentFloor.name}`}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-slate-500 hover:text-slate-800 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del espacio</label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Nombre del ambiente o área"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Disponibilidad real actual
                      </label>
                      <select
                        value={formAvailability}
                        onChange={(e) => setFormAvailability(e.target.value as SpaceAvailability)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {AVAILABILITY_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Franja de formación / ocupación
                      </label>
                      <input
                        type="text"
                        value={formScheduleNote}
                        onChange={(e) => setFormScheduleNote(e.target.value)}
                        placeholder="Ej. Lunes a viernes 07:00-13:00"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formHasComputers}
                        onChange={(e) => setFormHasComputers(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Ambiente con equipos de cómputo
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={formHasTv}
                        onChange={(e) => setFormHasTv(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Ambiente con televisores / pantallas
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Detalle de elementos y observaciones de limpieza
                    </label>
                    <input
                      type="text"
                      value={formElementsDetail}
                      onChange={(e) => setFormElementsDetail(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Información
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Espacios registrados en {currentFloor.name}</h4>
                  <span className="text-xs text-slate-500">
                    Actualice la disponibilidad para evitar interrumpir clases
                  </span>
                </div>
                {floorSpaces.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-xs text-slate-600">
                      Aún no hay espacios o ambientes registrados en {currentFloor.name}. Use «Agregar Espacio» o importe el archivo Excel del CESGE para registrar las áreas reales de este nivel.
                    </p>
                    {canEditStructure && (
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Registrar primer espacio en {currentFloor.name}
                      </button>
                    )}
                  </div>
                ) : (
                <div className="divide-y divide-slate-100">
                  {floorSpaces.map((sp) => (
                    <div key={sp.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{sp.name}</span>
                          <span className="text-xs text-slate-500">· {sp.category}</span>
                          {Boolean(sp.hasComputers) && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-700">
                              <Monitor className="w-3 h-3" /> Cómputo
                            </span>
                          )}
                          {Boolean(sp.hasTv) && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                              <Tv className="w-3 h-3" /> TV
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600">
                          {sp.elementsDetail}
                          {sp.trainingScheduleNote ? ` · Horario: ${sp.trainingScheduleNote}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canUpdateAvailability ? (
                          <select
                            value={sp.availability}
                            disabled={busy}
                            onChange={(e) => handleQuickAvailability(sp, e.target.value as SpaceAvailability)}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${availabilityBadgeStyle(
                              sp.availability
                            )}`}
                          >
                            {AVAILABILITY_OPTIONS.map((av) => (
                              <option key={av} value={av}>
                                {av}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${availabilityBadgeStyle(sp.availability)}`}>
                            {sp.availability}
                          </span>
                        )}

                        {canEditStructure && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(sp)}
                              title="Editar espacio"
                              className="p-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSpace(sp)}
                              title="Retirar espacio conservando historial"
                              className="p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
