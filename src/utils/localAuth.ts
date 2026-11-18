import { Role, User } from '../types/cesge';

const USERS_STORAGE_KEY = 'cesge_users_v1';
const SESSION_STORAGE_KEY = 'cesge_session_v1';
const TOKEN_STORAGE_KEY = 'cesge_token';

export const ALLOWED_ROLES: Role[] = [
  'ADMINISTRADOR',
  'SUPERVISOR',
  'PERSONAL DE ASEO',
  'AUDITOR',
  'DIRECTIVO',
];

interface StoredUser extends User {
  passwordHash: string;
}

interface StoredSession {
  token: string;
  userId: number;
  role: Role;
  expiresAt: number;
}

const DEFAULT_ACCOUNTS: Array<{
  id: number;
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: Role;
  shiftPreference: string;
}> = [
  {
    id: 1,
    username: 'admin.cesge',
    email: 'admin.cesge@gmail.com',
    fullName: 'Coordinación Administrativa CESGE',
    password: 'CesgeAdmin2026!',
    role: 'ADMINISTRADOR',
    shiftPreference: 'Todas',
  },
  {
    id: 2,
    username: 'supervisor.norte',
    email: 'supervisor.norte@gmail.com',
    fullName: 'Supervisión Torre Norte',
    password: 'CesgeSup2026!',
    role: 'SUPERVISOR',
    shiftPreference: 'Jornada de la mañana',
  },
  {
    id: 3,
    username: 'operario.aseo',
    email: 'aseo.torrenorte@gmail.com',
    fullName: 'Equipo Operativo de Aseo',
    password: 'CesgeAseo2026!',
    role: 'PERSONAL DE ASEO',
    shiftPreference: 'Jornada de la mañana',
  },
  {
    id: 4,
    username: 'auditor.calidad',
    email: 'auditoria.cesge@gmail.com',
    fullName: 'Auditoría Interna Calidad y Ambiental',
    password: 'CesgeAudit2026!',
    role: 'AUDITOR',
    shiftPreference: 'Todas',
  },
  {
    id: 5,
    username: 'directivo.cesge',
    email: 'direccion.cesge@gmail.com',
    fullName: 'Dirección Centro CESGE',
    password: 'CesgeDir2026!',
    role: 'DIRECTIVO',
    shiftPreference: 'Todas',
  },
];

function fallbackSyncHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((h1 >>> 0) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `sync_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function hashPasswordClient(password: string): Promise<string> {
  const salted = `cesge_torre_norte_2026:${password}`;
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoded = new TextEncoder().encode(salted);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256_${hex}`;
    }
  } catch {
    // Fallback below when subtle crypto is restricted
  }
  return fallbackSyncHash(salted);
}

function buildSeedUsersSync(): StoredUser[] {
  const now = new Date().toISOString();
  return DEFAULT_ACCOUNTS.map((acc) => ({
    id: acc.id,
    username: acc.username,
    email: acc.email,
    fullName: acc.fullName,
    role: acc.role,
    shiftPreference: acc.shiftPreference,
    active: 1,
    createdAt: now,
    passwordHash: fallbackSyncHash(`cesge_torre_norte_2026:${acc.password}`),
  }));
}

function readStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Re-seed if localStorage JSON is corrupted
  }
  const seeded = buildSeedUsersSync();
  writeStoredUsers(seeded);
  return seeded;
}

function writeStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function toPublicUser(u: StoredUser): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    shiftPreference: u.shiftPreference,
    active: u.active,
    createdAt: u.createdAt,
  };
}

async function verifyUserPassword(user: StoredUser, plainPassword: string): Promise<boolean> {
  const syncExpected = fallbackSyncHash(`cesge_torre_norte_2026:${plainPassword}`);
  if (user.passwordHash === syncExpected) {
    return true;
  }
  const shaExpected = await hashPasswordClient(plainPassword);
  if (user.passwordHash === shaExpected) {
    return true;
  }
  // Check against built-in defaults in case a stored record still has legacy hash format
  const defaultMatch = DEFAULT_ACCOUNTS.find(
    (d) => d.email.toLowerCase() === user.email.toLowerCase() && d.password === plainPassword
  );
  return Boolean(defaultMatch);
}

function generateLocalToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getLocalToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setLocalToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export function ensureDefaultUsersLoaded(): void {
  readStoredUsers();
}

