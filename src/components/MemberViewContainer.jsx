import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MemberDashboardApp from '../MemberDashboardApp';

/**
 * MemberViewContainer - Tab-based container for Home (betting) and My Bets (dashboard) views
 * 
 * Purpose: Implement seamless tab switching without unmounting/remounting components
 * - Uses CSS display:none to hide inactive tabs while preserving state
 * - Prevents data re-fetching when switching between Home and My Bets
 * - Mobile-First Design: Optimized for mobile performance
 * 
 * Issue #1: Betting Slip Default State
 * - Automatically collapses betting slip when navigating to Home tab
 * 
 * Issue #2: Seamless Tab Transitions
 * - Both views remain mounted, hidden with display:none when inactive
 * - Eliminates loading delay when switching tabs
 */
function MemberViewContainer({
  // Home/Betting view props
  LandingPageComponent,
  games,
  allSportsGames,
  currentViewSport,
  onChangeSport,
  loading,
  sport,
  betType,
  onBetTypeChange,
  apiError,
  onManualRefresh,
  lastRefreshTime,
  onSignOut,
  isRefreshing,
  propBets,
  propBetsLoading,
  propBetsError,
  userCredit,
  onRefreshCredit,
  setCurrentViewSport,
  currentViewSportRef,
  setGames,
  loadAllPropBets
}) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine active tab from URL path
  const isDashboardPath = location.pathname === '/member/dashboard';
  const [activeTab, setActiveTab] = useState(isDashboardPath ? 'mybets' : 'home');
  const [collapseBettingSlip, setCollapseBettingSlip] = useState(false);
  
  // Keep activeTab in sync with URL
  useEffect(() => {
    const newTab = location.pathname === '/member/dashboard' ? 'mybets' : 'home';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      
      // Issue #1: Collapse betting slip when navigating to Home
      if (newTab === 'home') {
        setCollapseBettingSlip(true);
        // Reset after a brief delay to allow the prop to be processed
        setTimeout(() => setCollapseBettingSlip(false), 100);
      }
    }
  }, [location.pathname, activeTab]);
  
  // Navigation handlers
  const handleNavigateToDashboard = () => {
    navigate('/member/dashboard', { state: { from: 'home' } });
  };
  
  const handleNavigateHome = () => {
    // Navigate to last viewed sport or default to NFL
    // Pass state to indicate we're returning from dashboard (for Issue #1)
    const sportPath = currentViewSportRef.current || sport || 'NFL';
    navigate(`/member/${sportPath}`, { state: { from: 'dashboard', collapseBettingSlip: true } });
  };
  
  return (
    <div className="member-view-container">
      {/* Home Tab - Betting View (Issue #2: Hidden with display:none, not unmounted) */}
      <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
        {LandingPageComponent && React.createElement(LandingPageComponent, {
          games,
          allSportsGames,
          currentViewSport,
          onChangeSport,
          loading,
          onBackToMenu: onSignOut,
          sport,
          betType,
          onBetTypeChange,
          apiError,
          onManualRefresh,
          lastRefreshTime,
          propBets,
          propBetsLoading,
          propBetsError,
          onSignOut,
          isRefreshing,
          onNavigateToDashboard: handleNavigateToDashboard,
          userCredit,
          onRefreshCredit,
          collapseBettingSlip // Issue #1: Pass collapse control to betting slip
        })}
      </div>
      
      {/* My Bets Tab - Dashboard View (Issue #2: Hidden with display:none, not unmounted) */}
      <div style={{ display: activeTab === 'mybets' ? 'block' : 'none' }}>
        <MemberDashboardApp 
          onNavigateHome={handleNavigateHome}
        />
      </div>
    </div>
  );
}

export default MemberViewContainer;
