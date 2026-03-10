import Deletion from '@/pages/Deletion';
import PrivacyPolicy from '@/pages/privacy-policy';
import { Link } from 'lucide-react';
import React from 'react';

export const Footer: React.FC = () => {
  // Safe check for the Vite-injected variable
  const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white mt-16 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <h3 className="text-xl font-black text-amber-400 tracking-tighter italic uppercase">
              Ref<span className="text-white">Central</span>
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The professional standard for rugby official management. Authority, Integrity, and Innovation on and off the pitch.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-gray-200">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="/dashboard" className="hover:text-amber-400 transition-colors">Dashboard</a></li>
              <li><a href="/appointments" className="hover:text-amber-400 transition-colors">Appointments</a></li>
              <li><a href="/reports" className="hover:text-amber-400 transition-colors">Match Reports</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-gray-200">Support</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-amber-400 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Technical Support</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Training Docs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-gray-200">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="/privacy-policy" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
              <li><a href="/data-deletion" className="hover:text-amber-400 transition-colors">Data Deletion</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Code of Conduct</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col items-center">
          <p className="text-gray-500 text-sm">
            © {currentYear} RefCentral. All rights reserved.
          </p>
          <p className="text-gray-600 text-[11px] mt-1 font-medium italic">
            Built with pride for the rugby refereeing community.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                v{appVersion}
              </span>
            </div>
            <span className="text-gray-800">|</span>
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              Stable Release
            </span>
          </div>
        </div>
      </div>

    </footer>
  );
};