import React, { useState } from 'react';
import { BellRing, Scale, ClipboardCheck, Plus, Save, CheckCircle2 } from 'lucide-react';
import {
  AuditAlert,
  AuditFinding,
  Floor,
  LegalMatrixRow,
  User,
} from '../types/cesge';
import { apiFetch } from '../utils/api';

interface AuditsLegalModuleProps {
  user: User;
  floors: Floor[];
  audits: AuditAlert[];
  findings: AuditFinding[];
  legalMatrix: LegalMatrixRow[];
  onRefresh: () => Promise<void>;
}

export default function AuditsLegalModule({
  user,
  floors,
  audits,
  findings,
  legalMatrix,
  onRefresh,
}: AuditsLegalModuleProps) {
  const [subTab, setSubTab] = useState<'audits' | 'findings' | 'legal'>('audits');

  // New audit alert form
  const [aTitle, setATitle] = useState('');
  const [aDate, setADate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aType, setAType] = useState('Seguimiento Integral SG-SST y Ambiental');
  const [aAuditor, setAAuditor] = useState(user.fullName);
  const [aReqsText, setAReqsText] = useState(
    'Evidencias fotográficas antes/después al día\nInventario SST-FR-96 y FDS disponibles\nSeparación Res. 2184/2019 verificada'
  );

  // New finding form
  const [fFloor, setFFloor] = useState(floors[1]?.code || 'PISO-01');
  const [fArea, setFArea] = useState('');
  const [fType, setFType] = useState<AuditFinding['findingType']>('Observación');
  const [fDesc, setFDesc] = useState('');
  const [fAction, setFAction] = useState('');
  const [fResp, setFResp] = useState('Supervisión Torre Norte');
  const [fDue, setFDue] = useState(() => new Date().toISOString().slice(0, 10));

  // New legal row form
  const [lNorm, setLNorm] = useState('');
  const [lYear, setLYear] = useState('2026');
  const [lArticle, setLArticle] = useState('');
  const [lReq, setLReq] = useState('');
  const [lApp, setLApp] = useState('');
  const [lResp, setLResp] = useState('Administrador / SG-SST');
  const [lEvidence, setLEvidence] = useState('');
  const [lSource, setLSource] = useState('SUIN-Juriscol / Ministerio');
  const [lType, setLType] = useState<LegalMatrixRow['obligationType']>('Obligación Legal');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR' || user.role === 'AUDITOR';

  async function handleCreateAudit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/audits', {
        method: 'POST',
        body: JSON.stringify({
          title: aTitle,
          auditDate: aDate,
          auditType: aType,
          auditorName: aAuditor,
          requirementsChecklist: aReqsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setATitle('');
      setFeedback({ type: 'ok', msg: 'Recordatorio de auditoría programado y guardado.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error programando auditoría.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateAuditStatus(id: number, status: AuditAlert['status']) {
    try {
      await apiFetch(`/api/audits/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando auditoría.' });
    }
  }

  async function handleCreateFinding(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/findings', {
        method: 'POST',
        body: JSON.stringify({
          floorCode: fFloor,
          areaName: fArea,
          findingType: fType,
          description: fDesc,
          correctiveAction: fAction,
          responsible: fResp,
          dueDate: fDue,
        }),
      });
      setFArea('');
      setFDesc('');
      setFAction('');
      setFeedback({ type: 'ok', msg: 'Hallazgo y acción correctiva guardados.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando hallazgo.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateFindingStatus(id: number, status: AuditFinding['status']) {
    try {
      await apiFetch(`/api/findings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando hallazgo.' });
    }
  }

  async function handleUpdateLegalStatus(id: number, complianceStatus: LegalMatrixRow['complianceStatus']) {
    try {
      await apiFetch(`/api/legal-matrix/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ complianceStatus }),
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error actualizando norma.' });
    }
  }

  async function handleAddLegal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/legal-matrix', {
        method: 'POST',
        body: JSON.stringify({
          norm: lNorm,
          year: lYear,
          applicableArticle: lArticle,
          requirement: lReq,
          processApplication: lApp,
          responsible: lResp,
          evidence: lEvidence,
          officialSource: lSource,
          obligationType: lType,
          complianceStatus: 'En proceso',
        }),
      });
      setLNorm('');
      setLReq('');
      setFeedback({ type: 'ok', msg: 'Disposición normativa agregada a la Matriz Legal.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando norma.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Avisos de Auditorías Pendientes, Mejoramiento Continuo y Normatividad Colombiana 2026
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Calendario de auditorías programadas, requisitos previos a verificar, hallazgos, planes de mejora y Matriz Legal vigente.
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
          onClick={() => setSubTab('audits')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'audits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" /> Calendario y Avisos ({audits.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('findings')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'findings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> Hallazgos y Mejora ({findings.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('legal')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            subTab === 'legal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5" /> Matriz Legal Colombia 2026 ({legalMatrix.length})
        </button>
      </div>

      {subTab === 'audits' && (
        <div className="space-y-5">
          {canManage && (
            <form onSubmit={handleCreateAudit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-700" />
                Programar Recordatorio / Aviso de Auditoría Pendiente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="lg:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Título de la auditoría</label>
                  <input required value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="Ej. Auditoría mensual de cumplimiento y FDS" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha programada</label>
                  <input type="date" required value={aDate} onChange={(e) => setADate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Auditor / Responsable</label>
                  <input required value={aAuditor} onChange={(e) => setAAuditor(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  Lista de requisitos a tener en cuenta (uno por línea)
                </label>
                <textarea rows={3} value={aReqsText} onChange={(e) => setAReqsText(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                  <Save className="w-3.5 h-3.5" /> Guardar Aviso de Auditoría
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {audits.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{a.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {a.auditType} · {a.auditorName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-semibold text-slate-900">{a.auditDate}</div>
                    {canManage ? (
                      <select
                        value={a.status}
                        onChange={(e) => handleUpdateAuditStatus(a.id, e.target.value as AuditAlert['status'])}
                        className="mt-1 px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En curso">En curso</option>
                        <option value="Completada">Completada</option>
                        <option value="Reprogramada">Reprogramada</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-amber-800">{a.status}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-1 text-xs text-slate-700 border-t border-slate-100 pt-3">
                  {a.requirementsChecklist.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'findings' && (
        <div className="space-y-5">
          {canManage && (
            <form onSubmit={handleCreateFinding} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Registrar Hallazgo y Plan de Mejoramiento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Piso</label>
                  <select value={fFloor} onChange={(e) => setFFloor(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {floors.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Área</label>
                  <input required value={fArea} onChange={(e) => setFArea(e.target.value)} placeholder="Ej. Baño 2 / Cuarto útil" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Clasificación</label>
                  <select value={fType} onChange={(e) => setFType(e.target.value as AuditFinding['findingType'])} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="No conformidad">No conformidad</option>
                    <option value="Observación">Observación</option>
                    <option value="Oportunidad de mejora">Oportunidad de mejora</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha límite</label>
                  <input type="date" required value={fDue} onChange={(e) => setFDue(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descripción del hallazgo</label>
                  <input required value={fDesc} onChange={(e) => setFDesc(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Acción correctiva / mejora</label>
                  <input required value={fAction} onChange={(e) => setFAction(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="flex justify-between items-center gap-3">
                <input value={fResp} onChange={(e) => setFResp(e.target.value)} placeholder="Responsable" className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                  <Save className="w-3.5 h-3.5" /> Guardar Hallazgo
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {findings.length === 0 ? (
              <p className="text-xs text-slate-500">No hay hallazgos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Fecha / Piso</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Hallazgo y Acción Correctiva</th>
                      <th className="py-2 px-3">Responsable / Plazo</th>
                      <th className="py-2 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {findings.map((f) => (
                      <tr key={f.id}>
                        <td className="py-2.5 px-3 font-mono">
                          <div>{f.date}</div>
                          <div className="font-sans font-semibold text-slate-900">{f.floorCode} · {f.areaName}</div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{f.findingType}</td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-900">{f.description}</div>
                          <div className="text-emerald-800 mt-0.5">Acción: {f.correctiveAction}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{f.responsible}</div>
                          <div className="font-mono text-slate-500">Vence: {f.dueDate}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {canManage ? (
                            <select
                              value={f.status}
                              onChange={(e) => handleUpdateFindingStatus(f.id, e.target.value as AuditFinding['status'])}
                              className="px-2 py-1 border border-slate-300 rounded-md bg-white"
                            >
                              <option value="Abierto">Abierto</option>
                              <option value="En ejecución">En ejecución</option>
                              <option value="Cerrado">Cerrado</option>
                            </select>
                          ) : (
                            <span>{f.status}</span>
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

      {subTab === 'legal' && (
        <div className="space-y-5">
          {canManage && (
            <form onSubmit={handleAddLegal} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Agregar Disposición a la Matriz Legal</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input required value={lNorm} onChange={(e) => setLNorm(e.target.value)} placeholder="Norma (ej. Resolución...)" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input required value={lYear} onChange={(e) => setLYear(e.target.value)} placeholder="Año" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input value={lArticle} onChange={(e) => setLArticle(e.target.value)} placeholder="Artículo aplicable" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <select value={lType} onChange={(e) => setLType(e.target.value as LegalMatrixRow['obligationType'])} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="Obligación Legal">Obligación Legal</option>
                  <option value="Recomendación Técnica Voluntaria">Recomendación Técnica Voluntaria</option>
                </select>
                <input required value={lReq} onChange={(e) => setLReq(e.target.value)} placeholder="Requisito" className="lg:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
                <input value={lApp} onChange={(e) => setLApp(e.target.value)} placeholder="Aplicación al proceso" className="lg:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
                <input value={lResp} onChange={(e) => setLResp(e.target.value)} placeholder="Responsable" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input value={lEvidence} onChange={(e) => setLEvidence(e.target.value)} placeholder="Evidencia" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <input value={lSource} onChange={(e) => setLSource(e.target.value)} placeholder="Fuente oficial" className="px-3 py-2 border border-slate-300 rounded-lg" />
                <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-700 rounded-lg">
                  <Save className="w-3.5 h-3.5" /> Agregar Norma
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Norma y Año</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Artículo / Requisito</th>
                  <th className="py-2.5 px-3">Aplicación CESGE</th>
                  <th className="py-2.5 px-3">Evidencia / Fuente</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {legalMatrix.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-3 px-3 min-w-[170px]">
                      <div className="font-bold text-slate-900">{row.norm}</div>
                      <div className="font-mono text-slate-500">{row.year}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{row.vigencyNote}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={row.obligationType === 'Obligación Legal' ? 'text-blue-800 font-semibold' : 'text-slate-600'}>
                        {row.obligationType}
                      </span>
                    </td>
                    <td className="py-3 px-3 min-w-[230px]">
                      <div className="font-semibold text-slate-800">{row.applicableArticle}</div>
                      <div className="text-slate-600 mt-0.5">{row.requirement}</div>
                    </td>
                    <td className="py-3 px-3 min-w-[210px]">
                      <div className="text-slate-700">{row.processApplication}</div>
                      <div className="text-[11px] text-slate-500 mt-1">Resp: {row.responsible}</div>
                    </td>
                    <td className="py-3 px-3 min-w-[180px]">
                      <div className="text-slate-700">{row.evidence}</div>
                      <div className="text-[11px] text-blue-700 mt-1">Fuente: {row.officialSource}</div>
                    </td>
                    <td className="py-3 px-3">
                      {canManage ? (
                        <select
                          value={row.complianceStatus}
                          onChange={(e) =>
                            handleUpdateLegalStatus(row.id, e.target.value as LegalMatrixRow['complianceStatus'])
                          }
                          className="px-2 py-1 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="Cumple">Cumple</option>
                          <option value="En proceso">En proceso</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="No aplica">No aplica</option>
                        </select>
                      ) : (
                        <span>{row.complianceStatus}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
