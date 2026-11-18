import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, logHistory, UPLOADS_DIR, verifyPassword } from './server/db.ts';
import { analyzeSpacePhoto, compareBeforeAfterPhotos } from './server/ai.ts';

interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  shiftPreference: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.split(';').find((c) => c.trim().startsWith('cesge_token='));
    if (match) return decodeURIComponent(match.split('=')[1]);
  }
  return null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesión no iniciada. Inicie sesión para continuar.' });
    return;
  }
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name as fullName, u.role, u.shift_preference as shiftPreference, u.active, s.expires_at
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`
    )
    .get(token) as (AuthUser & { active: number; expires_at: string }) | undefined;

  if (!row || !row.active || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(401).json({ error: 'Su sesión expiró o no es válida.' });
    return;
  }
  req.user = {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    shiftPreference: row.shiftPreference,
  };
  next();
}

function requireRoles(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Acceso restringido. Se requiere uno de los siguientes perfiles: ${roles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}

function saveBase64Image(dataUrl: string, prefix: string): { url: string; base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64 = dataUrl;
  if (match) {
    mimeType = match[1];
    base64 = match[2];
  }
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  return { url: `/uploads/${filename}`, base64, mimeType };
}

function readUploadedImageAsBase64(urlOrDataUrl: string): { base64: string; mimeType: string } {
  if (urlOrDataUrl.startsWith('data:')) {
    const match = urlOrDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    return {
      mimeType: match ? match[1] : 'image/jpeg',
      base64: match ? match[2] : urlOrDataUrl,
    };
  }
  const filename = path.basename(urlOrDataUrl);
  const fullPath = path.join(UPLOADS_DIR, filename);
  const buf = fs.readFileSync(fullPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { base64: buf.toString('base64'), mimeType };
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Ingrese su usuario o correo Gmail y su contraseña.' });
    return;
  }
  const cleanId = String(identifier).trim().toLowerCase();
  const user = db
    .prepare(
      `SELECT id, username, email, full_name as fullName, password_hash as passwordHash, role, shift_preference as shiftPreference, active
       FROM users WHERE lower(username) = ? OR lower(email) = ?`
    )
    .get(cleanId, cleanId) as
    | (AuthUser & { passwordHash: string; active: number })
    | undefined;

  if (!user || !user.active || !verifyPassword(String(password), user.passwordHash)) {
    res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(token, user.id, expires);
  logHistory(user.username, user.role, 'Autenticación', 'Inicio de sesión', `Ingreso al sistema (${user.email})`);

  res.cookie('cesge_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      shiftPreference: user.shiftPreference,
    },
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, fullName, password, role, shiftPreference } = req.body ?? {};
  if (!username || !email || !fullName || !password) {
    res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanUsername = String(username).trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    res.status(400).json({ error: 'Ingrese un correo electrónico válido (ej. usuario@gmail.com).' });
    return;
  }
  const existing = db
    .prepare(`SELECT id FROM users WHERE lower(username) = ? OR lower(email) = ?`)
    .get(cleanUsername, cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'Ya existe un usuario registrado con ese nombre de usuario o correo.' });
    return;
  }

  // Self-registration defaults to PERSONAL DE ASEO unless created by Admin/Directivo via /api/users
  const allowedSelfRole = role === 'PERSONAL DE ASEO' ? 'PERSONAL DE ASEO' : 'PERSONAL DE ASEO';
  const result = db
    .prepare(
      `INSERT INTO users (username, email, full_name, password_hash, role, shift_preference) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(cleanUsername, cleanEmail, String(fullName).trim(), hashPassword(String(password)), allowedSelfRole, shiftPreference ?? 'Jornada de la mañana');

  const userId = Number(result.lastInsertRowid);
  logHistory(cleanUsername, allowedSelfRole, 'Usuarios', 'Registro', `Nuevo usuario registrado: ${cleanEmail}`);
  res.status(201).json({ id: userId, username: cleanUsername, email: cleanEmail, fullName, role: allowedSelfRole });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    const session = db
      .prepare(`SELECT u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`)
      .get(token) as { username: string; role: string } | undefined;
    if (session) {
      logHistory(session.username, session.role, 'Autenticación', 'Cierre de sesión', 'Salida segura de la plataforma');
    }
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }
  res.clearCookie('cesge_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

// ==========================================
// USERS MANAGEMENT (Admin & Directivo delete)
// ==========================================
app.get('/api/users', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, username, email, full_name as fullName, role, shift_preference as shiftPreference, active, created_at as createdAt
       FROM users ORDER BY id ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/users', requireAuth, requireRoles('ADMINISTRADOR', 'DIRECTIVO'), (req: AuthedRequest, res) => {
  const { username, email, fullName, password, role, shiftPreference } = req.body ?? {};
  if (!username || !email || !fullName || !password || !role) {
    res.status(400).json({ error: 'Complete usuario, correo Gmail, nombre completo, contraseña y perfil.' });
    return;
  }
  const validRoles = ['ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO', 'AUDITOR', 'DIRECTIVO'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Perfil no válido.' });
    return;
  }
  const dup = db
    .prepare(`SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)`)
    .get(String(username).trim(), String(email).trim());
  if (dup) {
    res.status(409).json({ error: 'El usuario o correo ya se encuentra registrado.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO users (username, email, full_name, password_hash, role, shift_preference) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(username).trim().toLowerCase(),
      String(email).trim().toLowerCase(),
      String(fullName).trim(),
      hashPassword(String(password)),
      role,
      shiftPreference ?? ''
    );
  logHistory(req.user!.username, req.user!.role, 'Usuarios', 'Creación', `Creó usuario ${username} (${role})`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/users/:id', requireAuth, requireRoles('ADMINISTRADOR', 'DIRECTIVO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { fullName, email, role, shiftPreference, password, active } = req.body ?? {};
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }
  db.prepare(
    `UPDATE users SET full_name = ?, email = ?, role = ?, shift_preference = ?, active = ? WHERE id = ?`
  ).run(
    fullName ?? existing.full_name,
    String(email ?? existing.email).toLowerCase(),
    role ?? existing.role,
    shiftPreference ?? existing.shift_preference,
    active !== undefined ? Number(active) : existing.active,
    id
  );
  if (password && String(password).trim().length >= 6) {
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(String(password)), id);
  }
  logHistory(req.user!.username, req.user!.role, 'Usuarios', 'Actualización', `Actualizó usuario ID ${id} (${existing.username})`);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireRoles('ADMINISTRADOR', 'DIRECTIVO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ error: 'No puede eliminar su propia sesión activa.' });
    return;
  }
  const target = db.prepare(`SELECT username, role FROM users WHERE id = ?`).get(id) as { username: string; role: string } | undefined;
  if (!target) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }
  if (target.role === 'ADMINISTRADOR') {
    const adminCount = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'ADMINISTRADOR' AND active = 1`).get() as { c: number }).c;
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Debe permanecer al menos un Administrador activo en la plataforma.' });
      return;
    }
  }
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Usuarios', 'Eliminación', `Eliminó usuario ${target.username} (${target.role})`);
  res.json({ ok: true });
});

// ==========================================
// FLOORS & SPACES (TORRE NORTE MAP)
// ==========================================
app.get('/api/floors', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`SELECT id, code, name, sort_order as sortOrder, standard_elements as standardElements, notes FROM floors ORDER BY sort_order ASC`)
    .all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      ...r,
      standardElements: JSON.parse(String(r.standardElements || '[]')),
    }))
  );
});

app.get('/api/spaces', requireAuth, (req, res) => {
  const includeInactive = req.query.includeInactive === '1';
  const rows = db
    .prepare(
      `SELECT s.id, s.floor_id as floorId, f.code as floorCode, f.name as floorName, s.name, s.category,
              s.has_computers as hasComputers, s.has_tv as hasTv, s.availability,
              s.training_schedule_note as trainingScheduleNote, s.elements_detail as elementsDetail,
              s.active, s.updated_at as updatedAt, s.updated_by as updatedBy
       FROM spaces s JOIN floors f ON s.floor_id = f.id
        ${includeInactive ? '' : 'WHERE s.active = 1'}
        ORDER BY f.sort_order ASC, CASE WHEN s.name GLOB '[0-9]*' THEN 0 ELSE 1 END ASC, CAST(s.name AS INTEGER) ASC, s.name ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/spaces', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const { floorId, name, category, hasComputers, hasTv, availability, trainingScheduleNote, elementsDetail } = req.body ?? {};
  if (!floorId || !name || !category) {
    res.status(400).json({ error: 'Piso, nombre y categoría del espacio son obligatorios.' });
    return;
  }
  const dup = db
    .prepare(`SELECT id FROM spaces WHERE floor_id = ? AND lower(name) = lower(?) AND active = 1`)
    .get(Number(floorId), String(name).trim());
  if (dup) {
    res.status(409).json({ error: 'Ya existe un espacio activo con ese nombre en el piso seleccionado.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO spaces (floor_id, name, category, has_computers, has_tv, availability, training_schedule_note, elements_detail, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(floorId),
      String(name).trim(),
      String(category).trim(),
      hasComputers ? 1 : 0,
      hasTv ? 1 : 0,
      availability ?? 'Disponible',
      trainingScheduleNote ?? '',
      elementsDetail ?? '',
      req.user!.username
    );
  logHistory(req.user!.username, req.user!.role, 'Áreas y Espacios', 'Creación', `Agregó espacio "${name}" en piso ID ${floorId}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/spaces/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM spaces WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Espacio no encontrado.' });
    return;
  }
  const { name, category, hasComputers, hasTv, availability, trainingScheduleNote, elementsDetail } = req.body ?? {};
  db.prepare(
    `UPDATE spaces SET name = ?, category = ?, has_computers = ?, has_tv = ?, availability = ?, training_schedule_note = ?, elements_detail = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    hasComputers !== undefined ? (hasComputers ? 1 : 0) : existing.has_computers,
    hasTv !== undefined ? (hasTv ? 1 : 0) : existing.has_tv,
    availability ?? existing.availability,
    trainingScheduleNote ?? existing.training_schedule_note,
    elementsDetail ?? existing.elements_detail,
    req.user!.username,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Áreas y Espacios',
    'Modificación',
    `Actualizó espacio "${name ?? existing.name}" (Disponibilidad: ${availability ?? existing.availability})`
  );
  res.json({ ok: true });
});

// Soft delete so historical schedules/photos/waste remain intact!
app.delete('/api/spaces/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT name FROM spaces WHERE id = ?`).get(id) as { name: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Espacio no encontrado.' });
    return;
  }
  db.prepare(`UPDATE spaces SET active = 0, updated_at = datetime('now'), updated_by = ? WHERE id = ?`).run(
    req.user!.username,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Áreas y Espacios',
    'Eliminación lógica',
    `Desactivó espacio "${existing.name}" preservando historial de actividades`
  );
  res.json({ ok: true });
});

