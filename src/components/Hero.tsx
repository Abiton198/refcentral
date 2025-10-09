import React from 'react';
import { Button } from './ui/Button';

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  return (
    <div className="relative h-[500px] flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: 'url(https://d64gsuwffb70l.cloudfront.net/68e77e23888071e4248dfd45_1760001625609_fee698e9.webp)',
          filter: 'brightness(0.7)'
        }}
      />
      
      <div className="relative z-10 text-center text-white px-4 max-w-4xl">
        <div className="flex justify-center mb-6">
          <img 
            src="/img/epru_logo.jpeg" 
            alt="Society Crest" 
            className="h-24 w-24 rounded-full border-4 border-green-800 shadow-2xl"
          />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
          RefCentral
        </h1>
        <p className="text-xl md:text-2xl mb-2 font-semibold text-amber-400">
          Professional Match Officials, Digital Excellence
        </p>
        <p className="text-lg mb-8 text-gray-200">
          Authority. Integrity. Innovation.
        </p>
        
        <Button onClick={onGetStarted} size="lg" variant="secondary">
          Access Dashboard
        </Button>
      </div>
    </div>
  );
};
