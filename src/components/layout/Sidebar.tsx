import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Box, ChevronLeft, ChevronRight, History, LayoutDashboard, Map,
  Network, BarChart3, Plane, Settings, Radio, FileText, Activity, Cpu, Wifi, Brain, Wrench,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import type { PageId } from '../../data/types';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
}

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar, alerts, drone, sensors } = useApp();

  const unresolved = alerts.filter(a => !a.resolved).length;
  const critical = alerts.filter(a => a.type === 'critical' && !a.resolved).length;
  const online = sensors.filter(s => s.status !== 'offline').length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[16px] h-[16px]" /> },
    { id: 'digital-twin', label: 'Digital Twin', icon: <Box className="w-[16px] h-[16px]" /> },
    { id: 'mine-designer', label: 'Mine Designer', icon: <Wrench className="w-[16px] h-[16px]" /> },
    { id: 'rock-sentinel-ai', label: 'RockSentinel AI', icon: <Brain className="w-[16px] h-[16px]" /> },
    { id: 'sensor-network', label: 'Sensor Network', icon: <Network className="w-[16px] h-[16px]" /> },
    { id: 'risk-heatmap', label: 'Risk Heatmap', icon: <Map className="w-[16px] h-[16px]" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-[16px] h-[16px]" /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className="w-[16px] h-[16px]" />, badge: unresolved, badgeColor: critical > 0 ? '#ef4444' : '#f59e0b' },
    { id: 'drone-feed', label: 'Drone Feed', icon: <Plane className="w-[16px] h-[16px]" /> },
    { id: 'historical', label: 'Historical Events', icon: <History className="w-[16px] h-[16px]" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-[16px] h-[16px]" /> },
  ];

  return (
    <motion.nav
      className="shrink-0 flex flex-col z-40 relative"
      style={{
        background: 'rgba(9,14,24,0.88)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(56,189,248,0.12)',
      }}
      initial={{ x: -90 }}
      animate={{ x: 0, width: sidebarCollapsed ? 52 : 180 }}
      transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      {/* Navigation Items */}
      <div className="flex-1 py-2 flex flex-col gap-[2px] px-1.5 overflow-y-auto">
        {!sidebarCollapsed && (
          <div className="px-2 pb-1.5">
            <span className="text-[8px] font-mono tracking-[0.3em] text-slate-600 uppercase">DASHBOARD</span>
          </div>
        )}
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <motion.button
              key={item.id}
              className={`relative flex items-center gap-2.5 rounded-lg transition-colors duration-200 ${
                sidebarCollapsed ? 'justify-center py-2' : 'px-2.5 py-2'
              } ${isActive
                ? 'text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
              onClick={() => setCurrentPage(item.id)}
              whileHover={{ x: sidebarCollapsed ? 0 : 2 }}
              whileTap={{ scale: 0.96 }}
              style={isActive ? {
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.3)',
                boxShadow: '0 0 14px rgba(34,211,238,0.12)',
              } : { border: '1px solid transparent' }}
            >
              {isActive && (
                <motion.div
                  className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                  style={{ background: '#22d3ee', boxShadow: '0 0 10px rgba(34,211,238,0.8)' }}
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              )}
              <span className="relative shrink-0">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full text-[7px] font-bold text-white flex items-center justify-center px-0.5 animate-pulse"
                    style={{ background: item.badgeColor, boxShadow: `0 0 6px ${item.badgeColor}` }}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    className="text-[11px] font-medium whitespace-nowrap tracking-wide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* System Status Section */}
      {!sidebarCollapsed && (
        <div className="px-2.5 pb-2 border-t border-white/[0.06] pt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[8px] font-mono tracking-[0.2em] text-slate-600 uppercase font-bold">SYSTEM STATUS</span>
          </div>
          <div className="space-y-1.5">
            <SystemStatusRow icon={<Radio className="w-3 h-3" />} label="Sensors Online" value={`${online} / ${sensors.length}`} color="#22c55e" />
            <SystemStatusRow icon={<Wifi className="w-3 h-3" />} label="Gateways" value="4 / 4" color="#22c55e" />
            <SystemStatusRow icon={<Cpu className="w-3 h-3" />} label="Network Health" value="92%" color="#22c55e" />
            <SystemStatusRow icon={<Brain className="w-3 h-3" />} label="AI Accuracy" value="91.3%" color="#22c55e" />
            <SystemStatusRow icon={<Activity className="w-3 h-3" />} label="Last Data Sync" value="2 sec ago" color="#38bdf8" />
          </div>
        </div>
      )}

      <div className="px-1.5 pb-1.5">
        <button
          className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.nav>
  );
}

function SystemStatusRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
      <span className="text-[9px] text-slate-400 flex-1">{label}</span>
      <span className="text-[9px] font-mono font-bold text-slate-200">{value}</span>
    </div>
  );
}
