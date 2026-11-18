import React, { useState } from 'react';
import { Camera, Upload, Eye, Save, Trash2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  BeforeAfterComparisonResult,
  Floor,
  PhotoAnalysisResult,
  PhotoRecord,
  Space,
  User,
} from '../types/cesge';
import { apiFetch } from '../utils/api';

interface AiVisionModuleProps {
  user: User;
  floors: Floor[];
  spaces: Space[];
  photos: PhotoRecord[];
  onRefresh: () => Promise<void>;
}

export default function AiVisionModule({
  user,
  floors,
  spaces,
  photos,
  onRefresh,
}: AiVisionModuleProps) {
  const [tab, setTab] = useState<'identify' | 'compare'>('identify');
  const [selectedFloor, setSelectedFloor] = useState(floors[1]?.code || 'PISO-01');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [customSpaceName, setCustomSpaceName] = useState('');
  const [activityTitle, setActivityTitle] = useState('Limpieza y desinfección general');
  const [responsible, setResponsible] = useState(user.fullName);

  const [primaryImage, setPrimaryImage] = useState<string>('');
  const [beforeImage, setBeforeImage] = useState<string>('');
  const [afterImage, setAfterImage] = useState<string>('');

  const [analysis, setAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [comparison, setComparison] = useState<BeforeAfterComparisonResult | null>(null);

  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const floorSpaces = spaces.filter((s) => s.floorCode === selectedFloor);

  function readFileAsDataUrl(file: File, setter: (v: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyzeSpace() {
    if (!primaryImage) {
      setFeedback({ type: 'err', msg: 'Cargue o tome una fotografía del espacio primero.' });
      return;
    }
    setLoadingAi(true);
    setFeedback(null);
    setAnalysis(null);
    try {
      const res = await apiFetch<{ analysis: PhotoAnalysisResult }>('/api/ai/analyze-space', {
        method: 'POST',
        body: JSON.stringify({ imageDataUrl: primaryImage, floorHint: selectedFloor }),
      });
      setAnalysis(res.analysis);
      if (!customSpaceName && res.analysis.environmentName) {
        setCustomSpaceName(res.analysis.environmentName);
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error analizando la fotografía.',
      });
    } finally {
      setLoadingAi(false);
    }
  }

  async function handleCompareBeforeAfter() {
    if (!beforeImage || !afterImage) {
      setFeedback({
        type: 'err',
        msg: 'Cargue ambas fotografías (Antes y Después) para realizar la evaluación visual.',
      });
      return;
    }
    setLoadingAi(true);
    setFeedback(null);
    setComparison(null);
    const chosenSpace = floorSpaces.find((s) => String(s.id) === selectedSpaceId);
    try {
      const res = await apiFetch<{ comparison: BeforeAfterComparisonResult }>(
        '/api/ai/compare-before-after',
        {
          method: 'POST',
          body: JSON.stringify({
            beforeImageDataUrl: beforeImage,
            afterImageDataUrl: afterImage,
            floorCode: selectedFloor,
            spaceName: chosenSpace?.name || customSpaceName || 'Ambiente Torre Norte',
            activityTitle,
          }),
        }
      );
      setComparison(res.comparison);
    } catch (err) {
      setFeedback({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Error comparando las fotografías.',
      });
    } finally {
      setLoadingAi(false);
    }
  }

  async function handleSaveEvidence() {
    const chosenSpace = floorSpaces.find((s) => String(s.id) === selectedSpaceId);
    const finalSpaceName = chosenSpace?.name || customSpaceName.trim() || analysis?.environmentName || '';
    if (!finalSpaceName) {
      setFeedback({ type: 'err', msg: 'Seleccione o escriba el nombre del ambiente antes de guardar.' });
      return;
    }
    if (tab === 'identify' && !primaryImage) {
      setFeedback({ type: 'err', msg: 'Debe cargar una fotografía para guardar la ficha.' });
      return;
    }
    if (tab === 'compare' && (!beforeImage || !afterImage)) {
      setFeedback({ type: 'err', msg: 'Debe cargar ambas fotografías (Antes y Después) para guardar.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/photos', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: chosenSpace ? chosenSpace.id : null,
          floorCode: selectedFloor,
          spaceName: finalSpaceName,
          photoType: tab === 'identify' ? 'Identificación' : 'Antes',
          activityTitle,
          responsible,
          imageDataUrl: tab === 'identify' ? primaryImage : beforeImage,
          pairImageDataUrl: tab === 'compare' ? afterImage : null,
          aiAnalysis: tab === 'identify' ? analysis : null,
          aiComparison: tab === 'compare' ? comparison : null,
          capturedAt: new Date().toISOString(),
        }),
      });
      setFeedback({
        type: 'ok',
        msg: `Ficha fotográfica guardada con fecha, hora, piso (${selectedFloor}), ambiente (${finalSpaceName}) y responsable.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error guardando evidencia.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePhoto(id: number) {
    try {
      await apiFetch(`/api/photos/${id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error eliminando registro.' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Reconocimiento Visual por IA y Evidencia Antes / Después
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Identifique elementos del espacio (mesas, sillas, computadores, microondas, neveras, vidrios, barandales, pasamanos y canecas) y evalúe visualmente el resultado de la limpieza.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('identify');
              setFeedback(null);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'identify' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Identificación de Espacio
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('compare');
              setFeedback(null);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === 'compare' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Comparación Antes y Después
          </button>
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" />
        <span>
          <strong>Criterio de Auditoría Visual:</strong> La Inteligencia Artificial presenta resultados como{' '}
          <strong>evaluaciones visuales orientativas</strong>, nunca como pruebas absolutas. Si las fotografías no tienen suficiente claridad o ángulo coincidente, la IA reportará evidencia insuficiente sin afirmar cumplimiento.
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

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Piso / Zona</label>
            <select
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setSelectedSpaceId('');
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {floors.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ambiente registrado</label>
            <select
              value={selectedSpaceId}
              onChange={(e) => {
                setSelectedSpaceId(e.target.value);
                if (e.target.value) setCustomSpaceName('');
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">
                {floorSpaces.length > 0
                  ? `-- Seleccionar ambiente (${floorSpaces.length} registrados) --`
                  : '-- Sin ambientes en este nivel / Ingresar nombre --'}
              </option>
              {floorSpaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del ambiente (si aplica)
            </label>
            <input
              type="text"
              value={customSpaceName}
              onChange={(e) => setCustomSpaceName(e.target.value)}
              placeholder="Nombre del espacio o ambiente"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Responsable</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Actividad asociada</label>
          <input
            type="text"
            value={activityTitle}
            onChange={(e) => setActivityTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        {tab === 'identify' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-3">
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[240px]">
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt="Fotografía del espacio a analizar"
                    className="max-h-64 w-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center space-y-2 text-slate-500">
                    <Camera className="w-8 h-8 mx-auto text-slate-400" />
                    <p className="text-xs">Cargue una fotografía o capture desde la cámara del dispositivo</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Subir fotografía
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFileAsDataUrl(f, setPrimaryImage);
                    }}
                    className="hidden"
                  />
                </label>
                <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFileAsDataUrl(f, setPrimaryImage);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAnalyzeSpace}
                  disabled={loadingAi || !primaryImage}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {loadingAi ? 'Analizando imagen...' : 'Evaluar Espacio con IA'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvidence}
                  disabled={saving || !primaryImage}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Guardar Ficha
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-3 min-h-[280px]">
              <h3 className="text-sm font-bold text-slate-900">Resultado del Reconocimiento Visual</h3>
              {!analysis ? (
                <p className="text-xs text-slate-500">
                  Cargue una imagen y pulse «Evaluar Espacio con IA» para detectar piso probable, tipo de ambiente, mobiliario, canecas y condiciones visibles de suciedad.
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Piso probable</div>
                      <div className="font-bold text-slate-900 mt-0.5">{analysis.probableFloor}</div>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Tipo de espacio</div>
                      <div className="font-bold text-slate-900 mt-0.5">{analysis.spaceType}</div>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Ambiente detectado</div>
                      <div className="font-bold text-slate-900 mt-0.5">{analysis.environmentName}</div>
                    </div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-semibold text-slate-800">Elementos que requieren limpieza:</div>
                    <div className="text-slate-700">{analysis.detectedElements.join(' · ') || 'No identificados'}</div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-semibold text-slate-800">Canecas y recipientes visibles:</div>
                    <div className="text-slate-700">{analysis.detectedBins.join(' · ') || 'Sin canecas visibles en el encuadre'}</div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="font-semibold text-slate-800">Condiciones visibles observadas:</div>
                    <div className="text-slate-700">{analysis.visibleDirtConditions.join(' · ') || 'Sin hallazgos visibles'}</div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    <strong>Nota de evaluación visual:</strong> {analysis.observations} ({analysis.confidenceNote})
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">Fotografía ANTES de la actividad</div>
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 min-h-[200px] flex items-center justify-center">
                  {beforeImage ? (
                    <img src={beforeImage} alt="Antes de la limpieza" className="max-h-56 object-contain rounded-lg" />
                  ) : (
                    <span className="text-xs text-slate-500">Sin imagen ANTES</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Cargar foto ANTES
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFileAsDataUrl(f, setBeforeImage);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">Fotografía DESPUÉS de la actividad</div>
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 min-h-[200px] flex items-center justify-center">
                  {afterImage ? (
                    <img src={afterImage} alt="Después de la limpieza" className="max-h-56 object-contain rounded-lg" />
                  ) : (
                    <span className="text-xs text-slate-500">Sin imagen DESPUÉS</span>
                  )}
                </div>
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Cargar foto DESPUÉS
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readFileAsDataUrl(f, setAfterImage);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCompareBeforeAfter}
                disabled={loadingAi || !beforeImage || !afterImage}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {loadingAi ? 'Evaluando comparación visual...' : 'Comparar Antes y Después con IA'}
              </button>
              <button
                type="button"
                onClick={handleSaveEvidence}
                disabled={saving || !beforeImage || !afterImage}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Guardar Evidencia Antes/Después
              </button>
            </div>

            {comparison && (
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    {comparison.sufficientEvidence ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                    )}
                    <span>Evaluación Visual: {comparison.overallVisualAssessment}</span>
                  </div>
                </div>
                <p className="text-slate-700 leading-relaxed">{comparison.visualEvaluationSummary}</p>
                {!comparison.sufficientEvidence && comparison.insufficientEvidenceReason && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900">
                    <strong>Evidencia insuficiente:</strong> {comparison.insufficientEvidenceReason}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Superficies</div>
                    <div className="text-slate-600 mt-0.5">{comparison.surfacesStatus}</div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Residuos en suelo</div>
                    <div className="text-slate-600 mt-0.5">{comparison.floorWasteStatus}</div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Canecas</div>
                    <div className="text-slate-600 mt-0.5">{comparison.binsStatus}</div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Polvo y manchas</div>
                    <div className="text-slate-600 mt-0.5">{comparison.dustAndStainsStatus}</div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Organización</div>
                    <div className="text-slate-600 mt-0.5">{comparison.organizationStatus}</div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="font-semibold text-slate-800">Baños / Vidrios / Pasamanos</div>
                    <div className="text-slate-600 mt-0.5">{comparison.restroomsOrGlassStatus}</div>
                  </div>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                  {comparison.disclaimer}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HISTORIAL DE FICHAS FOTOGRÁFICAS GUARDADAS */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Archivo de Fichas Fotográficas y Evidencias Guardadas ({photos.length})
          </h3>
        </div>
        {photos.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aún no hay fichas fotográficas guardadas. Cargue una fotografía arriba para iniciar el registro visual trazable.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((ph) => {
              const parsedComp = ph.aiComparisonJson
                ? (JSON.parse(ph.aiComparisonJson) as BeforeAfterComparisonResult)
                : null;
              return (
                <div key={ph.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 flex flex-col">
                  <div className="grid grid-cols-1 gap-1 bg-slate-100 p-2">
                    <div className={ph.pairImageUrl ? 'grid grid-cols-2 gap-2' : ''}>
                      <img
                        src={ph.imageUrl}
                        alt={ph.spaceName}
                        className="h-36 w-full object-cover rounded-lg border border-slate-200"
                      />
                      {ph.pairImageUrl && (
                        <img
                          src={ph.pairImageUrl}
                          alt={`${ph.spaceName} después`}
                          className="h-36 w-full object-cover rounded-lg border border-slate-200"
                        />
                      )}
                    </div>
                  </div>
                  <div className="p-4 text-xs space-y-1.5 flex-1">
                    <div className="font-bold text-slate-900">
                      {ph.floorCode} · {ph.spaceName}
                    </div>
                    <div className="text-slate-600">{ph.activityTitle}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {new Date(ph.capturedAt).toLocaleString('es-CO')} · Resp: {ph.responsible}
                    </div>
                    {parsedComp && (
                      <div className="pt-1 text-blue-800 font-medium">
                        Evaluación IA: {parsedComp.overallVisualAssessment}
                      </div>
                    )}
                  </div>
                  {(user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR') && (
                    <div className="px-4 py-2 border-t border-slate-200 bg-white flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(ph.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
