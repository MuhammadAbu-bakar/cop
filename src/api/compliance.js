import { supabase } from './supabase'

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

// Get region name from region ID
const getRegionName = async (regionId) => {
  if (!regionId) return null;
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('name')
      .eq('id', regionId)
      .single();
    
    if (error) {
      console.error('Error getting region name:', error);
      return null;
    }
    return data?.name || null;
  } catch (error) {
    console.error('Error getting region name:', error);
    return null;
  }
}

export const getObligations = async (
  filters = {},
  userRegion = null,
  isAdmin = false
) => {
  try {
    console.log('🔍 getObligations called with:', { filters, userRegion, isAdmin });

    // ---------------------------------------------------------
    // 1. GET USER REGION ID
    // ---------------------------------------------------------
    let userRegionId = null;
    if (!isAdmin && userRegion) {
      userRegionId = await getRegionId(userRegion);
      console.log(`👤 User region: ${userRegion} (ID: ${userRegionId})`);
    }

    // ---------------------------------------------------------
    // 2. CHECK IF MONTH FILTER IS ACTIVE
    // ---------------------------------------------------------
    const monthValue = filters.month || '';
    const yearValue = filters.year || '';
    
    const hasMonthFilter = monthValue !== '' && monthValue !== 'all' && 
                           yearValue !== '' && yearValue !== 'all';
    
    console.log(`📅 Month filter active: ${hasMonthFilter}, Month: ${monthValue}, Year: ${yearValue}`);

    // ---------------------------------------------------------
    // 3. QUERY compliance_progress WITH PAGINATION
    // ---------------------------------------------------------
    const PAGE_SIZE = 1000;
    let allProgressData = [];
    let pageStart = 0;
    let hasMore = true;

    while (hasMore) {
      let progressQuery = supabase
        .from("compliance_progress")
        .select(`
          id,
          obligation_id,
          region_id,
          occurrence_date,
          calculated_due_date,
          status,
          evidence_id,
          uploaded_by,
          updated_by,
          comments,
          created_at,
          updated_at
        `)
        .range(pageStart, pageStart + PAGE_SIZE - 1);

      if (!isAdmin && userRegionId) {
        progressQuery = progressQuery.eq("region_id", userRegionId);
      }

      // ---------------------------------------------------------
      // 4. APPLY MONTH/YEAR FILTERS IF PRESENT
      // ---------------------------------------------------------
      if (hasMonthFilter) {
        const year = parseInt(yearValue);
        const month = parseInt(monthValue);
        if (!isNaN(year) && !isNaN(month)) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          const formatDate = (date) => date.toISOString().split("T")[0];
          progressQuery = progressQuery
            .gte("occurrence_date", formatDate(startDate))
            .lte("occurrence_date", formatDate(endDate));
          console.log(`📅 Filtering by month: ${month}/${year}`);
        }
      } else if (yearValue !== '' && yearValue !== 'all') {
        const year = parseInt(yearValue);
        if (!isNaN(year)) {
          const startDate = `${year}-01-01`;
          const endDate = `${year}-12-31`;
          progressQuery = progressQuery
            .gte("occurrence_date", startDate)
            .lte("occurrence_date", endDate);
          console.log(`📅 Filtering by year: ${year}`);
        }
      }

      progressQuery = progressQuery.order("occurrence_date", { ascending: false });

      const { data: progressData, error: progressError } = await progressQuery;

      if (progressError) {
        throw progressError;
      }

      if (!progressData || progressData.length === 0) {
        hasMore = false;
        break;
      }

      allProgressData.push(...progressData);
      
      if (progressData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        pageStart += PAGE_SIZE;
      }
    }

    console.log(`📊 Found ${allProgressData?.length || 0} progress records`);

    if (!allProgressData || allProgressData.length === 0) {
      return { data: [], error: null };
    }

    // ---------------------------------------------------------
    // 5. Get unique obligation_ids from progress records
    // ---------------------------------------------------------
    const obligationIds = [...new Set(allProgressData.map(p => p.obligation_id))];
    console.log(`📋 Found ${obligationIds.length} unique obligation IDs in progress`);

    // ---------------------------------------------------------
    // 6. GET OBLIGATION DETAILS for these IDs
    // ---------------------------------------------------------
    let obligationQuery = supabase
      .from("compliance_obligations")
      .select("*")
      .in("obligation_id", obligationIds)
      .order("obligation_id", { ascending: true });

    if (filters.domain && filters.domain !== "all") {
      obligationQuery = obligationQuery.eq("domain", filters.domain);
    }

    if (filters.frequency && filters.frequency !== "all") {
      obligationQuery = obligationQuery.eq("frequency", filters.frequency);
    }

    if (filters.obligation_type && filters.obligation_type !== "all") {
      obligationQuery = obligationQuery.eq("obligation_type", filters.obligation_type);
    }

    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
        obligationQuery = obligationQuery.or(
          `obligation_name.ilike.%${search}%,` +
          `description.ilike.%${search}%,` +
          `obligation_id.ilike.%${search}%`
        );
      }
    }

    const { data: obligations, error: obligationsError } = await obligationQuery;

    if (obligationsError) {
      throw obligationsError;
    }

    console.log(`📋 Found ${obligations?.length || 0} obligation details`);

    if (!obligations || obligations.length === 0) {
      return { data: [], error: null };
    }

    // ---------------------------------------------------------
    // 7. Create a map of obligation details by obligation_id
    // ---------------------------------------------------------
    const obligationMap = {};
    obligations.forEach(obligation => {
      obligationMap[obligation.obligation_id] = obligation;
    });

    // ---------------------------------------------------------
    // 8. BUILD FINAL DATA
    // ---------------------------------------------------------
    let processedData = [];

    if (hasMonthFilter) {
      console.log(`📋 Month filter active (${monthValue}/${yearValue}) - Showing UNIQUE obligations for this month`);
      
      const latestProgressMap = {};
      allProgressData.forEach(progress => {
        if (!latestProgressMap[progress.obligation_id]) {
          latestProgressMap[progress.obligation_id] = progress;
        }
      });

      processedData = obligations.map(obligation => {
        const latestProgress = latestProgressMap[obligation.obligation_id] || null;
        const status = latestProgress?.status || 'Open';

        return {
          ...obligation,
          current_status: status,
          progress_id: latestProgress?.id || null,
          progress_status: latestProgress?.status || null,
          progress_comments: latestProgress?.comments || null,
          progress_uploaded_by: latestProgress?.uploaded_by || null,
          progress_updated_by: latestProgress?.updated_by || null,
          has_progress: !!latestProgress,
          occurrence_date: latestProgress?.occurrence_date || null,
          calculated_due_date: latestProgress?.calculated_due_date || null,
          region_id: latestProgress?.region_id || null,
          progressRecords: latestProgress ? [latestProgress] : [],
          latestProgress: latestProgress,
          _status: status,
          _frequency: obligation.frequency,
          _domain: obligation.domain,
          _obligation_name: obligation.obligation_name,
          _obligation_id: obligation.obligation_id,
          _description: obligation.description
        };
      });

      console.log(`📊 Showing ${processedData.length} UNIQUE obligations for ${monthValue}/${yearValue}`);

    } else {
      console.log('📋 No filter - Showing ALL progress records (duplicates allowed)');
      
      processedData = allProgressData.map(progress => {
        const obligation = obligationMap[progress.obligation_id] || {};
        
        return {
          ...obligation,
          progress_id: progress.id,
          progress_status: progress.status,
          progress_comments: progress.comments,
          progress_uploaded_by: progress.uploaded_by,
          progress_updated_by: progress.updated_by,
          occurrence_date: progress.occurrence_date,
          calculated_due_date: progress.calculated_due_date,
          region_id: progress.region_id,
          progress_created_at: progress.created_at,
          progress_updated_at: progress.updated_at,
          evidence_id: progress.evidence_id,
          current_status: progress.status,
          _status: progress.status,
          _frequency: obligation.frequency,
          _domain: obligation.domain,
          _obligation_name: obligation.obligation_name,
          _obligation_id: obligation.obligation_id,
          _description: obligation.description,
          _progress: progress
        };
      });

      console.log(`📊 Showing ${processedData.length} progress records (including duplicates across months)`);
    }

    // ---------------------------------------------------------
    // 9. APPLY STATUS FILTER (in-memory)
    // ---------------------------------------------------------
    let finalData = processedData;
    if (filters.status && filters.status !== 'all') {
      finalData = finalData.filter(item => {
        const status = item.current_status || 'Open';
        return status === filters.status;
      });
      console.log(`📊 Filtered by status: ${filters.status}, ${finalData.length} remaining`);
    }

    if (finalData.length > 0) {
      console.log('📋 Sample final data:');
      finalData.slice(0, 5).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.obligation_id} - ${item.obligation_name} - Due: ${item.calculated_due_date} - Status: ${item.current_status}`);
      });
    }

    console.log(`✅ Returning ${finalData.length} records`);
    return { data: finalData, error: null };

  } catch (error) {
    console.error("❌ Error fetching obligations:", error);
    return { data: null, error };
  }
};

// Get single obligation with details (by UUID)
export const getObligationById = async (id, userRegion = null, isAdmin = false) => {
  try {
    const { data, error } = await supabase
      .from('compliance_obligations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return { data: null, error: null };

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    let progressQuery = supabase
      .from('compliance_progress')
      .select('*')
      .eq('obligation_id', data.obligation_id);

    if (!isAdmin && regionId) {
      progressQuery = progressQuery.eq('region_id', regionId);
    }

    const { data: progressData, error: progressError } = await progressQuery;
    if (!progressError) {
      data.compliance_progress = progressData || [];
      
      const latestProgress = progressData && progressData.length > 0 
        ? progressData.reduce((latest, current) => {
            return new Date(current.occurrence_date) > new Date(latest.occurrence_date) ? current : latest;
          })
        : null;
      
      if (latestProgress) {
        data.current_status = latestProgress.status;
        data.progress_id = latestProgress.id;
        data.progress_status = latestProgress.status;
        data.progress_comments = latestProgress.comments;
        data.progress_uploaded_by = latestProgress.uploaded_by;
        data.progress_updated_by = latestProgress.updated_by;
        data.occurrence_date = latestProgress.occurrence_date;
        data.calculated_due_date = latestProgress.calculated_due_date;
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching obligation by ID:', error);
    return { data: null, error };
  }
}

// Get obligation by obligation_id (MS-001 format)
export const getObligationByObligationId = async (obligationId, userRegion = null, isAdmin = false) => {
  try {
    const { data, error } = await supabase
      .from('compliance_obligations')
      .select('*')
      .eq('obligation_id', obligationId)
      .single();

    if (error) throw error;
    if (!data) return { data: null, error: null };

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    let progressQuery = supabase
      .from('compliance_progress')
      .select('*')
      .eq('obligation_id', data.obligation_id);

    if (!isAdmin && regionId) {
      progressQuery = progressQuery.eq('region_id', regionId);
    }

    const { data: progressData, error: progressError } = await progressQuery;
    if (!progressError) {
      data.compliance_progress = progressData || [];
      
      const latestProgress = progressData && progressData.length > 0 
        ? progressData.reduce((latest, current) => {
            return new Date(current.occurrence_date) > new Date(latest.occurrence_date) ? current : latest;
          })
        : null;
      
      if (latestProgress) {
        data.current_status = latestProgress.status;
        data.progress_id = latestProgress.id;
        data.progress_status = latestProgress.status;
        data.progress_comments = latestProgress.comments;
        data.progress_uploaded_by = latestProgress.uploaded_by;
        data.progress_updated_by = latestProgress.updated_by;
        data.occurrence_date = latestProgress.occurrence_date;
        data.calculated_due_date = latestProgress.calculated_due_date;
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching obligation by obligation_id:', error);
    return { data: null, error };
  }
}

// ============================================================
// OCCURRENCE MANAGEMENT
// ============================================================

export const generateOccurrences = async (obligationId, regionId, frequency, dueDate, monthsToGenerate = 12) => {
  try {
    const dueDateObj = new Date(dueDate);
    const dueDay = dueDateObj.getDate();
    const startDate = new Date();
    const occurrences = [];

    let monthIncrement = 1;
    if (frequency === 'Quarterly') monthIncrement = 3;
    else if (frequency === 'Bi-Annual') monthIncrement = 6;
    else if (frequency === 'Annual') monthIncrement = 12;
    else if (frequency === 'Monthly') monthIncrement = 1;
    else {
      const dueDateStr = dueDateObj.toISOString().split('T')[0];
      const instanceDate = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), 1);
      
      occurrences.push({
        obligation_id: obligationId,
        region_id: regionId,
        occurrence_date: instanceDate.toISOString().split('T')[0],
        calculated_due_date: dueDateStr,
        status: 'Open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const { data, error } = await supabase
        .from('compliance_progress')
        .insert(occurrences)
        .select();

      if (error) throw error;
      return { data, error: null };
    }

    for (let i = 0; i < monthsToGenerate; i++) {
      const occurrenceDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + (i * monthIncrement),
        1
      );
      
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
        occurrence_date: instanceDate.toISOString().split('T')[0],
        calculated_due_date: dueDateForOccurrence.toISOString().split('T')[0],
        status: 'Open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const { data, error } = await supabase
      .from('compliance_progress')
      .insert(occurrences)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error generating occurrences:', error);
    return { data: null, error };
  }
}

export const getOccurrencesForMonth = async (regionId, year, month) => {
  try {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('compliance_progress')
      .select(`
        *,
        obligation:compliance_obligations(
          obligation_id,
          obligation_name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          policy,
          clause,
          due_date_rule
        )
      `)
      .eq('region_id', regionId)
      .gte('occurrence_date', startDate)
      .lte('occurrence_date', endDate)
      .order('occurrence_date', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching occurrences for month:', error);
    return { data: null, error };
  }
}

export const updateOccurrenceStatus = async (progressId, status, evidenceId = null, comment = '') => {
  try {
    const validStatuses = ['Open', 'Submitted/Under Review', 'Closed'];
    if (!validStatuses.includes(status)) {
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

    if (evidenceId) {
      updateData.evidence_id = evidenceId;
    }

    if (comment) {
      updateData.comments = comment;
    }

    const { data, error } = await supabase
      .from('compliance_progress')
      .update(updateData)
      .eq('id', progressId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error updating occurrence status:', error);
    return { data: null, error };
  }
}

// ============================================================
// APPROVAL FUNCTIONS - FIXED FOR AMBIGUOUS RELATIONSHIP
// ============================================================

export const getPendingApprovals = async (userRegion = null, isAdmin = false) => {
  try {
    // First, get the progress records with status 'Submitted/Under Review'
    let progressQuery = supabase
      .from('compliance_progress')
      .select(`
        *,
        obligation:compliance_obligations(
          obligation_id,
          obligation_name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          policy,
          clause,
          due_date_rule
        )
      `)
      .eq('status', 'Submitted/Under Review')
      .order('updated_at', { ascending: false });

    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }
    }

    const { data: progressData, error: progressError } = await progressQuery;

    if (progressError) {
      throw progressError;
    }

    if (!progressData || progressData.length === 0) {
      return { data: [], error: null };
    }

    // Now, separately fetch evidence for each progress record
    const evidenceIds = progressData
      .map(p => p.evidence_id)
      .filter(id => id !== null);

    let evidenceMap = {};
    if (evidenceIds.length > 0) {
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('evidence')
        .select('*')
        .in('id', evidenceIds);

      if (!evidenceError && evidenceData) {
        evidenceData.forEach(e => {
          evidenceMap[e.id] = e;
        });
      }
    }

    // Combine progress with evidence
    const combinedData = progressData.map(progress => {
      const evidence = progress.evidence_id ? evidenceMap[progress.evidence_id] : null;
      return {
        ...progress,
        evidence: evidence
      };
    });

    return { data: combinedData, error: null };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { data: null, error };
  }
};

export const getApprovedOccurrences = async (userRegion = null, isAdmin = false) => {
  try {
    // First, get the progress records with status 'Closed'
    let progressQuery = supabase
      .from('compliance_progress')
      .select(`
        *,
        obligation:compliance_obligations(
          obligation_id,
          obligation_name,
          domain,
          frequency,
          description,
          responsible,
          accountable,
          compliance_weight,
          evidence_required,
          evidence_type,
          mandatory,
          policy,
          clause,
          due_date_rule
        )
      `)
      .eq('status', 'Closed')
      .order('updated_at', { ascending: false });

    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }
    }

    const { data: progressData, error: progressError } = await progressQuery;

    if (progressError) {
      throw progressError;
    }

    if (!progressData || progressData.length === 0) {
      return { data: [], error: null };
    }

    // Now, separately fetch evidence for each progress record
    const evidenceIds = progressData
      .map(p => p.evidence_id)
      .filter(id => id !== null);

    let evidenceMap = {};
    if (evidenceIds.length > 0) {
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('evidence')
        .select('*')
        .in('id', evidenceIds);

      if (!evidenceError && evidenceData) {
        evidenceData.forEach(e => {
          evidenceMap[e.id] = e;
        });
      }
    }

    // Combine progress with evidence
    const combinedData = progressData.map(progress => {
      const evidence = progress.evidence_id ? evidenceMap[progress.evidence_id] : null;
      return {
        ...progress,
        evidence: evidence
      };
    });

    return { data: combinedData, error: null };
  } catch (error) {
    console.error('Error fetching approved occurrences:', error);
    return { data: null, error };
  }
};

export const approveOccurrence = async (progressId, comment = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Closed',
        comments: comment || 'Approved by admin',
        updated_by: user.data.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId)
      .select();

    if (error) throw error;

    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        progressId,
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

export const rejectOccurrence = async (progressId, reason = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Open',
        comments: reason || 'Rejected, please resubmit',
        updated_by: user.data.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId)
      .select();

    if (error) throw error;

    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        progressId,
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

export const submitOccurrenceForReview = async (progressId, evidenceId = null) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const updateData = {
      status: 'Submitted/Under Review',
      updated_by: user.data.user.id,
      updated_at: new Date().toISOString()
    };

    if (evidenceId) {
      updateData.evidence_id = evidenceId;
    }

    const { data, error } = await supabase
      .from('compliance_progress')
      .update(updateData)
      .eq('id', progressId)
      .select();

    if (error) throw error;

    if (data && data[0]) {
      await addActivityHistory(
        data[0].obligation_id,
        progressId,
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
// EVIDENCE FUNCTIONS
// ============================================================

export const uploadEvidenceForOccurrence = async (file, progressId, obligationId, regionId, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    if (!isAdmin && !userRegion) {
      throw new Error('Your profile does not have a region assigned. Please contact your administrator.');
    }

    // Get the UUID from compliance_obligations for the obligation_id (text)
    const { data: obligationData, error: obligationError } = await supabase
      .from('compliance_obligations')
      .select('id')
      .eq('obligation_id', obligationId)
      .single();

    if (obligationError || !obligationData) {
      throw new Error(`Obligation with ID "${obligationId}" not found`);
    }

    const obligationUuid = obligationData.id;

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `evidence/${obligationId}/${progressId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('obligation_evidence')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('obligation_evidence')
      .getPublicUrl(filePath);

    const { data: evidenceData, error: evidenceError } = await supabase
      .from('evidence')
      .insert({
        obligation_id: obligationUuid,
        occurrence_id: progressId,
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

    if (evidenceData && evidenceData[0]) {
      const updateResult = await supabase
        .from('compliance_progress')
        .update({
          status: 'Submitted/Under Review',
          evidence_id: evidenceData[0].id,
          uploaded_by: user.data.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', progressId)
        .select();

      if (updateResult.error) {
        console.error('Error updating occurrence status:', updateResult.error);
        throw updateResult.error;
      }

      await addActivityHistory(
        obligationId,
        progressId,
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

export const getEvidence = async (obligationId, userRegion = null, isAdmin = false) => {
  try {
    // Get the UUID from compliance_obligations
    const { data: obligationData, error: obligationError } = await supabase
      .from('compliance_obligations')
      .select('id')
      .eq('obligation_id', obligationId)
      .single();

    if (obligationError || !obligationData) {
      return { data: [], error: null };
    }

    const obligationUuid = obligationData.id;

    let query = supabase
      .from('evidence')
      .select(`
        *,
        progress:compliance_progress!evidence_occurrence_id_fkey(
          id,
          occurrence_date,
          status,
          region_id
        )
      `)
      .eq('obligation_id', obligationUuid)
      .order('uploaded_at', { ascending: false });

    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      } else {
        return { data: [], error: null };
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return { data: null, error };
  }
}

// ============================================================
// ACTIVITY HISTORY
// ============================================================

export const addActivityHistory = async (obligationId, progressId = null, action, details = null) => {
  try {
    const user = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('activity_history')
      .insert({
        obligation_id: obligationId,
        progress_id: progressId,
        action: action,
        user_id: user.data.user?.id || null,
        user_name: user.data.user?.user_metadata?.full_name || user.data.user?.email || 'System',
        details: details ? { comment: details } : null,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error adding activity history:', error);
    return { data: null, error };
  }
}

export const getActivityHistory = async (obligationId, progressId = null) => {
  try {
    let query = supabase
      .from('activity_history')
      .select('*')
      .eq('obligation_id', obligationId)
      .order('created_at', { ascending: false });

    if (progressId) {
      query = query.eq('progress_id', progressId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching activity history:', error);
    return { data: null, error };
  }
}

// ============================================================
// DASHBOARD STATS - FIXED
// - Handles Supabase 1000-row limit using pagination
// - Regional users see ONLY their region
// - Admin users see ALL regions
// - Only occurrence_date <= today is counted
// - Correct status calculations
// ============================================================

export const getDashboardStats = async (
  userRegion = null,
  isAdmin = false
) => {
  try {
    console.log("=================================================");
    console.log("🔍 [DashboardStats] START");
    console.log("👤 User Region:", userRegion);
    console.log("👑 Is Admin:", isAdmin);
    console.log("=================================================");

    // ---------------------------------------------------------
    // 1. GET USER REGION ID
    // ---------------------------------------------------------

    let regionId = null;

    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);

      console.log(
        "👤 Regional User:",
        userRegion,
        "| Region ID:",
        regionId
      );

      if (!regionId) {
        console.warn(
          "⚠️ Could not find region ID for:",
          userRegion
        );

        return {
          overallCompliance: 0,
          auditReadiness: 0,
          totalObligations: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          inProgress: 0,
          notStarted: 0,
          highRiskGaps: 0,
          regionsBelowTarget: 0,
          regionsTotal: 1,
          evidenceCompletion: 0,
          mandatoryObligations: 0,
          totalOccurrences: 0
        };
      }
    }

    // ---------------------------------------------------------
    // 2. TODAY
    // ---------------------------------------------------------

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString().split("T")[0];

    console.log(
      "📅 Dashboard date:",
      todayStr
    );

    // ---------------------------------------------------------
    // 3. FETCH OBLIGATION INFORMATION
    // ---------------------------------------------------------

    const {
      data: obligations,
      error: obligationsError
    } = await supabase
      .from("compliance_obligations")
      .select(
        `
        obligation_id,
        compliance_weight,
        obligation_type,
        mandatory
        `
      );

    if (obligationsError) {
      console.error(
        "❌ Error fetching obligations:",
        obligationsError
      );

      throw obligationsError;
    }

    console.log(
      "📋 Obligation definitions:",
      obligations?.length || 0
    );

    // ---------------------------------------------------------
    // 4. FETCH ALL PROGRESS RECORDS
    //
    // IMPORTANT:
    // Supabase/PostgREST normally returns max 1000 rows
    // per request.
    //
    // Therefore we fetch in pages:
    // 0-999
    // 1000-1999
    // 2000-2999
    // ...
    // ---------------------------------------------------------

    const PAGE_SIZE = 1000;

    let progressData = [];
    let pageStart = 0;

    while (true) {
      let progressQuery = supabase
        .from("compliance_progress")
        .select("*")
        .lte("occurrence_date", todayStr)
        .order("occurrence_date", {
          ascending: false
        })
        .range(
          pageStart,
          pageStart + PAGE_SIZE - 1
        );

      // -------------------------------------------------------
      // REGIONAL USER
      // -------------------------------------------------------

      if (!isAdmin && regionId) {
        progressQuery = progressQuery.eq(
          "region_id",
          regionId
        );

        console.log(
          `🔐 Region filter applied: ${userRegion} (${regionId})`
        );
      }

      // -------------------------------------------------------
      // ADMIN
      // -------------------------------------------------------

      if (isAdmin) {
        console.log(
          "👑 Admin mode: ALL regions"
        );
      }

      const {
        data: pageData,
        error: pageError
      } = await progressQuery;

      if (pageError) {
        console.error(
          "❌ Error fetching progress page:",
          pageError
        );

        throw pageError;
      }

      // -------------------------------------------------------
      // NO MORE RECORDS
      // -------------------------------------------------------

      if (!pageData || pageData.length === 0) {
        break;
      }

      // Add page to complete dataset
      progressData.push(...pageData);

      console.log(
        `📦 Progress page fetched: ${pageStart} - ${
          pageStart + pageData.length - 1
        }`
      );

      console.log(
        `📊 Page records: ${pageData.length}`
      );

      console.log(
        `📊 Total records so far: ${progressData.length}`
      );

      // -------------------------------------------------------
      // LAST PAGE
      // -------------------------------------------------------

      if (pageData.length < PAGE_SIZE) {
        break;
      }

      pageStart += PAGE_SIZE;
    }

    // ---------------------------------------------------------
    // 5. FINAL FETCH DEBUG
    // ---------------------------------------------------------

    console.log(
      "================================================="
    );

    console.log(
      "✅ TOTAL PROGRESS RECORDS:",
      progressData.length
    );

    if (!isAdmin) {
      console.log(
        "🔐 Region:",
        userRegion
      );

      console.log(
        "🔐 Region ID:",
        regionId
      );
    } else {
      console.log(
        "👑 Admin: ALL REGIONS"
      );
    }

    console.log(
      "================================================="
    );

    // ---------------------------------------------------------
    // 6. NO DATA
    // ---------------------------------------------------------

    if (
      !progressData ||
      progressData.length === 0
    ) {
      console.warn(
        "⚠️ No compliance progress records found."
      );

      return {
        overallCompliance: 0,
        auditReadiness: 0,
        totalObligations: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        inProgress: 0,
        notStarted: 0,
        highRiskGaps: 0,
        regionsBelowTarget: 0,
        regionsTotal: isAdmin ? 0 : 1,
        evidenceCompletion: 0,
        mandatoryObligations: 0,
        totalOccurrences: 0
      };
    }

    // ---------------------------------------------------------
    // 7. DEBUG REGION DISTRIBUTION
    // ---------------------------------------------------------

    const regionDistribution = {};

    progressData.forEach((record) => {
      const id = record.region_id || "NULL";

      regionDistribution[id] =
        (regionDistribution[id] || 0) + 1;
    });

    console.log(
      "🌍 Region distribution:",
      regionDistribution
    );

    // ---------------------------------------------------------
    // 8. DEBUG STATUS DISTRIBUTION
    // ---------------------------------------------------------

    const statusDistribution = {};

    progressData.forEach((record) => {
      const status = record.status || "NULL";

      statusDistribution[status] =
        (statusDistribution[status] || 0) + 1;
    });

    console.log(
      "📊 Status distribution:",
      statusDistribution
    );

    // ---------------------------------------------------------
    // 9. TOTAL OCCURRENCES
    // ---------------------------------------------------------

    const totalProgressRecords =
      progressData.length;

    // ---------------------------------------------------------
    // 10. STATUS COUNTS
    // ---------------------------------------------------------

    const closedRecords =
      progressData.filter(
        (p) => p.status === "Closed"
      ).length;

    const submittedRecords =
      progressData.filter(
        (p) =>
          p.status ===
          "Submitted/Under Review"
      ).length;

    const openRecords =
      progressData.filter(
        (p) => p.status === "Open"
      ).length;

    // ---------------------------------------------------------
    // 11. OVERDUE
    //
    // Closed records are NEVER overdue.
    // ---------------------------------------------------------

    const overdueRecords =
      progressData.filter((p) => {
        if (p.status === "Closed") {
          return false;
        }

        const dueDate =
          p.calculated_due_date ||
          p.occurrence_date;

        if (!dueDate) {
          return false;
        }

        const dueDateObj =
          new Date(dueDate);

        dueDateObj.setHours(
          0,
          0,
          0,
          0
        );

        return dueDateObj < today;
      }).length;

    // ---------------------------------------------------------
    // 12. NOT STARTED
    //
    // Open records that are NOT overdue.
    // ---------------------------------------------------------

    const notStarted = Math.max(
      0,
      openRecords - overdueRecords
    );

    // ---------------------------------------------------------
    // 13. UNIQUE OBLIGATIONS
    // ---------------------------------------------------------

    const uniqueObligationIds =
      new Set(
        progressData.map(
          (p) => p.obligation_id
        )
      );

    const totalUniqueObligations =
      uniqueObligationIds.size;

    // ---------------------------------------------------------
    // 14. OVERALL COMPLIANCE
    // ---------------------------------------------------------

    const overallCompliance =
      totalProgressRecords > 0
        ? Number(
            (
              (closedRecords /
                totalProgressRecords) *
              100
            ).toFixed(1)
          )
        : 0;

    // ---------------------------------------------------------
    // 15. AUDIT READINESS
    // ---------------------------------------------------------

    const auditReadiness =
      totalProgressRecords > 0
        ? Number(
            (
              ((closedRecords +
                submittedRecords) /
                totalProgressRecords) *
              100
            ).toFixed(1)
          )
        : 0;

    // ---------------------------------------------------------
    // 16. WEIGHTED COMPLIANCE
    // ---------------------------------------------------------

    const obligationsMap = {};

    (obligations || []).forEach(
      (obligation) => {
        obligationsMap[
          obligation.obligation_id
        ] =
          Number(
            obligation.compliance_weight
          ) || 1;
      }
    );

    let totalWeight = 0;
    let achievedWeight = 0;

    progressData.forEach((progress) => {
      const weight =
        obligationsMap[
          progress.obligation_id
        ] || 1;

      totalWeight += weight;

      if (progress.status === "Closed") {
        achievedWeight += weight;
      }
    });

    const overallWeightedCompliance =
      totalWeight > 0
        ? Number(
            (
              (achievedWeight /
                totalWeight) *
              100
            ).toFixed(1)
          )
        : 0;

    // ---------------------------------------------------------
    // 17. EVIDENCE COMPLETION
    // ---------------------------------------------------------

    const progressWithEvidence =
      progressData.filter(
        (p) =>
          p.evidence_id !== null &&
          p.evidence_id !== undefined
      ).length;

    const evidenceCompletion =
      totalProgressRecords > 0
        ? Number(
            (
              (progressWithEvidence /
                totalProgressRecords) *
              100
            ).toFixed(1)
          )
        : 0;

    // ---------------------------------------------------------
    // 18. MANDATORY OBLIGATIONS
    //
    // Count only mandatory obligations that actually
    // exist in this dashboard's progress records.
    // ---------------------------------------------------------

    const mandatoryObligationIds =
      new Set(
        (obligations || [])
          .filter(
            (o) => o.mandatory === true
          )
          .map(
            (o) => o.obligation_id
          )
      );

    const mandatoryObligations =
      [
        ...uniqueObligationIds
      ].filter(
        (id) =>
          mandatoryObligationIds.has(id)
      ).length;

    // ---------------------------------------------------------
    // 19. REGION TARGET
    // ---------------------------------------------------------

    let regionsBelowTarget = 0;
    let regionsTotal = 0;

    if (isAdmin) {
      // -------------------------------------------------------
      // ADMIN
      // -------------------------------------------------------

      const {
        data: allRegions,
        error: regionsError
      } = await supabase
        .from("regions")
        .select("id, name");

      if (!regionsError && allRegions) {
        regionsTotal =
          allRegions.length;

        for (const region of allRegions) {
          const regionProgress =
            progressData.filter(
              (p) =>
                p.region_id ===
                region.id
            );

          const regionTotal =
            regionProgress.length;

          const regionClosed =
            regionProgress.filter(
              (p) =>
                p.status === "Closed"
            ).length;

          const regionCompliance =
            regionTotal > 0
              ? (regionClosed /
                  regionTotal) *
                100
              : 0;

          console.log(
            `🌍 ${region.name}: ${regionTotal} total | ${regionClosed} closed | ${regionCompliance.toFixed(
              1
            )}%`
          );

          if (
            regionTotal > 0 &&
            regionCompliance < 80
          ) {
            regionsBelowTarget++;
          }
        }
      }
    } else {
      // -------------------------------------------------------
      // REGIONAL USER
      // -------------------------------------------------------

      regionsTotal = 1;

      if (
        totalProgressRecords > 0
      ) {
        const regionCompliance =
          (closedRecords /
            totalProgressRecords) *
          100;

        if (
          regionCompliance < 80
        ) {
          regionsBelowTarget = 1;
        }
      }
    }

    // ---------------------------------------------------------
    // 20. HIGH-RISK GAPS
    // ---------------------------------------------------------

    const highRiskGaps =
      overdueRecords;

    // ---------------------------------------------------------
    // 21. FINAL RESULT
    // ---------------------------------------------------------

    const result = {
      // Use weighted compliance when available
      overallCompliance:
        totalWeight > 0
          ? overallWeightedCompliance
          : overallCompliance,

      auditReadiness,

      // Unique obligations
      totalObligations:
        totalUniqueObligations,

      // Status counts are occurrences
      completed: closedRecords,

      pending: openRecords,

      overdue: overdueRecords,

      inProgress: submittedRecords,

      notStarted,

      highRiskGaps,

      regionsBelowTarget,

      regionsTotal,

      evidenceCompletion,

      mandatoryObligations,

      // Actual number of progress/occurrence records
      totalOccurrences:
        totalProgressRecords
    };

    // ---------------------------------------------------------
    // 22. FINAL DEBUG
    // ---------------------------------------------------------

    console.log(
      "================================================="
    );

    console.log(
      "✅ [DashboardStats] FINAL RESULT"
    );

    console.log(
      "Region:",
      isAdmin
        ? "ALL REGIONS"
        : userRegion
    );

    console.log(
      "Total:",
      result.totalOccurrences
    );

    console.log(
      "Closed:",
      result.completed
    );

    console.log(
      "Submitted:",
      result.inProgress
    );

    console.log(
      "Open:",
      result.pending
    );

    console.log(
      "Overdue:",
      result.overdue
    );

    console.log(
      "Evidence:",
      result.evidenceCompletion + "%"
    );

    console.log(
      "================================================="
    );

    return result;

  } catch (error) {
    console.error(
      "❌ [DashboardStats] ERROR:",
      error
    );

    return {
      overallCompliance: 0,
      auditReadiness: 0,
      totalObligations: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      inProgress: 0,
      notStarted: 0,
      highRiskGaps: 0,
      regionsBelowTarget: 0,
      regionsTotal: 0,
      evidenceCompletion: 0,
      mandatoryObligations: 0,
      totalOccurrences: 0
    };
  }
};

// ============================================================
// COMPLIANCE BY DOMAIN
// ============================================================

// ============================================================
// COMPLIANCE BY DOMAIN - FIXED FOR ADMIN
// ============================================================

export const getComplianceByDomain = async (userRegion = null, isAdmin = false) => {
  try {
    console.log('🔍 [ComplianceByDomain] ========== START ==========');
    console.log('🔍 [ComplianceByDomain] Fetching for:', { userRegion, isAdmin });

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
      console.log('🔍 [ComplianceByDomain] Region ID:', regionId);
    }

    // Fetch ALL obligations with their domains and compliance weights
    console.log('🔍 [ComplianceByDomain] Fetching all obligations...');
    const { data: obligations, error: obligationsError } = await supabase
      .from('compliance_obligations')
      .select('obligation_id, domain, compliance_weight, obligation_type');

    if (obligationsError) {
      console.error('❌ [ComplianceByDomain] Error fetching obligations:', obligationsError);
      throw obligationsError;
    }

    console.log(`📋 [ComplianceByDomain] Found ${obligations?.length || 0} obligations`);

    if (!obligations || obligations.length === 0) {
      console.log('⚠️ [ComplianceByDomain] No obligations found');
      return { domains: [], compliance: [] };
    }

    // Get all obligation IDs
    const obligationIds = obligations.map(o => o.obligation_id);
    console.log(`📋 [ComplianceByDomain] Obligation IDs: ${obligationIds.length} total`);

    // Fetch progress records with pagination
    console.log('🔍 [ComplianceByDomain] Fetching progress records...');
    const PAGE_SIZE = 1000;
    let allProgressData = [];
    let pageStart = 0;
    let hasMore = true;

    while (hasMore) {
      let progressQuery = supabase
        .from('compliance_progress')
        .select('obligation_id, status, occurrence_date, region_id')
        .range(pageStart, pageStart + PAGE_SIZE - 1);

      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
        console.log(`🔍 [ComplianceByDomain] Filtering by region ID: ${regionId}`);
      }

      const { data: pageData, error: pageError } = await progressQuery;

      if (pageError) {
        console.error('❌ [ComplianceByDomain] Error fetching progress page:', pageError);
        throw pageError;
      }

      if (!pageData || pageData.length === 0) {
        hasMore = false;
        break;
      }

      allProgressData.push(...pageData);
      
      if (pageData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        pageStart += PAGE_SIZE;
      }
    }

    console.log(`📊 [ComplianceByDomain] Found ${allProgressData?.length || 0} total progress records`);

    // Filter progress records to only include those for our obligations
    const obligationIdSet = new Set(obligationIds);
    const progressData = allProgressData?.filter(p => obligationIdSet.has(p.obligation_id)) || [];
    
    console.log(`📊 [ComplianceByDomain] Filtered to ${progressData.length} progress records for our obligations`);

    // For ADMIN: We need to check if ANY region has the obligation as 'Closed'
    // For REGIONAL: We only check the specific region
    const latestStatusMap = {};
    
    if (progressData) {
      console.log('🔍 [ComplianceByDomain] Building latest status map...');
      
      if (isAdmin) {
        // ADMIN: For each obligation, if ANY region has it closed, mark it as closed
        console.log('👑 [ComplianceByDomain] Admin mode - checking all regions for closed status');
        
        // Group by obligation_id to see all statuses across regions
        const obligationStatuses = {};
        progressData.forEach(p => {
          if (!obligationStatuses[p.obligation_id]) {
            obligationStatuses[p.obligation_id] = [];
          }
          obligationStatuses[p.obligation_id].push({
            status: p.status,
            date: p.occurrence_date,
            region_id: p.region_id
          });
        });

        // For each obligation, check if ANY region has it closed
        for (const [obligationId, statuses] of Object.entries(obligationStatuses)) {
          // Check if any status is 'Closed'
          const hasClosed = statuses.some(s => s.status === 'Closed');
          
          if (hasClosed) {
            // Find the most recent closed record
            const closedRecords = statuses.filter(s => s.status === 'Closed');
            const mostRecentClosed = closedRecords.reduce((a, b) => 
              new Date(a.date) > new Date(b.date) ? a : b
            );
            
            latestStatusMap[obligationId] = {
              status: 'Closed',
              date: mostRecentClosed.date,
              region_id: mostRecentClosed.region_id
            };
            console.log(`📊 [ComplianceByDomain] ✅ ${obligationId} is CLOSED in at least one region`);
          } else {
            // Get the most recent status (not closed)
            const mostRecent = statuses.reduce((a, b) => 
              new Date(a.date) > new Date(b.date) ? a : b
            );
            latestStatusMap[obligationId] = {
              status: mostRecent.status,
              date: mostRecent.date,
              region_id: mostRecent.region_id
            };
            console.log(`📊 [ComplianceByDomain] ❌ ${obligationId} is ${mostRecent.status} (no closed regions)`);
          }
        }
      } else {
        // REGIONAL: Only check the specific region
        progressData.forEach(p => {
          const obligationId = p.obligation_id;
          const current = latestStatusMap[obligationId];
          
          if (!current) {
            latestStatusMap[obligationId] = {
              status: p.status,
              date: p.occurrence_date,
              region_id: p.region_id
            };
          } else if (p.status === 'Closed' && current.status !== 'Closed') {
            latestStatusMap[obligationId] = {
              status: p.status,
              date: p.occurrence_date,
              region_id: p.region_id
            };
          } else if (current.status !== 'Closed' && 
                     new Date(p.occurrence_date) > new Date(current.date)) {
            latestStatusMap[obligationId] = {
              status: p.status,
              date: p.occurrence_date,
              region_id: p.region_id
            };
          }
        });
      }
    }

    console.log(`📊 [ComplianceByDomain] Latest status map has ${Object.keys(latestStatusMap).length} entries`);

    // Group by domain and calculate compliance
    const domainMap = {};
    
    obligations.forEach(o => {
      const domain = o.domain || 'Uncategorized';
      
      if (!domainMap[domain]) {
        domainMap[domain] = { 
          totalWeight: 0, 
          achievedWeight: 0,
          totalObligations: 0,
          closedObligations: 0,
          obligationIds: []
        };
      }
      
      const weight = Number(o.compliance_weight) || 1;
      domainMap[domain].totalWeight += weight;
      domainMap[domain].totalObligations += 1;
      domainMap[domain].obligationIds.push(o.obligation_id);
      
      const statusData = latestStatusMap[o.obligation_id];
      if (statusData && statusData.status === 'Closed') {
        domainMap[domain].achievedWeight += weight;
        domainMap[domain].closedObligations += 1;
        console.log(`📊 [ComplianceByDomain] ✅ ${o.obligation_id} (${domain}) is CLOSED - weight ${weight}`);
      } else {
        console.log(`📊 [ComplianceByDomain] ❌ ${o.obligation_id} (${domain}) is ${statusData?.status || 'Open'} - NOT closed`);
      }
    });

    // Calculate compliance percentage for each domain with decimals
    const domains = [];
    const compliance = [];
    const details = {};

    for (const [domain, data] of Object.entries(domainMap)) {
      domains.push(domain);
      let percentage = 0;
      
      if (data.totalWeight > 0) {
        const rawPercentage = (data.achievedWeight / data.totalWeight) * 100;
        percentage = parseFloat(rawPercentage.toFixed(1));
        console.log(`📊 [ComplianceByDomain] ${domain}: ${percentage}% (${data.closedObligations}/${data.totalObligations} closed, ${data.achievedWeight}/${data.totalWeight} weight)`);
      }
      
      compliance.push(percentage);
      
      details[domain] = {
        total: data.totalObligations,
        closed: data.closedObligations,
        totalWeight: data.totalWeight,
        achievedWeight: data.achievedWeight,
        percentage: percentage,
        obligationIds: data.obligationIds
      };
    }

    // Sort by compliance percentage (highest first)
    const sortedIndices = domains.map((_, i) => i).sort((a, b) => compliance[b] - compliance[a]);
    const sortedDomains = sortedIndices.map(i => domains[i]);
    const sortedCompliance = sortedIndices.map(i => compliance[i]);

    const result = { 
      domains: sortedDomains, 
      compliance: sortedCompliance,
      details: details
    };

    console.log('📊 [ComplianceByDomain] ========== RESULT ==========');
    console.log('📊 [ComplianceByDomain] Domains:', sortedDomains);
    console.log('📊 [ComplianceByDomain] Compliance percentages:', sortedCompliance);
    console.log('📊 [ComplianceByDomain] ========== END ==========');

    return result;
  } catch (error) {
    console.error('❌ [ComplianceByDomain] Error:', error);
    console.error('❌ [ComplianceByDomain] Stack trace:', error.stack);
    return { domains: [], compliance: [] };
  }
};

// ============================================================
// UPCOMING DEADLINES
// ============================================================

export const getUpcomingDeadlines = async (userRegion = null, isAdmin = false) => {
  try {
    const { data: obligations, error } = await supabase
      .from('compliance_obligations')
      .select('*');
    
    if (error) throw error;
    if (!obligations || obligations.length === 0) return [];

    let progressData = [];
    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        const { data: progress, error: progressError } = await supabase
          .from('compliance_progress')
          .select('*')
          .eq('region_id', regionId)
          .eq('status', 'Open')
          .order('calculated_due_date', { ascending: true });
        
        if (!progressError && progress) {
          progressData = progress;
        }
      }
    } else if (isAdmin) {
      const { data: progress, error: progressError } = await supabase
        .from('compliance_progress')
        .select('*')
        .eq('status', 'Open')
        .order('calculated_due_date', { ascending: true });
      
      if (!progressError && progress) {
        progressData = progress;
      }
    }

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const upcoming = progressData.filter(progress => {
      const dueDate = new Date(progress.calculated_due_date || progress.occurrence_date);
      return dueDate >= today && dueDate <= nextMonth && progress.status !== 'Closed';
    });

    const result = [];
    for (const progress of upcoming) {
      const obligation = obligations.find(o => o.obligation_id === progress.obligation_id);
      if (obligation) {
        result.push({
          ...progress,
          obligation: {
            id: obligation.id,
            name: obligation.obligation_name,
            obligation_id: obligation.obligation_id,
            domain: obligation.domain,
            policy: obligation.policy
          }
        });
      }
    }
    
    return result.slice(0, 10);
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error);
    return [];
  }
};

// ============================================================
// REGION FUNCTIONS
// ============================================================

export const getRegions = async () => {
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .order('name');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching regions:', error);
    return { data: null, error };
  }
};

export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { data: null, error };
  }
};

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

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
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { data: null, error };
  }
};

