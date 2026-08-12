import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../api/supabase";
import { getCurrentUser, getUserProfile, signOut } from "../api/auth";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active session
    const initializeAuth = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
          const profileData = await getUserProfile();
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const profileData = await getUserProfile();
        setProfile(profileData);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      const { error } = await signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError(err.message);
    }
  };

  const value = {
    user,
    profile,
    loading,
    error,
    logout,
    setUser,
    setProfile,
    hasRole: (role) => profile?.role === role,
    isAdmin: () => profile?.role === "admin",
    isManagement: () => profile?.role === "management",
    isReviewer: () => profile?.role === "reviewer",
    isRegionalUser: () => profile?.role === "regional_user",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
