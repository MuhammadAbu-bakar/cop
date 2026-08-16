// ============================================================
// Layout.jsx - Updated with fixed header and sidebar
// ============================================================

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Chatbot from "./Chatbot";

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-0 md:ml-20 lg:ml-24">
        <Header />
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 bg-[#f0f2f5] mt-12 sm:mt-14">
          <Outlet />
        </main>
      </div>
      <Chatbot />
    </div>
  );
};

export default Layout;