app.post('/api/spaces/import', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const { rows } = req.body ?? {};
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No se recibieron filas válidas desde el archivo Excel.' });
    return;
  }
  const floors = db.prepare(`SELECT id, code, name FROM floors`).all() as Array<{ id: number; code: string; name: string }>;
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const floorRaw = String(row.floor || row.piso || '').trim().toLowerCase();
    const numericCode = /^\d+$/.test(floorRaw) ? `piso-${floorRaw.padStart(2, '0')}` : '';
    const matchedFloor =
      floors.find(
        (f) =>
          f.code.toLowerCase() === floorRaw ||
          (numericCode && f.code.toLowerCase() === numericCode) ||
          f.name.toLowerCase() === floorRaw ||
          (floorRaw && !/^\d+$/.test(floorRaw) && f.name.toLowerCase().includes(floorRaw))
      ) || floors[1];

    const spaceName = String(row.name || row.ambiente || row.area || '').trim();
    if (!spaceName) continue;

    const category = String(row.category || row.tipo || 'Ambiente de Formación').trim();
    const availability = String(row.availability || row.disponibilidad || 'Disponible').trim();
    const note = String(row.trainingScheduleNote || row.horario || row.franja || '').trim();

    const existing = db
      .prepare(`SELECT id FROM spaces WHERE floor_id = ? AND lower(name) = lower(?) AND active = 1`)
      .get(matchedFloor.id, spaceName) as { id: number } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE spaces SET availability = ?, training_schedule_note = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
      ).run(availability, note, req.user!.username, existing.id);
      updated++;
    } else {
      db.prepare(
        `INSERT INTO spaces (floor_id, name, category, availability, training_schedule_note, updated_by) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(matchedFloor.id, spaceName, category, availability, note, req.user!.username);
      inserted++;
    }
  }
  logHistory(
    req.user!.username,
    req.user!.role,
    'Áreas y Espacios',
    'Importación Excel',
    `Importación de ambientes CESGE: ${inserted} nuevos, ${updated} actualizados`
  );
  res.json({ inserted, updated });
});

// ==========================================
// PHOTOGRAPHIC EVIDENCE & AI VISION
// ==========================================
app.get('/api/photos', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, space_id as spaceId, floor_code as floorCode, space_name as spaceName, photo_type as photoType,
              activity_title as activityTitle, responsible, image_url as imageUrl, pair_image_url as pairImageUrl,
              ai_analysis_json as aiAnalysisJson, ai_comparison_json as aiComparisonJson,
              captured_at as capturedAt, created_by as createdBy
       FROM photos ORDER BY id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/ai/analyze-space', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { imageDataUrl, floorHint } = req.body ?? {};
    if (!imageDataUrl) {
      res.status(400).json({ error: 'Debe cargar o capturar una fotografía para analizar.' });
      return;
    }
    const { base64, mimeType } = readUploadedImageAsBase64(imageDataUrl);
    const analysis = await analyzeSpacePhoto(base64, mimeType, floorHint);
    res.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error analizando la fotografía con IA.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/ai/compare-before-after', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { beforeImageDataUrl, afterImageDataUrl, floorCode, spaceName, activityTitle } = req.body ?? {};
    if (!beforeImageDataUrl || !afterImageDataUrl) {
      res.status(400).json({ error: 'Se requieren ambas fotografías (Antes y Después) para realizar la evaluación visual.' });
      return;
    }
    const beforeImg = readUploadedImageAsBase64(beforeImageDataUrl);
    const afterImg = readUploadedImageAsBase64(afterImageDataUrl);
    const comparison = await compareBeforeAfterPhotos(
      beforeImg.base64,
      beforeImg.mimeType,
      afterImg.base64,
      afterImg.mimeType,
      {
        floorCode: floorCode || 'Por confirmar',
        spaceName: spaceName || 'Espacio Torre Norte',
        activityTitle: activityTitle || 'Actividad de aseo',
      }
    );
    res.json({ comparison });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error comparando las fotografías con IA.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/photos', requireAuth, (req: AuthedRequest, res) => {
  const {
    spaceId,
    floorCode,
    spaceName,
    photoType,
    activityTitle,
    responsible,
    imageDataUrl,
    pairImageDataUrl,
    aiAnalysis,
    aiComparison,
    capturedAt,
  } = req.body ?? {};
  if (!floorCode || !spaceName || !imageDataUrl) {
    res.status(400).json({ error: 'Piso, ambiente y fotografía principal son obligatorios.' });
    return;
  }
  const savedPrimary = saveBase64Image(imageDataUrl, 'evidencia');
  let savedPairUrl: string | null = null;
  if (pairImageDataUrl) {
    savedPairUrl = saveBase64Image(pairImageDataUrl, 'despues').url;
  }
  const timestamp = capturedAt || new Date().toISOString();
  const r = db
    .prepare(
      `INSERT INTO photos (space_id, floor_code, space_name, photo_type, activity_title, responsible, image_url, pair_image_url, ai_analysis_json, ai_comparison_json, captured_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      spaceId ? Number(spaceId) : null,
      floorCode,
      spaceName,
      photoType || 'Identificación',
      activityTitle || 'Registro visual de espacio',
      responsible || req.user!.fullName,
      savedPrimary.url,
      savedPairUrl,
      aiAnalysis ? JSON.stringify(aiAnalysis) : null,
      aiComparison ? JSON.stringify(aiComparison) : null,
      timestamp,
      req.user!.username
    );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Evidencia Fotográfica',
    'Registro',
    `Guardó ficha fotográfica (${photoType || 'Identificación'}) en ${floorCode} - ${spaceName}`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid), imageUrl: savedPrimary.url, pairImageUrl: savedPairUrl });
});

app.delete('/api/photos/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM photos WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Evidencia Fotográfica', 'Eliminación', `Eliminó registro fotográfico ID ${id}`);
  res.json({ ok: true });
});

