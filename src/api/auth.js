import { supabase } from './supabase'

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  REGIONAL_USER: 'regional_user',
  REGIONAL_MANAGER: 'regional_manager',  // NEW: Regional Manager role
  MANAGEMENT: 'management',
  REVIEWER: 'reviewer'
}

// Define user roles and regions by email
const USER_CONFIG_BY_EMAIL = {
  // Admin
  'admin@compliance.com': { role: 'admin', region_name: null, region_code: null },
  
  // Regional Users
  'c1@compliance.com': { role: 'regional_user', region_name: 'Region C1', region_code: 'C1' },
  'c2@compliance.com': { role: 'regional_user', region_name: 'Region C2', region_code: 'C2' },
  'c3@compliance.com': { role: 'regional_user', region_name: 'Region C3', region_code: 'C3' },
  'c4@compliance.com': { role: 'regional_user', region_name: 'Region C4', region_code: 'C4' },
  'c5@compliance.com': { role: 'regional_user', region_name: 'Region C5', region_code: 'C5' },
  'c6@compliance.com': { role: 'regional_user', region_name: 'Region C6', region_code: 'C6' },
  
  // Regional Managers - Each region has a manager
  'manager-c1@compliance.com': { role: 'regional_manager', region_name: 'Region C1', region_code: 'C1' },
  'manager-c2@compliance.com': { role: 'regional_manager', region_name: 'Region C2', region_code: 'C2' },
  'manager-c3@compliance.com': { role: 'regional_manager', region_name: 'Region C3', region_code: 'C3' },
  'manager-c4@compliance.com': { role: 'regional_manager', region_name: 'Region C4', region_code: 'C4' },
  'manager-c5@compliance.com': { role: 'regional_manager', region_name: 'Region C5', region_code: 'C5' },
  'manager-c6@compliance.com': { role: 'regional_manager', region_name: 'Region C6', region_code: 'C6' },
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
        region_name: userData.region_name || null,
        region_code: userData.region_code || null,
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

// Get region ID from region code
const getRegionIdByCode = async (regionCode) => {
  if (!regionCode) return null;
  
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('id, name')
      .eq('code', regionCode)
      .single();
    
    if (error) {
      console.error('Error fetching region:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error in getRegionIdByCode:', error);
    return null;
  }
}

// Get region ID from region name
const getRegionIdByName = async (regionName) => {
  if (!regionName) return null;
  
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('id, code')
      .eq('name', regionName)
      .single();
    
    if (error) {
      console.error('Error fetching region:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error in getRegionIdByName:', error);
    return null;
  }
}

// Ensure profile exists for user
export const ensureProfileExists = async (user) => {
  try {
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get user config from email
    const userConfig = USER_CONFIG_BY_EMAIL[user.email];
    const role = userConfig?.role || user.user_metadata?.role || USER_ROLES.REGIONAL_USER;
    const regionName = userConfig?.region_name || user.user_metadata?.region_name || '';
    const regionCode = userConfig?.region_code || user.user_metadata?.region_code || '';

    // Get region_id from regions table
    let regionId = null;
    let finalRegionName = regionName;
    let finalRegionCode = regionCode;

    if (regionCode) {
      const regionData = await getRegionIdByCode(regionCode);
      if (regionData) {
        regionId = regionData.id;
        finalRegionName = regionData.name || regionName;
        finalRegionCode = regionCode;
      }
    } else if (regionName) {
      const regionData = await getRegionIdByName(regionName);
      if (regionData) {
        regionId = regionData.id;
        finalRegionCode = regionData.code || regionCode;
        finalRegionName = regionName;
      }
    }

    if (!existingProfile || checkError) {
      // Create new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: role,
          region_id: regionId,
          region_name: finalRegionName,
          department: user.user_metadata?.department || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error creating profile:', insertError);
      } else {
        console.log('Profile created successfully for user:', user.email);
      }
    } else {
      // Update profile if region info is missing
      let needsUpdate = false;
      const updateData = {};

      if (!existingProfile.role && role) {
        updateData.role = role;
        needsUpdate = true;
      }
      
      if (!existingProfile.region_id && regionId) {
        updateData.region_id = regionId;
        updateData.region_name = finalRegionName;
        needsUpdate = true;
      }

      if (!existingProfile.region_name && finalRegionName) {
        updateData.region_name = finalRegionName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log('Profile updated successfully for user:', user.email);
        }
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

// Get user profile with role and region
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
      // Ensure profile exists
      await ensureProfileExists(user);
      
      // Fetch the profile again
      const { data: newProfile, error: newError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (newError) {
        // Return default profile based on config
        const userConfig = USER_CONFIG_BY_EMAIL[user.email];
        return {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: userConfig?.role || USER_ROLES.REGIONAL_USER,
          region_id: null,
          region_name: userConfig?.region_name || user.user_metadata?.region_name || '',
          department: user.user_metadata?.department || '',
          avatar_url: user.user_metadata?.avatar_url || null
        };
      }
      
      return {
        id: newProfile.id,
        email: user.email,
        full_name: newProfile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: newProfile.role || user.user_metadata?.role || USER_ROLES.REGIONAL_USER,
        region_id: newProfile.region_id || null,
        region_name: newProfile.region_name || user.user_metadata?.region_name || '',
        department: newProfile.department || user.user_metadata?.department || '',
        avatar_url: newProfile.avatar_url || user.user_metadata?.avatar_url || null
      };
    }

    // Get region details if region_id exists
    let regionDetails = { region_name: profile.region_name || '', region_code: '' };
    
    if (profile.region_id) {
      try {
        const { data: regionData, error: regionError } = await supabase
          .from('regions')
          .select('name, code')
          .eq('id', profile.region_id)
          .single();
        
        if (!regionError && regionData) {
          regionDetails.region_name = regionData.name;
          regionDetails.region_code = regionData.code;
        }
      } catch (error) {
        console.error('Error fetching region details:', error);
      }
    }

    return {
      id: profile.id,
      email: user.email,
      full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      role: profile.role || USER_ROLES.REGIONAL_USER,
      region_id: profile.region_id || null,
      region_name: regionDetails.region_name || profile.region_name || user.user_metadata?.region_name || '',
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

// ============================================================
// ROLE CHECK FUNCTIONS
// ============================================================

// Check if user has specific role
export const hasRole = (user, role) => {
  if (!user) return false
  const userRole = user.role || USER_ROLES.REGIONAL_USER
  return userRole === role
}

// Check if user has admin role
export const isAdmin = (user) => {
  return hasRole(user, USER_ROLES.ADMIN)
}

// Check if user has regional manager role
export const isRegionalManager = (user) => {
  return hasRole(user, USER_ROLES.REGIONAL_MANAGER)
}

// Check if user has regional user role (non-manager)
export const isRegionalUser = (user) => {
  return hasRole(user, USER_ROLES.REGIONAL_USER)
}

// Check if user has management role
export const isManagement = (user) => {
  return hasRole(user, USER_ROLES.MANAGEMENT)
}

// Check if user has reviewer role
export const isReviewer = (user) => {
  return hasRole(user, USER_ROLES.REVIEWER)
}

// Check if user can approve based on role and approval level
export const canApproveAtLevel = (user, approvalLevel) => {
  if (!user) return false;
  const role = user.role || USER_ROLES.REGIONAL_USER;
  
  // Admin can approve at any level
  if (role === USER_ROLES.ADMIN) {
    return true;
  }
  
  // Regional Manager can approve regional submissions
  if (role === USER_ROLES.REGIONAL_MANAGER && approvalLevel === 'regional') {
    return true;
  }
  
  return false;
}

// Check if user can reject based on role and approval level
export const canRejectAtLevel = (user, approvalLevel) => {
  if (!user) return false;
  const role = user.role || USER_ROLES.REGIONAL_USER;
  
  // Admin can reject manager-approved submissions
  if (role === USER_ROLES.ADMIN && approvalLevel === 'manager') {
    return true;
  }
  
  // Regional Manager can reject regional submissions
  if (role === USER_ROLES.REGIONAL_MANAGER && approvalLevel === 'regional') {
    return true;
  }
  
  return false;
}

// Get user's role as string
export const getUserRole = (user) => {
  return user?.role || USER_ROLES.REGIONAL_USER;
}

// Get user's region
export const getUserRegion = (user) => {
  if (!user) return null;
  return user.region_name || user.region_code || null;
}

// Get region name by code
export const getRegionNameByCode = async (regionCode) => {
  if (!regionCode) return null;
  
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('name')
      .eq('code', regionCode)
      .single();
    
    if (error) return null;
    return data?.name || null;
  } catch (error) {
    console.error('Error fetching region name:', error);
    return null;
  }
}

// Get region code by name
export const getRegionCodeByName = async (regionName) => {
  if (!regionName) return null;
  
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('code')
      .eq('name', regionName)
      .single();
    
    if (error) return null;
    return data?.code || null;
  } catch (error) {
    console.error('Error fetching region code:', error);
    return null;
  }
}

// Get user's region ID from profile
export const getUserRegionId = async (user) => {
  if (!user) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('region_id')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user region ID:', error);
      return null;
    }
    
    return data?.region_id || null;
  } catch (error) {
    console.error('Error in getUserRegionId:', error);
    return null;
  }
}

