import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import zongLogo from "../../assets/images/zong-logo.jpg";

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
      name: "Compliance",
      path: "/compliance",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
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

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-56 lg:w-64 bg-white shadow-lg flex-col h-screen fixed left-0 top-0 z-30">
        <div className="h-24 lg:h-28 flex items-center justify-center px-4 lg:px-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={zongLogo}
                alt="Zong Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg lg:text-2xl font-bold text-gray-800">Compliance</h1>
              <p className="text-[10px] lg:text-xs text-gray-500">Orchestration Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 mt-4 lg:mt-6 px-3 lg:px-4 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg mb-1 transition-colors text-sm lg:text-base ${
                  isActive
                    ? "bg-[#8cc63e] text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <svg
                className="h-4 w-4 lg:h-5 lg:w-5 mr-2 lg:mr-3 flex-shrink-0"
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
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 lg:p-4 border-t border-gray-200 flex-shrink-0">
          <div className="text-[10px] lg:text-xs text-gray-400 text-center">
            <p>Version 1.0.0</p>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="flex justify-around items-center py-1">
          {navigation.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center py-1 px-2 text-[10px] ${
                  isActive ? "text-[#8cc63e]" : "text-gray-500"
                }`
              }
            >
              <svg
                className="h-5 w-5"
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
              <span className="mt-0.5">{item.name}</span>
            </NavLink>
          ))}
          <NavLink
            to={navigation[5]?.path || "/dashboard"}
            className={({ isActive }) =>
              `flex flex-col items-center py-1 px-2 text-[10px] ${
                isActive ? "text-[#8cc63e]" : "text-gray-500"
              }`
            }
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
            <span className="mt-0.5">More</span>
          </NavLink>
        </div>
      </div>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-14"></div>
    </>
  );
};

export default Sidebar;