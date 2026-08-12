import { supabase } from './supabase'

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  REGIONAL_USER: 'regional_user',
  MANAGEMENT: 'management',
  REVIEWER: 'reviewer'
}

// Define user roles by email
const USER_ROLES_BY_EMAIL = {
  'admin@compliance.com': 'admin',
  'c1@compliance.com': 'regional_user'
}

// Sign up
export const signUp = async (email, password, userData) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: userData.fullName,
        role: userData.role || USER_ROLES.REGIONAL_USER,
        region: userData.region || null,
        department: userData.department || null
      }
    }
  })
  return { data, error }
}

// Sign in
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (data?.user) {
    await ensureProfileExists(data.user);
  }
  
  return { data, error }
}

// Ensure profile exists for user
export const ensureProfileExists = async (user) => {
  try {
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!existingProfile || checkError) {
      const role = USER_ROLES_BY_EMAIL[user.email] || USER_ROLES.REGIONAL_USER;
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: role,
          region_name: user.user_metadata?.region || '',
          department: user.user_metadata?.department || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating profile:', insertError);
      }
    }
  } catch (error) {
    console.error('Error in ensureProfileExists:', error);
  }
}

// Sign in with Google
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get user profile with role
export const getUserProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      await ensureProfileExists(user);
      
      const { data: newProfile, error: newError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (newError) {
        return {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: USER_ROLES_BY_EMAIL[user.email] || user.user_metadata?.role || USER_ROLES.REGIONAL_USER,
          region_id: user.user_metadata?.region_id || null,
          region_name: user.user_metadata?.region || '',
          department: user.user_metadata?.department || '',
          avatar_url: user.user_metadata?.avatar_url || null
        };
      }
      
      return {
        id: newProfile.id,
        email: user.email,
        full_name: newProfile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: newProfile.role || USER_ROLES_BY_EMAIL[user.email] || user.user_metadata?.role || USER_ROLES.REGIONAL_USER,
        region_id: newProfile.region_id || null,
        region_name: newProfile.region_name || user.user_metadata?.region || '',
        department: newProfile.department || user.user_metadata?.department || '',
        avatar_url: newProfile.avatar_url || user.user_metadata?.avatar_url || null
      };
    }

    return {
      id: profile.id,
      email: user.email,
      full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      role: profile.role || USER_ROLES_BY_EMAIL[user.email] || user.user_metadata?.role || USER_ROLES.REGIONAL_USER,
      region_id: profile.region_id || null,
      region_name: profile.region_name || user.user_metadata?.region || '',
      department: profile.department || user.user_metadata?.department || '',
      avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null
    };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Reset password
export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  return { error }
}

// Update password
export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })
  return { error }
}

// Update user profile
export const updateUserProfile = async (userData) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: userData.full_name,
      role: userData.role,
      region_id: userData.region_id,
      region_name: userData.region_name,
      department: userData.department,
      avatar_url: userData.avatar_url,
      updated_at: new Date().toISOString()
    })
    .eq('id', userData.id)
    .select()

  return { data, error }
}

// Check if user has specific role
export const hasRole = (user, role) => {
  if (!user) return false
  const userRole = user.user_metadata?.role || USER_ROLES.REGIONAL_USER
  return userRole === role
}

// Check if user has admin role
export const isAdmin = (user) => {
  return hasRole(user, USER_ROLES.ADMIN)
}

// Check if user has management role
export const isManagement = (user) => {
  return hasRole(user, USER_ROLES.MANAGEMENT)
}

// Check if user has reviewer role
export const isReviewer = (user) => {
  return hasRole(user, USER_ROLES.REVIEWER)
}