export async function loginLocal(
  identifierInput: string,
  passwordInput: string
): Promise<{ token: string; user: User }> {
  const identifier = String(identifierInput || '').trim().toLowerCase();
  const password = String(passwordInput || '');
  if (!identifier || !password) {
    throw new Error('Ingrese su usuario o correo Gmail y su contraseña.');
  }

  const users = readStoredUsers();
  const matched = users.find(
    (u) => u.email.toLowerCase() === identifier || u.username.toLowerCase() === identifier
  );

  if (!matched || !matched.active) {
    throw new Error('Credenciales inválidas o usuario inactivo.');
  }

  const valid = await verifyUserPassword(matched, password);
  if (!valid) {
    throw new Error('Credenciales inválidas o usuario inactivo.');
  }

  const token = generateLocalToken();
  const session: StoredSession = {
    token,
    userId: matched.id,
    role: matched.role,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  return { token, user: toPublicUser(matched) };
}

export async function registerLocal(payload: {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role?: Role;
  shiftPreference?: string;
}): Promise<{ id: number; user: User }> {
  const username = String(payload.username || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const fullName = String(payload.fullName || '').trim();
  const password = String(payload.password || '');
  const role: Role = ALLOWED_ROLES.includes(payload.role as Role)
    ? (payload.role as Role)
    : 'PERSONAL DE ASEO';
  const shiftPreference = String(payload.shiftPreference || 'Jornada de la mañana').trim();

  if (!username || !email || !fullName || !password) {
    throw new Error('Todos los campos son obligatorios para registrar la cuenta.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Ingrese un correo electrónico válido.');
  }
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  const users = readStoredUsers();
  const exists = users.some(
    (u) => u.email.toLowerCase() === email || u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) {
    throw new Error('El usuario o correo electrónico ya se encuentra registrado.');
  }

  const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const passwordHash = await hashPasswordClient(password);
  const created: StoredUser = {
    id: nextId,
    username,
    email,
    fullName,
    role,
    shiftPreference,
    active: 1,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  users.push(created);
  writeStoredUsers(users);
  return { id: nextId, user: toPublicUser(created) };
}

export function getSessionUserLocal(): User | null {
  const token = getLocalToken();
  if (!token) return null;

  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return null;
    const session = JSON.parse(rawSession) as StoredSession;
    if (!session || session.token !== token || session.expiresAt < Date.now()) {
      setLocalToken(null);
      return null;
    }

    const users = readStoredUsers();
    const user = users.find((u) => u.id === session.userId && u.active === 1);
    if (!user) {
      setLocalToken(null);
      return null;
    }
    return toPublicUser(user);
  } catch {
    setLocalToken(null);
    return null;
  }
}

export function logoutLocal(): void {
  setLocalToken(null);
}

export function listUsersLocal(): User[] {
  return readStoredUsers()
    .map(toPublicUser)
    .sort((a, b) => a.id - b.id);
}

export async function createUserLocal(
  caller: User,
  payload: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    role: Role;
    shiftPreference?: string;
  }
): Promise<{ id: number; user: User }> {
  if (caller.role !== 'ADMINISTRADOR' && caller.role !== 'DIRECTIVO') {
    throw new Error('Acceso restringido. Se requiere perfil ADMINISTRADOR o DIRECTIVO.');
  }
  return registerLocal(payload);
}

export function updateUserLocal(
  caller: User,
  id: number,
  payload: Partial<Pick<User, 'fullName' | 'role' | 'shiftPreference' | 'active'>>
): void {
  if (caller.role !== 'ADMINISTRADOR' && caller.role !== 'DIRECTIVO') {
    throw new Error('Acceso restringido. Se requiere perfil ADMINISTRADOR o DIRECTIVO.');
  }
  const users = readStoredUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) {
    throw new Error('Usuario no encontrado.');
  }
  const nextRole = payload.role && ALLOWED_ROLES.includes(payload.role) ? payload.role : users[idx].role;
  users[idx] = {
    ...users[idx],
    fullName: payload.fullName !== undefined ? payload.fullName : users[idx].fullName,
    role: nextRole,
    shiftPreference:
      payload.shiftPreference !== undefined ? payload.shiftPreference : users[idx].shiftPreference,
    active: payload.active !== undefined ? (payload.active ? 1 : 0) : users[idx].active,
  };
  writeStoredUsers(users);
}

export function deleteUserLocal(caller: User, id: number): { deletedUsername: string } {
  if (caller.role !== 'ADMINISTRADOR' && caller.role !== 'DIRECTIVO') {
    throw new Error('Acceso restringido. Se requiere perfil ADMINISTRADOR o DIRECTIVO.');
  }
  if (id === caller.id) {
    throw new Error('No puede eliminar su propia sesión activa.');
  }
  const users = readStoredUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    throw new Error('Usuario no encontrado.');
  }
  if (target.role === 'ADMINISTRADOR') {
    const activeAdmins = users.filter((u) => u.role === 'ADMINISTRADOR' && u.active === 1);
    if (activeAdmins.length <= 1) {
      throw new Error('Debe permanecer al menos un Administrador activo en la plataforma.');
    }
  }
  writeStoredUsers(users.filter((u) => u.id !== id));
  return { deletedUsername: target.username };
}
