import React from 'react';
import { UserRole } from '../types';
import { Badge } from './ui/Badge';

interface HeaderProps {
  role: UserRole | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ role, onLogout }) => {
  const getRoleBadge = () => {
    if (!role) return null;
    const variants = {
      executive: 'danger' as const,
      referee: 'success' as const,
      coach: 'info' as const
    };
    return <Badge variant={variants[role]}>{role.toUpperCase()}</Badge>;
  };

  return (
    <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img 
            src="/img/epru_logo.jpeg" 
            alt="EPRRS_LOGO" 
            className="h-12 w-12 rounded-full border-2 border-amber-500"
          />
          <div>
            <h1 className="text-2xl font-bold">RefCentral</h1>
            <p className="text-xs text-amber-400">Eastern Province Rugby Referees Society</p>
          </div>
        </div>
        
        {role && (
          <div className="flex items-center gap-4">
            {getRoleBadge()}
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
