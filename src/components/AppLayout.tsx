import React, { useState } from 'react';
import { UserRole } from '../types';
import { Hero } from './Hero';
import { Header } from './Header';
import { Footer } from './Footer';
import { Features } from './Features';
import { Stats } from './Stats';
import { Testimonials } from './Testimonials';
import { AboutSection } from './AboutSection';
import { RoleSelector } from './RoleSelector';
import { ExecutiveDashboard } from './executive/ExecutiveDashboard';
import { RefereeDashboard } from './referee/RefereeDashboard';
import { CoachDashboard } from './coach/CoachDashboard';



const AppLayout: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const handleGetStarted = () => {
    setShowDashboard(true);
  };

  const handleSelectRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const handleLogout = () => {
    setCurrentRole(null);
    setShowDashboard(false);
  };

  const renderDashboard = () => {
    switch(currentRole) {
      case 'executive':
        return <ExecutiveDashboard />;
      case 'referee':
        return <RefereeDashboard />;
      case 'coach':
        return <CoachDashboard />;
      default:
        return <RoleSelector onSelectRole={handleSelectRole} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header role={currentRole} onLogout={handleLogout} />
      
      {!showDashboard ? (
        <>
          <Hero onGetStarted={handleGetStarted} />
          <Stats />
          <AboutSection />
          <Features />
          <Testimonials />
        </>


      ) : (
        <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
          {renderDashboard()}
        </main>
      )}
      
      <Footer />
    </div>
  );
};

export default AppLayout;