// Get user's region name from profile
export const getUserRegionName = async (user) => {
  if (!user) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('region_name')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user region name:', error);
      return null;
    }
    
    return data?.region_name || null;
  } catch (error) {
    console.error('Error in getUserRegionName:', error);
    return null;
  }
}

// Get all regional managers for a region
export const getRegionalManagersByRegion = async (regionId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('region_id', regionId)
      .eq('role', USER_ROLES.REGIONAL_MANAGER);
    
    if (error) {
      console.error('Error fetching regional managers:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error in getRegionalManagersByRegion:', error);
    return { data: [], error };
  }
}

// Get all regional users for a region (excluding managers)
export const getRegionalUsersByRegion = async (regionId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('region_id', regionId)
      .eq('role', USER_ROLES.REGIONAL_USER);
    
    if (error) {
      console.error('Error fetching regional users:', error);
      return { data: [], error };
    }
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error in getRegionalUsersByRegion:', error);
    return { data: [], error };
  }
}

// Check if user is a regional manager for their region
export const isManagerForRegion = async (user, regionId) => {
  if (!user) return false;
  if (!isRegionalManager(user)) return false;
  
  try {
    const userRegionId = await getUserRegionId(user);
    return userRegionId === regionId;
  } catch (error) {
    console.error('Error in isManagerForRegion:', error);
    return false;
  }
}