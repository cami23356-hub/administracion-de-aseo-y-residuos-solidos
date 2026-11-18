import { GoogleGenAI, Type } from '@google/genai';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No se encontró la clave GEMINI_API_KEY en el servidor. Configúrela en el panel de Secrets para habilitar el reconocimiento visual.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeSpacePhoto(
  imageBase64: string,
  mimeType: string,
  floorHint?: string
) {
  const ai = getClient();

  const prompt = `Eres un especialista en visión por computadora, seguridad y salud en el trabajo (SG-SST) y administración de servicios generales del SENA CESGE – Torre Norte (edificio de Sótano a Piso 10 y Zonas Exteriores).
Analiza esta fotografía de un espacio de la infraestructura${floorHint ? ` (piso sugerido por usuario: ${floorHint})` : ''}.
Debes identificar exclusivamente lo que es visible en la imagen sin inventar elementos ocultos:
1. Piso probable (solo si existe señalización visible en la fotografía; de lo contrario indicar "Por confirmar").
2. Tipo de espacio (baño, ambiente con computadores, cafetín, terraza, pasillo/circulación, escaleras, parqueadero, auditorio, oficina, cuarto útil, etc.).
3. Nombre sugerido del ambiente.
4. Elementos que requieren limpieza presentes en la foto (mesas, sillas, sillas de 3 puestos, computadores, escritorios, microondas, neveras, vidrios, barandales de vidrio, pasamanos, sanitarios, lavamanos, pisos, etc.).
5. Canecas y recipientes visibles (color blanco, negro, verde o sin recipiente visible).
6. Condiciones visibles de suciedad, manchas, polvo, residuos en el suelo o desorden.
7. Observaciones y aclaración obligatoria de que esto constituye una evaluación visual preliminar y no una prueba absoluta.

Responde estrictamente en español y en formato JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          probableFloor: { type: Type.STRING },
          spaceType: { type: Type.STRING },
          environmentName: { type: Type.STRING },
          detectedElements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          detectedBins: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          visibleDirtConditions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          observations: { type: Type.STRING },
          confidenceNote: { type: Type.STRING },
        },
        required: [
          'probableFloor',
          'spaceType',
          'environmentName',
          'detectedElements',
          'detectedBins',
          'visibleDirtConditions',
          'observations',
          'confidenceNote',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

export async function compareBeforeAfterPhotos(
  beforeBase64: string,
  beforeMime: string,
  afterBase64: string,
  afterMime: string,
  context: { floorCode: string; spaceName: string; activityTitle: string }
) {
  const ai = getClient();

  const prompt = `Eres un auditor visual y supervisor de aseo institucional del CESGE – Torre Norte.
Compara la PRIMERA imagen (ANTES de la actividad) y la SEGUNDA imagen (DESPUÉS de la actividad) para el espacio "${context.spaceName}" (${context.floorCode}), actividad: "${context.activityTitle}".

REGLAS ESTRICTAS DE EVALUACIÓN:
- Presenta todos los resultados exclusivamente como EVALUACIONES VISUALES basadas en la evidencia fotográfica observada, NUNCA como pruebas absolutas de desinfección o cumplimiento total.
- Si las fotografías corresponden a ángulos totalmente distintos, están borrosas, oscuras o no permiten verificar la misma zona, debes establecer sufficientEvidence = false y overallVisualAssessment = "Evidencia insuficiente", y explicar exactamente qué falta para poder evaluar. No afirmes que la actividad se realizó correctamente si no existe evidencia suficiente.
- Evalúa específicamente:
  1. Superficies limpias o sucias.
  2. Residuos en el suelo.
  3. Canecas llenas o vaciadas/con bolsa.
  4. Polvo visible y manchas.
  5. Elementos desorganizados u organizados (mesas, sillas, equipos).
  6. Baños con condiciones inadecuadas o vidrios/pasamanos con suciedad visible (si aplica al espacio).

Responde en español en JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        { text: 'IMAGEN 1 — ANTES DE LA ACTIVIDAD:' },
        { inlineData: { mimeType: beforeMime, data: beforeBase64 } },
        { text: 'IMAGEN 2 — DESPUÉS DE LA ACTIVIDAD:' },
        { inlineData: { mimeType: afterMime, data: afterBase64 } },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visualEvaluationSummary: { type: Type.STRING },
          sufficientEvidence: { type: Type.BOOLEAN },
          insufficientEvidenceReason: { type: Type.STRING },
          surfacesStatus: { type: Type.STRING },
          floorWasteStatus: { type: Type.STRING },
          binsStatus: { type: Type.STRING },
          dustAndStainsStatus: { type: Type.STRING },
          organizationStatus: { type: Type.STRING },
          restroomsOrGlassStatus: { type: Type.STRING },
          overallVisualAssessment: {
            type: Type.STRING,
            description:
              'Debe ser exactamente uno de: "Evidencia favorable visualmente", "Requiere revisión adicional", o "Evidencia insuficiente".',
          },
          disclaimer: { type: Type.STRING },
        },
        required: [
          'visualEvaluationSummary',
          'sufficientEvidence',
          'insufficientEvidenceReason',
          'surfacesStatus',
          'floorWasteStatus',
          'binsStatus',
          'dustAndStainsStatus',
          'organizationStatus',
          'restroomsOrGlassStatus',
          'overallVisualAssessment',
          'disclaimer',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}
