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

// Get obligation by obligation_id (MS-001 format)
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

// Get obligation instances - FIXED: Generate instances on the fly from obligations
export const getObligationInstances = async (obligationId) => {
  try {
    // First get the obligation to understand its frequency
    const { data: obligation, error: obligationError } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', obligationId)
      .single()

    if (obligationError) throw obligationError
    if (!obligation) return { data: [], error: null }

    // Generate instances based on frequency
    const instances = generateInstancesFromObligation(obligation)
    
    return { data: instances, error: null }
  } catch (error) {
    console.error('Error fetching obligation instances:', error)
    return { data: null, error }
  }
}

// Helper function to generate instances based on frequency
const generateInstancesFromObligation = (obligation) => {
  const instances = []
  const today = new Date()
  const frequencies = {
    'Monthly': 1,
    'Quarterly': 3,
    'Bi-Annual': 6,
    'Annual': 12,
    'One-Time': 0
  }

  const monthsToGenerate = frequencies[obligation.frequency] || 1
  const currentDate = new Date(today)
  
  // Generate future instances
  for (let i = 0; i < 6; i++) { // Generate up to 6 instances
    const dueDate = new Date(currentDate)
    if (monthsToGenerate > 0) {
      dueDate.setMonth(dueDate.getMonth() + (i * monthsToGenerate))
    } else {
      // One-time obligation - use the obligation's due_date_rule if available
      if (obligation.due_date_rule) {
        const parsedDate = new Date(obligation.due_date_rule)
        if (!isNaN(parsedDate.getTime())) {
          dueDate.setTime(parsedDate.getTime())
        } else {
          dueDate.setMonth(dueDate.getMonth() + 1) // Default to 1 month if no rule
        }
      } else {
        dueDate.setMonth(dueDate.getMonth() + 1)
      }
    }

    // Only add if due date is not too far in the past
    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays > -30) { // Keep instances from last 30 days
      instances.push({
        id: `${obligation.id}-${i}`,
        obligation_id: obligation.id,
        due_date: dueDate.toISOString().split('T')[0],
        status: determineInstanceStatus(dueDate, obligation.current_status),
        comments: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  }

  // Sort by due date
  instances.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  
  return instances
}

// Helper function to determine instance status
const determineInstanceStatus = (dueDate, obligationStatus) => {
  const today = new Date()
  const diffTime = dueDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return 'Overdue'
  } else if (diffDays === 0) {
    return 'Pending'
  } else if (diffDays <= 7) {
    return 'Pending'
  } else {
    return 'In Progress'
  }
}

// Update instance status
export const updateInstanceStatus = async (instanceId, status, comment = '') => {
  try {
    // Parse instanceId to get obligation_id
    const [obligationId, index] = instanceId.split('-')
    
    // Get the obligation
    const { data: obligation, error: fetchError } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', obligationId)
      .single()

    if (fetchError) throw fetchError

    // Update the obligation's current_status if it's a significant status change
    if (['Approved', 'Submitted', 'Completed'].includes(status)) {
      await updateObligationStatus(obligationId, status, comment)
    }

    // Add to activity history
    await addActivityHistory(
      obligationId,
      instanceId,
      `Instance status updated to ${status}`,
      comment
    )

    // Return a mock updated instance
    return { 
      data: [{ 
        id: instanceId,
        obligation_id: obligationId,
        status: status,
        comments: comment,
        updated_at: new Date().toISOString()
      }], 
      error: null 
    }
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

    const [obligationId, index] = instanceId.split('-')
    
    // Get the obligation
    const { data: obligation, error: fetchError } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', obligationId)
      .single()

    if (fetchError) throw fetchError

    // Update obligation status to Submitted
    await updateObligationStatus(obligationId, 'Submitted', 'Submitted for review')

    // Add to activity history
    await addActivityHistory(
      obligationId,
      instanceId,
      'Instance submitted for review',
      `Submitted by ${user.data.user.email}`
    )

    return { 
      data: [{ 
        id: instanceId,
        obligation_id: obligationId,
        status: 'Submitted',
        submitted_by: user.data.user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], 
      error: null 
    }
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

    const [obligationId, index] = instanceId.split('-')
    
    // Get the obligation
    const { data: obligation, error: fetchError } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', obligationId)
      .single()

    if (fetchError) throw fetchError

    // Update obligation status to Approved
    await updateObligationStatus(obligationId, 'Approved', 'Approved')

    // Add to activity history
    await addActivityHistory(
      obligationId,
      instanceId,
      'Instance approved',
      `Approved by ${user.data.user.email}`
    )

    return { 
      data: [{ 
        id: instanceId,
        obligation_id: obligationId,
        status: 'Approved',
        approved_by: user.data.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], 
      error: null 
    }
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

// Get upcoming deadlines - FIXED: Now uses obligations table directly
export const getUpcomingDeadlines = async () => {
  try {
    // Generate instances for all obligations
    const { data: obligations, error } = await supabase
      .from('obligations')
      .select('*')
    
    if (error) throw error
    if (!obligations || obligations.length === 0) return []

    let allInstances = []
    
    // Generate instances for each obligation
    for (const obligation of obligations) {
      const instances = generateInstancesFromObligation(obligation)
      // Add obligation details to each instance
      const instancesWithObligation = instances.map(instance => ({
        ...instance,
        obligation: {
          id: obligation.id,
          name: obligation.name,
          obligation_id: obligation.obligation_id,
          domain: obligation.domain
        }
      }))
      allInstances = [...allInstances, ...instancesWithObligation]
    }

    // Filter for upcoming deadlines (next 30 days)
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const upcoming = allInstances.filter(instance => {
      const dueDate = new Date(instance.due_date)
      return dueDate >= today && dueDate <= nextMonth
    })

    // Sort by due date and limit to 10
    upcoming.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    
    return upcoming.slice(0, 10)
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