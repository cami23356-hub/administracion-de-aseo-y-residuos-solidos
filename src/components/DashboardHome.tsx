import React from 'react';
import {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Recycle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import {
  AuditAlert,
  ProductItem,
  ScheduleActivity,
  Space,
  User,
  WasteRecord,
} from '../types/cesge';
import UserManualPanel from './UserManualPanel';

interface DashboardHomeProps {
  user: User;
  spaces: Space[];
  schedules: ScheduleActivity[];
  products: ProductItem[];
  wasteRecords: WasteRecord[];
  audits: AuditAlert[];
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({
  user,
  spaces,
  schedules,
  products,
  wasteRecords,
  audits,
  onNavigate,
}: DashboardHomeProps) {
  const pendingAudits = audits.filter((a) => a.status === 'Pendiente' || a.status === 'En curso');
  const completedCount = schedules.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
  const pendingCount = schedules.filter((s) => s.status === 'Pendiente' || s.status === 'En proceso').length;
  const compliancePct = schedules.length ? ((completedCount / schedules.length) * 100).toFixed(1) : '0.0';

  const lowStockProducts = products.filter((p) => p.availableQty <= p.minQty);
  const expiringProducts = products.filter((p) => {
    if (!p.expirationDate) return false;
    const diffDays = (new Date(p.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  });

  const activeWasteAlerts = wasteRecords.filter((w) => w.alertType !== 'Ninguna');
  const totalWasteKg = wasteRecords.reduce((acc, w) => acc + w.weightKg, 0).toFixed(1);

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `Vencida hace ${Math.abs(diff)} días`;
    if (diff === 0) return 'Programada para hoy';
    return `En ${diff} días`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-700 mb-1">
            CESGE Torre Norte · Sesión activa: {user.fullName} ({user.role})
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            Tablero General de Administración de Aseo y Residuos Sólidos
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Control operativo desde Sótano y Parqueadero hasta Piso 10 y Zonas Exteriores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('schedules')}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Programar Jornada
          </button>
          <button
            type="button"
            onClick={() => onNavigate('vision')}
            className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
          >
            Cargar Evidencia IA
          </button>
        </div>
      </div>

      {/* AVISO PRIORITARIO DE AUDITORÍAS PENDIENTES */}
      <section className="bg-white border border-amber-300 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-amber-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Aviso y Calendario de Auditorías Pendientes
              </h3>
              <p className="text-xs text-slate-600">
                Verifique con anticipación las evidencias, inventario SST-FR-96, FDS y planillas exigidas para cada auditoría.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('audits')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Gestionar auditorías y requisitos
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {pendingAudits.length === 0 ? (
          <p className="text-xs text-slate-600">
            No hay auditorías pendientes programadas actualmente. Puede agendar una nueva auditoría en el módulo Auditoría y Normatividad.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingAudits.map((audit) => (
              <div key={audit.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{audit.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {audit.auditType} · Responsable: {audit.auditorName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-semibold text-amber-800">{audit.auditDate}</div>
                    <div className="text-xs text-amber-700">{daysUntil(audit.auditDate)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">
                    Aspectos clave requeridos para esta auditoría:
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {audit.requirementsChecklist.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MÉTRICAS EN TIEMPO REAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Espacios Torre Norte</span>
            <Building2 className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{spaces.length}</div>
          <div className="text-xs text-slate-600 mt-1">
            {spaces.filter((s) => s.availability === 'En formación').length} en formación actualmente
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Cumplimiento de Aseo</span>
            <CalendarClock className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{compliancePct}%</div>
          <div className="text-xs text-slate-600 mt-1 tabular-nums">
            {completedCount} ejecutadas · {pendingCount} pendientes
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Inventario SST-FR-96</span>
            <FlaskConical className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{products.length}</div>
          <div className="text-xs text-slate-600 mt-1 tabular-nums">
            {lowStockProducts.length} por agotar · {expiringProducts.length} por vencer
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Residuos Registrados</span>
            <Recycle className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{totalWasteKg} kg</div>
          <div className="text-xs text-slate-600 mt-1 tabular-nums">
            {activeWasteAlerts.length} alertas activas de recolección
          </div>
        </div>
      </div>

      {/* RESUMEN DE REPOSICIÓN Y ALERTAS OPERATIVAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-700" />
              Estado de Almacenamiento: Qué hay, qué falta y qué se necesita
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Ver inventario
            </button>
          </div>
          {products.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Aún no hay productos químicos ni insumos cargados. Importe el archivo Excel SENA SST-FR-96 o registre productos en el módulo de Inventario.
            </div>
          ) : lowStockProducts.length === 0 && expiringProducts.length === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              Todos los {products.length} productos e insumos registrados cuentan con stock por encima del mínimo configurado.
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs"
                >
                  <div>
                    <span className="font-semibold text-red-900">{p.name}</span>
                    <span className="text-red-700 ml-2">({p.category})</span>
                  </div>
                  <span className="font-mono font-semibold text-red-800 tabular-nums">
                    Disponible: {p.availableQty} / Mín: {p.minQty} {p.unit}
                  </span>
                </div>
              ))}
              {expiringProducts.slice(0, 3).map((p) => (
                <div
                  key={`exp-${p.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs"
                >
                  <span className="font-semibold text-amber-900">{p.name} (próximo a vencer)</span>
                  <span className="font-mono text-amber-800">{p.expirationDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Alertas de Residuos Sólidos y Actividades Pendientes
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('waste')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Ir a residuos
            </button>
          </div>
          {activeWasteAlerts.length === 0 && pendingCount === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              No hay alertas activas de canecas llenas, falta de bolsas o mezclas en este momento.
            </div>
          ) : (
            <div className="space-y-2">
              {activeWasteAlerts.slice(0, 4).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs"
                >
                  <div>
                    <span className="font-semibold text-amber-900">{w.alertType}</span>
                    <span className="text-amber-800 ml-2">
                      · {w.floorCode} ({w.location})
                    </span>
                  </div>
                  <span className="font-mono text-amber-800">{w.date}</span>
                </div>
              ))}
              {schedules
                .filter((s) => s.status === 'Pendiente' || s.status === 'No realizado')
                .slice(0, 3)
                .map((s) => (
                  <div
                    key={`sch-${s.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{s.activity}</span>
                      <span className="text-slate-600 ml-2">
                        · {s.floorCode} - {s.areaName}
                      </span>
                    </div>
                    <span className="font-mono text-slate-700">{s.status}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* MANUAL DEL USUARIO EN LA RAÍZ DE LA PÁGINA */}
      <section id="manual-usuario-raiz" className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <span>Documentación de ayuda integrada en la raíz de la plataforma</span>
        </div>
        <UserManualPanel />
      </section>
    </div>
  );
}
