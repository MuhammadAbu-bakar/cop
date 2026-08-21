import { supabase } from './supabase'

// Get region ID from region name
const getRegionId = async (regionName) => {
  if (!regionName) return null;
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('id')
      .eq('name', regionName)
      .single();
    
    if (error) {
      console.error('Error getting region ID:', error);
      return null;
    }
    return data?.id || null;
  } catch (error) {
    console.error('Error getting region ID:', error);
    return null;
  }
}

// Determine occurrence status based on due date - UPDATED for new status flow
const determineOccurrenceStatus = (dueDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateObj = new Date(dueDate);
  dueDateObj.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDateObj - today) / (1000 * 60 * 60 * 24));
  
  // New status flow: Open (default), Submitted/Under Review, Closed
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due Today';
  if (diffDays <= 7) return 'Pending';
  return 'In Progress';
}

// Generate occurrences for a cyclic obligation - UPDATED with Open as default status
export const generateOccurrences = async (obligationId, regionId, frequency, dueDate, monthsToGenerate = 12) => {
  try {
    const dueDateObj = new Date(dueDate);
    const dueDay = dueDateObj.getDate();
    const startDate = new Date();
    const occurrences = [];

    // Determine month increment based on frequency
    let monthIncrement = 1;
    if (frequency === 'Quarterly') monthIncrement = 3;
    else if (frequency === 'Bi-Annual') monthIncrement = 6;
    else if (frequency === 'Annual') monthIncrement = 12;
    else if (frequency === 'Monthly') monthIncrement = 1;
    else {
      // For non-cyclic frequencies, generate just one occurrence with status 'Open'
      const dueDateStr = dueDateObj.toISOString().split('T')[0];
      const instanceDate = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), 1);
      
      occurrences.push({
        obligation_id: obligationId,
        region_id: regionId,
        instance_date: instanceDate.toISOString().split('T')[0],
        due_date: dueDateStr,
        status: 'Open', // Default status for new obligations
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const { data, error } = await supabase
        .from('obligation_occurrences')
        .insert(occurrences)
        .select();

      if (error) throw error;
      return { data, error: null };
    }

    // Generate occurrences for cyclic obligations - all start with 'Open' status
    for (let i = 0; i < monthsToGenerate; i++) {
      const occurrenceDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + (i * monthIncrement),
        1
      );
      
      // If we've gone past the due date, adjust
      if (occurrenceDate < dueDateObj && i === 0) {
        occurrenceDate.setFullYear(dueDateObj.getFullYear());
        occurrenceDate.setMonth(dueDateObj.getMonth());
      }

      const lastDayOfMonth = new Date(
        occurrenceDate.getFullYear(),
        occurrenceDate.getMonth() + 1,
        0
      ).getDate();
      
      const effectiveDay = Math.min(dueDay, lastDayOfMonth);
      const dueDateForOccurrence = new Date(
        occurrenceDate.getFullYear(),
        occurrenceDate.getMonth(),
        effectiveDay
      );

      const instanceDate = new Date(
        occurrenceDate.getFullYear(),
        occurrenceDate.getMonth(),
        1
      );

      occurrences.push({
        obligation_id: obligationId,
        region_id: regionId,
        instance_date: instanceDate.toISOString().split('T')[0],
        due_date: dueDateForOccurrence.toISOString().split('T')[0],
        status: 'Open', // Default status for new occurrences
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Insert occurrences
    const { data, error } = await supabase
      .from('obligation_occurrences')
      .insert(occurrences)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error generating occurrences:', error);
    return { data: null, error };
  }
}

// Get all obligations with their progress for the user's region
export const getObligations = async (filters = {}, userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*),
        obligation_progress!left(
          id,
          status,
          completed_at,
          started_at,
          last_updated_at,
          comments,
          region_id
        )
      `)

    if (filters.domain && filters.domain !== 'all') {
      query = query.eq('domain', filters.domain)
    }
    
    if (filters.frequency && filters.frequency !== 'all') {
      query = query.eq('frequency', filters.frequency)
    }

    if (filters.obligation_type) {
      query = query.eq('obligation_type', filters.obligation_type)
    }
    
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,obligation_id.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    let userRegionId = null;
    if (!isAdmin && userRegion) {
      userRegionId = await getRegionId(userRegion);
    }

    let processedData = data
      .map(obligation => {
        if (!isAdmin && userRegionId) {
          const progressForRegion = obligation.obligation_progress?.find(
            p => p.region_id === userRegionId
          );
          
          if (!progressForRegion) return null;
          
          return {
            ...obligation,
            current_status: progressForRegion.status,
            progress_id: progressForRegion.id || null,
            progress_status: progressForRegion.status || null,
            completed_at: progressForRegion.completed_at || null,
            started_at: progressForRegion.started_at || null,
            last_updated_at: progressForRegion.last_updated_at || null,
            progress_comments: progressForRegion.comments || null,
            user_region_id: userRegionId,
            has_progress: true,
          };
        }

        const progress = obligation.obligation_progress?.[0] || null;
        const status = progress?.status || obligation.current_status || 'Open';
        
        return {
          ...obligation,
          current_status: status,
          progress_id: progress?.id || null,
          progress_status: progress?.status || null,
          completed_at: progress?.completed_at || null,
          started_at: progress?.started_at || null,
          last_updated_at: progress?.last_updated_at || null,
          progress_comments: progress?.comments || null,
          has_progress: !!progress,
        };
      })
      .filter(obligation => obligation !== null);

    if (filters.status && filters.status !== 'all') {
      processedData = processedData.filter(o => o.current_status === filters.status);
    }

    return { data: processedData, error: null }
  } catch (error) {
    console.error('Error fetching obligations:', error)
    return { data: null, error }
  }
}

// Get single obligation with details (by UUID) including progress and occurrences
export const getObligationById = async (id, userRegion = null, isAdmin = false) => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*),
        obligation_progress!left(
          id,
          status,
          completed_at,
          started_at,
          last_updated_at,
          comments,
          region_id
        ),
        obligation_occurrences!left(
          id,
          instance_date,
          due_date,
          status,
          completed_at,
          started_at,
          evidence_id,
          comments,
          region_id
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    if (!data) return { data: null, error: null }

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    // Filter occurrences by region
    if (regionId && data.obligation_occurrences) {
      data.obligation_occurrences = data.obligation_occurrences.filter(
        o => o.region_id === regionId
      );
      // Sort by instance_date descending
      data.obligation_occurrences.sort((a, b) => 
        new Date(b.instance_date) - new Date(a.instance_date)
      );
    }

    if (!isAdmin && userRegion && data) {
      if (regionId && data.obligation_progress) {
        const regionProgress = data.obligation_progress.find(
          p => p.region_id === regionId
        );
        if (regionProgress) {
          data.current_status = regionProgress.status;
          data.progress_id = regionProgress.id;
          data.progress_status = regionProgress.status;
          data.completed_at = regionProgress.completed_at;
          data.started_at = regionProgress.started_at;
          data.last_updated_at = regionProgress.last_updated_at;
          data.progress_comments = regionProgress.comments;
        }
      }
    } else if (isAdmin && data) {
      const progress = data.obligation_progress?.[0] || null;
      if (progress) {
        data.current_status = progress.status;
        data.progress_id = progress.id;
        data.progress_status = progress.status;
        data.completed_at = progress.completed_at;
        data.started_at = progress.started_at;
        data.last_updated_at = progress.last_updated_at;
        data.progress_comments = progress.comments;
      }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligation by ID:', error)
    return { data: null, error }
  }
}

// Get obligation by obligation_id (MS-001 format) with progress and occurrences
export const getObligationByObligationId = async (obligationId, userRegion = null, isAdmin = false) => {
  try {
    const { data, error } = await supabase
      .from('obligations')
      .select(`
        *,
        policy:policies(*),
        obligation_progress!left(
          id,
          status,
          completed_at,
          started_at,
          last_updated_at,
          comments,
          region_id
        ),
        obligation_occurrences!left(
          id,
          instance_date,
          due_date,
          status,
          completed_at,
          started_at,
          evidence_id,
          comments,
          region_id
        )
      `)
      .eq('obligation_id', obligationId)
      .single()

    if (error) throw error

    if (!data) return { data: null, error: null }

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    // Filter occurrences by region
    if (regionId && data.obligation_occurrences) {
      data.obligation_occurrences = data.obligation_occurrences.filter(
        o => o.region_id === regionId
      );
      // Sort by instance_date descending
      data.obligation_occurrences.sort((a, b) => 
        new Date(b.instance_date) - new Date(a.instance_date)
      );
    }

    if (!isAdmin && userRegion && data) {
      if (regionId && data.obligation_progress) {
        const regionProgress = data.obligation_progress.find(
          p => p.region_id === regionId
        );
        if (regionProgress) {
          data.current_status = regionProgress.status;
          data.progress_id = regionProgress.id;
          data.progress_status = regionProgress.status;
          data.completed_at = regionProgress.completed_at;
          data.started_at = regionProgress.started_at;
          data.last_updated_at = regionProgress.last_updated_at;
          data.progress_comments = regionProgress.comments;
        }
      }
    } else if (isAdmin && data) {
      const progress = data.obligation_progress?.[0] || null;
      if (progress) {
        data.current_status = progress.status;
        data.progress_id = progress.id;
        data.progress_status = progress.status;
        data.completed_at = progress.completed_at;
        data.started_at = progress.started_at;
        data.last_updated_at = progress.last_updated_at;
        data.progress_comments = progress.comments;
      }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching obligation by obligation_id:', error)
    return { data: null, error }
  }
}

// Get occurrences for a specific month
export const getOccurrencesForMonth = async (regionId, year, month) => {
  try {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('obligation_occurrences')
      .select(`
        *,
        obligation:obligations(
          obligation_id,
          name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          region,
          clause,
          due_date_rule
        )
      `)
      .eq('region_id', regionId)
      .gte('instance_date', startDate)
      .lte('instance_date', endDate)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching occurrences for month:', error);
    return { data: null, error };
  }
}

// Update occurrence status - UPDATED for new status flow
export const updateOccurrenceStatus = async (occurrenceId, status, evidenceId = null, comment = '') => {
  try {
    // Validate status - only allow: 'Open', 'Submitted/Under Review', 'Closed'
    const validStatuses = ['Open', 'Submitted/Under Review', 'Closed'];
    if (!validStatuses.includes(status)) {
      // Map old statuses to new ones
      if (status === 'Completed' || status === 'Approved') {
        status = 'Closed';
      } else if (status === 'Submitted' || status === 'Under Review') {
        status = 'Submitted/Under Review';
      } else {
        status = 'Open';
      }
    }

    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'Closed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'Submitted/Under Review') {
      updateData.started_at = new Date().toISOString();
    }

    if (evidenceId) {
      updateData.evidence_id = evidenceId;
    }

    if (comment) {
      updateData.comments = comment;
    }

    const { data, error } = await supabase
      .from('obligation_occurrences')
      .update(updateData)
      .eq('id', occurrenceId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating occurrence status:', error);
    return { data: null, error };
  }
}

// ============================================================
// NEW APPROVAL FUNCTIONS
// ============================================================

// Get occurrences pending approval (Submitted/Under Review)
// Get occurrences pending approval (Submitted/Under Review) - FIXED to include evidence
export const getPendingApprovals = async (userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
      .from('obligation_occurrences')
      .select(`
        *,
        obligation:obligations(
          obligation_id,
          name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          region,
          clause,
          due_date_rule
        ),
        evidence:evidence!evidence_occurrence_id_fkey(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by,
          status
        )
      `)
      .eq('status', 'Submitted/Under Review')
      .order('updated_at', { ascending: false });

    // Filter by region for non-admin users
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { data: null, error };
  }
};

// Get approved occurrences (Closed)
export const getApprovedOccurrences = async (userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
      .from('obligation_occurrences')
      .select(`
        *,
        obligation:obligations(
          obligation_id,
          name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          region,
          clause,
          due_date_rule
        ),
        evidence:evidence(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by
        )
      `)
      .eq('status', 'Closed')
      .order('updated_at', { ascending: false });

    // Filter by region for non-admin users
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching approved occurrences:', error);
    return { data: null, error };
  }
};

// Approve an occurrence (change status to Closed)
export const approveOccurrence = async (occurrenceId, comment = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('obligation_occurrences')
      .update({
        status: 'Closed',
        comments: comment || 'Approved by admin',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', occurrenceId)
      .select();

    if (error) throw error;

    // Add to activity history
    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        occurrenceId,
        `Occurrence approved and closed`,
        `Approved by ${user.data.user.email}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error approving occurrence:', error);
    return { data: null, error };
  }
};

