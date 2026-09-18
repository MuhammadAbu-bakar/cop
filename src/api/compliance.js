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

// ============================================================
// CALCULATE DUE DATE FOR A GIVEN PERIOD
// This is the KEY function that ensures evidence is tied to the
// correct due date month, not just the upload date.
// ============================================================

export const calculateDueDateForPeriod = (frequency, referenceDate = new Date(), dueDateRule = null) => {
  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Parse due day from rule if possible (e.g., "25th of month", "End of month")
  let dueDay = 25; // default
  if (dueDateRule) {
    const dayMatch = dueDateRule.match(/(\d{1,2})/);
    if (dayMatch) {
      dueDay = parseInt(dayMatch[1]);
    } else if (dueDateRule.toLowerCase().includes('end')) {
      dueDay = new Date(year, month + 1, 0).getDate();
    }
  }

  let occurrenceDate, calculatedDueDate;

  switch (frequency) {
    case 'Monthly':
      occurrenceDate = new Date(year, month, 1);
      calculatedDueDate = new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));
      break;

    case 'Quarterly': {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      occurrenceDate = new Date(year, quarterStartMonth, 1);
      const lastMonthOfQuarter = quarterStartMonth + 2;
      calculatedDueDate = new Date(year, lastMonthOfQuarter, Math.min(dueDay, new Date(year, lastMonthOfQuarter + 1, 0).getDate()));
      break;
    }

    case 'Bi-Annual': {
      const halfStartMonth = month < 6 ? 0 : 6;
      occurrenceDate = new Date(year, halfStartMonth, 1);
      const lastMonthOfHalf = halfStartMonth + 5;
      calculatedDueDate = new Date(year, lastMonthOfHalf, Math.min(dueDay, new Date(year, lastMonthOfHalf + 1, 0).getDate()));
      break;
    }

    case 'Annual':
    case 'Yearly':
      occurrenceDate = new Date(year, 0, 1);
      calculatedDueDate = new Date(year, 11, Math.min(dueDay, 31));
      break;

    case 'Event Based':
      occurrenceDate = new Date(year, month, 1);
      calculatedDueDate = new Date(date);
      calculatedDueDate.setDate(calculatedDueDate.getDate() + 2);
      break;

    default:
      occurrenceDate = new Date(year, month, 1);
      calculatedDueDate = new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));
  }

  return {
    occurrence_date: occurrenceDate.toISOString().split('T')[0],
    calculated_due_date: calculatedDueDate.toISOString().split('T')[0]
  };
};

// ============================================================
// FIND OR CREATE PROGRESS RECORD FOR THE CURRENT DUE PERIOD
// This ensures evidence is always attached to the correct month
// ============================================================

