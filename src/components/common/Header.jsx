// ============================================================
// Header.jsx - Navy blue background, full width, with COP logo
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Header = () => {
  const { profile, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  const getRoleBadge = (role) => {
    const badges = {
      admin: "bg-indigo-100 text-indigo-800",
      management: "bg-blue-100 text-blue-800",
      regional_user: "bg-emerald-100 text-emerald-800",
      reviewer: "bg-amber-100 text-amber-800",
    };
    return badges[role] || "bg-gray-100 text-gray-800";
  };

  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email.split("@")[0];
    return "User";
  };

  return (
    <header 
      className="h-12 sm:h-14 flex items-center justify-between px-3 sm:px-4 md:px-6 fixed top-0 left-0 right-0 z-20 ml-0 md:ml-16 lg:ml-20"
      style={{ backgroundColor: "#00008b" }}
    >
      {/* Left - COP Logo and Title */}
      <div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
        {/* Removed hidden xs:block - now always visible */}
        <div className="block">
          <h1 className="text-xs sm:text-sm font-bold tracking-tight leading-tight text-white whitespace-nowrap">
            <span className="text-white text-2xl">COP</span>
            <span className="text-blue-300 font-normal mx-1">|</span>
            <span className="text-white font-medium">Compliance Orchestration Portal</span>
            <span className="text-blue-300 font-normal mx-1">|</span>
            <span className="text-white font-medium">From Policy to Performance</span>

          </h1>
          
        </div>

        
      </div>

      {/* Center - Date and Time */}
      <div className="hidden sm:block text-center flex-1">
        <p className="text-xs sm:text-sm font-medium text-white">
          {formatDate(currentDateTime)}
          <span className="text-blue-300 mx-2">|</span>
          <span className="text-blue-200 font-semibold">{formatTime(currentDateTime)}</span>
        </p>
      </div>

      {/* Right - User Info */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        {/* Role Badge */}
        <div className="hidden xs:block">
          <span
            className={`px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${getRoleBadge(profile?.role)}`}
          >
            {getRoleDisplayName(profile?.role)} View
          </span>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-1 sm:space-x-2 focus:outline-none hover:bg-white/10 rounded-lg px-1 sm:px-2 py-1 transition-colors"
          >
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-medium text-xs shadow-md">
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
            <div className="hidden xs:block text-left">
              <p className="text-xs sm:text-sm font-medium text-white truncate max-w-[60px] sm:max-w-[100px]">
                {getDisplayName()}
              </p>
            </div>
            <svg
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-300"
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
            <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50 animate-slideDown">
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                  {getDisplayName()}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{profile?.email}</p>
                <span
                  className={`inline-block mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full ${getRoleBadge(profile?.role)}`}
                >
                  {getRoleDisplayName(profile?.role)}
                </span>
              </div>

              <div className="py-1">
                <Link
                  to="/profile"
                  className="block px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Your Profile
                  </span>
                </Link>
                <Link
                  to="/settings"
                  className="block px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    Settings
                  </span>
                </Link>
              </div>

              <div className="border-t border-gray-100">
                <button
                  onClick={logout}
                  className="block w-full text-left px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </span>
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