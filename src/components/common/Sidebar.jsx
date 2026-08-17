// ============================================================
// Sidebar.jsx - Compact with icons above text, green background
// ============================================================

import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import copLogo from "../../assets/images/cop-logo.png";

const Sidebar = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const navigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      name: "Obligations",
      path: "/compliance",
      icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    },
    {
      name: "Calendar",
      path: "/calendar",
      icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    },
    {
      name: "Reports",
      path: "/reports",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l3 3 3-3",
    },
    {
      name: "Audit History",
      path: "/audit-history",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      name: "Policies",
      path: "/policies",
      icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
  ];

  // if (isAdmin) {
  //   navigation.push({
  //     name: "Admin",
  //     path: "/admin",
  //     icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  //   });
  // }

  return (
    <>
      {/* Desktop Sidebar */}
      <div 
        className="hidden md:flex md:w-20 lg:w-24 flex-col h-screen fixed left-0 top-0 z-30 border-r border-green-700/30"
        style={{ backgroundColor: "#8cc63e" }}
      >
        {/* Logo Section - Small and compact */}
        <div 
          className="h-12 sm:h-14 flex items-center justify-center border-b border-green-700/30 flex-shrink-0"
          style={{ backgroundColor: "#8cc63e" }}
        >
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 p-1">
            <img
              src={copLogo}
              alt="COP Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Navigation - Icons above text */}
        <nav className="flex-1 mt-1 lg:mt-2 px-1 lg:px-2 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-1 py-1.5 lg:py-2 rounded-lg mb-0.5 transition-all duration-200 text-[7px] lg:text-[8px] ${
                  isActive
                    ? "bg-white/20 text-white font-medium shadow-sm"
                    : "text-green-100 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <svg
                className={`h-4 w-4 lg:h-5 lg:w-5 mb-0.5 flex-shrink-0 ${
                  ({ isActive }) => (isActive ? "text-white" : "text-green-200")
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
              <span className="text-center leading-tight truncate w-full px-0.5">
                {item.name}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section - Minimal */}
        <div 
          className="p-1 lg:p-2 border-t border-green-700/30 flex-shrink-0"
          style={{ backgroundColor: "#8cc63e" }}
        >
          <div className="text-center">
            <div className="text-[5px] lg:text-[7px] text-green-200/40">
              v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Shows first 4 items plus Audit History */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 shadow-lg"
           style={{ backgroundColor: "#8cc63e" }}>
        <div className="flex justify-around items-center py-1">
          {navigation.slice(0, 4).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-1 text-[7px] transition-colors ${
                  isActive ? "text-white" : "text-green-100 hover:text-white"
                }`
              }
            >
              <svg
                className={`h-4 w-4 ${({ isActive }) => (isActive ? "text-white" : "text-green-200")}`}
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
              <span className="mt-0.5 text-[6px]">{item.name}</span>
            </NavLink>
          ))}
          <NavLink
            to="/audit-history"
            className={({ isActive }) =>
              `flex flex-col items-center py-1 px-1 text-[7px] transition-colors ${
                isActive ? "text-white" : "text-green-100 hover:text-white"
              }`
            }
          >
            <svg
              className={`h-4 w-4 ${({ isActive }) => (isActive ? "text-white" : "text-green-200")}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="mt-0.5 text-[6px]">Audit History</span>
          </NavLink>
        </div>
      </div>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-12"></div>
    </>
  );
};

export default Sidebar;