import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Header = () => {
  const { profile, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleBadge = (role) => {
    const badges = {
      admin: "bg-purple-100 text-purple-800",
      management: "bg-blue-100 text-blue-800",
      regional_user: "bg-green-100 text-green-800",
      reviewer: "bg-orange-100 text-orange-800",
    };
    return badges[role] || "bg-gray-100 text-gray-800";
  };

  const getRoleDisplayName = (role) => {
    const names = {
      admin: "Administrator",
      management: "Management",
      regional_user: "Regional User",
      reviewer: "Reviewer",
    };
    return names[role] || role || "User";
  };

  // Get user's display name
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email.split("@")[0];
    return "User";
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-3 sm:px-4 md:px-6">
      <div className="flex items-center min-w-0">
        <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-700 truncate">
          Compliance Orchestration Platform
        </h2>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
        {/* Notification Bell */}
        <button className="relative p-1.5 sm:p-2 text-gray-400 hover:text-gray-600">
          <svg
            className="h-5 w-5 sm:h-6 sm:w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-1.5 w-1.5 sm:h-2 sm:w-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 sm:space-x-3 focus:outline-none"
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#8cc63e] flex items-center justify-center text-white font-medium text-xs sm:text-sm">
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[100px] md:max-w-[150px]">
                {getDisplayName()}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[100px] md:max-w-[150px]">
                {profile?.email || ""}
              </p>
            </div>
            <svg
              className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getDisplayName()}
                </p>
                <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                <span
                  className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(profile?.role)}`}
                >
                  {getRoleDisplayName(profile?.role)}
                </span>
              </div>

              <div className="py-1">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Your Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </Link>
              </div>

              <div className="border-t">
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;