// ==========================================
// SHIFTS & SCHEDULING (JORNADAS Y CALENDARIO)
// ==========================================
app.get('/api/shifts', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, start_time as startTime, end_time as endTime, duration_minutes as durationMinutes, frequency, supervisor_name as supervisorName, notes FROM shifts ORDER BY id ASC`
    )
    .all();
  res.json(rows);
});

app.put('/api/shifts/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { startTime, endTime, durationMinutes, frequency, supervisorName, notes } = req.body ?? {};
  db.prepare(
    `UPDATE shifts SET start_time = ?, end_time = ?, duration_minutes = ?, frequency = ?, supervisor_name = ?, notes = ? WHERE id = ?`
  ).run(startTime, endTime, Number(durationMinutes), frequency, supervisorName ?? '', notes ?? '', id);
  logHistory(req.user!.username, req.user!.role, 'Jornadas', 'Configuración', `Actualizó parámetros de jornada ID ${id}`);
  res.json({ ok: true });
});

app.get('/api/schedules', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT sc.id, sc.date, sc.scheduled_time as scheduledTime, sc.shift_name as shiftName,
              sc.floor_id as floorId, f.code as floorCode, f.name as floorName,
              sc.space_id as spaceId, sc.area_name as areaName, sc.activity, sc.responsible,
              sc.frequency, sc.estimated_minutes as estimatedMinutes,
              sc.required_products as requiredProducts, sc.required_supplies as requiredSupplies,
              sc.status, sc.is_sunday as isSunday, sc.sunday_justification as sundayJustification,
              sc.training_conflict_checked as trainingConflictChecked, sc.notes,
              sc.updated_at as updatedAt, sc.updated_by as updatedBy
       FROM schedules sc JOIN floors f ON sc.floor_id = f.id
       ORDER BY sc.date DESC, sc.scheduled_time ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/schedules', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const {
    date,
    scheduledTime,
    shiftName,
    floorId,
    spaceId,
    areaName,
    activity,
    responsible,
    frequency,
    estimatedMinutes,
    requiredProducts,
    requiredSupplies,
    status,
    sundayJustification,
    trainingConflictChecked,
    notes,
  } = req.body ?? {};

  if (!date || !scheduledTime || !shiftName || !floorId || !areaName || !activity || !responsible) {
    res.status(400).json({ error: 'Complete fecha, hora, jornada, piso, área, actividad y responsable.' });
    return;
  }

  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const isSunday = dayOfWeek === 0 ? 1 : 0;
  if (isSunday && (!sundayJustification || String(sundayJustification).trim().length < 5)) {
    res.status(400).json({
      error: 'La operación regular es de lunes a sábado. Para programar un domingo debe anotar y aclarar el motivo en el campo correspondiente.',
    });
    return;
  }

  // Prevent duplicates for same date + time + area + activity
  const dup = db
    .prepare(
      `SELECT id FROM schedules WHERE date = ? AND scheduled_time = ? AND floor_id = ? AND lower(area_name) = lower(?) AND lower(activity) = lower(?)`
    )
    .get(date, scheduledTime, Number(floorId), String(areaName).trim(), String(activity).trim());
  if (dup) {
    res.status(409).json({
      error: 'Registro duplicado: ya existe esa misma actividad programada en esa fecha, hora y área.',
    });
    return;
  }

  const r = db
    .prepare(
      `INSERT INTO schedules (date, scheduled_time, shift_name, floor_id, space_id, area_name, activity, responsible, frequency, estimated_minutes, required_products, required_supplies, status, is_sunday, sunday_justification, training_conflict_checked, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      date,
      scheduledTime,
      shiftName,
      Number(floorId),
      spaceId ? Number(spaceId) : null,
      String(areaName).trim(),
      String(activity).trim(),
      String(responsible).trim(),
      frequency || 'Diaria',
      Number(estimatedMinutes || 30),
      requiredProducts ?? '',
      requiredSupplies ?? '',
      status || 'Pendiente',
      isSunday,
      sundayJustification ?? '',
      trainingConflictChecked ? 1 : 0,
      notes ?? '',
      req.user!.username
    );

  logHistory(
    req.user!.username,
    req.user!.role,
    'Programación',
    'Creación',
    `Programó "${activity}" en ${areaName} (${date} ${scheduledTime}, ${shiftName})`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/schedules/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Actividad programada no encontrada.' });
    return;
  }
  const { status, notes, responsible, scheduledTime, date, activity, requiredProducts, requiredSupplies } = req.body ?? {};

  // Personal de aseo can update execution status and notes; Admin/Supervisor can edit full details
  if (req.user!.role === 'AUDITOR' || req.user!.role === 'DIRECTIVO') {
    res.status(403).json({ error: 'Su perfil es de consulta/auditoría para programación operativa.' });
    return;
  }

  db.prepare(
    `UPDATE schedules SET status = ?, notes = ?, responsible = ?, scheduled_time = ?, date = ?, activity = ?, required_products = ?, required_supplies = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
  ).run(
    status ?? existing.status,
    notes ?? existing.notes,
    responsible ?? existing.responsible,
    scheduledTime ?? existing.scheduled_time,
    date ?? existing.date,
    activity ?? existing.activity,
    requiredProducts ?? existing.required_products,
    requiredSupplies ?? existing.required_supplies,
    req.user!.username,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Programación',
    'Actualización',
    `Actualizó actividad "${existing.activity}" a estado: ${status ?? existing.status}`
  );
  res.json({ ok: true });
});

app.delete('/api/schedules/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Programación', 'Eliminación', `Eliminó programación ID ${id}`);
  res.json({ ok: true });
});

// ==========================================
// INVENTORY (SST-FR-96) & CONSUMPTIONS
// ==========================================
app.get('/api/products', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, category, usage_scope as usageScope, brand, supplier, specific_use as specificUse,
              presentation, unit, available_qty as availableQty, used_qty as usedQty, min_qty as minQty,
              unit_price as unitPrice, expiration_date as expirationDate, lot, storage_location as storageLocation,
              safety_sheet_ref as safetySheetRef, hazard_classification as hazardClassification,
              handling_recommendations as handlingRecommendations, required_epp as requiredEpp,
              updated_at as updatedAt, updated_by as updatedBy
       FROM products ORDER BY name ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/products', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const p = req.body ?? {};
  if (!p.name || !p.category) {
    res.status(400).json({ error: 'El nombre y categoría del producto/insumo son obligatorios.' });
    return;
  }
  const dup = db
    .prepare(`SELECT id FROM products WHERE lower(name) = lower(?) AND lower(lot) = lower(?)`)
    .get(String(p.name).trim(), String(p.lot || '').trim());
  if (dup) {
    res.status(409).json({ error: 'Ya existe un producto con el mismo nombre y lote en el inventario.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO products (name, category, usage_scope, brand, supplier, specific_use, presentation, unit, available_qty, used_qty, min_qty, unit_price, expiration_date, lot, storage_location, safety_sheet_ref, hazard_classification, handling_recommendations, required_epp, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(p.name).trim(),
      p.category,
      p.usageScope || 'Operativo',
      p.brand ?? '',
      p.supplier ?? '',
      p.specificUse ?? '',
      p.presentation ?? '',
      p.unit || 'unidades',
      Number(p.availableQty || 0),
      Number(p.usedQty || 0),
      Number(p.minQty || 0),
      Number(p.unitPrice || 0),
      p.expirationDate ?? '',
      p.lot ?? '',
      p.storageLocation ?? '',
      p.safetySheetRef ?? '',
      p.hazardClassification ?? '',
      p.handlingRecommendations ?? '',
      p.requiredEpp ?? '',
      req.user!.username
    );
  logHistory(req.user!.username, req.user!.role, 'Inventario', 'Creación', `Registró producto "${p.name}" (${p.availableQty || 0} ${p.unit || 'unidades'})`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/products/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Producto no encontrado.' });
    return;
  }
  const p = req.body ?? {};
  db.prepare(
    `UPDATE products SET name = ?, category = ?, usage_scope = ?, brand = ?, supplier = ?, specific_use = ?, presentation = ?, unit = ?, available_qty = ?, min_qty = ?, unit_price = ?, expiration_date = ?, lot = ?, storage_location = ?, safety_sheet_ref = ?, hazard_classification = ?, handling_recommendations = ?, required_epp = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
  ).run(
    p.name ?? existing.name,
    p.category ?? existing.category,
    p.usageScope ?? existing.usage_scope,
    p.brand ?? existing.brand,
    p.supplier ?? existing.supplier,
    p.specificUse ?? existing.specific_use,
    p.presentation ?? existing.presentation,
    p.unit ?? existing.unit,
    p.availableQty !== undefined ? Number(p.availableQty) : existing.available_qty,
    p.minQty !== undefined ? Number(p.minQty) : existing.min_qty,
    p.unitPrice !== undefined ? Number(p.unitPrice) : existing.unit_price,
    p.expirationDate ?? existing.expiration_date,
    p.lot ?? existing.lot,
    p.storageLocation ?? existing.storage_location,
    p.safetySheetRef ?? existing.safety_sheet_ref,
    p.hazardClassification ?? existing.hazard_classification,
    p.handlingRecommendations ?? existing.handling_recommendations,
    p.requiredEpp ?? existing.required_epp,
    req.user!.username,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Inventario', 'Modificación', `Actualizó producto "${p.name ?? existing.name}"`);
  res.json({ ok: true });
});

