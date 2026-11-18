import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Filter } from 'lucide-react';
import { Floor, ShiftConfig } from '../types/cesge';
import { apiFetch } from '../utils/api';

interface IndicatorsModuleProps {
  floors: Floor[];
  shifts: ShiftConfig[];
}

interface IndicatorsData {
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  completionPct: number;
  pendingPct: number;
  byFloor: Array<{ floorCode: string; floorName: string; total: number; completed: number; compliancePct: number }>;
  byShift: Array<{ shiftName: string; total: number; completed: number; compliancePct: number }>;
  totalConsumptionsCount: number;
  totalConsumptionCost: number;
  bagsConsumed: number;
  totalWasteKg: number;
  totalWasteBags: number;
  wasteByClassification: Array<{ classification: string; weightKg: number; bags: number }>;
}

const CHART_COLORS = ['#15803d', '#1d4ed8', '#d97706', '#64748b'];

export default function IndicatorsModule({ floors, shifts }: IndicatorsModuleProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [floorCode, setFloorCode] = useState('TODOS');
  const [shiftName, setShiftName] = useState('TODAS');
  const [responsible, setResponsible] = useState('');
  const [data, setData] = useState<IndicatorsData | null>(null);

  useEffect(() => {
    async function loadIndicators() {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (floorCode !== 'TODOS') qs.set('floorCode', floorCode);
      if (shiftName !== 'TODAS') qs.set('shiftName', shiftName);
      if (responsible.trim()) qs.set('responsible', responsible.trim());
      const res = await apiFetch<IndicatorsData>(`/api/indicators?${qs.toString()}`);
      setData(res);
    }
    loadIndicators().catch(() => {});
  }, [dateFrom, dateTo, floorCode, shiftName, responsible]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Tablero de Indicadores de Gestión – Torre Norte
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Cálculos en tiempo real basados exclusivamente en registros guardados en la base de datos.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Filter className="w-3.5 h-3.5" /> Filtros activos
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Piso</label>
            <select value={floorCode} onChange={(e) => setFloorCode(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white">
              <option value="TODOS">Todos los pisos</option>
              {floors.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jornada</label>
            <select value={shiftName} onChange={(e) => setShiftName(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white">
              <option value="TODAS">Todas las jornadas</option>
              {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Responsable</label>
            <input
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Filtrar por nombre"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">1. Actividades realizadas</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">{data.completionPct}%</div>
              <div className="text-xs text-slate-600 mt-1 tabular-nums">
                {data.completedActivities} de {data.totalActivities} programadas
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">2. Actividades pendientes</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">{data.pendingPct}%</div>
              <div className="text-xs text-slate-600 mt-1 tabular-nums">
                {data.pendingActivities} en espera o ejecución
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">5 y 6. Consumo de productos y bolsas</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-700 mt-1">
                {data.totalConsumptionsCount} reg.
              </div>
              <div className="text-xs text-slate-600 mt-1 tabular-nums">
                {data.bagsConsumed} bolsas en consumo · ${data.totalConsumptionCost.toLocaleString('es-CO')}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">7. Residuos recolectados</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {data.totalWasteKg} kg
              </div>
              <div className="text-xs text-slate-600 mt-1 tabular-nums">
                {data.totalWasteBags} bolsas recolectadas en total
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">3. Porcentaje de cumplimiento por piso (%)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byFloor}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="floorCode" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="compliancePct" name="% Cumplimiento" fill="#15803d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">4. Cumplimiento por jornada (%)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byShift}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="shiftName" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="compliancePct" name="% Cumplimiento" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              7. Distribución de residuos recolectados según Resolución 2184 de 2019 (kg)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.wasteByClassification}
                      dataKey="weightKg"
                      nameKey="classification"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {data.wasteByClassification.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {data.wasteByClassification.map((w) => (
                  <div key={w.classification} className="py-3 flex justify-between">
                    <span className="font-semibold text-slate-800">{w.classification}</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {w.weightKg} kg · {w.bags} bolsas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
