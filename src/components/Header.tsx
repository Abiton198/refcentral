import React, { useState } from 'react';
import { UserRole } from '../types';
import { Badge } from './ui/Badge';

interface HeaderProps {
  role: UserRole | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ role, onLogout }) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const getRoleBadge = () => {
    if (!role) return null;
    const variants = {
      executive: 'danger' as const,
      referee: 'success' as const,
      coach: 'info' as const,
    };
    return <Badge variant={variants[role]}>{role.toUpperCase()}</Badge>;
  };

  const handleImageClick = (src: string) => {
    setZoomedImage(zoomedImage === src ? null : src);
  };

  return (
    <>
      <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          
          {/* Left Logo */}
          <div className="flex items-center gap-4">
            <img
              src="/img/epru_logo.jpeg"
              alt="EPRRS_LOGO"
              onClick={() => handleImageClick('/img/epru_logo.jpeg')}
              className="h-12 w-12 rounded-full border-2 border-amber-500 cursor-pointer transition-transform hover:scale-110"
            />
            <div>
              <h1 className="text-2xl font-bold">RefCentral</h1>
              <p className="text-xs text-amber-400">
                Eastern Province Rugby Referees Society
              </p>
            </div>
          </div>

          {/* Middle (role + logout if logged in) */}
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

          {/* Right Logo */}
          <div className="flex items-center gap-4">
            <img
              src="/img/saru_logo.jpeg"
              alt="saru Logo"
              onClick={() => handleImageClick('/img/saru_logo.jpeg')}
              className="h-12 w-12 rounded-full border-2 border-amber-500 cursor-pointer transition-transform hover:scale-110"
            />
          </div>
        </div>
      </header>

      {/* Zoomed Image Overlay */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-[9999]"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed logo"
            className="max-w-full max-h-full rounded-lg shadow-lg cursor-pointer"
          />
        </div>
      )}
    </>
  );
};