app.delete('/api/products/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Inventario', 'Eliminación', `Eliminó producto ID ${id}`);
  res.json({ ok: true });
});

// Import SST-FR-96 rows without inventing chemical properties or quantities
app.post('/api/products/import-sst-fr-96', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'No se encontraron registros válidos en el archivo SST-FR-96.' });
    return;
  }
  let imported = 0;
  let skipped = 0;
  const insertStmt = db.prepare(
    `INSERT INTO products (name, category, usage_scope, brand, supplier, specific_use, presentation, unit, available_qty, used_qty, min_qty, unit_price, expiration_date, lot, storage_location, safety_sheet_ref, hazard_classification, handling_recommendations, required_epp, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const item of items) {
    const name = String(item.name || '').trim();
    if (!name) {
      skipped++;
      continue;
    }
    const lot = String(item.lot || '').trim();
    const dup = db
      .prepare(`SELECT id FROM products WHERE lower(name) = lower(?) AND lower(lot) = lower(?)`)
      .get(name, lot);
    if (dup) {
      skipped++;
      continue;
    }
    insertStmt.run(
      name,
      String(item.category || 'Otros elementos de limpieza'),
      String(item.usageScope || 'Operativo'),
      String(item.brand || ''),
      String(item.supplier || ''),
      String(item.specificUse || ''),
      String(item.presentation || ''),
      String(item.unit || 'unidades'),
      Number(item.availableQty) || 0,
      Number(item.minQty) || 0,
      Number(item.unitPrice) || 0,
      String(item.expirationDate || ''),
      lot,
      String(item.storageLocation || ''),
      String(item.safetySheetRef || ''),
      String(item.hazardClassification || ''),
      String(item.handlingRecommendations || ''),
      String(item.requiredEpp || ''),
      req.user!.username
    );
    imported++;
  }
  logHistory(
    req.user!.username,
    req.user!.role,
    'Inventario SST-FR-96',
    'Importación Excel',
    `Importó formato SST-FR-96: ${imported} productos registrados, ${skipped} omitidos/duplicados`
  );
  res.json({ imported, skipped });
});

app.get('/api/consumptions', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.date, c.month_key as monthKey, c.shift_name as shiftName, c.floor_code as floorCode,
              c.area_name as areaName, c.activity, c.responsible, c.product_id as productId,
              p.name as productName, c.quantity, c.unit, c.calculated_cost as calculatedCost,
              c.fds_verified as fdsVerified, c.notes, c.created_by as createdBy
       FROM consumptions c JOIN products p ON c.product_id = p.id
       ORDER BY c.date DESC, c.id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/consumptions', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const { date, shiftName, floorCode, areaName, activity, responsible, productId, quantity, fdsVerified, notes } = req.body ?? {};
  if (!date || !shiftName || !floorCode || !areaName || !productId || !quantity) {
    res.status(400).json({ error: 'Complete fecha, jornada, piso, ambiente, producto y cantidad.' });
    return;
  }
  if (!fdsVerified) {
    res.status(400).json({
      error: 'Debe confirmar la consulta de la Ficha Técnica y Ficha de Datos de Seguridad (FDS) del fabricante antes de registrar diluciones o consumos.',
    });
    return;
  }
  const prod = db.prepare(`SELECT id, name, unit, available_qty, unit_price FROM products WHERE id = ?`).get(Number(productId)) as
    | { id: number; name: string; unit: string; available_qty: number; unit_price: number }
    | undefined;
  if (!prod) {
    res.status(404).json({ error: 'Producto no encontrado.' });
    return;
  }
  const qty = Number(quantity);
  if (qty <= 0 || qty > prod.available_qty) {
    res.status(400).json({ error: `Cantidad inválida. Disponible actual en inventario: ${prod.available_qty} ${prod.unit}.` });
    return;
  }
  const monthKey = String(date).slice(0, 7);
  const cost = Number((qty * (prod.unit_price || 0)).toFixed(2));

  db.prepare(
    `UPDATE products SET available_qty = available_qty - ?, used_qty = used_qty + ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
  ).run(qty, qty, req.user!.username, prod.id);

  const r = db
    .prepare(
      `INSERT INTO consumptions (date, month_key, shift_name, floor_code, area_name, activity, responsible, product_id, quantity, unit, calculated_cost, fds_verified, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      date,
      monthKey,
      shiftName,
      floorCode,
      areaName,
      activity || 'Limpieza programada',
      responsible || req.user!.fullName,
      prod.id,
      qty,
      prod.unit,
      cost,
      notes ?? '',
      req.user!.username
    );

  logHistory(
    req.user!.username,
    req.user!.role,
    'Consumos',
    'Registro',
    `Consumió ${qty} ${prod.unit} de "${prod.name}" en ${floorCode} - ${areaName}`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid), calculatedCost: cost });
});

// ==========================================
// DELIVERIES OF DOTACIÓN, EPP, UNIFORMS & CLEANING SUPPLIES
// ==========================================
app.get('/api/deliveries', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, delivery_date as deliveryDate, delivery_time as deliveryTime, delivery_type as deliveryType,
              delivered_by as deliveredBy, delivered_by_role as deliveredByRole,
              delivered_to as deliveredTo, recipient_role as recipientRole, shift_name as shiftName,
              items_json as itemsJson, condition_note as conditionNote,
              received_confirmed as receivedConfirmed, observations,
              created_by as createdBy, created_at as createdAt
       FROM equipment_deliveries
       ORDER BY delivery_date DESC, delivery_time DESC, id DESC`
    )
    .all() as Array<Record<string, string | number | null>>;

  res.json(
    rows.map((r) => {
      let items: unknown[] = [];
      try {
        items = JSON.parse(String(r.itemsJson || '[]'));
      } catch {
        items = [];
      }
      return {
        id: r.id,
        deliveryDate: r.deliveryDate,
        deliveryTime: r.deliveryTime,
        deliveryType: r.deliveryType,
        deliveredBy: r.deliveredBy,
        deliveredByRole: r.deliveredByRole || '',
        deliveredTo: r.deliveredTo,
        recipientRole: r.recipientRole || '',
        shiftName: r.shiftName || '',
        items,
        conditionNote: r.conditionNote || '',
        receivedConfirmed: Number(r.receivedConfirmed ?? 1),
        observations: r.observations || '',
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      };
    })
  );
});

