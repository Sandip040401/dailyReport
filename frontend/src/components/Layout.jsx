// src/components/Layout.jsx
import React, { useState } from 'react';
import { Menu, X, BookMinus, LogOut, Settings, Home, Users, BarChart3, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('payment-token');
    window.location.href = '/';
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/daily-payments', label: 'Daily Payments', icon: BarChart3 },
    { path: '/multi-day-payments', label: 'Multi-Day Payments', icon: AlertCircle },
    { path: '/expenses', label: 'Expenses', icon: AlertCircle },
    { path: '/parties', label: 'Parties', icon: Users },
    { path: '/reports', label: 'Reports', icon: BookMinus }
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 transform transition-all duration-300 ease-in-out shadow-lg overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'w-64' : 'w-64'}
          ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Sidebar Header */}
          <div className={`p-6 border-b border-gray-200 flex items-center flex-shrink-0 overflow-hidden ${sidebarOpen ? 'justify-between' : 'lg:justify-center justify-between'}`}>
            <div className={`flex items-center min-w-0 overflow-hidden ${sidebarOpen ? 'space-x-3' : 'lg:space-x-0 space-x-3'}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">PM</span>
              </div>
              <div className={`min-w-0 overflow-hidden ${sidebarOpen ? 'block' : 'lg:hidden block'}`}>
                <h1 className="text-black font-bold truncate">Payment</h1>
                <p className="text-xs text-gray-600 truncate">Manager</p>
              </div>
            </div>
            
            {/* Desktop collapse button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Toggle sidebar"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ChevronLeft className={`w-5 h-5 ${sidebarOpen ? 'block' : 'hidden'} lg:block`} />
              <ChevronRight className={`w-5 h-5 ${sidebarOpen ? 'hidden' : 'block lg:block'}`} />
              <X className={`w-5 h-5 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`} />
              <Menu className={`w-5 h-5 lg:hidden ${sidebarOpen ? 'hidden' : 'block'}`} />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors group relative ${sidebarOpen ? 'space-x-3' : 'lg:justify-center space-x-3'} ${
                    active
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`font-medium whitespace-nowrap ${sidebarOpen ? 'block' : 'lg:hidden block'}`}>
                    {item.label}
                  </span>
                  
                  {/* Tooltip for collapsed state on desktop */}
                  <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 ${sidebarOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    {item.label}
                  </span>
                </a>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2 flex-shrink-0 overflow-hidden">
            <button 
              className={`w-full flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors group relative ${sidebarOpen ? 'space-x-3' : 'lg:justify-center space-x-3'}`}
              title={!sidebarOpen ? "Settings" : ''}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className={`text-sm font-medium whitespace-nowrap ${sidebarOpen ? 'block' : 'lg:hidden block'}`}>
                Settings
              </span>
              <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 ${sidebarOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                Settings
              </span>
            </button>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors group relative ${sidebarOpen ? 'space-x-3' : 'lg:justify-center space-x-3'}`}
              title={!sidebarOpen ? "Logout" : ''}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className={`text-sm font-medium whitespace-nowrap ${sidebarOpen ? 'block' : 'lg:hidden block'}`}>
                Logout
              </span>
              <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 ${sidebarOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                Logout
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header for Mobile */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 lg:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-700 hover:text-black transition-colors"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-white">{children}</div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