// Reject an occurrence (change status back to Open)
export const rejectOccurrence = async (occurrenceId, reason = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('obligation_occurrences')
      .update({
        status: 'Open',
        comments: reason || 'Rejected, please resubmit',
        updated_at: new Date().toISOString(),
        completed_at: null,
        started_at: null
      })
      .eq('id', occurrenceId)
      .select();

    if (error) throw error;

    // Add to activity history
    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        occurrenceId,
        `Occurrence rejected`,
        `Rejected by ${user.data.user.email}: ${reason}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error rejecting occurrence:', error);
    return { data: null, error };
  }
};

// Submit occurrence for review (when evidence is uploaded)
// Submit occurrence for review (when evidence is uploaded)
export const submitOccurrenceForReview = async (occurrenceId, evidenceId = null) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const updateData = {
      status: 'Submitted/Under Review',
      updated_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    };

    if (evidenceId) {
      updateData.evidence_id = evidenceId;
    }

    const { data, error } = await supabase
      .from('obligation_occurrences')
      .update(updateData)
      .eq('id', occurrenceId)
      .select();

    if (error) throw error;

    console.log('Occurrence submitted for review:', data);

    // Add to activity history
    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        occurrenceId,
        `Evidence uploaded - Submitted for review`,
        `Submitted by ${user.data.user.email}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error submitting occurrence for review:', error);
    return { data: null, error };
  }
};

