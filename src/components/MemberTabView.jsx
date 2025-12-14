import React, { useState } from 'react';
import MemberDashboardApp from '../MemberDashboardApp';

/**
 * MemberTabView - Wrapper component that manages Home and My Bets tabs
 * Uses display:none to hide inactive tabs, preserving state and preventing remounting
 * Mobile-First Design: Optimized for seamless tab switching on mobile devices
 */
function MemberTabView({ 
  homeContent,
  onTabChange,
  initialTab = 'home',
  onBettingSlipReset // Callback to reset betting slip when navigating to Home
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Reset betting slip when navigating to Home tab
    if (tab === 'home' && onBettingSlipReset) {
      onBettingSlipReset();
    }
    
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className="member-tab-view">
      {/* Home Tab Content - Hidden with display:none when inactive */}
      <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
        {/* Clone the home content and inject tab switching prop */}
        {React.cloneElement(homeContent, {
          onNavigateToDashboard: () => handleTabChange('mybets')
        })}
      </div>

      {/* My Bets Tab Content - Hidden with display:none when inactive */}
      <div style={{ display: activeTab === 'mybets' ? 'block' : 'none' }}>
        <MemberDashboardApp 
          onNavigateHome={() => handleTabChange('home')}
        />
      </div>
    </div>
  );
}

export default MemberTabView;
