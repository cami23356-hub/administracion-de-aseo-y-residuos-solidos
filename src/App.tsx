import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Camera,
  Calendar,
  FlaskConical,
  Recycle,
  GitBranch,
  BarChart3,
  ShieldAlert,
  FileSpreadsheet,
  LogOut,
  Search,
  Menu,
  X,
  BookOpen,
  Coffee,
} from 'lucide-react';
import {
  AuditAlert,
  AuditFinding,
  CafeteriaMovement,
  CafeteriaSupply,
  ConsumptionRecord,
  DamageReport,
  EquipmentDelivery,
  Floor,
  LegalMatrixRow,
  PhotoRecord,
  ProductItem,
  ScheduleActivity,
  ShiftConfig,
  Space,
  User,
  WasteBin,
  WasteRecord,
} from './types/cesge';
import { apiFetch, getToken, setToken } from './utils/api';
import LoginView from './components/LoginView';
import DashboardHome from './components/DashboardHome';
import BuildingMapModule from './components/BuildingMapModule';
import AiVisionModule from './components/AiVisionModule';
import ScheduleModule from './components/ScheduleModule';
import InventoryConsumptionModule from './components/InventoryConsumptionModule';
import WasteModule from './components/WasteModule';
import ProcessDocsModule from './components/ProcessDocsModule';
import IndicatorsModule from './components/IndicatorsModule';
import AuditsLegalModule from './components/AuditsLegalModule';
import ReportsAdminModule from './components/ReportsAdminModule';
import CafeteriaDamagesModule from './components/CafeteriaDamagesModule';

type NavTab =
  | 'dashboard'
  | 'map'
  | 'vision'
  | 'schedules'
  | 'inventory'
  | 'cafeteria'
  | 'waste'
  | 'process'
  | 'indicators'
  | 'audits'
  | 'reports';