app.post('/api/deliveries', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const deliveryDate = String(b.deliveryDate || '').trim();
  const deliveryTime = String(b.deliveryTime || '').trim();
  const deliveryType = String(b.deliveryType || '').trim();
  const deliveredBy = String(b.deliveredBy || '').trim();
  const deliveredTo = String(b.deliveredTo || '').trim();
  const rawItems = Array.isArray(b.items) ? b.items : [];

  if (!deliveryDate || !deliveryTime || !deliveryType || !deliveredBy || !deliveredTo) {
    res.status(400).json({ error: 'Fecha, hora, tipo de dotación, quién entrega y a quién se entrega son obligatorios.' });
    return;
  }

  const sanitizedItems: Array<{
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    sizeOrSpec: string;
    productId: number | null;
    deductStock: boolean;
  }> = [];

  for (const it of rawItems) {
    const itemName = String(it?.itemName || '').trim();
    const quantity = Number(it?.quantity || 0);
    if (!itemName || quantity <= 0) continue;
    const productId = it?.productId ? Number(it.productId) : null;
    const deductStock = Boolean(it?.deductStock && productId);
    sanitizedItems.push({
      itemName,
      category: String(it?.category || 'EPP'),
      quantity,
      unit: String(it?.unit || 'unidades'),
      sizeOrSpec: String(it?.sizeOrSpec || '').trim(),
      productId,
      deductStock,
    });
  }

  if (sanitizedItems.length === 0) {
    res.status(400).json({ error: 'Debe incluir al menos un elemento de dotación, EPP, uniforme o artículo de aseo con cantidad mayor a cero.' });
    return;
  }

  // Validate stock availability before mutating
  for (const it of sanitizedItems) {
    if (it.deductStock && it.productId) {
      const prod = db
        .prepare(`SELECT id, name, unit, available_qty FROM products WHERE id = ?`)
        .get(it.productId) as { id: number; name: string; unit: string; available_qty: number } | undefined;
      if (!prod) {
        res.status(404).json({ error: `Producto vinculado "${it.itemName}" no encontrado en inventario.` });
        return;
      }
      if (it.quantity > prod.available_qty) {
        res.status(400).json({
          error: `Stock insuficiente para "${prod.name}". Disponible: ${prod.available_qty} ${prod.unit}, solicitado: ${it.quantity}.`,
        });
        return;
      }
    }
  }

  let newId = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const it of sanitizedItems) {
      if (it.deductStock && it.productId) {
        db.prepare(
          `UPDATE products SET available_qty = available_qty - ?, used_qty = used_qty + ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?`
        ).run(it.quantity, it.quantity, req.user!.username, it.productId);
      }
    }

    const r = db
      .prepare(
        `INSERT INTO equipment_deliveries (
          delivery_date, delivery_time, delivery_type, delivered_by, delivered_by_role,
          delivered_to, recipient_role, shift_name, items_json, condition_note,
          received_confirmed, observations, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        deliveryDate,
        deliveryTime,
        deliveryType,
        deliveredBy,
        String(b.deliveredByRole || ''),
        deliveredTo,
        String(b.recipientRole || ''),
        String(b.shiftName || ''),
        JSON.stringify(sanitizedItems),
        String(b.conditionNote || 'Dotación reglamentaria'),
        b.receivedConfirmed !== undefined ? (b.receivedConfirmed ? 1 : 0) : 1,
        String(b.observations || ''),
        req.user!.username
      );
    newId = Number(r.lastInsertRowid);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const summaryNames = sanitizedItems.map((i) => `${i.quantity} ${i.unit} ${i.itemName}`).join(', ');
  logHistory(
    req.user!.username,
    req.user!.role,
    'Entrega de Dotación',
    'Registro',
    `${deliveryDate} ${deliveryTime} · Entrega de ${deliveryType} por ${deliveredBy} a ${deliveredTo}: ${summaryNames}`
  );
  res.status(201).json({ id: newId });
});

app.put('/api/deliveries/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare(`SELECT * FROM equipment_deliveries WHERE id = ?`)
    .get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Registro de entrega no encontrado.' });
    return;
  }
  const b = req.body ?? {};
  db.prepare(
    `UPDATE equipment_deliveries
     SET received_confirmed = ?, observations = ?, condition_note = ?
     WHERE id = ?`
  ).run(
    b.receivedConfirmed !== undefined ? (b.receivedConfirmed ? 1 : 0) : existing.received_confirmed,
    b.observations !== undefined ? String(b.observations) : existing.observations,
    b.conditionNote !== undefined ? String(b.conditionNote) : existing.condition_note,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Entrega de Dotación',
    'Actualización',
    `Actualizó acta de entrega ID ${id} (destinatario: ${existing.delivered_to})`
  );
  res.json({ ok: true });
});

app.delete('/api/deliveries/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare(`SELECT id, delivered_to, delivery_type, delivery_date FROM equipment_deliveries WHERE id = ?`)
    .get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Registro de entrega no encontrado.' });
    return;
  }
  db.prepare(`DELETE FROM equipment_deliveries WHERE id = ?`).run(id);
  logHistory(
    req.user!.username,
    req.user!.role,
    'Entrega de Dotación',
    'Eliminación',
    `Eliminó registro de entrega ID ${id} (${existing.delivery_type} a ${existing.delivered_to} del ${existing.delivery_date})`
  );
  res.json({ ok: true });
});

// ==========================================
// CAFETERIA SUPPLIES & ASSIGNMENTS
// ==========================================
app.get('/api/cafeteria/supplies', requireAuth, (_req, res) => {
  const supplies = db
    .prepare(
      `SELECT id, item_name as itemName, category, cafeteria_location as cafeteriaLocation, unit,
              current_qty as currentQty, min_qty as minQty, assigned_to as assignedTo,
              last_assigned_at as lastAssignedAt, notes, updated_at as updatedAt, updated_by as updatedBy
       FROM cafeteria_supplies
       ORDER BY (current_qty <= min_qty) DESC, item_name ASC`
    )
    .all();

  const movements = db
    .prepare(
      `SELECT m.id, m.supply_id as supplyId, s.item_name as itemName, s.unit,
              m.movement_date as movementDate, m.movement_time as movementTime,
              m.movement_type as movementType, m.cafeteria_location as cafeteriaLocation,
              m.quantity, m.assigned_by as assignedBy, m.received_by as receivedBy,
              m.notes, m.created_at as createdAt
       FROM cafeteria_supply_movements m
       JOIN cafeteria_supplies s ON s.id = m.supply_id
       ORDER BY m.movement_date DESC, m.movement_time DESC, m.id DESC
       LIMIT 150`
    )
    .all();

  res.json({ supplies, movements });
});

app.post('/api/cafeteria/supplies', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const itemName = String(b.itemName || '').trim();
  if (!itemName) {
    res.status(400).json({ error: 'El nombre del insumo de cafetería es obligatorio.' });
    return;
  }
  const currentQty = Math.max(0, Number(b.currentQty || 0));
  const minQty = Math.max(0, Number(b.minQty ?? 1));
  const r = db
    .prepare(
      `INSERT INTO cafeteria_supplies (item_name, category, cafeteria_location, unit, current_qty, min_qty, assigned_to, last_assigned_at, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      itemName,
      String(b.category || 'Bebidas e insumos de consumo'),
      String(b.cafeteriaLocation || 'Todos los cafetines'),
      String(b.unit || 'unidades'),
      currentQty,
      minQty,
      String(b.assignedTo || ''),
      b.assignedTo ? new Date().toISOString().slice(0, 16).replace('T', ' ') : '',
      String(b.notes || ''),
      req.user!.username
    );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Cafetería',
    'Registro insumo',
    `Registró insumo "${itemName}" (${currentQty} ${b.unit || 'unidades'}, mín ${minQty}) en ${b.cafeteriaLocation || 'Todos los cafetines'}`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/cafeteria/supplies/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM cafeteria_supplies WHERE id = ?`).get(id) as
    | Record<string, string | number | null>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Insumo de cafetería no encontrado.' });
    return;
  }
  const b = req.body ?? {};
  db.prepare(
    `UPDATE cafeteria_supplies
     SET item_name = ?, category = ?, cafeteria_location = ?, unit = ?, current_qty = ?, min_qty = ?, assigned_to = ?, notes = ?, updated_at = datetime('now'), updated_by = ?
     WHERE id = ?`
  ).run(
    b.itemName !== undefined ? String(b.itemName).trim() : existing.item_name,
    b.category ?? existing.category,
    b.cafeteriaLocation ?? existing.cafeteria_location,
    b.unit ?? existing.unit,
    b.currentQty !== undefined ? Math.max(0, Number(b.currentQty)) : existing.current_qty,
    b.minQty !== undefined ? Math.max(0, Number(b.minQty)) : existing.min_qty,
    b.assignedTo !== undefined ? String(b.assignedTo) : existing.assigned_to,
    b.notes !== undefined ? String(b.notes) : existing.notes,
    req.user!.username,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Cafetería',
    'Actualización insumo',
    `Actualizó insumo "${b.itemName ?? existing.item_name}"`
  );
  res.json({ ok: true });
});

app.post('/api/cafeteria/supplies/:id/move', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM cafeteria_supplies WHERE id = ?`).get(id) as
    | { id: number; item_name: string; unit: string; current_qty: number; cafeteria_location: string; assigned_to: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Insumo de cafetería no encontrado.' });
    return;
  }
  const b = req.body ?? {};
  const movementType = String(b.movementType || 'Asignación a cafetín');
  const qty = Number(b.quantity || 0);
  if (qty <= 0) {
    res.status(400).json({ error: 'La cantidad debe ser mayor a cero.' });
    return;
  }

  let newQty = existing.current_qty;
  if (movementType === 'Ingreso / Reposición') {
    newQty = existing.current_qty + qty;
  } else if (movementType === 'Asignación a cafetín') {
    if (qty > existing.current_qty) {
      res.status(400).json({
        error: `Stock insuficiente de "${existing.item_name}". Hay ${existing.current_qty} ${existing.unit} disponibles.`,
      });
      return;
    }
    newQty = existing.current_qty - qty;
  } else {
    newQty = Math.max(0, qty);
  }

  const mDate = String(b.movementDate || new Date().toISOString().slice(0, 10));
  const mTime = String(b.movementTime || new Date().toTimeString().slice(0, 5));
  const location = String(b.cafeteriaLocation || existing.cafeteria_location);
  const assignedBy = String(b.assignedBy || req.user!.fullName);
  const receivedBy = String(b.receivedBy || existing.assigned_to || '');

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE cafeteria_supplies
       SET current_qty = ?, assigned_to = ?, last_assigned_at = ?, updated_at = datetime('now'), updated_by = ?
       WHERE id = ?`
    ).run(newQty, receivedBy || existing.assigned_to, `${mDate} ${mTime}`, req.user!.username, id);

    db.prepare(
      `INSERT INTO cafeteria_supply_movements (supply_id, movement_date, movement_time, movement_type, cafeteria_location, quantity, assigned_by, received_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, mDate, mTime, movementType, location, qty, assignedBy, receivedBy, String(b.notes || ''));

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  logHistory(
    req.user!.username,
    req.user!.role,
    'Cafetería',
    movementType,
    `${movementType}: ${qty} ${existing.unit} de "${existing.item_name}" en ${location} (${assignedBy} -> ${receivedBy || 'Cafetín'})`
  );
  res.json({ ok: true, newQty });
});

