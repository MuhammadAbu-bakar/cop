import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import zongLogo from "../../assets/images/zong-logo.jpg";

const Sidebar = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      name: "Compliance",
      path: "/compliance",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
      name: "Evidence",
      path: "/evidence",
      icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    },
    {
      name: "Calendar",
      path: "/calendar",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      name: "Reports",
      path: "/reports",
      icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      name: "Audit History",
      path: "/audit-history",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l3 3 3-3",
    },
  ];

  // Add Policies and Admin for admin users
  if (isAdmin) {
    navigation.splice(6, 0, {
      name: "Policies",
      path: "/policies",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    });
    
    navigation.push({
      name: "Admin",
      path: "/admin",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    });
  }

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={toggleMobileSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#8cc63e] text-white shadow-lg hover:bg-[#7ab32e] transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isMobileOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static top-0 left-0 h-screen bg-white shadow-lg flex flex-col z-50
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Section */}
        <div className={`
          flex items-center justify-center px-4 border-b border-gray-200
          ${isCollapsed ? 'h-24' : 'h-28'}
          transition-all duration-300
        `}>
          {!isCollapsed ? (
            <div className="flex items-center space-x-3 w-full">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={zongLogo}
                  alt="Zong Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate">
                  Compliance
                </h1>
                <p className="text-[10px] md:text-xs text-gray-500 truncate">
                  Orchestration Platform
                </p>
              </div>
            </div>
          ) : (
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden">
              <img
                src={zongLogo}
                alt="Zong Logo"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex absolute -right-3 top-24 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
        >
          <svg
            className={`h-4 w-4 text-gray-600 transition-transform duration-300 ${
              isCollapsed ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 mt-4 md:mt-6 px-3 md:px-4 overflow-y-auto overflow-x-hidden">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileOpen(false);
                }
              }}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 md:px-4 md:py-3 rounded-lg mb-1 transition-all duration-200 group ${
                  isActive
                    ? "bg-[#8cc63e] text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${isCollapsed ? 'justify-center' : ''}`
              }
            >
              <svg
                className={`flex-shrink-0 h-5 w-5 transition-colors ${
                  isCollapsed ? 'mr-0' : 'mr-3'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={item.icon}
                />
              </svg>
              
              {!isCollapsed && (
                <span className="text-sm md:text-base font-medium whitespace-nowrap">
                  {item.name}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Section */}
        <div className={`p-4 border-t border-gray-200 ${
          isCollapsed ? 'text-center' : ''
        }`}>
          {!isCollapsed ? (
            <div className="text-xs text-gray-400 text-center">
              <p>Version 1.0.0</p>
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">
              <p>v1.0.0</p>
            </div>
          )}
        </div>
      </div>

      {/* Push content for desktop */}
      <div className={`hidden lg:block transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      } flex-shrink-0`} />
    </>
  );
};

export default Sidebar;