interface SearchResults {
  spaces: Array<{ id: number; name: string; category: string; floorCode: string; floorName: string; availability: string }>;
  schedules: Array<{ id: number; date: string; areaName: string; activity: string; responsible: string; status: string }>;
  products: Array<{ id: number; name: string; category: string; availableQty: number; unit: string }>;
  legal: Array<{ id: number; norm: string; year: string; complianceStatus: string }>;
  deliveries?: Array<{ id: number; deliveryDate: string; deliveryTime: string; deliveryType: string; deliveredBy: string; deliveredTo: string }>;
  cafeteria?: Array<{ id: number; itemName: string; cafeteriaLocation: string; currentQty: number; minQty: number; unit: string }>;
  damages?: Array<{ id: number; itemDamaged: string; spaceName: string; status: string; severity: string; floorName: string }>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global live data
  const [floors, setFloors] = useState<Floor[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [schedules, setSchedules] = useState<ScheduleActivity[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [deliveries, setDeliveries] = useState<EquipmentDelivery[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [cafeteriaSupplies, setCafeteriaSupplies] = useState<CafeteriaSupply[]>([]);
  const [cafeteriaMovements, setCafeteriaMovements] = useState<CafeteriaMovement[]>([]);
  const [damages, setDamages] = useState<DamageReport[]>([]);
  const [wasteBins, setWasteBins] = useState<WasteBin[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [audits, setAudits] = useState<AuditAlert[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [legalMatrix, setLegalMatrix] = useState<LegalMatrixRow[]>([]);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);

  const loadAllData = useCallback(async () => {
    const [fl, sp, ph, sh, sc, pr, co, dl, us, caf, dm, wb, wr, au, fi, lm] = await Promise.all([
      apiFetch<Floor[]>('/api/floors'),
      apiFetch<Space[]>('/api/spaces'),
      apiFetch<PhotoRecord[]>('/api/photos'),
      apiFetch<ShiftConfig[]>('/api/shifts'),
      apiFetch<ScheduleActivity[]>('/api/schedules'),
      apiFetch<ProductItem[]>('/api/products'),
      apiFetch<ConsumptionRecord[]>('/api/consumptions'),
      apiFetch<EquipmentDelivery[]>('/api/deliveries'),
      apiFetch<User[]>('/api/users'),
      apiFetch<{ supplies: CafeteriaSupply[]; movements: CafeteriaMovement[] }>('/api/cafeteria/supplies'),
      apiFetch<DamageReport[]>('/api/damages'),
      apiFetch<WasteBin[]>('/api/waste/bins'),
      apiFetch<WasteRecord[]>('/api/waste/records'),
      apiFetch<AuditAlert[]>('/api/audits'),
      apiFetch<AuditFinding[]>('/api/findings'),
      apiFetch<LegalMatrixRow[]>('/api/legal-matrix'),
    ]);
    setFloors(fl);
    setSpaces(sp);
    setPhotos(ph);
    setShifts(sh);
    setSchedules(sc);
    setProducts(pr);
    setConsumptions(co);
    setDeliveries(dl);
    setUsersList(us);
    setCafeteriaSupplies(caf.supplies);
    setCafeteriaMovements(caf.movements);
    setDamages(dm);
    setWasteBins(wb);
    setWasteRecords(wr);
    setAudits(au);
    setFindings(fi);
    setLegalMatrix(lm);
  }, []);

  useEffect(() => {
    async function init() {
      const token = getToken();
      if (!token) {
        setCheckingAuth(false);
        return;
      }
      try {
        const res = await apiFetch<{ user: User }>('/api/auth/me');
        setUser(res.user);
        await loadAllData();
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        setCheckingAuth(false);
      }
    }
    init();
  }, [loadAllData]);

  useEffect(() => {
    if (!user) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then(setSearchResults)
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  async function handleLoginSuccess(loggedUser: User) {
    setUser(loggedUser);
    await loadAllData();
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless
    }
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Verificando sesión institucional CESGE...
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Inicio y Manual', icon: LayoutDashboard },
    { id: 'map', label: 'Mapa Torre Norte', icon: Building2 },
    { id: 'vision', label: 'Visión IA y Fotos', icon: Camera },
    { id: 'schedules', label: 'Jornadas y Calendario', icon: Calendar },
    { id: 'inventory', label: 'Inventario, EPP y Dotación', icon: FlaskConical },
    { id: 'cafeteria', label: 'Cafetería y Daños', icon: Coffee },
    { id: 'waste', label: 'Residuos Sólidos', icon: Recycle },
    { id: 'process', label: 'Procesos y PHVA', icon: GitBranch },
    { id: 'indicators', label: 'Indicadores', icon: BarChart3 },
    { id: 'audits', label: 'Auditorías y Matriz Legal', icon: ShieldAlert },
    { id: 'reports', label: 'Reportes y Usuarios', icon: FileSpreadsheet },
  ];

  const pendingAuditsCount = audits.filter((a) => a.status === 'Pendiente' || a.status === 'En curso').length;

  function selectTab(tab: NavTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setSearchResults(null);
  }

  function jumpToManual() {
    setActiveTab('dashboard');
    setMobileMenuOpen(false);
    setTimeout(() => {
      document.getElementById('manual-usuario-raiz')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
            CESGE
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">Torre Norte</div>
            <div className="text-[11px] text-slate-500 truncate">Aseo y Residuos Sólidos</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'audits' && pendingAuditsCount > 0 && (
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${
                      active ? 'text-amber-200' : 'text-amber-700'
                    }`}
                  >
                    {pendingAuditsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={jumpToManual}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Manual del Usuario</span>
          </button>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-bold text-slate-900 truncate">{user.fullName}</div>
            <div className="text-[11px] text-slate-500 truncate">{user.role}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 bg-white h-full border-r border-slate-200 flex flex-col p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-900">CESGE Torre Norte</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      active ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              PLATAFORMA INTEGRAL DE ADMINISTRACIÓN DEL ASEO Y RESIDUOS SÓLIDOS – CESGE
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* ÁREA DE BÚSQUEDA GLOBAL */}
            <div className="relative w-48 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar espacio, producto, norma..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {searchResults && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 max-h-96 overflow-y-auto text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-900">Resultados de búsqueda</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                      }}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      Cerrar
                    </button>
                  </div>
                  {searchResults.spaces.length > 0 && (
                    <div>
                      <div className="font-semibold text-emerald-800 mb-1">Espacios</div>
                      {searchResults.spaces.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectTab('map')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {s.floorName} · {s.name} ({s.availability})
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.schedules.length > 0 && (
                    <div>
                      <div className="font-semibold text-blue-800 mb-1">Actividades</div>
                      {searchResults.schedules.map((sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => selectTab('schedules')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {sc.date} · {sc.activity} ({sc.areaName})
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.products.length > 0 && (
                    <div>
                      <div className="font-semibold text-emerald-800 mb-1">Inventario</div>
                      {searchResults.products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectTab('inventory')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {p.name} ({p.availableQty} {p.unit})
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.legal.length > 0 && (
                    <div>
                      <div className="font-semibold text-blue-800 mb-1">Normatividad</div>
                      {searchResults.legal.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => selectTab('audits')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {l.norm} ({l.year}) · {l.complianceStatus}
                        </button>
                      ))}
                    </div>
                  )}
                  {(searchResults.deliveries?.length ?? 0) > 0 && (
                    <div>
                      <div className="font-semibold text-amber-800 mb-1">Entregas de Dotación / EPP</div>
                      {searchResults.deliveries!.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => selectTab('inventory')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {d.deliveryDate} {d.deliveryTime} · {d.deliveryType} ({d.deliveredBy} → {d.deliveredTo})
                        </button>
                      ))}
                    </div>
                  )}
                  {(searchResults.cafeteria?.length ?? 0) > 0 && (
                    <div>
                      <div className="font-semibold text-amber-800 mb-1">Insumos de Cafetería</div>
                      {searchResults.cafeteria!.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectTab('cafeteria')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {c.itemName} · {c.cafeteriaLocation} (Hay: {c.currentQty} {c.unit})
                        </button>
                      ))}
                    </div>
                  )}
                  {(searchResults.damages?.length ?? 0) > 0 && (
                    <div>
                      <div className="font-semibold text-red-700 mb-1">Reportes de Daños</div>
                      {searchResults.damages!.map((dm) => (
                        <button
                          key={dm.id}
                          type="button"
                          onClick={() => selectTab('cafeteria')}
                          className="w-full text-left py-1 px-2 hover:bg-slate-50 rounded"
                        >
                          {dm.itemDamaged} · {dm.floorName} ({dm.status})
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.spaces.length === 0 &&
                    searchResults.schedules.length === 0 &&
                    searchResults.products.length === 0 &&
                    searchResults.legal.length === 0 &&
                    (searchResults.deliveries?.length ?? 0) === 0 &&
                    (searchResults.cafeteria?.length ?? 0) === 0 &&
                    (searchResults.damages?.length ?? 0) === 0 && (
                      <div className="text-slate-500 py-2">Sin coincidencias para «{searchQuery}».</div>
                    )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesión
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardHome
              user={user}
              spaces={spaces}
              schedules={schedules}
              products={products}
              wasteRecords={wasteRecords}
              audits={audits}
              onNavigate={(tab) => selectTab(tab as NavTab)}
            />
          )}
          {activeTab === 'map' && (
            <BuildingMapModule
              user={user}
              floors={floors}
              spaces={spaces}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'vision' && (
            <AiVisionModule
              user={user}
              floors={floors}
              spaces={spaces}
              photos={photos}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'schedules' && (
            <ScheduleModule
              user={user}
              floors={floors}
              spaces={spaces}
              shifts={shifts}
              schedules={schedules}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryConsumptionModule
              user={user}
              floors={floors}
              shifts={shifts}
              products={products}
              consumptions={consumptions}
              deliveries={deliveries}
              usersList={usersList}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'cafeteria' && (
            <CafeteriaDamagesModule
              user={user}
              floors={floors}
              spaces={spaces}
              supplies={cafeteriaSupplies}
              movements={cafeteriaMovements}
              damages={damages}
              usersList={usersList}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'waste' && (
            <WasteModule
              user={user}
              floors={floors}
              shifts={shifts}
              bins={wasteBins}
              records={wasteRecords}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'process' && <ProcessDocsModule user={user} />}
          {activeTab === 'indicators' && <IndicatorsModule floors={floors} shifts={shifts} />}
          {activeTab === 'audits' && (
            <AuditsLegalModule
              user={user}
              floors={floors}
              audits={audits}
              findings={findings}
              legalMatrix={legalMatrix}
              onRefresh={loadAllData}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsAdminModule
              user={user}
              spaces={spaces}
              schedules={schedules}
              products={products}
              consumptions={consumptions}
              deliveries={deliveries}
              cafeteriaSupplies={cafeteriaSupplies}
              damages={damages}
              wasteBins={wasteBins}
              wasteRecords={wasteRecords}
              audits={audits}
              findings={findings}
              legalMatrix={legalMatrix}
              onRefresh={loadAllData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