export const getNotifications = async () => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.data.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { data: null, error };
  }
};

export const markNotificationRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { data: null, error };
  }
};

// ============================================================
// POLICY FUNCTIONS
// ============================================================

export const getPolicies = async () => {
  try {
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .order('name');

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching policies:', error);
    return { data: null, error };
  }
};

// ============================================================
// REGION PROGRESS FUNCTIONS
// ============================================================

export const getRegionProgressSummary = async (regionId) => {
  try {
    const { data, error } = await supabase
      .from('compliance_progress')
      .select('*')
      .eq('region_id', regionId);

    if (error) throw error;

    const total = data?.length || 0;
    const open = data?.filter(p => p.status === 'Open').length || 0;
    const submitted = data?.filter(p => p.status === 'Submitted/Under Review').length || 0;
    const closed = data?.filter(p => p.status === 'Closed').length || 0;

    const overdue = data?.filter(p => {
      if (p.status === 'Closed') return false;
      const dueDate = p.calculated_due_date || p.occurrence_date;
      return dueDate && new Date(dueDate) < new Date();
    }).length || 0;

    return {
      total,
      open,
      submitted,
      closed,
      overdue,
      completionRate: total > 0 ? Math.round((closed / total) * 100) : 0
    };
  } catch (error) {
    console.error('Error fetching region progress summary:', error);
    return { total: 0, open: 0, submitted: 0, closed: 0, overdue: 0, completionRate: 0 };
  }
};

