import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = new DatabaseSync(path.join(DATA_DIR, 'cesge.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMINISTRADOR','SUPERVISOR','PERSONAL DE ASEO','AUDITOR','DIRECTIVO')),
      shift_preference TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      standard_elements TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      has_computers INTEGER NOT NULL DEFAULT 0,
      has_tv INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT 'Disponible',
      training_schedule_note TEXT DEFAULT '',
      elements_detail TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'Sistema',
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER,
      floor_code TEXT NOT NULL,
      space_name TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      activity_title TEXT NOT NULL,
      responsible TEXT NOT NULL,
      image_url TEXT NOT NULL,
      pair_image_url TEXT,
      ai_analysis_json TEXT,
      ai_comparison_json TEXT,
      captured_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      supervisor_name TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      shift_name TEXT NOT NULL,
      floor_id INTEGER NOT NULL,
      space_id INTEGER,
      area_name TEXT NOT NULL,
      activity TEXT NOT NULL,
      responsible TEXT NOT NULL,
      frequency TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      required_products TEXT DEFAULT '',
      required_supplies TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pendiente',
      is_sunday INTEGER NOT NULL DEFAULT 0,
      sunday_justification TEXT DEFAULT '',
      training_conflict_checked INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'Sistema',
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      usage_scope TEXT NOT NULL,
      brand TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      specific_use TEXT DEFAULT '',
      presentation TEXT DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'unidades',
      available_qty REAL NOT NULL DEFAULT 0,
      used_qty REAL NOT NULL DEFAULT 0,
      min_qty REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      expiration_date TEXT DEFAULT '',
      lot TEXT DEFAULT '',
      storage_location TEXT DEFAULT '',
      safety_sheet_ref TEXT DEFAULT '',
      hazard_classification TEXT DEFAULT '',
      handling_recommendations TEXT DEFAULT '',
      required_epp TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'Sistema'
    );

    CREATE TABLE IF NOT EXISTS consumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month_key TEXT NOT NULL,
      shift_name TEXT NOT NULL,
      floor_code TEXT NOT NULL,
      area_name TEXT NOT NULL,
      activity TEXT NOT NULL,
      responsible TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calculated_cost REAL NOT NULL DEFAULT 0,
      fds_verified INTEGER NOT NULL DEFAULT 1,
      notes TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS waste_bins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_code TEXT NOT NULL,
      location TEXT NOT NULL,
      container_type TEXT NOT NULL,
      color TEXT NOT NULL,
      bag_type TEXT NOT NULL,
      condition TEXT NOT NULL DEFAULT 'Óptimo',
      collection_frequency TEXT NOT NULL DEFAULT 'Por jornada',
      needs_additional_green INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS waste_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      collection_time TEXT NOT NULL,
      truck_pickup_time TEXT DEFAULT '',
      truck_verified INTEGER NOT NULL DEFAULT 0,
      floor_code TEXT NOT NULL,
      bin_id INTEGER,
      location TEXT NOT NULL,
      classification TEXT NOT NULL,
      bags_count INTEGER NOT NULL DEFAULT 0,
      weight_kg REAL NOT NULL DEFAULT 0,
      shift_name TEXT NOT NULL,
      responsible TEXT NOT NULL,
      alert_type TEXT NOT NULL DEFAULT 'Ninguna',
      observations TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      FOREIGN KEY (bin_id) REFERENCES waste_bins(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      audit_date TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      auditor_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      requirements_checklist TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER,
      date TEXT NOT NULL,
      floor_code TEXT NOT NULL,
      area_name TEXT NOT NULL,
      finding_type TEXT NOT NULL,
      description TEXT NOT NULL,
      corrective_action TEXT NOT NULL,
      responsible TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Abierto',
      created_by TEXT NOT NULL,
      FOREIGN KEY (audit_id) REFERENCES audit_alerts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS legal_matrix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      norm TEXT NOT NULL,
      year TEXT NOT NULL,
      applicable_article TEXT NOT NULL,
      requirement TEXT NOT NULL,
      process_application TEXT NOT NULL,
      responsible TEXT NOT NULL,
      evidence TEXT NOT NULL,
      compliance_status TEXT NOT NULL DEFAULT 'En proceso',
      official_source TEXT NOT NULL,
      obligation_type TEXT NOT NULL DEFAULT 'Obligación Legal',
      vigency_note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS process_docs (
      doc_type TEXT PRIMARY KEY,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'Sistema'
    );

    CREATE TABLE IF NOT EXISTS change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_date TEXT NOT NULL,
      delivery_time TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      delivered_by TEXT NOT NULL,
      delivered_by_role TEXT DEFAULT '',
      delivered_to TEXT NOT NULL,
      recipient_role TEXT DEFAULT '',
      shift_name TEXT DEFAULT '',
      items_json TEXT NOT NULL,
      condition_note TEXT DEFAULT '',
      received_confirmed INTEGER NOT NULL DEFAULT 1,
      observations TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cafeteria_supplies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Bebidas e insumos de consumo',
      cafeteria_location TEXT NOT NULL DEFAULT 'Todos los cafetines',
      unit TEXT NOT NULL DEFAULT 'unidades',
      current_qty REAL NOT NULL DEFAULT 0,
      min_qty REAL NOT NULL DEFAULT 1,
      assigned_to TEXT DEFAULT '',
      last_assigned_at TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'Sistema'
    );

    CREATE TABLE IF NOT EXISTS cafeteria_supply_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_id INTEGER NOT NULL,
      movement_date TEXT NOT NULL,
      movement_time TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      cafeteria_location TEXT NOT NULL,
      quantity REAL NOT NULL,
      assigned_by TEXT NOT NULL,
      received_by TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supply_id) REFERENCES cafeteria_supplies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS damage_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      report_time TEXT NOT NULL,
      floor_id INTEGER NOT NULL,
      space_name TEXT NOT NULL,
      item_damaged TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Equipo de cafetería',
      severity TEXT NOT NULL DEFAULT 'Media',
      description TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Reportado',
      assigned_technician TEXT DEFAULT '',
      resolution_notes TEXT DEFAULT '',
      resolved_at TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
    );
  `);
}

export function logHistory(
  username: string,
  userRole: string,
  module: string,
  action: string,
  details: string
) {
  db.prepare(
    `INSERT INTO change_history (username, user_role, module, action, details) VALUES (?, ?, ?, ?, ?)`
  ).run(username, userRole, module, action, details);
}

export function seedInitialData() {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users (username, email, full_name, password_hash, role, shift_preference) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertUser.run('admin.cesge', 'admin.cesge@gmail.com', 'Coordinación Administrativa CESGE', hashPassword('CesgeAdmin2026!'), 'ADMINISTRADOR', 'Todas');
    insertUser.run('supervisor.norte', 'supervisor.norte@gmail.com', 'Supervisión Torre Norte', hashPassword('CesgeSup2026!'), 'SUPERVISOR', 'Jornada de la mañana');
    insertUser.run('operario.aseo', 'aseo.torrenorte@gmail.com', 'Equipo Operativo de Aseo', hashPassword('CesgeAseo2026!'), 'PERSONAL DE ASEO', 'Jornada de la mañana');
    insertUser.run('auditor.calidad', 'auditoria.cesge@gmail.com', 'Auditoría Interna Calidad y Ambiental', hashPassword('CesgeAudit2026!'), 'AUDITOR', 'Todas');
    insertUser.run('directivo.cesge', 'direccion.cesge@gmail.com', 'Dirección Centro CESGE', hashPassword('CesgeDir2026!'), 'DIRECTIVO', 'Todas');
  }

  const floorCount = (db.prepare('SELECT COUNT(*) as c FROM floors').get() as { c: number }).c;
  if (floorCount === 0) {
    const commonElements = JSON.stringify([
      'Barandales de vidrio',
      'Pasamanos de seguridad',
      'Canecas de residuos blancos y negros, con sus respectivas bolsas',
      'Zonas de circulación y acceso',
      'Sillas de 3 puestos',
    ]);

    const floorDefs: Array<{
      code: string;
      name: string;
      sortOrder: number;
      notes: string;
    }> = [
      { code: 'SOTANO', name: 'Sótano y Parqueadero', sortOrder: 0, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-01', name: 'Piso 1', sortOrder: 1, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-02', name: 'Piso 2', sortOrder: 2, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-03', name: 'Piso 3', sortOrder: 3, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-04', name: 'Piso 4', sortOrder: 4, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-05', name: 'Piso 5', sortOrder: 5, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-06', name: 'Piso 6', sortOrder: 6, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-07', name: 'Piso 7', sortOrder: 7, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-08', name: 'Piso 8', sortOrder: 8, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-09', name: 'Piso 9', sortOrder: 9, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'PISO-10', name: 'Piso 10', sortOrder: 10, notes: 'Nivel de infraestructura. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
      { code: 'EXTERIORES', name: 'Zonas Exteriores', sortOrder: 11, notes: 'Perímetro exterior. Registre manualmente o importe desde Excel los espacios y áreas reales.' },
    ];

    const insertFloor = db.prepare(
      `INSERT INTO floors (code, name, sort_order, standard_elements, notes) VALUES (?, ?, ?, ?, ?)`
    );

    for (const f of floorDefs) {
      insertFloor.run(f.code, f.name, f.sortOrder, commonElements, f.notes);
    }
  }

  const spaceCount = (db.prepare('SELECT COUNT(*) as c FROM spaces').get() as { c: number }).c;
  if (spaceCount === 0) {
    const floorMap = new Map<string, number>();
    const floorRows = db.prepare('SELECT id, code FROM floors').all() as Array<{ id: number; code: string }>;
    for (const fr of floorRows) {
      floorMap.set(fr.code, fr.id);
    }

    type PdfAreaRow = {
      piso: number;
      ambiente: string;
      franja: string;
      dispFormacion: 'SI' | 'NO';
      descripcion: string;
      capacidad: number | null;
      mt2: number;
    };

    const areasCesgePdf: PdfAreaRow[] = [
      { piso: 1, ambiente: '101', franja: 'AM', dispFormacion: 'SI', descripcion: 'Cocina demostrativa Taller', capacidad: 30, mt2: 121.97 },
      { piso: 2, ambiente: '201', franja: 'AM', dispFormacion: 'SI', descripcion: 'Simulador de transporte Taller', capacidad: 20, mt2: 64.53 },
      { piso: 2, ambiente: '202', franja: 'AM', dispFormacion: 'SI', descripcion: 'Simulador de montacargas Taller', capacidad: 25, mt2: 65.07 },
      { piso: 2, ambiente: '203', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 64.53 },
      { piso: 2, ambiente: '204', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Laboratorio comunicación gráfica', capacidad: 10, mt2: 39.2 },
      { piso: 3, ambiente: '300', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: null, mt2: 36 },
      { piso: 3, ambiente: '301', franja: 'AM', dispFormacion: 'NO', descripcion: 'Laboratorio Fábrica de Software', capacidad: 25, mt2: 28.96 },
      { piso: 3, ambiente: '302', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc Ambiente de multimedia', capacidad: 22, mt2: 58.24 },
      { piso: 3, ambiente: '304', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: null, mt2: 36 },
      { piso: 4, ambiente: '402', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina', capacidad: 15, mt2: 36 },
      { piso: 4, ambiente: '403', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 30, mt2: 49.39 },
      { piso: 4, ambiente: '404', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 28, mt2: 44.05 },
      { piso: 4, ambiente: '405', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 21, mt2: 34.24 },
      { piso: 4, ambiente: '406', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 34.24 },
      { piso: 4, ambiente: '407', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 33.32 },
      { piso: 4, ambiente: '408', franja: 'AM', dispFormacion: 'SI', descripcion: 'Taller de Peluquería', capacidad: 23, mt2: 34.44 },
      { piso: 4, ambiente: '409', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 24, mt2: 36.54 },
      { piso: 4, ambiente: '410', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 24, mt2: 36.34 },
      { piso: 4, ambiente: '411', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 24, mt2: 37.42 },
      { piso: 5, ambiente: '501', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 26, mt2: 41.67 },
      { piso: 5, ambiente: '502', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.48 },
      { piso: 5, ambiente: '503', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.96 },
      { piso: 5, ambiente: '504', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.93 },
      { piso: 5, ambiente: '505', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 31, mt2: 50.18 },
      { piso: 5, ambiente: '506', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 31.89 },
      { piso: 5, ambiente: '507', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 25, mt2: 40.28 },
      { piso: 5, ambiente: '508', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller de Cableado', capacidad: null, mt2: 20 },
      { piso: 5, ambiente: '509', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Laboratorio de Cableado', capacidad: null, mt2: 25 },
      { piso: 6, ambiente: '601', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficina EECL', capacidad: null, mt2: 36 },
      { piso: 6, ambiente: '602', franja: 'AM', dispFormacion: 'NO', descripcion: 'Tradicional Ambiente ENI', capacidad: 28, mt2: 44.37 },
      { piso: 6, ambiente: '603', franja: 'AM', dispFormacion: 'NO', descripcion: 'Tradicional Ambiente ENI', capacidad: 28, mt2: 44.96 },
      { piso: 6, ambiente: '604', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.93 },
      { piso: 6, ambiente: '605', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 32, mt2: 50.22 },
      { piso: 6, ambiente: '606', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 20, mt2: 31.89 },
      { piso: 6, ambiente: '607', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 25, mt2: 40.28 },
      { piso: 6, ambiente: '608', franja: 'AM', dispFormacion: 'NO', descripcion: 'Bodega de Mantenimiento', capacidad: null, mt2: 36 },
      { piso: 6, ambiente: '609', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 22, mt2: 35.04 },
      { piso: 6, ambiente: '610', franja: 'AM', dispFormacion: 'NO', descripcion: 'Equipo Pedagógico', capacidad: null, mt2: 36 },
      { piso: 7, ambiente: '701', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 26, mt2: 41.66 },
      { piso: 7, ambiente: '702', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.06 },
      { piso: 7, ambiente: '703', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
      { piso: 7, ambiente: '704', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
      { piso: 7, ambiente: '705', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.06 },
      { piso: 7, ambiente: '706', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 41.66 },
      { piso: 7, ambiente: '707', franja: 'AM', dispFormacion: 'NO', descripcion: 'Sala de Instructores', capacidad: null, mt2: 36 },
      { piso: 8, ambiente: '801', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 35.85 },
      { piso: 8, ambiente: '802', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.15 },
      { piso: 8, ambiente: '803', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
      { piso: 8, ambiente: '804', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.51 },
      { piso: 8, ambiente: '805', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 28, mt2: 44.14 },
      { piso: 8, ambiente: '806', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 34, mt2: 54.76 },
      { piso: 8, ambiente: '807', franja: 'AM', dispFormacion: 'NO', descripcion: 'Sala de Instructores', capacidad: null, mt2: 36 },
      { piso: 9, ambiente: '901', franja: 'AM', dispFormacion: 'NO', descripcion: 'Oficinas Administrativas y Coordinaciones', capacidad: 75, mt2: 380 },
      { piso: 10, ambiente: '1001', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 23, mt2: 35.85 },
      { piso: 10, ambiente: '1002', franja: 'AM', dispFormacion: 'SI', descripcion: 'Tradicional', capacidad: 29, mt2: 44.14 },
      { piso: 10, ambiente: '1003', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.46 },
      { piso: 10, ambiente: '1004', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 22, mt2: 34.46 },
      { piso: 10, ambiente: '1005', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 29, mt2: 44.14 },
      { piso: 10, ambiente: '1006', franja: 'AM', dispFormacion: 'NO', descripcion: 'Taller Ambiente de Edición', capacidad: 16, mt2: 23.85 },
      { piso: 10, ambiente: '1007', franja: 'AM', dispFormacion: 'SI', descripcion: 'Pc', capacidad: 23, mt2: 36 },
      { piso: 10, ambiente: '1008', franja: 'AM', dispFormacion: 'NO', descripcion: 'Bodega de Industrias Gráficas', capacidad: null, mt2: 23.85 },
    ];

    const insertSpace = db.prepare(
      `INSERT INTO spaces (floor_id, name, category, has_computers, has_tv, availability, training_schedule_note, elements_detail, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AREAS CESGE PDF')`
    );

    for (const row of areasCesgePdf) {
      const code = `PISO-${String(row.piso).padStart(2, '0')}`;
      const floorId = floorMap.get(code);
      if (!floorId) continue;
      const descLower = row.descripcion.toLowerCase();
      const hasComputers =
        descLower.includes('pc') ||
        descLower.includes('software') ||
        descLower.includes('edición') ||
        descLower.includes('comunicación gráfica') ||
        descLower.includes('simulador')
          ? 1
          : 0;
      let category = 'Ambiente de Formación';
      if (descLower.includes('oficina') || descLower.includes('instructores') || descLower.includes('pedagógico')) {
        category = 'Área Administrativa';
      } else if (descLower.includes('bodega')) {
        category = 'Almacenamiento';
      } else if (descLower.includes('pc')) {
        category = 'Ambiente con Cómputo';
      } else if (descLower.includes('software') || descLower.includes('cableado')) {
        category = 'Área Tecnológica';
      } else if (descLower.includes('taller') || descLower.includes('simulador') || descLower.includes('cocina')) {
        category = 'Taller Especializado';
      }

      const capText = row.capacidad !== null ? `${row.capacidad} personas` : 'No especificada';
      const mt2Text = `${String(row.mt2).replace('.', ',')} m²`;
      insertSpace.run(
        floorId,
        `${row.ambiente} - ${row.descripcion}`,
        category,
        hasComputers,
        0,
        'Disponible',
        `Franja ${row.franja} · Disponible formación: ${row.dispFormacion}`,
        `Área: ${mt2Text} · Capacidad real: ${capText} · Sede Torre Norte`
      );
    }
  }

  // Biblioteca (Piso 1), Auditorios (Piso 1 y Piso 2) y Terrazas separadas a cada lado (Piso 4 y Piso 7)
  {
    const floorMap = new Map<string, number>();
    const floorRows = db.prepare('SELECT id, code FROM floors').all() as Array<{ id: number; code: string }>;
    for (const fr of floorRows) {
      floorMap.set(fr.code, fr.id);
    }

    const insertArchSpace = db.prepare(
      `INSERT INTO spaces (floor_id, name, category, has_computers, has_tv, availability, training_schedule_note, elements_detail, updated_by)
       VALUES (?, ?, ?, ?, ?, 'Disponible', ?, ?, 'Infraestructura Torre Norte')`
    );

    const archSpaces: Array<{
      floorCode: string;
      name: string;
      category: string;
      hasComputers: number;
      hasTv: number;
      scheduleNote: string;
      detail: string;
    }> = [
      {
        floorCode: 'PISO-01',
        name: 'Biblioteca Piso 1',
        category: 'Biblioteca',
        hasComputers: 1,
        hasTv: 0,
        scheduleNote: 'Acceso continuo por jornadas',
        detail: 'Biblioteca CESGE Piso 1 · Estanterías, mesas de lectura, equipos de cómputo de consulta y zona de estudio · Sede Torre Norte',
      },
      {
        floorCode: 'PISO-01',
        name: 'Auditorio Piso 1',
        category: 'Auditorio',
        hasComputers: 0,
        hasTv: 1,
        scheduleNote: 'Uso institucional / eventos',
        detail: 'Auditorio principal Piso 1 · Silletería, tarima, pantallas/audio y zonas de acceso · Sede Torre Norte',
      },
      {
        floorCode: 'PISO-02',
        name: 'Auditorio Piso 2',
        category: 'Auditorio',
        hasComputers: 0,
        hasTv: 1,
        scheduleNote: 'Uso institucional / formación',
        detail: 'Auditorio Piso 2 · Silletería, pantallas/audio y circulación · Sede Torre Norte',
      },
      {
        floorCode: 'PISO-04',
        name: 'Terraza Lado Izquierdo (Piso 4)',
        category: 'Terraza / Alimentación',
        hasComputers: 0,
        hasTv: 0,
        scheduleNote: 'Acceso abierto por jornadas',
        detail: 'Ubicada en el costado izquierdo del Piso 4 (separada de la terraza derecha) · Mesas, sillas, microondas y canecas de residuos',
      },
      {
        floorCode: 'PISO-04',
        name: 'Terraza Lado Derecho (Piso 4)',
        category: 'Terraza / Alimentación',
        hasComputers: 0,
        hasTv: 0,
        scheduleNote: 'Acceso abierto por jornadas',
        detail: 'Ubicada en el costado derecho del Piso 4 (separada de la terraza izquierda) · Mesas, sillas, microondas y canecas de residuos',
      },
      {
        floorCode: 'PISO-07',
        name: 'Terraza Lado Izquierdo (Piso 7)',
        category: 'Terraza / Alimentación',
        hasComputers: 0,
        hasTv: 0,
        scheduleNote: 'Acceso abierto por jornadas',
        detail: 'Ubicada en el costado izquierdo del Piso 7 (separada de la terraza derecha) · Puestos, mesas, microondas y canecas de residuos',
      },
      {
        floorCode: 'PISO-07',
        name: 'Terraza Lado Derecho (Piso 7)',
        category: 'Terraza / Alimentación',
        hasComputers: 0,
        hasTv: 0,
        scheduleNote: 'Acceso abierto por jornadas',
        detail: 'Ubicada en el costado derecho del Piso 7 (separada de la terraza izquierda) · Puestos, mesas, microondas y canecas de residuos',
      },
    ];

    for (const sp of archSpaces) {
      const fId = floorMap.get(sp.floorCode);
      if (!fId) continue;
      const exists = db
        .prepare(`SELECT id FROM spaces WHERE floor_id = ? AND lower(name) = lower(?)`)
        .get(fId, sp.name);
      if (!exists) {
        insertArchSpace.run(fId, sp.name, sp.category, sp.hasComputers, sp.hasTv, sp.scheduleNote, sp.detail);
      }
    }
  }

  const shiftCount = (db.prepare('SELECT COUNT(*) as c FROM shifts').get() as { c: number }).c;
  if (shiftCount === 0) {
    const insShift = db.prepare(
      `INSERT INTO shifts (name, start_time, end_time, duration_minutes, frequency, supervisor_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insShift.run('Jornada de la mañana', '06:00', '14:00', 480, 'Lunes a sábado', 'Supervisión Torre Norte', 'Aseo previo al inicio de formación y mantenimiento continuo de baños y pasillos.');
    insShift.run('Jornada de la tarde', '14:00', '22:00', 480, 'Lunes a sábado', 'Supervisión Torre Norte', 'Desinfección de cambio de jornada en ambientes, terrazas y cafetines.');
    insShift.run('Jornada de la noche', '22:00', '06:00', 480, 'Lunes a sábado (domingo bajo programación especial)', 'Supervisión Torre Norte', 'Limpieza profunda de pisos, vidrios, barandales y lavado general sin interferir con clases.');
  }

  const legalCount = (db.prepare('SELECT COUNT(*) as c FROM legal_matrix').get() as { c: number }).c;
  if (legalCount === 0) {
    const insLegal = db.prepare(
      `INSERT INTO legal_matrix (norm, year, applicable_article, requirement, process_application, responsible, evidence, compliance_status, official_source, obligation_type, vigency_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const legalRows = [
      ['Ley 9 (Código Sanitario Nacional)', '1979', 'Arts. 193-207 y 231-246', 'Condiciones sanitarias de edificaciones, saneamiento básico, limpieza, desinfección y manejo higiénico de áreas de alimentos y baños.', 'Protocolos diarios de aseo y desinfección de baños, cafetines, terrazas y ambientes de formación.', 'Administrador / Supervisor', 'Registros de actividades y evidencias fotográficas antes/después.', 'Cumple', 'Función Pública / SUIN-Juriscol', 'Obligación Legal', 'Vigente 2026. Norma marco sanitaria nacional.'],
      ['Ley 55 (Convenio 170 OIT)', '1993', 'Arts. 6, 7, 10, 11 y 13', 'Seguridad en la utilización de productos químicos en el trabajo: clasificación, etiquetado, fichas de datos de seguridad y capacitación.', 'Control de inventario SST-FR-96, exigencia de FDS del fabricante y rotulado antes de entrega de insumos.', 'Supervisor / SG-SST', 'Inventario SST-FR-96 con FDS disponibles y registro de capacitación.', 'En proceso', 'Congreso de Colombia / SUIN-Juriscol', 'Obligación Legal', 'Vigente 2026. Reglamentada por Decreto 1496 de 2018 y Res. 773 de 2021.'],
      ['Resolución 2400 (Estatuto de Seguridad Industrial)', '1979', 'Arts. 17-37 y 176-201', 'Orden, limpieza de locales de trabajo, evacuación de basuras y suministro obligatorio de Elementos de Protección Personal (EPP).', 'Dotación y uso de guantes, tapabocas, calzado antideslizante y señalización de piso mojado.', 'Supervisor / Personal de Aseo', 'Inventario de EPP y verificación visual en campo.', 'Cumple', 'Ministerio del Trabajo', 'Obligación Legal', 'Vigente 2026 en disposiciones de higiene y seguridad industrial.'],
      ['Ley 1562', '2012', 'Arts. 1-11', 'Sistema General de Riesgos Laborales y prevención de accidentes y enfermedades laborales en actividades operativas.', 'Identificación de peligros químicos, biológicos y locativos (escaleras, cuartos eléctricos, terrazas).', 'Administrador / SG-SST', 'Matriz de peligros y reporte de incidentes.', 'Cumple', 'Ministerio del Trabajo', 'Obligación Legal', 'Vigente 2026.'],
      ['Decreto 1072 (DUR Sector Trabajo)', '2015', 'Libro 2, Parte 2, Título 4, Cap. 6 (Arts. 2.2.4.6.1 - 2.2.4.6.37)', 'Implementación obligatoria del SG-SST, ciclo PHVA, control de peligros químicos, auditorías y acciones correctivas.', 'Estructuración PHVA del proceso de aseo, matriz de riesgos, auditorías periódicas y planes de mejoramiento.', 'Administrador / Auditor / SG-SST', 'Caracterización PHVA, actas de auditoría y planes de acción.', 'En proceso', 'Ministerio del Trabajo / SUIN-Juriscol', 'Obligación Legal', 'Vigente 2026 (con actualizaciones de reporte SG-SST).'],
      ['Decreto 1076 (DUR Sector Ambiente)', '2015', 'Libro 2, Parte 2, Título 6 (Gestión de residuos y RESPEL)', 'Gestión ambiental integral, prevención de contaminación y manejo diferenciado de residuos peligrosos (envases químicos contaminados).', 'Almacenamiento seguro de sustancias y disposición diferenciada de envases de químicos o luminarias si aplica.', 'Administrador / Gestión Ambiental', 'Actas de entrega y registro de residuos por piso.', 'En proceso', 'Ministerio de Ambiente y Desarrollo Sostenible', 'Obligación Legal', 'Vigente 2026.'],
      ['Decreto 1077 (DUR Vivienda, Ciudad y Territorio)', '2015', 'Libro 2, Parte 3, Título 2 (Arts. 2.3.2.2.1 y ss.)', 'Prestación del servicio público de aseo, presentación en la vía pública, frecuencias de recolección y deberes del usuario generador.', 'Verificación de recolección interna, cierre de bolsas y control de hora de recogida del camión recolector.', 'Supervisor / Personal de Aseo', 'Registro de recolección con verificación de horario de camión.', 'Cumple', 'MinVivienda / CRA', 'Obligación Legal', 'Vigente 2026 (modificado parcialmente en esquemas de aprovechamiento, mantiene deberes del usuario).'],
      ['Decreto 1496', '2018', 'Arts. 1-20', 'Adopción del Sistema Globalmente Armonizado (SGA) de clasificación y etiquetado de productos químicos.', 'Clasificación de peligros SGA en inventario de detergentes, desinfectantes y desengrasantes.', 'Administrador / Proveedores', 'Base de datos de productos con clasificación SGA y FDS.', 'En proceso', 'MinTrabajo / MinSalud / MinAmbiente', 'Obligación Legal', 'Vigente 2026. Reglamentado en lugares de trabajo por Res. 773 de 2021.'],
      ['Resolución 0312', '2019', 'Arts. 16-21 y 27 (Estándares Mínimos SG-SST)', 'Cumplimiento de estándares mínimos del SG-SST según tamaño de entidad, plan de mejora e indicadores.', 'Seguimiento de indicadores de cumplimiento, EPP y control de sustancias químicas en Torre Norte.', 'Administrador / SG-SST', 'Tablero de indicadores y evaluaciones de cumplimiento.', 'En proceso', 'Ministerio del Trabajo', 'Obligación Legal', 'Vigente 2026.'],
      ['Resolución 2184 (y mod. Res. 1342 de 2020)', '2019 / 2020', 'Art. 4 (Código de colores unificado nacional)', 'Separación en la fuente obligatoria: Blanco (aprovechables), Negro (no aprovechables), Verde (orgánicos aprovechables).', 'Control de canecas blancas y negras por piso e identificación de necesidad de canecas verdes en cafeterines y terrazas.', 'Supervisor / Personal de Aseo', 'Inventario de canecas por piso y planillas de pesaje por color.', 'Cumple', 'MinAmbiente / MinVivienda', 'Obligación Legal', 'Vigente 2026 (código nacional obligatorio desde 1 de enero de 2021).'],
      ['Resolución 773', '2021', 'Arts. 1-17', 'Acciones para la aplicación del SGA en los lugares de trabajo: etiquetas de recipientes trasvasados y FDS actualizadas en el área.', 'Prohibición de diluciones sin ficha técnica/FDS del fabricante y rotulado SGA de atomizadores y envases.', 'Supervisor / Personal de Aseo', 'FDS físicas/digitales y verificación de etiquetas en cuartos útiles.', 'En proceso', 'Ministerio del Trabajo', 'Obligación Legal', 'Vigente 2026.'],
      ['Resolución 1407 de 2018 (mod. Res. 1342/2020 y Res. 803/2024)', '2024', 'Responsabilidad extendida de envases y empaques', 'Gestión de envases y empaques de papel, cartón, plástico, vidrio y metal para su aprovechamiento.', 'Separación adecuada de empaques y botellas limpias en recipientes blancos del CESGE.', 'Gestión Ambiental / Supervisor', 'Reportes mensuales de kilos aprovechables en bolsa blanca.', 'En proceso', 'Ministerio de Ambiente / ANLA', 'Obligación Legal', 'Vigente 2026 con metas progresivas establecidas por Res. 803 de 2024.'],
      ['GTC 24 ICONTEC (Guía para la separación en la fuente)', '2009', 'Guía técnica de referencia', 'Orientación técnica para separación de residuos sólidos y diseño de puntos ecológicos.', 'Apoyo técnico complementario para señalización y ubicación de puntos ecológicos (no sustituye Res. 2184/2019).', 'Gestión Ambiental', 'Material de apoyo pedagógico en puntos ecológicos.', 'Cumple', 'ICONTEC', 'Recomendación Técnica Voluntaria', 'Estándar técnico voluntario — NO constituye obligación legal por sí mismo.'],
    ];
    for (const r of legalRows) {
      insLegal.run(...r);
    }
  }

  const docCount = (db.prepare('SELECT COUNT(*) as c FROM process_docs').get() as { c: number }).c;
  if (docCount === 0) {
    const flowchart = [
      { id: 'step-1', stepNumber: 1, title: 'Identificación e inventario de las áreas', nodeType: 'inicio', responsible: 'Administrador / Supervisor', inputs: 'Planos Torre Norte, listado de pisos y espacios', outputs: 'Inventario actualizado de áreas por piso' },
      { id: 'step-2', stepNumber: 2, title: 'Reconocimiento fotográfico de los espacios', nodeType: 'actividad', responsible: 'Supervisor / Personal de Aseo', inputs: 'Fotografías de referencia y cámara', outputs: 'Ficha fotográfica inicial y evaluación visual IA' },
      { id: 'step-3', stepNumber: 3, title: 'Identificación de necesidades de limpieza', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Diagnóstico visual, estado de baños, terrazas y aulas', outputs: 'Requerimientos de aseo ordinario o profundo' },
      { id: 'step-4', stepNumber: 4, title: 'Consulta de programación de ambientes', nodeType: 'decision', responsible: 'Supervisor', inputs: 'Excel de programación CESGE y disponibilidad real', outputs: 'Confirmación de franja libre sin interrumpir formación' },
      { id: 'step-5', stepNumber: 5, title: 'Planificación de jornadas', nodeType: 'actividad', responsible: 'Administrador / Supervisor', inputs: 'Jornadas mañana, tarde y noche (lunes a sábado)', outputs: 'Calendario diario, semanal y mensual' },
      { id: 'step-6', stepNumber: 6, title: 'Asignación de responsables', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Personal disponible por jornada y piso', outputs: 'Órdenes de trabajo asignadas' },
      { id: 'step-7', stepNumber: 7, title: 'Verificación de productos e insumos', nodeType: 'decision', responsible: 'Supervisor / Almacén', inputs: 'Inventario SST-FR-96, FDS y stock mínimo', outputs: 'Disponibilidad confirmada o alerta de reposición' },
      { id: 'step-8', stepNumber: 8, title: 'Entrega de materiales', nodeType: 'actividad', responsible: 'Supervisor', inputs: 'Productos químicos rotulados SGA, bolsas y EPP', outputs: 'Registro de entrega y verificación de FDS' },
      { id: 'step-9', stepNumber: 9, title: 'Ejecución de actividades de aseo', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Programación, EPP, señalización piso mojado', outputs: 'Espacios limpios y desinfectados' },
      { id: 'step-10', stepNumber: 10, title: 'Recolección y clasificación de residuos', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Bolsas blancas, negras y verdes (Res. 2184/2019)', outputs: 'Residuos pesados y entregados al camión recolector' },
      { id: 'step-11', stepNumber: 11, title: 'Registro de fotografías antes y después', nodeType: 'actividad', responsible: 'Personal de Aseo', inputs: 'Evidencias fotográficas del área intervenida', outputs: 'Comparación visual IA almacenada con trazabilidad' },
      { id: 'step-12', stepNumber: 12, title: 'Verificación del cumplimiento', nodeType: 'decision', responsible: 'Supervisor', inputs: 'Lista de chequeo y evaluación visual antes/después', outputs: 'Actividad verificada o reprogramada' },
      { id: 'step-13', stepNumber: 13, title: 'Actualización de registros', nodeType: 'actividad', responsible: 'Supervisor / Personal de Aseo', inputs: 'Consumos reales, inventario, residuos y estados', outputs: 'Base de datos y stock actualizados' },
      { id: 'step-14', stepNumber: 14, title: 'Seguimiento de indicadores', nodeType: 'actividad', responsible: 'Administrador / Directivo', inputs: 'Datos reales por piso, jornada y responsable', outputs: 'Tablero de indicadores de cumplimiento y consumo' },
      { id: 'step-15', stepNumber: 15, title: 'Auditoría del proceso', nodeType: 'actividad', responsible: 'Auditor', inputs: 'Calendario de auditoría, evidencias y matriz legal', outputs: 'Informe de auditoría y hallazgos' },
      { id: 'step-16', stepNumber: 16, title: 'Acciones correctivas y mejora continua', nodeType: 'fin', responsible: 'Administrador / Supervisor', inputs: 'Hallazgos y no conformidades', outputs: 'Plan de mejoramiento y ajuste de programación' },
    ];

    const processMap = {
      strategic: [
        'Planeación del servicio de aseo',
        'Administración de recursos',
        'Gestión ambiental',
        'Seguimiento y control',
      ],
      misional: [
        'Identificación de áreas',
        'Programación del aseo',
        'Preparación de productos e insumos',
        'Ejecución del aseo',
        'Gestión de residuos sólidos',
        'Verificación de actividades',
      ],
      support: [
        'Gestión de inventarios',
        'Gestión del talento humano',
        'Seguridad y salud en el trabajo',
        'Gestión documental',
        'Gestión tecnológica',
      ],
      evaluation: [
        'Auditoría del aseo',
        'Evaluación de resultados',
        'Acciones correctivas',
        'Mejoramiento continuo',
      ],
    };

    const characterization = {
      processName: 'Gestión del aseo y residuos sólidos – CESGE Torre Norte',
      objective: 'Garantizar condiciones óptimas de limpieza, desinfección, salubridad y manejo integral de residuos sólidos en toda la infraestructura de la Torre Norte (Sótano a Piso 10 y zonas exteriores), protegiendo la salud ocupacional y el ambiente sin interferir con las actividades formativas.',
      scope: 'Aplica desde el Sótano y Parqueadero hasta el Piso 10 y Zonas Exteriores de la Torre Norte del CESGE, cubriendo las jornadas mañana, tarde y noche.',
      owner: 'Coordinación Administrativa y Supervisión de Servicios Generales – CESGE',
      suppliersInternal: ['Dirección CESGE', 'Coordinación Académica (programación de ambientes)', 'SG-SST', 'Almacén / Gestión de Inventarios'],
      suppliersExternal: ['Proveedores de sustancias químicas con FDS', 'Proveedores de bolsas y EPP', 'Empresa prestadora del servicio público de aseo y gestores de reciclaje'],
      inputs: [
        'Inventario de áreas',
        'Programación de ambientes',
        'Productos químicos',
        'Insumos',
        'Personal',
        'Recursos físicos',
        'Requisitos legales',
        'Solicitudes de limpieza',
      ],
      phva: {
        planear: 'Identificar las áreas, necesidades, recursos, productos, frecuencias, horarios y responsables.',
        hacer: 'Ejecutar las actividades programadas de limpieza, desinfección, recolección y clasificación de residuos.',
        verificar: 'Comprobar el cumplimiento de las actividades, revisar fotografías, evaluar las condiciones de las áreas y realizar auditorías.',
        actuar: 'Implementar acciones correctivas, ajustar la programación, mejorar los procedimientos y controlar las causas de incumplimiento.',
      },
      outputs: [
        'Áreas limpias y ordenadas',
        'Residuos recolectados y clasificados',
        'Registros de actividades',
        'Inventarios actualizados',
        'Informes de cumplimiento',
        'Informes de auditoría',
        'Acciones de mejoramiento',
      ],
      clients: [
        'Aprendices',
        'Instructores',
        'Personal administrativo',
        'Visitantes',
        'Comunidad institucional',
        'Responsables de la infraestructura',
      ],
      resources: ['Personal operativo por jornadas', 'Productos químicos con FDS', 'Insumos y herramientas de aseo', 'EPP', 'Plataforma digital de control e IA visual'],
      associatedDocs: ['Formato SST-FR-96', 'Programación de ambientes CESGE', 'Fichas de Datos de Seguridad (FDS)', 'Matriz Legal 2026', 'Listas de chequeo de auditoría'],
      indicators: ['% Actividades realizadas', '% Actividades pendientes', '% Cumplimiento por piso', 'Cumplimiento por jornada', 'Consumo de productos e insumos', 'Residuos recolectados por clasificación (kg)'],
      risks: ['Exposición a sustancias químicas sin FDS/EPP', 'Interrupción de ambientes en formación', 'Mezcla de residuos sólidos', 'Desabastecimiento de insumos críticos', 'Caídas por pisos húmedos sin señalización'],
      controls: ['Verificación previa de disponibilidad de ambientes', 'Prohibición de dilución sin ficha técnica/FDS', 'Señalización de piso mojado', 'Evidencia fotográfica antes y después', 'Alertas de stock mínimo y vencimiento'],
      legalRequirements: ['Ley 9 de 1979', 'Ley 55 de 1993', 'Decreto 1072 de 2015', 'Decreto 1076 y 1077 de 2015', 'Decreto 1496 de 2018', 'Resolución 0312 de 2019', 'Resolución 2184 de 2019', 'Resolución 773 de 2021'],
    };

    const insDoc = db.prepare(`INSERT INTO process_docs (doc_type, content_json, updated_by) VALUES (?, ?, 'Sistema Base')`);
    insDoc.run('flowchart', JSON.stringify(flowchart));
    insDoc.run('process_map', JSON.stringify(processMap));
    insDoc.run('characterization', JSON.stringify(characterization));
  }

  const auditCount = (db.prepare('SELECT COUNT(*) as c FROM audit_alerts').get() as { c: number }).c;
  if (auditCount === 0) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 5);
    const isoDate = nextDate.toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO audit_alerts (title, audit_date, audit_type, auditor_name, status, requirements_checklist, notes, created_by) VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, 'Sistema Base')`
    ).run(
      'Auditoría Interna de Cumplimiento Aseo, SGA y Residuos – Torre Norte',
      isoDate,
      'Seguimiento Integral SG-SST y Ambiental',
      'Auditoría Interna Calidad y Ambiental',
      JSON.stringify([
        'Verificar que todas las jornadas tengan evidencias fotográficas antes y después cargadas',
        'Confirmar actualización del inventario químico SST-FR-96 y disponibilidad de FDS',
        'Validar separación de residuos blanco/negro/verde conforme a Resolución 2184 de 2019',
        'Revisar uso de EPP y señalización de piso mojado en cuartos de riesgo eléctrico y escaleras',
        'Verificar planillas de recolección con hora de paso del camión recolector',
      ]),
      'Recordatorio preventivo de auditoría programada. Complete las verificaciones pendientes antes de la fecha indicada.',
    );
  }
}

initSchema();
seedInitialData();
