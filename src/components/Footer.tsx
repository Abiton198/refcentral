import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4 text-amber-400">RefCentral</h3>
            <p className="text-gray-400 text-sm">
              Professional rugby referee management system. Authority, Integrity, Innovation.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-amber-400">Dashboard</a></li>
              <li><a href="#" className="hover:text-amber-400">Appointments</a></li>
              <li><a href="#" className="hover:text-amber-400">Reports</a></li>
              <li><a href="#" className="hover:text-amber-400">Resources</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-amber-400">Help Center</a></li>
              <li><a href="#" className="hover:text-amber-400">Contact Us</a></li>
              <li><a href="#" className="hover:text-amber-400">Training</a></li>
              <li><a href="#" className="hover:text-amber-400">Guidelines</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Society</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-amber-400">About Us</a></li>
              <li><a href="#" className="hover:text-amber-400">Code of Conduct</a></li>
              <li><a href="#" className="hover:text-amber-400">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-amber-400">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2025 RefCentral. All rights reserved. Built with pride for rugby officials.</p>
        </div>
      </div>
    </footer>
  );
};