app.delete('/api/cafeteria/supplies/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM cafeteria_supplies WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Cafetería', 'Eliminación', `Eliminó insumo de cafetería ID ${id}`);
  res.json({ ok: true });
});

// ==========================================
// DAMAGE REPORTS (CAFETERIA & INFRASTRUCTURE)
// ==========================================
app.get('/api/damages', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT d.id, d.report_date as reportDate, d.report_time as reportTime,
              d.floor_id as floorId, f.code as floorCode, f.name as floorName,
              d.space_name as spaceName, d.item_damaged as itemDamaged, d.category, d.severity,
              d.description, d.reported_by as reportedBy, d.status,
              d.assigned_technician as assignedTechnician, d.resolution_notes as resolutionNotes,
              d.resolved_at as resolvedAt, d.image_url as imageUrl,
              d.created_by as createdBy, d.created_at as createdAt
       FROM damage_reports d
       JOIN floors f ON f.id = d.floor_id
       ORDER BY (d.status = 'Reparado') ASC, d.report_date DESC, d.report_time DESC, d.id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/damages', requireAuth, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const floorId = Number(b.floorId);
  const spaceName = String(b.spaceName || '').trim();
  const itemDamaged = String(b.itemDamaged || '').trim();
  const description = String(b.description || '').trim();
  if (!floorId || !spaceName || !itemDamaged || !description) {
    res.status(400).json({ error: 'Piso, espacio/cafetín, elemento dañado y descripción son obligatorios.' });
    return;
  }
  let imageUrl = '';
  if (b.imageDataUrl) {
    imageUrl = saveBase64Image(String(b.imageDataUrl), 'dano').url;
  }
  const rDate = String(b.reportDate || new Date().toISOString().slice(0, 10));
  const rTime = String(b.reportTime || new Date().toTimeString().slice(0, 5));
  const reportedBy = String(b.reportedBy || req.user!.fullName).trim();

  const r = db
    .prepare(
      `INSERT INTO damage_reports (
        report_date, report_time, floor_id, space_name, item_damaged, category, severity,
        description, reported_by, status, assigned_technician, image_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reportado', ?, ?, ?)`
    )
    .run(
      rDate,
      rTime,
      floorId,
      spaceName,
      itemDamaged,
      String(b.category || 'Equipo de cafetería'),
      String(b.severity || 'Media'),
      description,
      reportedBy,
      String(b.assignedTechnician || ''),
      imageUrl,
      req.user!.username
    );

  logHistory(
    req.user!.username,
    req.user!.role,
    'Reporte de Daños',
    'Nuevo reporte',
    `Reportó daño (${b.severity || 'Media'}) en "${itemDamaged}" (${spaceName}) por ${reportedBy}`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid), imageUrl });
});

app.put('/api/damages/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM damage_reports WHERE id = ?`).get(id) as
    | Record<string, string | number | null>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Reporte de daño no encontrado.' });
    return;
  }
  const b = req.body ?? {};
  const nextStatus = String(b.status ?? existing.status);
  const resolvedAt =
    nextStatus === 'Reparado'
      ? String(b.resolvedAt || existing.resolved_at || new Date().toISOString().slice(0, 16).replace('T', ' '))
      : '';
  db.prepare(
    `UPDATE damage_reports
     SET status = ?, severity = ?, assigned_technician = ?, resolution_notes = ?, resolved_at = ?
     WHERE id = ?`
  ).run(
    nextStatus,
    String(b.severity ?? existing.severity),
    String(b.assignedTechnician ?? existing.assigned_technician ?? ''),
    String(b.resolutionNotes ?? existing.resolution_notes ?? ''),
    resolvedAt,
    id
  );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Reporte de Daños',
    'Actualización',
    `Actualizó daño ID ${id} ("${existing.item_damaged}") a estado ${nextStatus}`
  );
  res.json({ ok: true });
});

app.delete('/api/damages/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM damage_reports WHERE id = ?`).run(id);
  logHistory(req.user!.username, req.user!.role, 'Reporte de Daños', 'Eliminación', `Eliminó reporte de daño ID ${id}`);
  res.json({ ok: true });
});

