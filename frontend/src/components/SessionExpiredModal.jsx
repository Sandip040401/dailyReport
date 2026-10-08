// src/components/SessionExpiredModal.jsx
import React from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';

export default function SessionExpiredModal({ isOpen, onLogin }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-gray-100 transform transition-all scale-100">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50/50">
          <AlertTriangle className="w-7 h-7" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Session Expired
        </h3>
        
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Your session has timed out or is no longer valid. Please log in again to continue managing your payments.
        </p>

        <button
          onClick={onLogin}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-200 cursor-pointer active:scale-[0.99]"
        >
          <LogIn className="w-4 h-4" />
          <span>Login Again</span>
        </button>
      </div>
    </div>
  );
}