export const getObligationProgressByRegion = async (obligationId, regionId) => {
  try {
    const { data, error } = await supabase
      .from('compliance_progress')
      .select('*')
      .eq('obligation_id', obligationId)
      .eq('region_id', regionId)
      .order('occurrence_date', { ascending: false })
      .limit(1);

    if (error) throw error;
    return { data: data?.[0] || null, error: null };
  } catch (error) {
    console.error('Error fetching obligation progress by region:', error);
    return { data: null, error };
  }
};

export const createProgressRecord = async (obligationId, regionId, occurrenceDate, status = 'Open', comments = null) => {
  try {
    const { data: obligation, error: obligationError } = await supabase
      .from('compliance_obligations')
      .select('frequency, calculated_due_date')
      .eq('obligation_id', obligationId)
      .single();

    if (obligationError) throw obligationError;

    let calculatedDueDate = null;
    const occurrenceDateObj = new Date(occurrenceDate);

    if (obligation.frequency === 'Monthly') {
      calculatedDueDate = new Date(occurrenceDateObj.getFullYear(), occurrenceDateObj.getMonth(), 25);
    } else if (obligation.frequency === 'Quarterly') {
      const quarterMonth = Math.ceil((occurrenceDateObj.getMonth() + 1) / 3) * 3;
      calculatedDueDate = new Date(occurrenceDateObj.getFullYear(), quarterMonth - 1, 25);
    } else if (obligation.frequency === 'Bi-Annual') {
      const month = occurrenceDateObj.getMonth();
      const lastMonth = month < 6 ? 5 : 11;
      calculatedDueDate = new Date(occurrenceDateObj.getFullYear(), lastMonth, 25);
    } else if (obligation.frequency === 'Annual' || obligation.frequency === 'Yearly') {
      calculatedDueDate = new Date(occurrenceDateObj.getFullYear(), 11, 25);
    } else if (obligation.frequency === 'Event Based') {
      calculatedDueDate = new Date(occurrenceDateObj);
      calculatedDueDate.setDate(calculatedDueDate.getDate() + 2);
    } else {
      calculatedDueDate = new Date(occurrenceDateObj.getFullYear(), occurrenceDateObj.getMonth(), 25);
    }

    const { data, error } = await supabase
      .from('compliance_progress')
      .insert({
        obligation_id: obligationId,
        region_id: regionId,
        occurrence_date: occurrenceDate,
        calculated_due_date: calculatedDueDate.toISOString().split('T')[0],
        status: status,
        comments: comments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return { data: data?.[0] || null, error: null };
  } catch (error) {
    console.error('Error creating progress record:', error);
    return { data: null, error };
  }
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

export default {
  getRegionId,
  getRegionName,
  getObligations,
  getObligationById,
  getObligationByObligationId,
  generateOccurrences,
  getOccurrencesForMonth,
  updateOccurrenceStatus,
  getPendingApprovals,
  getApprovedOccurrences,
  approveOccurrence,
  rejectOccurrence,
  submitOccurrenceForReview,
  uploadEvidenceForOccurrence,
  getEvidence,
  addActivityHistory,
  getActivityHistory,
  getDashboardStats,
  getComplianceByDomain,
  getUpcomingDeadlines,
  getRegions,
  getUsers,
  getRegionProgressSummary,
  getObligationProgressByRegion,
  createProgressRecord,
  createNotification,
  getNotifications,
  markNotificationRead,
  getPolicies,
}