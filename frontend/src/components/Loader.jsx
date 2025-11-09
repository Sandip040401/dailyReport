// src/components/Loader.jsx
import React from 'react';

export default function Loader({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Message */}
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800">{message}</p>
          <p className="text-sm text-gray-500 mt-1">Please wait...</p>
        </div>
      </div>
    </div>
  );
}
