import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | boolean>>
) {
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('PLATAFORMA INTEGRAL DE ADMINISTRACIÓN DEL ASEO Y RESIDUOS SÓLIDOS – CESGE', 14, 15);
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text(title, 14, 22);
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${subtitle} · Generado: ${new Date().toLocaleString('es-CO')}`, 14, 28);

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ''))),
    startY: 33,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function downloadSstFr96Template() {
  const headers = [
    'Nombre del producto',
    'Categoría',
    'Clasificación de uso',
    'Marca',
    'Fabricante o proveedor',
    'Uso específico',
    'Presentación',
    'Unidad de medida',
    'Cantidad disponible',
    'Cantidad mínima',
    'Precio unitario',
    'Fecha de vencimiento',
    'Lote',
    'Ubicación de almacenamiento',
    'Ficha de datos de seguridad',
    'Clasificación de peligros SGA',
    'Recomendaciones de manipulación',
    'Elementos de protección personal requeridos',
  ];
  const sampleNote = [
    'Ejemplo: Hipoclorito de sodio al 5.25%',
    'Desinfectantes',
    'Operativo',
    'Marca del proveedor',
    'Proveedor autorizado',
    'Desinfección de baños y pisos según FDS',
    'Garrafa x 20 L',
    'L',
    0,
    5,
    0,
    '2027-12-31',
    'LOTE-001',
    'Cuarto de almacenamiento Sótano',
    'FDS-01 vigente en carpeta SGA',
    'Corrosivo / Irritante (Consultar FDS)',
    'No mezclar con ácidos ni amoníaco; consultar dilución en FDS',
    'Guantes de nitrilo, monogafas, tapabocas, delantal impermeable',
  ];
  exportToExcel('Plantilla_SST_FR_96_SENA.xlsx', 'SST-FR-96', headers, [sampleNote]);
}

export function downloadCesgeSpacesTemplate() {
  const headers = ['Piso', 'Ambiente', 'Tipo', 'Disponibilidad', 'Franja o Horario de Formación'];
  const example = ['Piso 1', 'Nombre del ambiente o área', 'Ambiente de Formación', 'Disponible', 'Horario de formación'];
  exportToExcel('Plantilla_Ambientes_CESGE.xlsx', 'Ambientes_CESGE', headers, [example]);
}

export async function parseExcelFile(file: File): Promise<Array<Record<string, unknown>>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
}