// ==========================================
// SOLID WASTE MANAGEMENT (RES. 2184 / 2019)
// ==========================================
app.get('/api/waste/bins', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, floor_code as floorCode, location, container_type as containerType, color,
              bag_type as bagType, condition, collection_frequency as collectionFrequency,
              needs_additional_green as needsAdditionalGreen, notes, updated_at as updatedAt
       FROM waste_bins ORDER BY floor_code ASC, color ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/waste/bins', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  if (!b.floorCode || !b.location || !b.color) {
    res.status(400).json({ error: 'Piso, ubicación y color de recipiente son obligatorios.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO waste_bins (floor_code, location, container_type, color, bag_type, condition, collection_frequency, needs_additional_green, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.floorCode,
      b.location,
      b.containerType || 'Caneca institucional',
      b.color,
      b.bagType || `Bolsa color ${String(b.color).toLowerCase()}`,
      b.condition || 'Óptimo',
      b.collectionFrequency || 'Por jornada',
      b.needsAdditionalGreen ? 1 : 0,
      b.notes ?? ''
    );
  logHistory(req.user!.username, req.user!.role, 'Residuos Sólidos', 'Creación caneca', `Registró recipiente ${b.color} en ${b.floorCode} - ${b.location}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/waste/bins/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM waste_bins WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Recipiente no encontrado.' });
    return;
  }
  const b = req.body ?? {};
  db.prepare(
    `UPDATE waste_bins SET location = ?, container_type = ?, color = ?, bag_type = ?, condition = ?, collection_frequency = ?, needs_additional_green = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    b.location ?? existing.location,
    b.containerType ?? existing.container_type,
    b.color ?? existing.color,
    b.bagType ?? existing.bag_type,
    b.condition ?? existing.condition,
    b.collectionFrequency ?? existing.collection_frequency,
    b.needsAdditionalGreen !== undefined ? (b.needsAdditionalGreen ? 1 : 0) : existing.needs_additional_green,
    b.notes ?? existing.notes,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Residuos Sólidos', 'Actualización caneca', `Actualizó estado de recipiente ID ${id} (${b.condition ?? existing.condition})`);
  res.json({ ok: true });
});

app.get('/api/waste/records', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, date, collection_time as collectionTime, truck_pickup_time as truckPickupTime,
              truck_verified as truckVerified, floor_code as floorCode, bin_id as binId, location,
              classification, bags_count as bagsCount, weight_kg as weightKg, shift_name as shiftName,
              responsible, alert_type as alertType, observations, created_by as createdBy
       FROM waste_records ORDER BY date DESC, id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/waste/records', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'PERSONAL DE ASEO'), (req: AuthedRequest, res) => {
  const w = req.body ?? {};
  if (!w.date || !w.collectionTime || !w.floorCode || !w.classification) {
    res.status(400).json({ error: 'Fecha, hora de recolección, piso y clasificación son obligatorios.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO waste_records (date, collection_time, truck_pickup_time, truck_verified, floor_code, bin_id, location, classification, bags_count, weight_kg, shift_name, responsible, alert_type, observations, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      w.date,
      w.collectionTime,
      w.truckPickupTime ?? '',
      w.truckVerified ? 1 : 0,
      w.floorCode,
      w.binId ? Number(w.binId) : null,
      w.location || w.floorCode,
      w.classification,
      Number(w.bagsCount || 0),
      Number(w.weightKg || 0),
      w.shiftName || 'Jornada de la mañana',
      w.responsible || req.user!.fullName,
      w.alertType || 'Ninguna',
      w.observations ?? '',
      req.user!.username
    );
  logHistory(
    req.user!.username,
    req.user!.role,
    'Residuos Sólidos',
    'Recolección',
    `Registró ${w.bagsCount || 0} bolsas (${w.weightKg || 0} kg) - ${w.classification} en ${w.floorCode}`
  );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/waste/records/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM waste_records WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Registro no encontrado.' });
    return;
  }
  const w = req.body ?? {};
  db.prepare(
    `UPDATE waste_records SET truck_pickup_time = ?, truck_verified = ?, alert_type = ?, observations = ? WHERE id = ?`
  ).run(
    w.truckPickupTime ?? existing.truck_pickup_time,
    w.truckVerified !== undefined ? (w.truckVerified ? 1 : 0) : existing.truck_verified,
    w.alertType ?? existing.alert_type,
    w.observations ?? existing.observations,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Residuos Sólidos', 'Verificación camión', `Actualizó verificación de recolección ID ${id}`);
  res.json({ ok: true });
});

// ==========================================
// AUDITS, REMINDERS, FINDINGS & CHECKLISTS
// ==========================================
app.get('/api/audits', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, audit_date as auditDate, audit_type as auditType, auditor_name as auditorName,
              status, requirements_checklist as requirementsChecklist, notes, created_by as createdBy
       FROM audit_alerts ORDER BY audit_date ASC`
    )
    .all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      ...r,
      requirementsChecklist: JSON.parse(String(r.requirementsChecklist || '[]')),
    }))
  );
});

app.post('/api/audits', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'), (req: AuthedRequest, res) => {
  const a = req.body ?? {};
  if (!a.title || !a.auditDate) {
    res.status(400).json({ error: 'Título y fecha de auditoría son obligatorios.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO audit_alerts (title, audit_date, audit_type, auditor_name, status, requirements_checklist, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      a.title,
      a.auditDate,
      a.auditType || 'Auditoría interna del proceso',
      a.auditorName || req.user!.fullName,
      a.status || 'Pendiente',
      JSON.stringify(Array.isArray(a.requirementsChecklist) ? a.requirementsChecklist : []),
      a.notes ?? '',
      req.user!.username
    );
  logHistory(req.user!.username, req.user!.role, 'Auditorías', 'Programación aviso', `Programó auditoría "${a.title}" para ${a.auditDate}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/audits/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM audit_alerts WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Auditoría no encontrada.' });
    return;
  }
  const a = req.body ?? {};
  db.prepare(
    `UPDATE audit_alerts SET title = ?, audit_date = ?, audit_type = ?, auditor_name = ?, status = ?, requirements_checklist = ?, notes = ? WHERE id = ?`
  ).run(
    a.title ?? existing.title,
    a.auditDate ?? existing.audit_date,
    a.auditType ?? existing.audit_type,
    a.auditorName ?? existing.auditor_name,
    a.status ?? existing.status,
    a.requirementsChecklist ? JSON.stringify(a.requirementsChecklist) : existing.requirements_checklist,
    a.notes ?? existing.notes,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Auditorías', 'Actualización', `Actualizó estado de auditoría ID ${id} a ${a.status ?? existing.status}`);
  res.json({ ok: true });
});

app.get('/api/findings', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, audit_id as auditId, date, floor_code as floorCode, area_name as areaName,
              finding_type as findingType, description, corrective_action as correctiveAction,
              responsible, due_date as dueDate, status, created_by as createdBy
       FROM audit_findings ORDER BY date DESC, id DESC`
    )
    .all();
  res.json(rows);
});

app.post('/api/findings', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'), (req: AuthedRequest, res) => {
  const f = req.body ?? {};
  if (!f.floorCode || !f.areaName || !f.description || !f.correctiveAction) {
    res.status(400).json({ error: 'Piso, área, descripción y acción correctiva son obligatorios.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO audit_findings (audit_id, date, floor_code, area_name, finding_type, description, corrective_action, responsible, due_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      f.auditId ? Number(f.auditId) : null,
      f.date || new Date().toISOString().slice(0, 10),
      f.floorCode,
      f.areaName,
      f.findingType || 'Observación',
      f.description,
      f.correctiveAction,
      f.responsible || 'Supervisión Torre Norte',
      f.dueDate || new Date().toISOString().slice(0, 10),
      f.status || 'Abierto',
      req.user!.username
    );
  logHistory(req.user!.username, req.user!.role, 'Hallazgos y Mejora', 'Creación', `Registró ${f.findingType || 'Observación'} en ${f.floorCode} - ${f.areaName}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/findings/:id', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM audit_findings WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Hallazgo no encontrado.' });
    return;
  }
  const f = req.body ?? {};
  db.prepare(`UPDATE audit_findings SET status = ?, corrective_action = ?, responsible = ?, due_date = ? WHERE id = ?`).run(
    f.status ?? existing.status,
    f.correctiveAction ?? existing.corrective_action,
    f.responsible ?? existing.responsible,
    f.dueDate ?? existing.due_date,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Hallazgos y Mejora', 'Actualización', `Actualizó hallazgo ID ${id} a estado ${f.status ?? existing.status}`);
  res.json({ ok: true });
});

// ==========================================
// PROCESS DOCS & LEGAL MATRIX
// ==========================================
app.get('/api/process-docs/:type', requireAuth, (req, res) => {
  const row = db
    .prepare(`SELECT doc_type as docType, content_json as contentJson, updated_at as updatedAt, updated_by as updatedBy FROM process_docs WHERE doc_type = ?`)
    .get(req.params.type) as { docType: string; contentJson: string; updatedAt: string; updatedBy: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Documento de proceso no encontrado.' });
    return;
  }
  res.json({
    docType: row.docType,
    content: JSON.parse(row.contentJson),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  });
});

app.put('/api/process-docs/:type', requireAuth, requireRoles('ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'), (req: AuthedRequest, res) => {
  const docType = String(req.params.type);
  const { content } = req.body ?? {};
  if (!content) {
    res.status(400).json({ error: 'Contenido requerido.' });
    return;
  }
  db.prepare(
    `INSERT INTO process_docs (doc_type, content_json, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(doc_type) DO UPDATE SET content_json = excluded.content_json, updated_at = datetime('now'), updated_by = excluded.updated_by`
  ).run(docType, JSON.stringify(content), req.user!.username);
  logHistory(req.user!.username, req.user!.role, 'Documentación del Proceso', 'Edición', `Actualizó documento "${docType}"`);
  res.json({ ok: true });
});

app.get('/api/legal-matrix', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, norm, year, applicable_article as applicableArticle, requirement, process_application as processApplication,
              responsible, evidence, compliance_status as complianceStatus, official_source as officialSource,
              obligation_type as obligationType, vigency_note as vigencyNote
       FROM legal_matrix ORDER BY id ASC`
    )
    .all();
  res.json(rows);
});

app.post('/api/legal-matrix', requireAuth, requireRoles('ADMINISTRADOR', 'AUDITOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const l = req.body ?? {};
  if (!l.norm || !l.year || !l.requirement) {
    res.status(400).json({ error: 'Norma, año y requisito son obligatorios.' });
    return;
  }
  const r = db
    .prepare(
      `INSERT INTO legal_matrix (norm, year, applicable_article, requirement, process_application, responsible, evidence, compliance_status, official_source, obligation_type, vigency_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      l.norm,
      l.year,
      l.applicableArticle || '',
      l.requirement,
      l.processApplication || '',
      l.responsible || '',
      l.evidence || '',
      l.complianceStatus || 'En proceso',
      l.officialSource || '',
      l.obligationType || 'Obligación Legal',
      l.vigencyNote || ''
    );
  logHistory(req.user!.username, req.user!.role, 'Matriz Legal', 'Adición', `Agregó norma "${l.norm}" (${l.year})`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/legal-matrix/:id', requireAuth, requireRoles('ADMINISTRADOR', 'AUDITOR', 'SUPERVISOR'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM legal_matrix WHERE id = ?`).get(id) as Record<string, string | number | null> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Registro normativo no encontrado.' });
    return;
  }
  const l = req.body ?? {};
  db.prepare(
    `UPDATE legal_matrix SET compliance_status = ?, evidence = ?, responsible = ?, vigency_note = ? WHERE id = ?`
  ).run(
    l.complianceStatus ?? existing.compliance_status,
    l.evidence ?? existing.evidence,
    l.responsible ?? existing.responsible,
    l.vigencyNote ?? existing.vigency_note,
    id
  );
  logHistory(req.user!.username, req.user!.role, 'Matriz Legal', 'Actualización', `Actualizó cumplimiento de "${existing.norm}" a ${l.complianceStatus ?? existing.compliance_status}`);
  res.json({ ok: true });
});