export const findOrCreateProgressForPeriod = async (obligationId, regionId, frequency, dueDateRule = null) => {
  try {
    const { occurrence_date, calculated_due_date } = calculateDueDateForPeriod(frequency, new Date(), dueDateRule);

    console.log(`🔍 Finding/creating progress for obligation ${obligationId}, region ${regionId}`);
    console.log(`📅 Period: ${occurrence_date} to ${calculated_due_date}`);

    // Try to find existing progress for this exact occurrence_date
    const { data: existing, error: findError } = await supabase
      .from('compliance_progress')
      .select('*')
      .eq('obligation_id', obligationId)
      .eq('region_id', regionId)
      .eq('occurrence_date', occurrence_date)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (existing) {
      console.log(`✅ Found existing progress: ${existing.id}`);
      return { data: existing, error: null, created: false };
    }

    // Create new progress record
    const { data: created, error: insertError } = await supabase
      .from('compliance_progress')
      .insert({
        obligation_id: obligationId,
        region_id: regionId,
        occurrence_date: occurrence_date,
        calculated_due_date: calculated_due_date,
        status: 'Open',
        approval_level: 'regional',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`✅ Created new progress: ${created.id} for period ${occurrence_date}`);
    return { data: created, error: null, created: true };

  } catch (error) {
    console.error('Error finding/creating progress for period:', error);
    return { data: null, error };
  }
};

// ============================================================
// GET OBLIGATIONS
// ============================================================

export const getObligations = async (
  filters = {},
  userRegion = null,
  isAdmin = false
) => {
  try {
    console.log('🔍 getObligations called with:', { filters, userRegion, isAdmin });

    let userRegionId = null;
    if (!isAdmin && userRegion) {
      userRegionId = await getRegionId(userRegion);
      console.log(`👤 User region: ${userRegion} (ID: ${userRegionId})`);
    }

    const monthValue = filters.month || '';
    const yearValue = filters.year || '';
    
    const hasMonthFilter = monthValue !== '' && monthValue !== 'all' && 
                           yearValue !== '' && yearValue !== 'all';
    
    console.log(`📅 Month filter active: ${hasMonthFilter}, Month: ${monthValue}, Year: ${yearValue}`);

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
          updated_at,
          approval_level,
          manager_approved_by,
          manager_approved_at,
          admin_approved_by,
          admin_approved_at
        `)
        .range(pageStart, pageStart + PAGE_SIZE - 1);

      if (!isAdmin && userRegionId) {
        progressQuery = progressQuery.eq("region_id", userRegionId);
      }

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
          progressQuery = progressQuery
            .gte("occurrence_date", `${year}-01-01`)
            .lte("occurrence_date", `${year}-12-31`);
          console.log(`📅 Filtering by year: ${year}`);
        }
      }

      progressQuery = progressQuery.order("occurrence_date", { ascending: false });

      const { data: progressData, error: progressError } = await progressQuery;

      if (progressError) throw progressError;

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

    const obligationIds = [...new Set(allProgressData.map(p => p.obligation_id))];
    console.log(`📋 Found ${obligationIds.length} unique obligation IDs in progress`);

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

    if (obligationsError) throw obligationsError;

    console.log(`📋 Found ${obligations?.length || 0} obligation details`);

    if (!obligations || obligations.length === 0) {
      return { data: [], error: null };
    }

    const obligationMap = {};
    obligations.forEach(obligation => {
      obligationMap[obligation.obligation_id] = obligation;
    });

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
          approval_level: latestProgress?.approval_level || 'regional',
          manager_approved_by: latestProgress?.manager_approved_by || null,
          manager_approved_at: latestProgress?.manager_approved_at || null,
          admin_approved_by: latestProgress?.admin_approved_by || null,
          admin_approved_at: latestProgress?.admin_approved_at || null,
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
          approval_level: progress.approval_level || 'regional',
          manager_approved_by: progress.manager_approved_by || null,
          manager_approved_at: progress.manager_approved_at || null,
          admin_approved_by: progress.admin_approved_by || null,
          admin_approved_at: progress.admin_approved_at || null,
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
        console.log(`  ${idx + 1}. ${item.obligation_id} - ${item.obligation_name} - Due: ${item.calculated_due_date} - Status: ${item.current_status} - Approval: ${item.approval_level}`);
      });
    }

    console.log(`✅ Returning ${finalData.length} records`);
    return { data: finalData, error: null };

  } catch (error) {
    console.error("❌ Error fetching obligations:", error);
    return { data: null, error };
  }
};

// ============================================================
// GET SINGLE OBLIGATION
// ============================================================

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
        data.approval_level = latestProgress.approval_level || 'regional';
        data.manager_approved_by = latestProgress.manager_approved_by || null;
        data.manager_approved_at = latestProgress.manager_approved_at || null;
        data.admin_approved_by = latestProgress.admin_approved_by || null;
        data.admin_approved_at = latestProgress.admin_approved_at || null;
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching obligation by ID:', error);
    return { data: null, error };
  }
}

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
        data.approval_level = latestProgress.approval_level || 'regional';
        data.manager_approved_by = latestProgress.manager_approved_by || null;
        data.manager_approved_at = latestProgress.manager_approved_at || null;
        data.admin_approved_by = latestProgress.admin_approved_by || null;
        data.admin_approved_at = latestProgress.admin_approved_at || null;
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
        approval_level: 'regional',
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
        approval_level: 'regional',
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
// TWO-LEVEL APPROVAL FUNCTIONS
// ============================================================

export const submitForRegionalApproval = async (progressId, evidenceId = null) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const updateData = {
      status: 'Submitted/Under Review',
      approval_level: 'regional',
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
        `Evidence uploaded - Waiting for Regional Manager approval`,
        `Submitted by ${user.data.user.email}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error submitting for regional approval:', error);
    return { data: null, error };
  }
};

export const managerApprove = async (progressId, comment = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Submitted/Under Review',
        approval_level: 'manager',
        manager_approved_by: user.data.user.id,
        manager_approved_at: new Date().toISOString(),
        comments: comment || 'Approved by Regional Manager',
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
        `Regional Manager approved - Waiting for Admin approval`,
        `Approved by ${user.data.user.email}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in manager approval:', error);
    return { data: null, error };
  }
};

export const managerReject = async (progressId, reason = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Open',
        approval_level: 'regional',
        comments: reason || 'Rejected by Regional Manager, please resubmit',
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
        `Regional Manager rejected - Please resubmit`,
        `Rejected by ${user.data.user.email}: ${reason}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in manager rejection:', error);
    return { data: null, error };
  }
};

