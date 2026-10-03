// Main Application Entrypoint
import { AnimatePresence, motion } from 'framer-motion';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { RightPanel } from './components/layout/RightPanel';
import { BottomPanel } from './components/layout/BottomPanel';
import { EmergencyModal } from './components/layout/EmergencyModal';
import { EventToasts } from './components/ui/EventToasts';
import { DashboardPage } from './components/pages/DashboardPage';
import { DigitalTwinPage } from './components/pages/DigitalTwinPage';
import { MineDesignerPage } from './components/designer/MineDesignerPage';
import { SensorNetworkPage } from './components/pages/SensorNetworkPage';
import { RiskHeatmapPage } from './components/pages/RiskHeatmapPage';
import { AnalyticsPage } from './components/pages/AnalyticsPage';
import { AlertsPage } from './components/pages/AlertsPage';
import { DroneFeedPage } from './components/pages/DroneFeedPage.tsx';
import { HistoricalPage } from './components/pages/HistoricalPage.tsx';
import { SettingsPage } from './components/pages/SettingsPage.tsx';
import { RockSentinelAIPage } from './pages/RockSentinelAI';
import { useApp } from './store/AppContext';
import type { PageId } from './data/types';

const PAGES: Record<PageId, React.ReactNode> = {
  dashboard: <DashboardPage />,
  'digital-twin': <DigitalTwinPage />,
  'mine-designer': <MineDesignerPage />,
  'rock-sentinel-ai': <RockSentinelAIPage />,
  'sensor-network': <SensorNetworkPage />,
  'risk-heatmap': <RiskHeatmapPage />,
  analytics: <AnalyticsPage />,
  alerts: <AlertsPage />,
  'drone-feed': <DroneFeedPage />,
  historical: <HistoricalPage />,
  settings: <SettingsPage />,
};

// Pages that show the right panel (sensor details, AI prediction)
const SHOW_RIGHT_PANEL: PageId[] = ['digital-twin', 'dashboard', 'sensor-network', 'risk-heatmap'];
// Pages that show the bottom panel (telemetry charts + widgets)
const SHOW_BOTTOM_PANEL: PageId[] = ['digital-twin', 'dashboard', 'sensor-network', 'risk-heatmap', 'alerts', 'historical'];

export default function App() {
  const { currentPage } = useApp();
  const showRight = SHOW_RIGHT_PANEL.includes(currentPage);
  const showBottom = SHOW_BOTTOM_PANEL.includes(currentPage);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b12] text-[var(--color-text-primary)]">
      <TopBar />
      <div className="flex flex-1 min-h-0 relative">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col relative">
          <div className="flex-1 min-h-0 relative overflow-hidden grid-bg">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {PAGES[currentPage]}
              </motion.div>
            </AnimatePresence>
          </div>
          {showBottom && <BottomPanel />}
        </div>
        {showRight && <RightPanel />}
      </div>
      <EmergencyModal />
      <EventToasts />
    </div>
  );
}
