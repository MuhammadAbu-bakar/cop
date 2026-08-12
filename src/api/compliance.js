import { supabase } from './supabase'

// Get all obligations with their instances
export const getObligations = async (filters = {}) => {
  try {
    let query = supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*)
      `)

    if (filters.status) {
      query = query.eq('current_status', filters.status)
    }
    
    if (filters.domain) {
      query = query.eq('domain', filters.domain)
    }
    
    if (filters.frequency) {
      query = query.eq('frequency', filters.frequency)
    }
    
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,obligation_id.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligations:', error)
    return { data: null, error }
  }
}

// Get single obligation with details (by UUID)
export const getObligationById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligation by ID:', error)
    return { data: null, error }
  }
}

// Get obligation by obligation_id (MS-001 format) - FIXED: removed instances
export const getObligationByObligationId = async (obligationId) => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*)
      `)
      .eq('obligation_id', obligationId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligation by obligation_id:', error)
    return { data: null, error }
  }
}

// Get obligation with full details (instances, evidence, activity)
export const getObligationWithFullDetails = async (obligationId) => {
  try {
    // First get the obligation
    const { data: obligation, error: obligationError } = await getObligationByObligationId(obligationId)
    if (obligationError) throw obligationError
    if (!obligation) return { data: null, error: null }

    // Get instances
    const { data: instances } = await getObligationInstances(obligation.id)
    
    // Get evidence
    const { data: evidence } = await getEvidence(obligation.id)
    
    // Get activity history
    const { data: activities } = await getActivityHistory(obligation.id)

    return {
      data: {
        ...obligation,
        instances: instances || [],
        evidence: evidence || [],
        activities: activities || []
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching full obligation details:', error)
    return { data: null, error }
  }
}

// Update obligation status
export const updateObligationStatus = async (id, status, comment = '') => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .update({ 
        current_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) throw error

    // Add to activity history
    if (data && data[0]) {
      await addActivityHistory(
        data[0].id, 
        null,
        `Status updated to ${status}`, 
        comment
      )
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating obligation status:', error)
    return { data: null, error }
  }
}

// Get obligation instances
export const getObligationInstances = async (obligationId) => {
  try {
    const { data, error } = await supabase
      .from('obligation_instances')
      .select('*')
      .eq('obligation_id', obligationId)
      .order('due_date', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligation instances:', error)
    return { data: null, error }
  }
}

// Update instance status
export const updateInstanceStatus = async (instanceId, status, comment = '') => {
  try {
    // First get the obligation_id for this instance
    const { data: instance, error: fetchError } = await supabase
      .from('obligation_instances')
      .select('obligation_id')
      .eq('id', instanceId)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('obligation_instances')
      .update({ 
        status,
        comments: comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .select()

    if (error) throw error

    // Add to activity history
    if (data && data[0] && instance) {
      await addActivityHistory(
        instance.obligation_id,
        data[0].id,
        `Instance status updated to ${status}`,
        comment
      )
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating instance status:', error)
    return { data: null, error }
  }
}

// Submit instance for review
export const submitInstance = async (instanceId) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    // First get the obligation_id for this instance
    const { data: instance, error: fetchError } = await supabase
      .from('obligation_instances')
      .select('obligation_id')
      .eq('id', instanceId)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('obligation_instances')
      .update({ 
        status: 'Submitted',
        submitted_by: user.data.user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .select()

    if (error) throw error

    // Add to activity history
    if (data && data[0] && instance) {
      await addActivityHistory(
        instance.obligation_id,
        data[0].id,
        'Instance submitted for review',
        null
      )
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error submitting instance:', error)
    return { data: null, error }
  }
}

// Approve instance
export const approveInstance = async (instanceId) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    // First get the obligation_id for this instance
    const { data: instance, error: fetchError } = await supabase
      .from('obligation_instances')
      .select('obligation_id')
      .eq('id', instanceId)
      .single()

    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('obligation_instances')
      .update({ 
        status: 'Approved',
        approved_by: user.data.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .select()

    if (error) throw error

    // Add to activity history
    if (data && data[0] && instance) {
      await addActivityHistory(
        instance.obligation_id,
        data[0].id,
        'Instance approved',
        null
      )
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error approving instance:', error)
    return { data: null, error }
  }
}

// Upload evidence
export const uploadEvidence = async (file, obligationId, instanceId = null) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    const fileName = `${Date.now()}_${file.name}`
    const filePath = `evidence/${fileName}`

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('compliance-evidence')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('compliance-evidence')
      .getPublicUrl(filePath)

    // Save to database
    const { data, error } = await supabase
      .from('evidence')
      .insert({
        obligation_id: obligationId,
        instance_id: instanceId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.data.user.id,
        status: 'Pending'
      })
      .select()

    if (error) throw error

    // Add to activity history
    if (data && data[0]) {
      await addActivityHistory(
        obligationId,
        instanceId,
        `Evidence uploaded: ${file.name}`,
        null
      )
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error uploading evidence:', error)
    return { data: null, error }
  }
}

// Get evidence for an obligation
export const getEvidence = async (obligationId) => {
  try {
    const { data, error } = await supabase
      .from('evidence')
      .select(`
        *
      `)
      .eq('obligation_id', obligationId)
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching evidence:', error)
    return { data: null, error }
  }
}

// Add comment to obligation
export const addComment = async (obligationId, comment) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    const { data, error } = await supabase
      .from('activity_history')
      .insert({
        obligation_id: obligationId,
        action: 'Comment added',
        user_id: user.data.user.id,
        user_name: user.data.user.user_metadata?.full_name || user.data.user.email || 'User',
        details: { comment },
        created_at: new Date().toISOString()
      })
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error adding comment:', error)
    return { data: null, error }
  }
}

// Add activity history
export const addActivityHistory = async (obligationId, instanceId = null, action, details = null) => {
  try {
    const user = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('activity_history')
      .insert({
        obligation_id: obligationId,
        instance_id: instanceId,
        action: action,
        user_id: user.data.user?.id || null,
        user_name: user.data.user?.user_metadata?.full_name || user.data.user?.email || 'System',
        details: details ? { comment: details } : null,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error adding activity history:', error)
    return { data: null, error }
  }
}

// Get activity history
export const getActivityHistory = async (obligationId) => {
  try {
    const { data, error } = await supabase
      .from('activity_history')
      .select('*')
      .eq('obligation_id', obligationId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching activity history:', error)
    return { data: null, error }
  }
}

// Get dashboard stats
export const getDashboardStats = async () => {
  try {
    const { data: obligations, error } = await supabase
      .from('obligations')
      .select('current_status, compliance_weight')

    if (error) throw error

    const total = obligations?.length || 0
    const completed = obligations?.filter(o => o.current_status === 'Completed').length || 0
    const pending = obligations?.filter(o => o.current_status === 'Pending').length || 0
    const overdue = obligations?.filter(o => o.current_status === 'Overdue').length || 0
    const inProgress = obligations?.filter(o => o.current_status === 'In Progress').length || 0
    const notStarted = obligations?.filter(o => o.current_status === 'Not Started').length || 0

    // Calculate overall compliance (weighted)
    let totalWeight = 0
    let achievedWeight = 0
    obligations?.forEach(o => {
      totalWeight += o.compliance_weight || 1
      if (o.current_status === 'Completed') {
        achievedWeight += o.compliance_weight || 1
      }
    })

    const overallCompliance = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0
    const auditReadiness = total > 0 ? Math.min(overallCompliance + 10, 100) : 0

    return {
      overallCompliance,
      auditReadiness,
      totalObligations: total,
      completed,
      pending,
      overdue,
      inProgress,
      notStarted
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      overallCompliance: 0,
      auditReadiness: 0,
      totalObligations: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      inProgress: 0,
      notStarted: 0
    }
  }
}

// Get compliance by domain
export const getComplianceByDomain = async () => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .select('domain, current_status, compliance_weight')

    if (error) throw error

    const domainMap = {}
    data?.forEach(o => {
      if (!domainMap[o.domain]) {
        domainMap[o.domain] = { total: 0, achieved: 0 }
      }
      domainMap[o.domain].total += o.compliance_weight || 1
      if (o.current_status === 'Completed') {
        domainMap[o.domain].achieved += o.compliance_weight || 1
      }
    })

    const domains = Object.keys(domainMap)
    const compliance = domains.map(d => 
      Math.round((domainMap[d].achieved / domainMap[d].total) * 100)
    )

    return { domains, compliance }
  } catch (error) {
    console.error('Error fetching compliance by domain:', error)
    return { domains: [], compliance: [] }
  }
}

// Get upcoming deadlines
export const getUpcomingDeadlines = async () => {
  try {
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const { data, error } = await supabase
      .from('obligation_instances')
      .select(`
        *,
        obligation:obligations(name, obligation_id, domain)
      `)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', nextMonth.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error)
    return []
  }
}

// Get all regions
export const getRegions = async () => {
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .order('name')

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching regions:', error)
    return { data: null, error }
  }
}

// Get users with profiles
export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { data: null, error }
  }
}

// Create notification
export const createNotification = async (userId, title, message, type, link = null) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link
      })
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating notification:', error)
    return { data: null, error }
  }
}

// Get user notifications
export const getNotifications = async () => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.data.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return { data: null, error }
  }
}

// Mark notification as read
export const markNotificationRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return { data: null, error }
  }
}

// Get all policies
export const getPolicies = async () => {
  try {
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .order('name')

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching policies:', error)
    return { data: null, error }
  }
}

// Update audit readiness
export const updateAuditReadiness = async (obligationId, score, notes = '') => {
  try {
    const { data, error } = await supabase
      .from('audit_readiness')
      .upsert({
        obligation_id: obligationId,
        readiness_score: score,
        notes: notes,
        last_assessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating audit readiness:', error)
    return { data: null, error }
  }
}

// Get audit readiness
export const getAuditReadiness = async (obligationId) => {
  try {
    const { data, error } = await supabase
      .from('audit_readiness')
      .select('*')
      .eq('obligation_id', obligationId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching audit readiness:', error)
    return { data: null, error }
  }
}