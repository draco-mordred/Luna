import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './TopNavbar.css';

type TabType = 'tracks' | 'albums' | 'artists' | 'composer';

const TABS = [
  { id: 'tracks' as TabType, label: 'Tracks', icon: 'music_note' },
  { id: 'albums' as TabType, label: 'Albums', icon: 'album' },
  { id: 'artists' as TabType, label: 'Artists', icon: 'person' },
  { id: 'composer' as TabType, label: 'Composer', icon: 'edit_note' },
];

const TopNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('tracks');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Sync active tab with URL
  useEffect(() => {
    const path = location.pathname.split('/')[1] as TabType | undefined;
    if (TABS.some(tab => tab.id === path)) {
      setActiveTab(path as TabType);
    }
  }, [location.pathname]);

  // Handle tab change
  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    navigate(`/${tabId}`);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSettingsMenu = () => {
    setShowSettingsMenu(!showSettingsMenu);
    setShowAccountMenu(false);
  };

  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu);
    setShowSettingsMenu(false);
  };

  return (
    <nav className="top-navbar">
      <div className="navbar-left">
        {/* Tab Navigation */}
        <div className="tabs-container">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="material-symbols-outlined tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="navbar-right">
        {/* Search */}
        <button className="navbar-button search-button">
          <span className="material-symbols-outlined">search</span>
        </button>

        {/* Account/Profile */}
        <div className="account-section" ref={accountMenuRef}>
          <button className="navbar-button account-button" onClick={toggleAccountMenu}>
            <span className="material-symbols-outlined">account_circle</span>
          </button>
          
          {showAccountMenu && (
            <div className="account-menu">
              <div className="menu-header">
                <h3>Account</h3>
              </div>
              <ul className="menu-list">
                <li className="menu-item">
                  <Link className="menu-button" to="/settings/profile">
                    <span className="material-symbols-outlined">person</span>
                    <span>Profile</span>
                  </Link>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">logout</span>
                    <span>Sign Out</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Options/Settings */}
        <div className="options-section" ref={settingsMenuRef}>
          <button className="navbar-button options-button" onClick={toggleSettingsMenu}>
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          
          {showSettingsMenu && (
            <div className="settings-menu">
              <div className="menu-header">
                <h3>Options</h3>
              </div>
              <ul className="menu-list">
                <li className="menu-item">
                  <Link className="menu-button" to="/settings" onClick={() => setShowSettingsMenu(false)}>
                    <span className="material-symbols-outlined">settings</span>
                    <span>Settings</span>
                  </Link>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">folder_open</span>
                    <span>Add Music Folder</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">refresh</span>
                    <span>Rescan Library</span>
                  </button>
                </li>
                <li className="menu-item divider">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">help</span>
                    <span>Help</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">info</span>
                    <span>About</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default TopNavbar;