export const adminFinalApprove = async (progressId, comment = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Closed',
        approval_level: 'admin',
        admin_approved_by: user.data.user.id,
        admin_approved_at: new Date().toISOString(),
        comments: comment || 'Final approved by Admin',
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
        `Admin final approved - Occurrence closed`,
        `Approved by ${user.data.user.email}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in admin final approval:', error);
    return { data: null, error };
  }
};

export const adminReject = async (progressId, reason = '') => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    const { data, error } = await supabase
      .from('compliance_progress')
      .update({
        status: 'Submitted/Under Review',
        approval_level: 'manager',
        comments: reason || 'Rejected by Admin, please review',
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
        `Admin rejected - Sent back to Regional Manager`,
        `Rejected by ${user.data.user.email}: ${reason}`
      );
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in admin rejection:', error);
    return { data: null, error };
  }
};

// ============================================================
// PENDING APPROVALS
// ============================================================

export const getManagerPendingApprovals = async (userRegion = null, isAdmin = false) => {
  try {
    console.log('🔍 [getManagerPendingApprovals] START');

    let regionId = null;
    if (userRegion) {
      const { data, error } = await supabase
        .from('regions')
        .select('id')
        .eq('name', userRegion)
        .single();
      
      if (!error && data) {
        regionId = data.id;
        console.log('📍 Found region ID:', regionId);
      } else {
        console.error('❌ Region not found:', userRegion);
        return { data: [], error: null };
      }
    }

    let query = supabase
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
        ),
        evidence!compliance_progress_evidence_id_fkey(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by
        ),
        region:regions(id, name, code)
      `)
      .eq('status', 'Submitted/Under Review')
      .eq('approval_level', 'regional')
      .order('updated_at', { ascending: false });

    if (regionId) {
      query = query.eq('region_id', regionId);
      console.log('🔍 Filtering by region_id:', regionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Query error:', error);
      return { data: [], error };
    }

    console.log(`✅ Found ${data?.length || 0} manager pending approvals`);
    return { data: data || [], error: null };
  } catch (error) {
    console.error('❌ Error in getManagerPendingApprovals:', error);
    return { data: [], error };
  }
};

