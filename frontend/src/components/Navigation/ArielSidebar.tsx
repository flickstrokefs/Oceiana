import React, { useEffect, useState } from 'react';
import {
  Compass,
  Activity,
  Database,
  Search,
  AlertTriangle,
  Fish,
  Settings,
  Eye,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import type { ArielPage } from '../../types/ocean';

interface ArielSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: ArielPage;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  restricted?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: '3d-ocean', label: '3D Ocean', icon: Compass },
  { id: 'obs-profile', label: 'Observation Profile', icon: Activity },
  { id: 'data-manager', label: 'Data Manager', icon: Database },
  { id: 'search', label: 'Search & Resources', icon: Search, restricted: true },
  { id: 'hazard', label: 'Hazard Assessment', icon: AlertTriangle, restricted: true },
  { id: 'fishery', label: 'Fishery Advisories', icon: Fish, restricted: true },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'public-view', label: 'Public View', icon: Eye },
];

export const ArielSidebar: React.FC<ArielSidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const [activePage, setActivePage] = useState<ArielPage>('3d-ocean');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setActivePage(snapshot.activePage);
      setModalOpen(snapshot.observationModalOpen);
    });
    return unsub;
  }, []);

  const handleNavClick = (pageId: ArielPage) => {
    OceanState.getInstance().setActivePage(pageId);
  };

  return (
    <aside className={`ariel-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-text">
          <div className="brand-org">INCOIS</div>
          <div className="brand-name">ARIEL</div>
          <div className="brand-subline">Advanced Ocean Intelligence</div>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.id === 'obs-profile' ? modalOpen : activePage === item.id && !modalOpen;

          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-btn ${isActive ? 'nav-active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              title={item.label}
            >
              <span className="nav-icon-wrap">
                <Icon size={16} />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}

        {/* Help item */}
        <button
          type="button"
          className="sidebar-nav-btn nav-help"
          onClick={() => {
            alert('ARIEL Ocean Intelligence Platform\nMinistry of Earth Sciences / INCOIS Ocean Valley\nProblem Statement: SIH26067');
          }}
          title="Help"
        >
          <span className="nav-icon-wrap">
            <HelpCircle size={16} />
          </span>
          <span className="nav-label">Help</span>
        </button>
      </nav>

      {/* System Status Footnote */}
      <div className="sidebar-footer">
        <div className="status-indicator-dot" />
        <span className="status-text">OPERATIONAL · INCOIS-HCOM</span>
      </div>
    </aside>
  );
};
