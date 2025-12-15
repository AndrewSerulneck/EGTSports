import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import MemberDashboardApp from '../MemberDashboardApp';

/**
 * MemberContainer - Unified container for Home (Betting Grid) and My Bets (Dashboard)
 * 
 * MOBILE-FIRST DESIGN: Performance Optimization
 * 
 * Both views are ALWAYS MOUNTED in the DOM to eliminate loading delays when switching tabs.
 * CSS display property (display: none / display: block) is used to show/hide views.
 * 
 * This prevents component unmount/remount, preserving state and eliminating the ~300-500ms
 * transition delay that occurs with React Router's default behavior.
 * 
 * Key Benefits:
 * - Instantaneous tab switching (~50ms vs ~300-500ms)
 * - State preservation across tab switches
 * - No re-initialization overhead
 * - Better mobile UX
 */
function MemberContainer({
  // Home (LandingPage) props
  games,
  allSportsGames,
  betType,
  onBetTypeChange,
  loading,
  apiError,
  onManualRefresh,
  lastRefreshTime,
  onSignOut,
  isRefreshing,
  propBets,
  propBetsLoading,
  propBetsError,
  setCurrentViewSport,
  currentViewSportRef,
  setGames,
  loadAllPropBets,
  userCredit,
  onRefreshCredit,
  // LandingPage component reference
  LandingPage
}) {
  const navigate = useNavigate();
  const { sport } = useParams();
  const location = useLocation();
  
  // Determine if we're on the dashboard route
  const isDashboardRoute = location.pathname === '/member/dashboard';
  
  // Current view state: 'home' or 'mybets'
  // Initialize based on route
  const [currentView, setCurrentView] = useState(isDashboardRoute ? 'mybets' : 'home');
  
  // Track if views have been initialized (for data loading)
  const homeInitialized = useRef(false);
  const myBetsInitialized = useRef(false);
  
  // Sync view state when route changes (e.g., browser back/forward button)
  useEffect(() => {
    const newView = location.pathname === '/member/dashboard' ? 'mybets' : 'home';
    if (newView !== currentView) {
      setCurrentView(newView);
    }
  }, [location.pathname, currentView]);
  
  // Handle sport changes in URL when on home view
  useEffect(() => {
    if (currentView === 'home' && sport) {
      if (sport === 'prop-bets') {
        setCurrentViewSport('Prop Bets');
        currentViewSportRef.current = 'Prop Bets';
        setGames([]);
        if (Object.keys(propBets).length === 0 && !propBetsLoading) {
          loadAllPropBets();
        }
      } else {
        const gamesForSport = allSportsGames[sport] || [];
        setCurrentViewSport(sport);
        currentViewSportRef.current = sport;
        setGames(gamesForSport);
      }
    }
  }, [sport, allSportsGames, propBets, propBetsLoading, currentView, setCurrentViewSport, currentViewSportRef, setGames, loadAllPropBets]);
  
  // Mark views as initialized on first render
  useEffect(() => {
    homeInitialized.current = true;
    myBetsInitialized.current = true;
  }, []);
  
  // Navigate to My Bets
  const handleNavigateToDashboard = () => {
    setCurrentView('mybets');
    navigate('/member/dashboard', { replace: false, state: { from: 'home' } });
  };
  
  // Navigate back to Home
  const handleNavigateToHome = () => {
    setCurrentView('home');
    const targetSport = sport || currentViewSportRef.current || 'NFL';
    navigate(`/member/${targetSport}`, { replace: false, state: { from: 'dashboard' } });
  };
  
  // Handle sport changes from within the home view
  const handleChangeSport = (newSport) => {
    if (newSport === 'Prop Bets') {
      navigate('/member/prop-bets', { replace: true });
    } else {
      navigate(`/member/${newSport}`, { replace: true });
    }
  };
  
  const currentSport = sport === 'prop-bets' ? 'Prop Bets' : sport;
  const [collapseBettingSlip, setCollapseBettingSlip] = useState(false);
  
  // Handle betting slip collapse when navigating from dashboard
  useEffect(() => {
    if (location.state?.from === 'dashboard' && currentView === 'home') {
      // Trigger collapse
      setCollapseBettingSlip(true);
      // Reset after a brief moment
      const timer = setTimeout(() => setCollapseBettingSlip(false), 100);
      return () => clearTimeout(timer);
    }
  }, [location.state, currentView]);
  
  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      minHeight: '100vh' 
    }}>
      {/* 
        HOME VIEW (Betting Grid + Betting Slip)
        Always mounted, visibility controlled by CSS 
      */}
      <div style={{ 
        display: currentView === 'home' ? 'block' : 'none',
        width: '100%',
        minHeight: '100vh'
      }}>
        <LandingPage
          games={games}
          allSportsGames={allSportsGames}
          currentViewSport={currentSport}
          onChangeSport={handleChangeSport}
          loading={loading}
          onBackToMenu={onSignOut}
          sport={currentSport}
          betType={betType}
          onBetTypeChange={onBetTypeChange}
          apiError={apiError}
          onManualRefresh={onManualRefresh}
          lastRefreshTime={lastRefreshTime}
          onSignOut={onSignOut}
          isRefreshing={isRefreshing}
          propBets={propBets}
          propBetsLoading={propBetsLoading}
          propBetsError={propBetsError}
          onNavigateToDashboard={handleNavigateToDashboard}
          userCredit={userCredit}
          onRefreshCredit={onRefreshCredit}
          collapseBettingSlip={collapseBettingSlip}
        />
      </div>
      
      {/* 
        MY BETS VIEW (Dashboard)
        Always mounted, visibility controlled by CSS 
      */}
      <div style={{ 
        display: currentView === 'mybets' ? 'block' : 'none',
        width: '100%',
        minHeight: '100vh'
      }}>
        <MemberDashboardApp 
          onNavigateToHome={handleNavigateToHome}
        />
      </div>
    </div>
  );
}

export default MemberContainer;