// ==========================================
// GLOBAL SEARCH, INDICATORS & CHANGE HISTORY
// ==========================================
app.get('/api/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    res.json({ spaces: [], schedules: [], products: [], waste: [], legal: [] });
    return;
  }
  const like = `%${q}%`;
  const spaces = db
    .prepare(
      `SELECT s.id, s.name, s.category, f.code as floorCode, f.name as floorName, s.availability
       FROM spaces s JOIN floors f ON s.floor_id = f.id
       WHERE s.active = 1 AND (lower(s.name) LIKE ? OR lower(s.category) LIKE ? OR lower(f.name) LIKE ?) LIMIT 8`
    )
    .all(like, like, like);
  const schedules = db
    .prepare(
      `SELECT sc.id, sc.date, sc.area_name as areaName, sc.activity, sc.responsible, sc.status, f.code as floorCode
       FROM schedules sc JOIN floors f ON sc.floor_id = f.id
       WHERE lower(sc.activity) LIKE ? OR lower(sc.area_name) LIKE ? OR lower(sc.responsible) LIKE ? LIMIT 8`
    )
    .all(like, like, like);
  const products = db
    .prepare(
      `SELECT id, name, category, available_qty as availableQty, unit, storage_location as storageLocation
       FROM products WHERE lower(name) LIKE ? OR lower(category) LIKE ? OR lower(brand) LIKE ? LIMIT 8`
    )
    .all(like, like, like);
  const legal = db
    .prepare(
      `SELECT id, norm, year, compliance_status as complianceStatus FROM legal_matrix
       WHERE lower(norm) LIKE ? OR lower(requirement) LIKE ? LIMIT 8`
    )
    .all(like, like);
  const deliveries = db
    .prepare(
      `SELECT id, delivery_date as deliveryDate, delivery_time as deliveryTime, delivery_type as deliveryType,
              delivered_by as deliveredBy, delivered_to as deliveredTo
       FROM equipment_deliveries
       WHERE lower(delivered_by) LIKE ? OR lower(delivered_to) LIKE ? OR lower(delivery_type) LIKE ? OR lower(items_json) LIKE ?
       LIMIT 8`
    )
    .all(like, like, like, like);
  const cafeteria = db
    .prepare(
      `SELECT id, item_name as itemName, cafeteria_location as cafeteriaLocation, current_qty as currentQty, min_qty as minQty, unit
       FROM cafeteria_supplies
       WHERE lower(item_name) LIKE ? OR lower(cafeteria_location) LIKE ? OR lower(category) LIKE ?
       LIMIT 8`
    )
    .all(like, like, like);
  const damages = db
    .prepare(
      `SELECT d.id, d.item_damaged as itemDamaged, d.space_name as spaceName, d.status, d.severity, f.name as floorName
       FROM damage_reports d JOIN floors f ON f.id = d.floor_id
       WHERE lower(d.item_damaged) LIKE ? OR lower(d.space_name) LIKE ? OR lower(d.description) LIKE ?
       LIMIT 8`
    )
    .all(like, like, like);
  res.json({ spaces, schedules, products, legal, deliveries, cafeteria, damages });
});

app.get('/api/history', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, timestamp, username, user_role as userRole, module, action, details FROM change_history ORDER BY id DESC LIMIT 200`
    )
    .all();
  res.json(rows);
});

app.get('/api/indicators', requireAuth, (req, res) => {
  const { dateFrom, dateTo, floorCode, shiftName, responsible } = req.query as Record<string, string | undefined>;
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (dateFrom) {
    whereClauses.push('sc.date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses.push('sc.date <= ?');
    params.push(dateTo);
  }
  if (floorCode && floorCode !== 'TODOS') {
    whereClauses.push('f.code = ?');
    params.push(floorCode);
  }
  if (shiftName && shiftName !== 'TODAS') {
    whereClauses.push('sc.shift_name = ?');
    params.push(shiftName);
  }
  if (responsible && responsible !== 'TODOS') {
    whereClauses.push('lower(sc.responsible) LIKE ?');
    params.push(`%${responsible.toLowerCase()}%`);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const schedules = db
    .prepare(
      `SELECT sc.status, sc.shift_name as shiftName, f.code as floorCode, f.name as floorName, f.sort_order as sortOrder
       FROM schedules sc JOIN floors f ON sc.floor_id = f.id ${whereSql}`
    )
    .all(...params) as Array<{ status: string; shiftName: string; floorCode: string; floorName: string; sortOrder: number }>;

  const totalActivities = schedules.length;
  const completedActivities = schedules.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
  const pendingActivities = schedules.filter((s) => s.status === 'Pendiente' || s.status === 'En proceso').length;
  const completionPct = totalActivities ? Number(((completedActivities / totalActivities) * 100).toFixed(1)) : 0;
  const pendingPct = totalActivities ? Number(((pendingActivities / totalActivities) * 100).toFixed(1)) : 0;

  const floors = db.prepare(`SELECT code, name, sort_order as sortOrder FROM floors ORDER BY sort_order ASC`).all() as Array<{
    code: string;
    name: string;
    sortOrder: number;
  }>;

  const byFloor = floors.map((fl) => {
    const flRows = schedules.filter((s) => s.floorCode === fl.code);
    const done = flRows.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
    return {
      floorCode: fl.code,
      floorName: fl.name,
      total: flRows.length,
      completed: done,
      compliancePct: flRows.length ? Number(((done / flRows.length) * 100).toFixed(1)) : 0,
    };
  });

  const shiftNames = ['Jornada de la mañana', 'Jornada de la tarde', 'Jornada de la noche'];
  const byShift = shiftNames.map((sh) => {
    const shRows = schedules.filter((s) => s.shiftName === sh);
    const done = shRows.filter((s) => s.status === 'Realizado' || s.status === 'Verificado').length;
    return {
      shiftName: sh,
      total: shRows.length,
      completed: done,
      compliancePct: shRows.length ? Number(((done / shRows.length) * 100).toFixed(1)) : 0,
    };
  });

  // Consumption totals
  const cWhere: string[] = [];
  const cParams: string[] = [];
  if (dateFrom) {
    cWhere.push('date >= ?');
    cParams.push(dateFrom);
  }
  if (dateTo) {
    cWhere.push('date <= ?');
    cParams.push(dateTo);
  }
  if (floorCode && floorCode !== 'TODOS') {
    cWhere.push('floor_code = ?');
    cParams.push(floorCode);
  }
  if (shiftName && shiftName !== 'TODAS') {
    cWhere.push('shift_name = ?');
    cParams.push(shiftName);
  }
  const cWhereSql = cWhere.length ? `WHERE ${cWhere.join(' AND ')}` : '';
  const consumptions = db
    .prepare(
      `SELECT c.quantity, c.unit, c.calculated_cost as cost, p.category, p.name as productName
       FROM consumptions c JOIN products p ON c.product_id = p.id ${cWhereSql}`
    )
    .all(...cParams) as Array<{ quantity: number; unit: string; cost: number; category: string; productName: string }>;

  const bagsConsumed = consumptions
    .filter((c) => c.category === 'Bolsas para residuos')
    .reduce((acc, c) => acc + c.quantity, 0);

  const wasteRecords = db
    .prepare(
      `SELECT floor_code as floorCode, classification, bags_count as bagsCount, weight_kg as weightKg, alert_type as alertType
       FROM waste_records ${cWhereSql}`
    )
    .all(...cParams) as Array<{ floorCode: string; classification: string; bagsCount: number; weightKg: number; alertType: string }>;

  const totalWasteKg = Number(wasteRecords.reduce((acc, w) => acc + w.weightKg, 0).toFixed(2));
  const totalWasteBags = wasteRecords.reduce((acc, w) => acc + w.bagsCount, 0);

  const wasteByClassification = [
    'Blanco - Aprovechables',
    'Negro - No aprovechables',
    'Verde - Orgánicos aprovechables',
  ].map((cls) => ({
    classification: cls,
    weightKg: Number(
      wasteRecords
        .filter((w) => w.classification === cls)
        .reduce((acc, w) => acc + w.weightKg, 0)
        .toFixed(2)
    ),
    bags: wasteRecords.filter((w) => w.classification === cls).reduce((acc, w) => acc + w.bagsCount, 0),
  }));

  res.json({
    totalActivities,
    completedActivities,
    pendingActivities,
    completionPct,
    pendingPct,
    byFloor,
    byShift,
    totalConsumptionsCount: consumptions.length,
    totalConsumptionCost: Number(consumptions.reduce((acc, c) => acc + c.cost, 0).toFixed(2)),
    bagsConsumed,
    totalWasteKg,
    totalWasteBags,
    wasteByClassification,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CESGE Torre Norte server listening on http://localhost:${PORT}`);
  });
}

startServer();
