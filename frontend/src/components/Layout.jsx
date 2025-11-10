// src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Menu, X, BookMinus, LogOut, Settings, Home, Users, BarChart3, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';


export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Handle responsive sidebar state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <aside
        className={`bg-white border-r border-gray-200 shadow-lg flex-shrink-0 transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'}
          fixed lg:relative inset-y-0 left-0 z-60
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ willChange: 'width, transform' }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3 min-w-0 overflow-hidden">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">PM</span>
              </div>
              <div 
                className={`min-w-0 overflow-hidden transition-opacity duration-200 ${
                  sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
                }`}
              >
                <h1 className="text-black font-bold truncate whitespace-nowrap">Payment</h1>
                <p className="text-xs text-gray-600 truncate whitespace-nowrap">Manager</p>
              </div>
            </div>
            
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <>
                  <ChevronLeft className="w-5 h-5 hidden lg:block" />
                  <X className="w-5 h-5 lg:hidden" />
                </>
              ) : (
                <>
                  <ChevronRight className="w-5 h-5 hidden lg:block" />
                  <Menu className="w-5 h-5 lg:hidden" />
                </>
              )}
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
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors group relative
                    ${sidebarOpen ? 'justify-start' : 'lg:justify-center'}
                    ${active
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span 
                    className={`font-medium whitespace-nowrap ml-3 transition-opacity duration-200 ${
                      sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                  
                  {/* Desktop tooltip when collapsed */}
                  <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity ${sidebarOpen ? 'lg:hidden' : ''}`}>
                    {item.label}
                  </span>
                </a>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2 flex-shrink-0">
            <button 
              className={`w-full flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors group relative
                ${sidebarOpen ? 'justify-start' : 'lg:justify-center'}`}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span 
                className={`text-sm font-medium whitespace-nowrap ml-3 transition-opacity duration-200 ${
                  sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                }`}
              >
                Settings
              </span>
              <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity ${sidebarOpen ? 'lg:hidden' : ''}`}>
                Settings
              </span>
            </button>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors group relative
                ${sidebarOpen ? 'justify-start' : 'lg:justify-center'}`}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span 
                className={`text-sm font-medium whitespace-nowrap ml-3 transition-opacity duration-200 ${
                  sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'
                }`}
              >
                Logout
              </span>
              <span className={`hidden lg:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity ${sidebarOpen ? 'lg:hidden' : ''}`}>
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header for Mobile */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 lg:hidden flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-700 hover:text-black transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-white">{children}</main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0  z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