export const getAdminPendingApprovals = async (userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
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
        ),
        evidence!compliance_progress_evidence_id_fkey(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by
        ),
        region:regions(id, name, code)
      `)
      .eq('status', 'Submitted/Under Review')
      .eq('approval_level', 'manager')
      .order('updated_at', { ascending: false });

    if (userRegion && !isAdmin) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Admin query error:', error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching admin pending approvals:', error);
    return { data: [], error };
  }
};

export const getApprovalHistory = async (progressId) => {
  try {
    const { data, error } = await supabase
      .from('compliance_progress')
      .select(`
        id,
        status,
        approval_level,
        manager_approved_by,
        manager_approved_at,
        admin_approved_by,
        admin_approved_at,
        updated_by,
        updated_at,
        comments,
        manager:profiles!compliance_progress_manager_approved_by_fkey(
          id,
          full_name,
          email
        ),
        admin:profiles!compliance_progress_admin_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('id', progressId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching approval history:', error);
    return { data: null, error };
  }
};

// ============================================================
// LEGACY APPROVAL FUNCTIONS
// ============================================================

export const getPendingApprovals = async (userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
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
        ),
        evidence!compliance_progress_evidence_id_fkey(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by
        ),
        region:regions(id, name, code)
      `)
      .eq('status', 'Submitted/Under Review')
      .order('updated_at', { ascending: false });

    if (userRegion && !isAdmin) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Pending approvals query error:', error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { data: [], error };
  }
};

export const getApprovedOccurrences = async (userRegion = null, isAdmin = false) => {
  try {
    let query = supabase
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
        ),
        evidence!compliance_progress_evidence_id_fkey(
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by
        ),
        region:regions(id, name, code)
      `)
      .eq('status', 'Closed')
      .order('updated_at', { ascending: false });

    if (userRegion && !isAdmin) {
      const regionId = await getRegionId(userRegion);
      if (regionId) {
        query = query.eq('region_id', regionId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Approved query error:', error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching approved occurrences:', error);
    return { data: [], error };
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
        approval_level: 'admin',
        admin_approved_by: user.data.user.id,
        admin_approved_at: new Date().toISOString(),
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
        approval_level: 'regional',
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
      approval_level: 'regional',
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
        `Evidence uploaded - Submitted for Regional Manager review`,
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
// EVIDENCE FUNCTIONS - UPDATED FOR CORRECT MONTH BINDING
// ============================================================

export const uploadEvidenceForOccurrence = async (file, progressId, obligationId, regionId, userRegion = null, isAdmin = false) => {
  try {
    const user = await supabase.auth.getUser();
    if (user.error) throw user.error;

    if (!isAdmin && !userRegion) {
      throw new Error('Your profile does not have a region assigned. Please contact your administrator.');
    }

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
        obligation_id: obligationId,
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
          approval_level: 'regional',
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
        `Evidence uploaded - Waiting for Regional Manager approval`,
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
    let query = supabase
      .from('evidence')
      .select(`
        *,
        progress:compliance_progress!evidence_occurrence_id_fkey(
          id,
          occurrence_date,
          status,
          region_id,
          approval_level
        )
      `)
      .eq('obligation_id', obligationId)
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
};

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
// DASHBOARD STATS (unchanged)
// ============================================================

export const getDashboardStats = async (userRegion = null, isAdmin = false) => {
  // ... (same as original, keeping it unchanged for brevity)
  // This function was already correct in your original code
  // I'll keep the full implementation from your original file
  try {
    console.log("=================================================");
    console.log("🔍 [DashboardStats] START");
    console.log("👤 User Region:", userRegion);
    console.log("👑 Is Admin:", isAdmin);
    console.log("=================================================");

    let regionId = null;

    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
      console.log("👤 Regional User:", userRegion, "| Region ID:", regionId);

      if (!regionId) {
        console.warn("⚠️ Could not find region ID for:", userRegion);
        return {
          overallCompliance: 0, auditReadiness: 0, totalObligations: 0,
          completed: 0, pending: 0, overdue: 0, inProgress: 0, notStarted: 0,
          highRiskGaps: 0, regionsBelowTarget: 0, regionsTotal: 1,
          evidenceCompletion: 0, mandatoryObligations: 0, totalOccurrences: 0
        };
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const { data: obligations, error: obligationsError } = await supabase
      .from("compliance_obligations")
      .select(`obligation_id, compliance_weight, obligation_type, mandatory`);

    if (obligationsError) throw obligationsError;

    const PAGE_SIZE = 1000;
    let progressData = [];
    let pageStart = 0;

    while (true) {
      let progressQuery = supabase
        .from("compliance_progress")
        .select("*")
        .lte("occurrence_date", todayStr)
        .order("occurrence_date", { ascending: false })
        .range(pageStart, pageStart + PAGE_SIZE - 1);

      if (!isAdmin && regionId) {
        progressQuery = progressQuery.eq("region_id", regionId);
      }

      const { data: pageData, error: pageError } = await progressQuery;
      if (pageError) throw pageError;
      if (!pageData || pageData.length === 0) break;

      progressData.push(...pageData);
      if (pageData.length < PAGE_SIZE) break;
      pageStart += PAGE_SIZE;
    }

    if (!progressData || progressData.length === 0) {
      return {
        overallCompliance: 0, auditReadiness: 0, totalObligations: 0,
        completed: 0, pending: 0, overdue: 0, inProgress: 0, notStarted: 0,
        highRiskGaps: 0, regionsBelowTarget: 0,
        regionsTotal: isAdmin ? 0 : 1,
        evidenceCompletion: 0, mandatoryObligations: 0, totalOccurrences: 0
      };
    }

    const totalProgressRecords = progressData.length;
    const closedRecords = progressData.filter((p) => p.status === "Closed").length;
    const submittedRecords = progressData.filter((p) => p.status === "Submitted/Under Review").length;
    const openRecords = progressData.filter((p) => p.status === "Open").length;

    const overdueRecords = progressData.filter((p) => {
      if (p.status === "Closed") return false;
      const dueDate = p.calculated_due_date || p.occurrence_date;
      if (!dueDate) return false;
      const dueDateObj = new Date(dueDate);
      dueDateObj.setHours(0, 0, 0, 0);
      return dueDateObj < today;
    }).length;

    const notStarted = Math.max(0, openRecords - overdueRecords);
    const uniqueObligationIds = new Set(progressData.map((p) => p.obligation_id));
    const totalUniqueObligations = uniqueObligationIds.size;

    const overallCompliance = totalProgressRecords > 0
      ? Number(((closedRecords / totalProgressRecords) * 100).toFixed(1)) : 0;

    const auditReadiness = totalProgressRecords > 0
      ? Number(((closedRecords + submittedRecords) / totalProgressRecords * 100).toFixed(1)) : 0;

    const obligationsMap = {};
    (obligations || []).forEach((obligation) => {
      obligationsMap[obligation.obligation_id] = Number(obligation.compliance_weight) || 1;
    });

    let totalWeight = 0;
    let achievedWeight = 0;

    progressData.forEach((progress) => {
      const weight = obligationsMap[progress.obligation_id] || 1;
      totalWeight += weight;
      if (progress.status === "Closed") achievedWeight += weight;
    });

    const overallWeightedCompliance = totalWeight > 0
      ? Number((achievedWeight / totalWeight * 100).toFixed(1)) : 0;

    const progressWithEvidence = progressData.filter(
      (p) => p.evidence_id !== null && p.evidence_id !== undefined
    ).length;

    const evidenceCompletion = totalProgressRecords > 0
      ? Number((progressWithEvidence / totalProgressRecords * 100).toFixed(1)) : 0;

    const mandatoryObligationIds = new Set(
      (obligations || []).filter((o) => o.mandatory === true).map((o) => o.obligation_id)
    );

    const mandatoryObligations = [...uniqueObligationIds].filter(
      (id) => mandatoryObligationIds.has(id)
    ).length;

    let regionsBelowTarget = 0;
    let regionsTotal = 0;

    if (isAdmin) {
      const { data: allRegions, error: regionsError } = await supabase
        .from("regions").select("id, name");

      if (!regionsError && allRegions) {
        regionsTotal = allRegions.length;
        for (const region of allRegions) {
          const regionProgress = progressData.filter((p) => p.region_id === region.id);
          const regionTotal = regionProgress.length;
          const regionClosed = regionProgress.filter((p) => p.status === "Closed").length;
          const regionCompliance = regionTotal > 0 ? (regionClosed / regionTotal) * 100 : 0;
          if (regionTotal > 0 && regionCompliance < 80) regionsBelowTarget++;
        }
      }
    } else {
      regionsTotal = 1;
      if (totalProgressRecords > 0) {
        const regionCompliance = (closedRecords / totalProgressRecords) * 100;
        if (regionCompliance < 80) regionsBelowTarget = 1;
      }
    }

    return {
      overallCompliance: totalWeight > 0 ? overallWeightedCompliance : overallCompliance,
      auditReadiness, totalObligations: totalUniqueObligations,
      completed: closedRecords, pending: openRecords, overdue: overdueRecords,
      inProgress: submittedRecords, notStarted, highRiskGaps: overdueRecords,
      regionsBelowTarget, regionsTotal, evidenceCompletion,
      mandatoryObligations, totalOccurrences: totalProgressRecords
    };
  } catch (error) {
    console.error("❌ [DashboardStats] ERROR:", error);
    return {
      overallCompliance: 0, auditReadiness: 0, totalObligations: 0,
      completed: 0, pending: 0, overdue: 0, inProgress: 0, notStarted: 0,
      highRiskGaps: 0, regionsBelowTarget: 0, regionsTotal: 0,
      evidenceCompletion: 0, mandatoryObligations: 0, totalOccurrences: 0
    };
  }
};

// ============================================================
// COMPLIANCE BY DOMAIN (unchanged)
// ============================================================

export const getComplianceByDomain = async (userRegion = null, isAdmin = false) => {
  // ... (same as original, keeping it unchanged)
  try {
    console.log('🔍 [ComplianceByDomain] ========== START ==========');

    let regionId = null;
    if (!isAdmin && userRegion) {
      regionId = await getRegionId(userRegion);
    }

    const { data: obligations, error: obligationsError } = await supabase
      .from('compliance_obligations')
      .select('obligation_id, domain, compliance_weight, obligation_type');

    if (obligationsError) throw obligationsError;
    if (!obligations || obligations.length === 0) {
      return { domains: [], compliance: [] };
    }

    const obligationIds = obligations.map(o => o.obligation_id);
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
      }

      const { data: pageData, error: pageError } = await progressQuery;
      if (pageError) throw pageError;
      if (!pageData || pageData.length === 0) { hasMore = false; break; }

      allProgressData.push(...pageData);
      if (pageData.length < PAGE_SIZE) hasMore = false;
      else pageStart += PAGE_SIZE;
    }

    const obligationIdSet = new Set(obligationIds);
    const progressData = allProgressData?.filter(p => obligationIdSet.has(p.obligation_id)) || [];

    const latestStatusMap = {};
    
    if (progressData) {
      if (isAdmin) {
        const obligationStatuses = {};
        progressData.forEach(p => {
          if (!obligationStatuses[p.obligation_id]) obligationStatuses[p.obligation_id] = [];
          obligationStatuses[p.obligation_id].push({
            status: p.status, date: p.occurrence_date, region_id: p.region_id
          });
        });

        for (const [obligationId, statuses] of Object.entries(obligationStatuses)) {
          const hasClosed = statuses.some(s => s.status === 'Closed');
          if (hasClosed) {
            const closedRecords = statuses.filter(s => s.status === 'Closed');
            const mostRecentClosed = closedRecords.reduce((a, b) => 
              new Date(a.date) > new Date(b.date) ? a : b
            );
            latestStatusMap[obligationId] = {
              status: 'Closed', date: mostRecentClosed.date, region_id: mostRecentClosed.region_id
            };
          } else {
            const mostRecent = statuses.reduce((a, b) => 
              new Date(a.date) > new Date(b.date) ? a : b
            );
            latestStatusMap[obligationId] = {
              status: mostRecent.status, date: mostRecent.date, region_id: mostRecent.region_id
            };
          }
        }
      } else {
        progressData.forEach(p => {
          const obligationId = p.obligation_id;
          const current = latestStatusMap[obligationId];
          
          if (!current) {
            latestStatusMap[obligationId] = {
              status: p.status, date: p.occurrence_date, region_id: p.region_id
            };
          } else if (p.status === 'Closed' && current.status !== 'Closed') {
            latestStatusMap[obligationId] = {
              status: p.status, date: p.occurrence_date, region_id: p.region_id
            };
          } else if (current.status !== 'Closed' && 
                     new Date(p.occurrence_date) > new Date(current.date)) {
            latestStatusMap[obligationId] = {
              status: p.status, date: p.occurrence_date, region_id: p.region_id
            };
          }
        });
      }
    }

    const domainMap = {};
    
    obligations.forEach(o => {
      const domain = o.domain || 'Uncategorized';
      
      if (!domainMap[domain]) {
        domainMap[domain] = { 
          totalWeight: 0, achievedWeight: 0,
          totalObligations: 0, closedObligations: 0, obligationIds: []
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
      }
    });

    const domains = [];
    const compliance = [];
    const details = {};

    for (const [domain, data] of Object.entries(domainMap)) {
      domains.push(domain);
      let percentage = 0;
      
      if (data.totalWeight > 0) {
        percentage = parseFloat(((data.achievedWeight / data.totalWeight) * 100).toFixed(1));
      }
      
      compliance.push(percentage);
      details[domain] = {
        total: data.totalObligations, closed: data.closedObligations,
        totalWeight: data.totalWeight, achievedWeight: data.achievedWeight,
        percentage: percentage, obligationIds: data.obligationIds
      };
    }

    const sortedIndices = domains.map((_, i) => i).sort((a, b) => compliance[b] - compliance[a]);
    const sortedDomains = sortedIndices.map(i => domains[i]);
    const sortedCompliance = sortedIndices.map(i => compliance[i]);

    return { 
      domains: sortedDomains, 
      compliance: sortedCompliance,
      details: details
    };
  } catch (error) {
    console.error('❌ [ComplianceByDomain] Error:', error);
    return { domains: [], compliance: [] };
  }
};

// ============================================================
// UPCOMING DEADLINES
// ============================================================

export const getUpcomingDeadlines = async (userRegion = null, isAdmin = false) => {
  try {
    const { data: obligations, error } = await supabase
      .from('compliance_obligations').select('*');
    
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
        
        if (!progressError && progress) progressData = progress;
      }
    } else if (isAdmin) {
      const { data: progress, error: progressError } = await supabase
        .from('compliance_progress')
        .select('*')
        .eq('status', 'Open')
        .order('calculated_due_date', { ascending: true });
      
      if (!progressError && progress) progressData = progress;
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
      .from('regions').select('*').order('name');
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
      .from('profiles').select('*').order('full_name');
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
      .insert({ user_id: userId, title, message, type, link })
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
      .from('notifications').select('*')
      .eq('user_id', user.data.user.id)
      .order('created_at', { ascending: false }).limit(50);

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
      .from('notifications').update({ read: true })
      .eq('id', notificationId).select();
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
      .from('policies').select('*').order('name');
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
      .from('compliance_progress').select('*').eq('region_id', regionId);
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
      total, open, submitted, closed, overdue,
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
        approval_level: 'regional',
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
// EXPORTS
// ============================================================

export default {
  getRegionId,
  getRegionName,
  calculateDueDateForPeriod,
  findOrCreateProgressForPeriod,
  getObligations,
  getObligationById,
  getObligationByObligationId,
  generateOccurrences,
  getOccurrencesForMonth,
  updateOccurrenceStatus,
  submitForRegionalApproval,
  managerApprove,
  managerReject,
  adminFinalApprove,
  adminReject,
  getManagerPendingApprovals,
  getAdminPendingApprovals,
  getApprovalHistory,
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