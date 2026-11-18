import React from 'react';
import { BookOpen, Building2, Camera, Calendar, FlaskConical, Recycle, GitBranch, BarChart3, ShieldAlert, FileSpreadsheet } from 'lucide-react';

export default function UserManualPanel() {
  const sections = [
    {
      icon: Building2,
      title: '1. Mapa Interactivo de Torre Norte',
      desc: 'Seleccione cualquier nivel desde Sótano y Parqueadero hasta el Piso 10 y Zonas Exteriores. Verifique los elementos comunes de cada piso (barandales de vidrio, pasamanos, canecas blancas/negras, zonas de circulación y sillas de 3 puestos), actualice disponibilidad de formación en tiempo real, importe listados Excel del CESGE o agregue/edite espacios sin alterar el historial.',
    },
    {
      icon: Camera,
      title: '2. Reconocimiento Visual IA y Evidencias Antes/Después',
      desc: 'Cargue o tome fotografías de un espacio para que la IA identifique elementos que requieren limpieza y condiciones visibles. Para actividades ejecutadas, cargue la fotografía de Antes y Después: el sistema emite una evaluación visual objetiva y advierte cuando la evidencia es insuficiente.',
    },
    {
      icon: Calendar,
      title: '3. Programación de Jornadas (Mañana, Tarde, Noche)',
      desc: 'Administre horarios, responsables y calendarios diarios, semanales y mensuales (lunes a sábado). Si requiere programar un domingo, el sistema solicita justificación obligatoria. Verifique la disponibilidad real de formación antes de asignar limpieza para no interrumpir clases.',
    },
    {
      icon: FlaskConical,
      title: '4. Inventario (SST-FR-96), Consumo y Entrega de Dotación / EPP',
      desc: 'Importe el archivo Excel SENA SST-FR-96 o registre productos, EPP y uniformes. Controle consumos descontando stock automáticamente y registre cada entrega de dotación, EPP, uniformes y artículos de aseo indicando quién entrega, fecha, hora, destinatario, tallas y confirmación de recibido.',
    },
    {
      icon: Recycle,
      title: '5. Gestión de Residuos Sólidos (Resolución 2184 de 2019)',
      desc: 'Controle recipientes blancos (aprovechables), negros (no aprovechables) y necesidades de recipientes verdes (orgánicos aprovechables). Registre peso, bolsas, alertas (caneca llena, falta bolsa, mezcla de residuos) y verifique la hora de paso del camión recolector.',
    },
    {
      icon: GitBranch,
      title: '6. Flujograma, Mapa de Procesos y Caracterización PHVA',
      desc: 'Consulte, edite, guarde y descargue en PDF/SVG los 16 pasos del flujograma operativo, el mapa de procesos (estratégicos, misionales, apoyo, evaluación) y la ficha de caracterización bajo ciclo PHVA.',
    },
    {
      icon: BarChart3,
      title: '7. Indicadores y Cafetería / Daños',
      desc: 'Consulte los indicadores por piso y jornada, administre insumos de cafetería (qué hay, qué falta y asignaciones) y reporte equipos o áreas dañadas en "Cafetería y Daños". Exporte cualquiera de los 19 reportes oficiales en PDF y Excel.',
    },
    {
      icon: ShieldAlert,
      title: '8. Auditorías Pendientes, Hallazgos y Matriz Legal 2026',
      desc: 'Visualice avisos y fechas de auditorías pendientes junto con sus requisitos de preparación. Gestione listas de chequeo, hallazgos, planes de mejoramiento y verifique la Matriz Legal Colombiana vigente hasta 2026.',
    },
    {
      icon: FileSpreadsheet,
      title: '9. Control de Acceso, Guardado y Trazabilidad',
      desc: 'Use los botones Guardar en cada formulario, la barra de búsqueda superior para localizar espacios, entregas, insumos, daños o normas, y el botón Cerrar Sesión al finalizar. Los perfiles Administrador y Directivo pueden administrar y eliminar cuentas de usuario.',
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Manual del Usuario – Plataforma Integral CESGE Torre Norte
            </h2>
            <p className="text-xs text-slate-600">
              Guía operativa de referencia rápida ubicada en la raíz de la plataforma
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-500">
          Operación estándar: Lunes a Sábado · Jornadas Mañana / Tarde / Noche
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.title} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{sec.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