// ============================================================
// END APPROVAL FUNCTIONS
// ============================================================

// Upload evidence for a specific occurrence - UPDATED to submit for review
// Upload evidence for a specific occurrence - FIXED
export const uploadEvidenceForOccurrence = async (file, occurrenceId, obligationId, regionId, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    if (!isAdmin && !userRegion) {
      throw new Error('Your profile does not have a region assigned. Please contact your administrator.');
    }

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `evidence/${obligationId}/${occurrenceId}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('obligation_evidence')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('obligation_evidence')
      .getPublicUrl(filePath);

    // Save evidence record with occurrence_id
    const { data: evidenceData, error: evidenceError } = await supabase
      .from('evidence')
      .insert({
        obligation_id: obligationId,
        occurrence_id: occurrenceId,
        region_id: regionId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.data.user.id,
        status: 'Pending'
      })
      .select();

    if (evidenceError) throw evidenceError;

    // CRITICAL FIX: Update occurrence status to "Submitted/Under Review"
    if (evidenceData && evidenceData[0]) {
      const updateResult = await supabase
        .from('obligation_occurrences')
        .update({
          status: 'Submitted/Under Review',
          evidence_id: evidenceData[0].id,
          updated_at: new Date().toISOString(),
          started_at: new Date().toISOString()
        })
        .eq('id', occurrenceId)
        .select();

      if (updateResult.error) {
        console.error('Error updating occurrence status:', updateResult.error);
        throw updateResult.error;
      }

      console.log('Occurrence status updated to Submitted/Under Review:', updateResult.data);

      // Add to activity history
      await addActivityHistory(
        obligationId,
        occurrenceId,
        `Evidence uploaded - Submitted for review`,
        `Submitted by ${user.data.user.email}`
      );
    }

    return { data: evidenceData, error: null };
  } catch (error) {
    console.error('Error uploading evidence for occurrence:', error);
    return { data: null, error };
  }
};

// Get obligation with full details (instances, evidence, activity, progress, occurrences)
export const getObligationWithFullDetails = async (obligationId, userRegion = null, isAdmin = false) => {
  try {
    const { data: obligation, error: obligationError } = await getObligationByObligationId(obligationId, userRegion, isAdmin)
    if (obligationError) throw obligationError
    if (!obligation) return { data: null, error: null }

    const { data: instances } = await getObligationInstances(obligation.id)
    const { data: evidence } = await getEvidence(obligation.id, userRegion, isAdmin)
    const { data: activities } = await getActivityHistory(obligation.id)

    return {
      data: {
        ...obligation,
        instances: instances || [],
        evidence: evidence || [],
        activities: activities || [],
        occurrences: obligation.obligation_occurrences || [],
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching full obligation details:', error)
    return { data: null, error }
  }
}

// Update obligation status - Updates both main table and progress table
export const updateObligationStatus = async (id, status, comment = '', userRegion = null, isAdmin = false) => {
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

    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        let progressStatus = status;
        if (status !== 'Completed' && status !== 'In Progress' && status !== 'Overdue') {
          progressStatus = 'In Progress';
        }
        
        const { data: existingProgress } = await supabase
          .from('obligation_progress')
          .select('id, status')
          .eq('obligation_id', id)
          .eq('region_id', regionId)
          .single();

        const updateData = {
          status: progressStatus,
          last_updated_at: new Date().toISOString(),
        };

        if (progressStatus === 'Completed') {
          updateData.completed_at = new Date().toISOString();
        } else if (progressStatus === 'In Progress' && !existingProgress?.started_at) {
          updateData.started_at = new Date().toISOString();
        }

        if (comment) {
          updateData.comments = comment;
        }

        if (existingProgress) {
          const { error: updateError } = await supabase
            .from('obligation_progress')
            .update(updateData)
            .eq('id', existingProgress.id);
          
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('obligation_progress')
            .insert({
              obligation_id: id,
              region_id: regionId,
              status: progressStatus,
              ...(progressStatus === 'Completed' && { completed_at: new Date().toISOString() }),
              ...(progressStatus === 'In Progress' && { started_at: new Date().toISOString() }),
              ...(comment && { comments: comment }),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) throw insertError;
        }
      }
    }

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

// Get region-specific progress for an obligation
export const getRegionProgress = async (obligationId, regionName) => {
  try {
    const regionId = await getRegionId(regionName);
    if (!regionId) return { data: null, error: null };

    const { data, error } = await supabase
      .from('obligation_progress')
      .select('*')
      .eq('obligation_id', obligationId)
      .eq('region_id', regionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { data: data || null, error: null };
  } catch (error) {
    console.error('Error fetching region progress:', error);
    return { data: null, error };
  }
}

// Update region progress - Direct update to progress table
export const updateRegionProgress = async (obligationId, regionName, status, comment = '') => {
  try {
    const regionId = await getRegionId(regionName);
    if (!regionId) {
      throw new Error(`Region not found for name: ${regionName}`);
    }

    let progressStatus = status;
    if (status !== 'Completed' && status !== 'In Progress' && status !== 'Overdue') {
      progressStatus = 'In Progress';
    }

    const { data: existingProgress } = await supabase
      .from('obligation_progress')
      .select('id, status')
      .eq('obligation_id', obligationId)
      .eq('region_id', regionId)
      .single();

    const updateData = {
      status: progressStatus,
      last_updated_at: new Date().toISOString(),
    };

    if (progressStatus === 'Completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (progressStatus === 'In Progress' && !existingProgress?.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    if (comment) {
      updateData.comments = comment;
    }

    let result;
    if (existingProgress) {
      result = await supabase
        .from('obligation_progress')
        .update(updateData)
        .eq('id', existingProgress.id)
        .select();
    } else {
      result = await supabase
        .from('obligation_progress')
        .insert({
          obligation_id: obligationId,
          region_id: regionId,
          status: progressStatus,
          ...(progressStatus === 'Completed' && { completed_at: new Date().toISOString() }),
          ...(progressStatus === 'In Progress' && { started_at: new Date().toISOString() }),
          ...(comment && { comments: comment }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
    }

    if (result.error) throw result.error;

    await supabase
      .from('obligations')
      .update({
        current_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', obligationId);

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error updating region progress:', error);
    return { data: null, error };
  }
}

// Get obligation instances - Generate instances on the fly from obligations
export const getObligationInstances = async (obligationId) => {
  try {
    const { data: obligation, error: obligationError } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', obligationId)
      .single()

    if (obligationError) throw obligationError
    if (!obligation) return { data: [], error: null }

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
    'One-Time': 0,
    'Continuous': 0
  }

  const monthsToGenerate = frequencies[obligation.frequency] || 1
  const currentDate = new Date(today)
  
  for (let i = 0; i < 6; i++) {
    const dueDate = new Date(currentDate)
    if (monthsToGenerate > 0) {
      dueDate.setMonth(dueDate.getMonth() + (i * monthsToGenerate))
    } else {
      if (obligation.due_date_rule) {
        const parsedDate = new Date(obligation.due_date_rule)
        if (!isNaN(parsedDate.getTime())) {
          dueDate.setTime(parsedDate.getTime())
        } else {
          dueDate.setMonth(dueDate.getMonth() + 1)
        }
      } else {
        dueDate.setMonth(dueDate.getMonth() + 1)
      }
    }

    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays > -30) {
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
    return 'Due Today'
  } else if (diffDays <= 7) {
    return 'Pending'
  } else {
    return 'In Progress'
  }
}

// Update instance status
export const updateInstanceStatus = async (instanceId, status, comment = '', userRegion = null, isAdmin = false) => {
  try {
    const [obligationId, index] = instanceId.split('-')
    
    const result = await updateObligationStatus(obligationId, status, comment, userRegion, isAdmin)

    if (result.data && result.data[0]) {
      await addActivityHistory(
        obligationId,
        instanceId,
        `Instance status updated to ${status}`,
        comment
      )
    }

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
export const submitInstance = async (instanceId, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    const [obligationId, index] = instanceId.split('-')
    
    const result = await updateObligationStatus(obligationId, 'Submitted', 'Submitted for review', userRegion, isAdmin)

    if (result.data && result.data[0]) {
      await addActivityHistory(
        obligationId,
        instanceId,
        'Instance submitted for review',
        `Submitted by ${user.data.user.email}`
      )
    }

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
export const approveInstance = async (instanceId, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    const [obligationId, index] = instanceId.split('-')
    
    const result = await updateObligationStatus(obligationId, 'Approved', 'Approved', userRegion, isAdmin)

    if (result.data && result.data[0]) {
      await addActivityHistory(
        obligationId,
        instanceId,
        'Instance approved',
        `Approved by ${user.data.user.email}`
      )
    }

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

// Upload evidence - Sets progress to Completed when evidence is uploaded (legacy)
export const uploadEvidence = async (file, obligationId, instanceId = null, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser()
    if (user.error) throw user.error

    // Check if user has a region
    if (!isAdmin && !userRegion) {
      throw new Error('Your profile does not have a region assigned. Please contact your administrator.')
    }

    const fileName = `${Date.now()}_${file.name}`
    const filePath = `evidence/${fileName}`

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('obligation_evidence')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('obligation_evidence')
      .getPublicUrl(filePath)

    // Get region ID if user is regional
    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
      console.log(`Region ID for "${userRegion}":`, regionId);
    }

    // Save to database
    const { data, error } = await supabase
      .from('evidence')
      .insert({
        obligation_id: obligationId,
        instance_id: instanceId,
        region_id: regionId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.data.user.id,
        status: 'Approved'
      })
      .select()

    if (error) throw error

    // If regional user uploaded evidence, update progress to Completed
    if (!isAdmin && userRegion && regionId) {
      console.log(`Updating progress to Completed for region: ${userRegion}`);
      await updateRegionProgress(obligationId, userRegion, 'Completed', 'Evidence uploaded');
    }

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

// Get evidence for an obligation - FILTERED BY REGION
export const getEvidence = async (obligationId, userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
      .from('evidence')
      .select(`
        *,
        occurrence:obligation_occurrences(
          id,
          instance_date,
          due_date,
          status
        )
      `)
      .eq('obligation_id', obligationId)
      .order('uploaded_at', { ascending: false });

    // If not admin and has region, filter by region
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
        console.log(`Filtering evidence for region: ${userRegion} (${regionId})`);
      } else {
        // If region not found, return empty array
        return { data: [], error: null };
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    console.log(`Found ${data?.length || 0} evidence items for region: ${userRegion || 'All'}`);
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return { data: null, error };
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

// Get dashboard stats - Uses obligation_progress for regional users
export const getDashboardStats = async (userRegion = null, isAdmin = false) => {
  try {
    // Get all obligations
    const { data: obligations, error: obligationsError } = await supabase
      .from('obligations')
      .select('id, compliance_weight, current_status');

    if (obligationsError) throw obligationsError;

    // Get region ID if user is regional
    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    // Get progress data for the user's region (or all if admin)
    let progressQuery = supabase
      .from('obligation_progress')
      .select('obligation_id, status, region_id');

    if (regionId) {
      progressQuery = progressQuery.eq('region_id', regionId);
    }

    const { data: progressData, error: progressError } = await progressQuery;

    if (progressError) throw progressError;

    // Calculate stats from progress data
    const totalObligations = obligations?.length || 0;
    const completed = progressData?.filter(p => p.status === 'Completed').length || 0;
    const overdue = progressData?.filter(p => p.status === 'Overdue').length || 0;
    const inProgress = progressData?.filter(p => p.status === 'In Progress').length || 0;
    
    // For regional users, total should be the number of obligations that have progress records
    // For admin, total is all obligations
    let effectiveTotal = totalObligations;
    if (!isAdmin && regionId) {
      // For regional users, total is the number of obligations that have progress for their region
      effectiveTotal = progressData?.length || 0;
    }

    const notStarted = Math.max(0, effectiveTotal - completed - overdue - inProgress);

    // Calculate compliance (based on effective total)
    const overallCompliance = effectiveTotal > 0 ? Math.round((completed / effectiveTotal) * 100) : 0;
    const auditReadiness = effectiveTotal > 0 ? Math.round(((completed + inProgress) / effectiveTotal) * 100) : 0;

    // Calculate weighted compliance
    let totalWeight = 0;
    let achievedWeight = 0;
    
    if (!isAdmin && regionId) {
      // For regional users, only count obligations that have progress
      const progressMap = {};
      progressData?.forEach(p => {
        progressMap[p.obligation_id] = p.status;
      });

      obligations?.forEach(o => {
        if (progressMap[o.id]) {
          totalWeight += o.compliance_weight || 1;
          if (progressMap[o.id] === 'Completed') {
            achievedWeight += o.compliance_weight || 1;
          }
        }
      });
    } else {
      // For admin, use all obligations
      obligations?.forEach(o => {
        totalWeight += o.compliance_weight || 1;
        if (o.current_status === 'Completed') {
          achievedWeight += o.compliance_weight || 1;
        }
      });
    }

    const overallWeightedCompliance = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;

    return {
      overallCompliance: overallWeightedCompliance || overallCompliance,
      auditReadiness: auditReadiness || 0,
      totalObligations: effectiveTotal,
      completed: completed,
      pending: inProgress,
      overdue: overdue,
      inProgress: inProgress,
      notStarted: notStarted,
      regionsBelowTarget: 0,
      regionsTotal: 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      overallCompliance: 0,
      auditReadiness: 0,
      totalObligations: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      inProgress: 0,
      notStarted: 0,
      regionsBelowTarget: 0,
      regionsTotal: 0,
    };
  }
};

// Get compliance by domain - Uses obligation_progress for regional users
export const getComplianceByDomain = async (userRegion = null, isAdmin = false) => {
  try {
    const { data: obligations, error } = await supabase
      .from('obligations')
      .select('id, domain, compliance_weight, current_status')

    if (error) throw error

    let progressData = {};
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        const { data: progress, error: progressError } = await supabase
          .from('obligation_progress')
          .select('obligation_id, status')
          .eq('region_id', regionId);
        
        if (!progressError && progress) {
          progress.forEach(p => {
            progressData[p.obligation_id] = p.status;
          });
        }
      }
    }

    const domainMap = {}
    obligations?.forEach(o => {
      if (!domainMap[o.domain]) {
        domainMap[o.domain] = { total: 0, achieved: 0 }
      }
      domainMap[o.domain].total += o.compliance_weight || 1
      
      let isCompleted = false;
      if (!isAdmin && userRegion) {
        isCompleted = progressData[o.id] === 'Completed';
      } else {
        isCompleted = o.current_status === 'Completed';
      }
      
      if (isCompleted) {
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

// Get upcoming deadlines - Uses obligation_progress for status
export const getUpcomingDeadlines = async (userRegion = null, isAdmin = false) => {
  try {
    const { data: obligations, error } = await supabase
      .from('obligations')
      .select('*')
    
    if (error) throw error
    if (!obligations || obligations.length === 0) return []

    let progressData = {};
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        const { data: progress, error: progressError } = await supabase
          .from('obligation_progress')
          .select('obligation_id, status')
          .eq('region_id', regionId);
        
        if (!progressError && progress) {
          progress.forEach(p => {
            progressData[p.obligation_id] = p.status;
          });
        }
      }
    }

    let allInstances = []
    
    for (const obligation of obligations) {
      const instances = generateInstancesFromObligation(obligation)
      const instancesWithObligation = instances.map(instance => {
        let status = instance.status;
        if (!isAdmin && userRegion) {
          const progressStatus = progressData[obligation.id];
          if (progressStatus) {
            status = progressStatus;
          } else {
            status = obligation.current_status || instance.status;
          }
        } else {
          status = obligation.current_status || instance.status;
        }
        
        return {
          ...instance,
          status,
          obligation: {
            id: obligation.id,
            name: obligation.name,
            obligation_id: obligation.obligation_id,
            domain: obligation.domain
          }
        }
      })
      allInstances = [...allInstances, ...instancesWithObligation]
    }

    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const upcoming = allInstances.filter(instance => {
      const dueDate = new Date(instance.due_date)
      return dueDate >= today && dueDate <= nextMonth && instance.status !== 'Completed'
    })

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