import React, { useEffect, useState } from 'react';
import { GitBranch, Network, FileText, Save, Download, Plus, Trash2, ArrowDown } from 'lucide-react';
import {
  CharacterizationData,
  FlowchartStep,
  ProcessMapData,
  User,
} from '../types/cesge';
import { apiFetch } from '../utils/api';
import { exportToExcel, exportToPdf } from '../utils/exporters';

interface ProcessDocsModuleProps {
  user: User;
}

export default function ProcessDocsModule({ user }: ProcessDocsModuleProps) {
  const [tab, setTab] = useState<'flowchart' | 'map' | 'char'>('flowchart');
  const [flowchart, setFlowchart] = useState<FlowchartStep[]>([]);
  const [processMap, setProcessMap] = useState<ProcessMapData | null>(null);
  const [charData, setCharData] = useState<CharacterizationData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const canEdit = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR' || user.role === 'AUDITOR';

  useEffect(() => {
    async function loadAll() {
      const [fc, pm, ch] = await Promise.all([
        apiFetch<{ content: FlowchartStep[] }>('/api/process-docs/flowchart'),
        apiFetch<{ content: ProcessMapData }>('/api/process-docs/process_map'),
        apiFetch<{ content: CharacterizationData }>('/api/process-docs/characterization'),
      ]);
      setFlowchart(fc.content);
      setProcessMap(pm.content);
      setCharData(ch.content);
    }
    loadAll().catch(() => {});
  }, []);

  async function saveDoc(docType: 'flowchart' | 'process_map' | 'characterization', content: unknown) {
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/process-docs/${docType}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      setFeedback({ type: 'ok', msg: 'Cambios guardados en la base de datos institucional.' });
      setEditMode(false);
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando documento.' });
    } finally {
      setSaving(false);
    }
  }

  function downloadFlowchartPdf() {
    exportToPdf(
      'Flujograma_Proceso_Aseo_CESGE.pdf',
      'Flujograma del Proceso de Administración del Aseo – Torre Norte',
      'Secuencia operativa editable de 16 pasos',
      ['Paso', 'Tipo', 'Actividad', 'Responsable', 'Entradas', 'Salidas'],
      flowchart.map((s) => [s.stepNumber, s.nodeType.toUpperCase(), s.title, s.responsible, s.inputs, s.outputs])
    );
  }

  function downloadProcessMapPdf() {
    if (!processMap) return;
    const rows: Array<Array<string>> = [
      ...processMap.strategic.map((p) => ['Estratégicos', p]),
      ...processMap.misional.map((p) => ['Misionales', p]),
      ...processMap.support.map((p) => ['Apoyo', p]),
      ...processMap.evaluation.map((p) => ['Evaluación', p]),
    ];
    exportToPdf(
      'Mapa_Procesos_Aseo_CESGE.pdf',
      'Mapa del Proceso de Gestión del Aseo – CESGE Torre Norte',
      'Estructura de procesos estratégicos, misionales, apoyo y evaluación',
      ['Macroproceso', 'Proceso'],
      rows
    );
  }

  function downloadCharPdf() {
    if (!charData) return;
    exportToPdf(
      'Caracterizacion_PHVA_Aseo_CESGE.pdf',
      'Ficha de Caracterización del Proceso de Gestión del Aseo y Residuos Sólidos',
      `Responsable: ${charData.owner}`,
      ['Campo', 'Contenido'],
      [
        ['Nombre del proceso', charData.processName],
        ['Objetivo', charData.objective],
        ['Alcance', charData.scope],
        ['Responsable', charData.owner],
        ['Proveedores Internos', charData.suppliersInternal.join('; ')],
        ['Proveedores Externos', charData.suppliersExternal.join('; ')],
        ['Entradas', charData.inputs.join('; ')],
        ['PHVA - PLANEAR', charData.phva.planear],
        ['PHVA - HACER', charData.phva.hacer],
        ['PHVA - VERIFICAR', charData.phva.verificar],
        ['PHVA - ACTUAR', charData.phva.actuar],
        ['Salidas', charData.outputs.join('; ')],
        ['Clientes', charData.clients.join('; ')],
        ['Recursos', charData.resources.join('; ')],
        ['Documentos Asociados', charData.associatedDocs.join('; ')],
        ['Indicadores', charData.indicators.join('; ')],
        ['Riesgos', charData.risks.join('; ')],
        ['Controles', charData.controls.join('; ')],
        ['Requisitos Legales', charData.legalRequirements.join('; ')],
      ]
    );
  }

  function downloadCharExcel() {
    if (!charData) return;
    exportToExcel(
      'Caracterizacion_PHVA_Aseo_CESGE.xlsx',
      'Caracterizacion',
      ['Campo', 'Detalle'],
      [
        ['Nombre del proceso', charData.processName],
        ['Objetivo', charData.objective],
        ['Alcance', charData.scope],
        ['Responsable', charData.owner],
        ['Proveedores Internos', charData.suppliersInternal.join(' | ')],
        ['Proveedores Externos', charData.suppliersExternal.join(' | ')],
        ['Entradas', charData.inputs.join(' | ')],
        ['PLANEAR', charData.phva.planear],
        ['HACER', charData.phva.hacer],
        ['VERIFICAR', charData.phva.verificar],
        ['ACTUAR', charData.phva.actuar],
        ['Salidas', charData.outputs.join(' | ')],
        ['Clientes', charData.clients.join(' | ')],
        ['Recursos', charData.resources.join(' | ')],
        ['Riesgos', charData.risks.join(' | ')],
        ['Controles', charData.controls.join(' | ')],
        ['Requisitos Legales', charData.legalRequirements.join(' | ')],
      ]
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Flujograma, Mapa de Procesos y Caracterización PHVA
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Documentación arquitectónica del proceso de aseo y residuos sólidos: visual, editable y descargable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg whitespace-nowrap"
            >
              {editMode ? 'Finalizar Edición' : 'Habilitar Edición'}
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

      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('flowchart')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            tab === 'flowchart' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" /> Flujograma (16 pasos)
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            tab === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Network className="w-3.5 h-3.5" /> Mapa de Procesos
        </button>
        <button
          type="button"
          onClick={() => setTab('char')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md ${
            tab === 'char' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Caracterización PHVA
        </button>
      </div>

      {/* 1. FLUJOGRAMA */}
      {tab === 'flowchart' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Flujograma del Proceso de Administración del Aseo
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadFlowchartPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Descargar PDF
              </button>
              {editMode && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setFlowchart((prev) => [
                        ...prev,
                        {
                          id: `step-${Date.now()}`,
                          stepNumber: prev.length + 1,
                          title: 'Nueva actividad',
                          nodeType: 'actividad',
                          responsible: 'Supervisor',
                          inputs: 'Por definir',
                          outputs: 'Por definir',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Paso
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveDoc('flowchart', flowchart)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar Flujograma
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 max-w-4xl mx-auto">
            {flowchart.map((step, idx) => {
              const isDecision = step.nodeType === 'decision';
              const isBoundary = step.nodeType === 'inicio' || step.nodeType === 'fin';
              return (
                <React.Fragment key={step.id}>
                  <div
                    className={`p-4 border transition-colors ${
                      isBoundary
                        ? 'rounded-full border-emerald-600 bg-emerald-50/70'
                        : isDecision
                        ? 'rounded-xl border-amber-400 bg-amber-50/60'
                        : 'rounded-xl border-slate-200 bg-slate-50/40'
                    }`}
                  >
                    {editMode ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center">
                        <div className="sm:col-span-1 font-mono font-bold">#{step.stepNumber}</div>
                        <input
                          value={step.title}
                          onChange={(e) => {
                            const copy = [...flowchart];
                            copy[idx] = { ...step, title: e.target.value };
                            setFlowchart(copy);
                          }}
                          className="sm:col-span-4 px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-semibold"
                        />
                        <select
                          value={step.nodeType}
                          onChange={(e) => {
                            const copy = [...flowchart];
                            copy[idx] = { ...step, nodeType: e.target.value as FlowchartStep['nodeType'] };
                            setFlowchart(copy);
                          }}
                          className="sm:col-span-2 px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                        >
                          <option value="inicio">Inicio</option>
                          <option value="actividad">Actividad</option>
                          <option value="decision">Decisión</option>
                          <option value="fin">Fin</option>
                        </select>
                        <input
                          value={step.responsible}
                          onChange={(e) => {
                            const copy = [...flowchart];
                            copy[idx] = { ...step, responsible: e.target.value };
                            setFlowchart(copy);
                          }}
                          placeholder="Responsable"
                          className="sm:col-span-2 px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                        />
                        <input
                          value={step.outputs}
                          onChange={(e) => {
                            const copy = [...flowchart];
                            copy[idx] = { ...step, outputs: e.target.value };
                            setFlowchart(copy);
                          }}
                          placeholder="Salida"
                          className="sm:col-span-2 px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setFlowchart((prev) => prev.filter((_, i) => i !== idx))}
                          className="sm:col-span-1 text-red-700 hover:bg-red-50 p-1.5 rounded-md justify-self-end"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">
                            <span className="font-mono text-emerald-800 mr-2">
                              {String(step.stepNumber).padStart(2, '0')}.
                            </span>
                            {step.title}
                            {isDecision && (
                              <span className="ml-2 text-[11px] font-semibold text-amber-800">
                                [Punto de Decisión]
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 mt-1">
                            <strong>Entradas:</strong> {step.inputs} · <strong>Salidas:</strong> {step.outputs}
                          </div>
                        </div>
                        <div className="text-slate-700 font-medium whitespace-nowrap shrink-0">
                          Resp: {step.responsible}
                        </div>
                      </div>
                    )}
                  </div>
                  {idx < flowchart.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. MAPA DE PROCESOS */}
      {tab === 'map' && processMap && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Mapa del Proceso de Gestión del Aseo – CESGE</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadProcessMapPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Descargar PDF
              </button>
              {editMode && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveDoc('process_map', processMap)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Mapa
                </button>
              )}
            </div>
          </div>

          {(
            [
              { key: 'strategic', title: 'Procesos Estratégicos', tone: 'border-blue-300 bg-blue-50/40' },
              { key: 'misional', title: 'Procesos Misionales (Cadena de Valor Operativa)', tone: 'border-emerald-300 bg-emerald-50/40' },
              { key: 'support', title: 'Procesos de Apoyo', tone: 'border-slate-300 bg-slate-50/70' },
              { key: 'evaluation', title: 'Procesos de Evaluación y Mejora', tone: 'border-amber-300 bg-amber-50/40' },
            ] as const
          ).map((block) => (
            <div key={block.key} className={`p-4 rounded-xl border ${block.tone} space-y-3`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">{block.title}</h4>
                {editMode && (
                  <button
                    type="button"
                    onClick={() =>
                      setProcessMap({
                        ...processMap,
                        [block.key]: [...processMap[block.key], 'Nuevo subproceso'],
                      })
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    + Agregar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {processMap[block.key].map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-800 flex items-center justify-between gap-2">
                    {editMode ? (
                      <>
                        <input
                          value={item}
                          onChange={(e) => {
                            const updated = [...processMap[block.key]];
                            updated[idx] = e.target.value;
                            setProcessMap({ ...processMap, [block.key]: updated });
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = processMap[block.key].filter((_, i) => i !== idx);
                            setProcessMap({ ...processMap, [block.key]: updated });
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span>{item}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. CARACTERIZACIÓN PHVA */}
      {tab === 'char' && charData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Ficha de Caracterización: {charData.processName}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadCharPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={downloadCharExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              {editMode && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveDoc('characterization', charData)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Ficha
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Objetivo del proceso</div>
              {editMode ? (
                <textarea
                  rows={3}
                  value={charData.objective}
                  onChange={(e) => setCharData({ ...charData, objective: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              ) : (
                <p className="text-slate-700 leading-relaxed">{charData.objective}</p>
              )}
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Alcance y Responsable</div>
              {editMode ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={charData.scope}
                    onChange={(e) => setCharData({ ...charData, scope: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                  <input
                    value={charData.owner}
                    onChange={(e) => setCharData({ ...charData, owner: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              ) : (
                <>
                  <p className="text-slate-700">{charData.scope}</p>
                  <p className="text-slate-900 font-semibold pt-1">Responsable: {charData.owner}</p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {(['planear', 'hacer', 'verificar', 'actuar'] as const).map((phase) => (
              <div key={phase} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="font-bold text-emerald-900 uppercase">{phase}</div>
                {editMode ? (
                  <textarea
                    rows={4}
                    value={charData.phva[phase]}
                    onChange={(e) =>
                      setCharData({
                        ...charData,
                        phva: { ...charData.phva, [phase]: e.target.value },
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  />
                ) : (
                  <p className="text-slate-700 leading-relaxed">{charData.phva[phase]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Proveedores (Internos / Externos)</div>
              <p className="text-slate-600">
                <strong>Internos:</strong> {charData.suppliersInternal.join(', ')}
              </p>
              <p className="text-slate-600">
                <strong>Externos:</strong> {charData.suppliersExternal.join(', ')}
              </p>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Entradas</div>
              <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                {charData.inputs.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Salidas y Clientes</div>
              <p className="text-slate-700">
                <strong>Salidas:</strong> {charData.outputs.join(', ')}
              </p>
              <p className="text-slate-700 pt-1">
                <strong>Clientes:</strong> {charData.clients.join(', ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Recursos, Documentos e Indicadores</div>
              <p className="text-slate-700"><strong>Recursos:</strong> {charData.resources.join(', ')}</p>
              <p className="text-slate-700"><strong>Documentos:</strong> {charData.associatedDocs.join(', ')}</p>
              <p className="text-slate-700"><strong>Indicadores:</strong> {charData.indicators.join(', ')}</p>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-bold text-slate-900">Riesgos, Controles y Requisitos Legales</div>
              <p className="text-slate-700"><strong>Riesgos:</strong> {charData.risks.join(', ')}</p>
              <p className="text-slate-700"><strong>Controles:</strong> {charData.controls.join(', ')}</p>
              <p className="text-slate-700"><strong>Normatividad:</strong> {charData.legalRequirements.join(', ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
