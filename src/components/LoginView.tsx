import React, { useEffect, useState } from 'react';
import { ShieldCheck, Mail, Lock, User as UserIcon, LogIn, UserPlus, BookOpen } from 'lucide-react';
import { ALLOWED_ROLES, ensureDefaultUsersLoaded, loginLocal, registerLocal } from '../utils/localAuth';
import { Role, User } from '../types/cesge';
import UserManualPanel from './UserManualPanel';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

const DEMO_ACCOUNTS = [
  { role: 'ADMINISTRADOR', user: 'admin.cesge@gmail.com', pass: 'CesgeAdmin2026!', desc: 'Control total, usuarios, programación e inventarios' },
  { role: 'SUPERVISOR', user: 'supervisor.norte@gmail.com', pass: 'CesgeSup2026!', desc: 'Jornadas, asignaciones y verificación de evidencias' },
  { role: 'PERSONAL DE ASEO', user: 'aseo.torrenorte@gmail.com', pass: 'CesgeAseo2026!', desc: 'Tareas, consumos, residuos y carga de fotos' },
  { role: 'AUDITOR', user: 'auditoria.cesge@gmail.com', pass: 'CesgeAudit2026!', desc: 'Auditorías pendientes, hallazgos, matriz legal y listas' },
  { role: 'DIRECTIVO', user: 'direccion.cesge@gmail.com', pass: 'CesgeDir2026!', desc: 'Indicadores, reportes y administración de altos cargos' },
];

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regRole, setRegRole] = useState<Role>('PERSONAL DE ASEO');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    ensureDefaultUsersLoaded();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await loginLocal(identifier, password);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const created = await registerLocal({
        username: regUsername,
        email: regEmail,
        fullName: regFullName,
        password: regPassword,
        role: regRole,
      });
      setInfo(
        `Cuenta creada correctamente con perfil ${created.user.role}. Ya puede iniciar sesión con su usuario o correo.`
      );
      setIdentifier(created.user.email);
      setPassword(regPassword);
      setRegUsername('');
      setRegEmail('');
      setRegFullName('');
      setRegPassword('');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar el usuario.');
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(email: string, pass: string) {
    setMode('login');
    setIdentifier(email);
    setPassword(pass);
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
            CN
          </div>
          <span className="font-bold text-slate-900 tracking-tight whitespace-nowrap">
            CESGE Torre Norte · Aseo y Residuos Sólidos
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          {showManual ? 'Volver al acceso' : 'Manual del Usuario'}
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {showManual ? (
          <div className="lg:col-span-12">
            <UserManualPanel />
          </div>
        ) : (
          <>
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8">
              <p className="text-xs font-medium text-emerald-700 tracking-wide mb-2">
                Centro de Servicios y Gestión Empresarial · SENA
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-3 text-balance">
                PLATAFORMA INTEGRAL DE ADMINISTRACIÓN DEL ASEO Y RESIDUOS SÓLIDOS – CESGE
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Sistema institucional para planificar, ejecutar, supervisar y auditar las actividades de limpieza, inventario químico (SST-FR-96), consumo de insumos, reconocimiento visual por IA y gestión de residuos sólidos (Resolución 2184 de 2019) en la Torre Norte, desde el sótano hasta el piso 10 y zonas exteriores.
              </p>

              <div className="border-t border-slate-200 pt-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">
                  Accesos iniciales por perfil institucional (clic para cargar credenciales)
                </h2>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => fillCredentials(acc.user, acc.pass)}
                      className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-semibold text-blue-800">{acc.role}</div>
                        <div className="text-xs text-slate-600">{acc.desc}</div>
                      </div>
                      <div className="text-xs font-mono text-slate-500 whitespace-nowrap">
                        {acc.user}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Registrar Cuenta
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {error}
                </div>
              )}
              {info && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  {info}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Usuario o Correo Gmail
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="usuario o correo@gmail.com"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4" />
                    {loading ? 'Verificando acceso...' : 'Iniciar Sesión'}
                  </button>
                  <div className="pt-2 flex items-start gap-2 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                    <span>
                      Toda acción realizada queda registrada con fecha, hora, usuario y perfil en el historial institucional de trazabilidad.
                    </span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Nombre y apellidos"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nombre de usuario
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="ej. juan.perez"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Correo electrónico (Gmail)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nombre@gmail.com"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Perfil institucional
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as Role)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {ALLOWED_ROLES.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Contraseña (mínimo 6 caracteres)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading ? 'Registrando...' : 'Crear Cuenta de Acceso'}
                  </button>
                </form>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
