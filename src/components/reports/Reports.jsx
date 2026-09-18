import { useState, useEffect } from "react";
import {
  getObligations,
  getDashboardStats,
  getComplianceByDomain,
  getRegions,
  getEvidence,
} from "../../api/compliance";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";
import JSZip from "jszip";
import { toast } from 'react-toastify';

const Reports = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [stats, setStats] = useState({});
  const [domainData, setDomainData] = useState({ domains: [], compliance: [] });
  const [downloading, setDownloading] = useState(false);
  const [allEvidence, setAllEvidence] = useState([]);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState([]);

  // Filter states
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [selectedClause, setSelectedClause] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedObligationId, setSelectedObligationId] = useState("");

  // Available options for filters
  const [domains, setDomains] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [clauses, setClauses] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [allRegionOptions, setAllRegionOptions] = useState([]);
  const [obligationIdOptions, setObligationIdOptions] = useState([]);
  const [allObligationIdOptions, setAllObligationIdOptions] = useState([]);
  const [months] = useState([
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]);
  const [years, setYears] = useState([]);

  // Get region ID from region name
  const getRegionId = async (regionName) => {
    if (!regionName) return null;
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id')
        .eq('name', regionName)
        .single();

      if (error) return null;
      return data?.id || null;
    } catch (error) {
      console.error('Error getting region ID:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchFilterOptions();
    fetchReportData();
  }, []);

  useEffect(() => {
    if (
      selectedDomain ||
      selectedPolicy ||
      selectedClause ||
      selectedRegion ||
      selectedMonth ||
      selectedYear ||
      selectedObligationId
    ) {
      fetchReportData();
    }
  }, [
    selectedDomain,
    selectedPolicy,
    selectedClause,
    selectedRegion,
    selectedMonth,
    selectedYear,
    selectedObligationId,
  ]);

  // Cascading filter effect
  useEffect(() => {
    if (selectedDomain) {
      updateFiltersBasedOnDomain(selectedDomain);
    } else {
      setPolicies(allPolicies);
      setClauses(allClauses);
      setObligationIdOptions(allObligationIdOptions);
    }
  }, [selectedDomain]);

  const fetchFilterOptions = async () => {
    try {
      const { data: obligationsData, error: obligationsError } = await supabase
        .from('compliance_obligations')
        .select('domain, clause, policy, obligation_type, obligation_id')
        .order('domain');

      if (obligationsError) {
        console.error('Error fetching obligations for filters:', obligationsError);
        toast.error('Failed to load filter options');
        return;
      }

      if (obligationsData) {
        const uniqueDomains = [...new Set(obligationsData.map((o) => o.domain).filter(Boolean))];
        setDomains(uniqueDomains);

        const uniqueClauses = [...new Set(obligationsData.map((o) => o.clause).filter(Boolean))];
        setAllClauses(uniqueClauses);
        setClauses(uniqueClauses);

        const uniqueObligationIds = [
          ...new Set(obligationsData.map((o) => o.obligation_id).filter(Boolean)),
        ];
        setAllObligationIdOptions(uniqueObligationIds);
        setObligationIdOptions(uniqueObligationIds);
      }

      const { data: policiesData, error: policiesError } = await supabase
        .from('policies')
        .select('id, name')
        .order('name');

      if (policiesError) {
        console.error('Error fetching policies:', policiesError);
      } else if (policiesData) {
        setAllPolicies(policiesData);
        setPolicies(policiesData);
      }

      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');

      if (regionsError) {
        console.error('Error fetching regions:', regionsError);
      } else if (regionsData) {
        const regionNames = regionsData.map((r) => r.name);
        setAllRegionOptions(regionNames);
        setRegionOptions(regionNames);
      }

      const currentYear = new Date().getFullYear();
      const yearOptions = [];
      for (let i = currentYear - 4; i <= currentYear; i++) {
        yearOptions.push({ value: i.toString(), label: i.toString() });
      }
      setYears(yearOptions);

      toast.success('Filters loaded successfully');
    } catch (error) {
      console.error('Error fetching filter options:', error);
      toast.error('Failed to load filter options');
    }
  };

  const updateFiltersBasedOnDomain = async (domain) => {
    try {
      const { data: domainObligations, error } = await supabase
        .from('compliance_obligations')
        .select('clause, policy, obligation_id')
        .eq('domain', domain);

      if (error) throw error;

      if (domainObligations) {
        const policyNames = [
          ...new Set(domainObligations.map((o) => o.policy).filter(Boolean)),
        ];
        const filteredPolicies = allPolicies.filter((p) => policyNames.includes(p.name));
        setPolicies(filteredPolicies);

        const uniqueClauses = [...new Set(domainObligations.map((o) => o.clause).filter(Boolean))];
        setClauses(uniqueClauses);

        const uniqueObligationIds = [
          ...new Set(domainObligations.map((o) => o.obligation_id).filter(Boolean)),
        ];
        setObligationIdOptions(uniqueObligationIds);

        if (selectedPolicy && !filteredPolicies.some((p) => p.id === selectedPolicy)) {
          setSelectedPolicy("");
        }
        if (selectedClause && !uniqueClauses.includes(selectedClause)) {
          setSelectedClause("");
        }
        if (selectedObligationId && !uniqueObligationIds.includes(selectedObligationId)) {
          setSelectedObligationId("");
        }
      }
    } catch (error) {
      console.error('Error updating filters based on domain:', error);
    }
  };

  // ============================================================
  // FETCH REPORT DATA — Evidence is scoped by occurrence_id
  // so it only shows in its due-date month.
  // ============================================================
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (selectedDomain) filters.domain = selectedDomain;
      if (selectedPolicy) filters.policy = selectedPolicy;
      if (selectedClause) filters.clause = selectedClause;
      if (selectedMonth) filters.month = selectedMonth;
      if (selectedYear) filters.year = selectedYear;
      if (selectedObligationId) filters.obligation_id = selectedObligationId;

      console.log('📊 Fetching report data with filters:', filters);

      const obligationsResult = await getObligations(filters, userRegion, isAdmin);

      const [statsData, domainData, regionsData] = await Promise.all([
        getDashboardStats(userRegion, isAdmin),
        getComplianceByDomain(userRegion, isAdmin),
        getRegions(),
      ]);

      setStats(statsData);
      setDomainData(domainData);
      setRegions(regionsData.data || []);

      let obligationsList = obligationsResult.data || [];
      setObligations(obligationsList);

      // ============================================================
      // FETCH EVIDENCE — only for progress records that match the
      // current filters. Each evidence row is bound to ONE occurrence.
      // ============================================================
      let evidenceData = [];
      let breakdown = [];

      if (obligationsList.length > 0) {
        const obligationIds = obligationsList.map((o) => o.obligation_id);

        let progressQuery = supabase
          .from('compliance_progress')
          .select('id, obligation_id, region_id, occurrence_date, calculated_due_date, status, approval_level')
          .in('obligation_id', obligationIds);

        if (!isAdmin && userRegion) {
          const rid = await getRegionId(userRegion);
          if (rid) progressQuery = progressQuery.eq('region_id', rid);
        }

        if (selectedRegion) {
          const rid = await getRegionId(selectedRegion);
          if (rid) progressQuery = progressQuery.eq('region_id', rid);
        }

        // Filter by occurrence_date (the period the obligation is FOR)
        if (selectedMonth && selectedYear) {
          const y = parseInt(selectedYear);
          const m = parseInt(selectedMonth);
          const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
          const end = new Date(y, m, 0).toISOString().split('T')[0];
          progressQuery = progressQuery
            .gte('occurrence_date', start)
            .lte('occurrence_date', end);
        } else if (selectedYear) {
          const y = parseInt(selectedYear);
          progressQuery = progressQuery
            .gte('occurrence_date', `${y}-01-01`)
            .lte('occurrence_date', `${y}-12-31`);
        }

        const { data: progressData, error: progressError } = await progressQuery;
        if (progressError) console.error('Error fetching progress:', progressError);

        if (progressData && progressData.length > 0) {
          const progressById = {};
          progressData.forEach((p) => {
            progressById[p.id] = p;
          });

          // Evidence ONLY for those filtered progress records.
          // If selectedObligationId is set, further narrow by obligation.
          let evidenceQuery = supabase
            .from('evidence')
            .select('*')
            .in('occurrence_id', progressData.map((p) => p.id))
            .order('uploaded_at', { ascending: false });

          if (selectedObligationId) {
            evidenceQuery = evidenceQuery.eq('obligation_id', selectedObligationId);
          }

          const { data: evidenceResult, error: evidenceError } = await evidenceQuery;

          if (evidenceError) {
            console.error('Error fetching evidence:', evidenceError);
          } else {
            evidenceData = (evidenceResult || []).map((ev) => {
              const p = progressById[ev.occurrence_id] || {};
              return {
                ...ev,
                occurrence_date: p.occurrence_date || null,
                calculated_due_date: p.calculated_due_date || null,
                progress_obligation_id: p.obligation_id || null,
                progress_region_id: p.region_id || null,
              };
            });
          }
        }
      }

      // Monthly breakdown chips
      const breakdownMap = {};
      evidenceData.forEach((ev) => {
        if (!ev.occurrence_date) return;
        const d = new Date(ev.occurrence_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!breakdownMap[key]) {
          breakdownMap[key] = {
            key,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            monthLabel:
              ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()],
            count: 0,
          };
        }
        breakdownMap[key].count++;
      });

      breakdown = Object.values(breakdownMap).sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.month - a.month
      );

      console.log(`📊 Found ${evidenceData.length} evidence files`, breakdown);
      setAllEvidence(evidenceData);
      setMonthlyBreakdown(breakdown);

      generateReport(
        obligationsList,
        statsData,
        domainData,
        regionsData.data || [],
        evidenceData
      );
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = (obligationsData, stats, domains, regions, evidence) => {
    const data = generateComplianceSummary(obligationsData || obligations, stats, domains);
    setReportData(data);
  };

  const generateComplianceSummary = (obligations, stats, domains) => {
    const getStatus = (item) => item.current_status || 'Open';

    const totalObligations = obligations.length;
    const closed = obligations.filter((o) => getStatus(o) === "Closed").length;
    const submitted = obligations.filter((o) => getStatus(o) === "Submitted/Under Review").length;
    const open = obligations.filter((o) => getStatus(o) === "Open").length;
    const overdue = obligations.filter((o) => {
      const dueDate = o.calculated_due_date;
      if (!dueDate) return false;
      return new Date(dueDate) < new Date() && getStatus(o) !== "Closed";
    }).length;

    return {
      title: "Compliance Summary Report",
      stats: stats,
      domains: domains,
      totalObligations: totalObligations,
      closed: closed,
      submitted: submitted,
      open: open,
      overdue: overdue,
      recentObligations: obligations.slice(0, 10),
      filters: {
        domain: selectedDomain,
        policy: selectedPolicy,
        clause: selectedClause,
        region: selectedRegion || (!isAdmin ? userRegion : "All Regions"),
        month: selectedMonth,
        year: selectedYear,
        obligationId: selectedObligationId,
        userRegion: !isAdmin ? userRegion : "All Regions",
      },
    };
  };

  // ============================================================
  // DOWNLOAD ALL DOCUMENTS
  // Downloads exactly what's shown in the report — meaning:
  //  - Only evidence bound to the selected obligation(s)
  //  - Only evidence whose occurrence_date matches the selected month/year
  //  - Only evidence in the selected region
  // Files are grouped into subfolders per obligation and month.
  // ============================================================
  const downloadAllDocuments = async () => {
    if (!allEvidence || allEvidence.length === 0) {
      toast.warning("No documents found to download.");
      return;
    }

    setDownloading(true);
    try {
      const zip = new JSZip();
      const rootFolder = zip.folder("compliance_documents");

      // Start from what's already loaded (scoped by fetchReportData).
      let evidenceToDownload = [...allEvidence];

      // Apply defensive re-filtering (in case any slipped through)
      // 1. Region
      if (selectedRegion) {
        const regionId = await getRegionId(selectedRegion);
        if (regionId) {
          evidenceToDownload = evidenceToDownload.filter(
            (item) => item.region_id === regionId
          );
        }
      } else if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          evidenceToDownload = evidenceToDownload.filter(
            (item) => item.region_id === regionId
          );
        } else {
          toast.error("Your region could not be identified.");
          setDownloading(false);
          return;
        }
      }

      // 2. Obligation
      if (selectedObligationId) {
        evidenceToDownload = evidenceToDownload.filter(
          (item) => item.obligation_id === selectedObligationId
        );
      }

      // 3. Month/Year — based on occurrence_date (the period), NOT upload date
      if (selectedMonth && selectedYear) {
        const tm = parseInt(selectedMonth);
        const ty = parseInt(selectedYear);
        evidenceToDownload = evidenceToDownload.filter((ev) => {
          if (!ev.occurrence_date) return false;
          const d = new Date(ev.occurrence_date);
          return d.getMonth() + 1 === tm && d.getFullYear() === ty;
        });
      } else if (selectedYear) {
        const ty = parseInt(selectedYear);
        evidenceToDownload = evidenceToDownload.filter((ev) => {
          if (!ev.occurrence_date) return false;
          return new Date(ev.occurrence_date).getFullYear() === ty;
        });
      }

      if (evidenceToDownload.length === 0) {
        toast.warning("No documents match the current filters.");
        setDownloading(false);
        return;
      }

      // Fetch obligation metadata (for folder & file names)
      const obligationTextIds = [
        ...new Set(evidenceToDownload.map((e) => e.obligation_id).filter(Boolean)),
      ];
      let obligationMap = {};
      if (obligationTextIds.length > 0) {
        const { data: obligationsData } = await supabase
          .from('compliance_obligations')
          .select('obligation_id, obligation_name, domain')
          .in('obligation_id', obligationTextIds);

        if (obligationsData) {
          obligationsData.forEach((ob) => {
            obligationMap[ob.obligation_id] = ob;
          });
        }
      }

      // Fetch region names
      const regionIds = [
        ...new Set(evidenceToDownload.map((e) => e.region_id).filter(Boolean)),
      ];
      let regionMap = {};
      if (regionIds.length > 0) {
        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name')
          .in('id', regionIds);

        if (regionsData) {
          regionsData.forEach((r) => {
            regionMap[r.id] = r.name;
          });
        }
      }

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];

      let downloadedCount = 0;

      for (const evidence of evidenceToDownload) {
        if (!evidence.file_url) continue;

        try {
          const response = await fetch(evidence.file_url);
          if (!response.ok) throw new Error(`Failed to download: ${evidence.file_name}`);
          const blob = await response.blob();

          const obligation = obligationMap[evidence.obligation_id] || {};
          const obligationId = obligation.obligation_id || evidence.obligation_id || "unknown";
          const domain = obligation.domain || "unknown";
          const regionName =
            regionMap[evidence.region_id] || selectedRegion || userRegion || "unknown";

          const fileExtension = evidence.file_name.split(".").pop() || "";

          // Build file name
          let baseFileName = `${obligationId}`;
          if (domain && domain !== "unknown") baseFileName += `_${domain.replace(/\s/g, '')}`;
          if (regionName && regionName !== "unknown") baseFileName += `_${regionName.replace(/\s/g, '')}`;

          // Use occurrence_date (the period the obligation covers)
          let monthYearLabel = null;
          if (evidence.occurrence_date) {
            const d = new Date(evidence.occurrence_date);
            monthYearLabel = `${monthNames[d.getMonth()]}${d.getFullYear()}`;
          } else if (selectedMonth && selectedYear) {
            const monthName =
              months.find((m) => m.value === selectedMonth)?.label || selectedMonth;
            monthYearLabel = `${monthName}${selectedYear}`;
          } else if (selectedYear) {
            monthYearLabel = `${selectedYear}`;
          }

          if (monthYearLabel) baseFileName += `_${monthYearLabel}`;
          baseFileName += `.${fileExtension}`;
          baseFileName = baseFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

          // Group into subfolder per obligation / month-year
          const obligationFolder = rootFolder.folder(obligationId);
          const periodFolder = monthYearLabel
            ? obligationFolder.folder(monthYearLabel)
            : obligationFolder;

          periodFolder.file(baseFileName, blob);
          downloadedCount++;
        } catch (error) {
          console.error(`Error downloading ${evidence.file_name}:`, error);
        }
      }

      if (downloadedCount === 0) {
        toast.error("No documents could be downloaded.");
        setDownloading(false);
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Build zip file name
      let zipFileName = `compliance_documents`;
      if (selectedObligationId) zipFileName += `_${selectedObligationId}`;
      if (selectedRegion) zipFileName += `_${selectedRegion.replace(/\s/g, '')}`;
      else if (!isAdmin && userRegion) zipFileName += `_${userRegion.replace(/\s/g, '')}`;
      if (selectedDomain) zipFileName += `_${selectedDomain.replace(/\s/g, '')}`;
      if (selectedPolicy) {
        const policyName =
          policies.find((p) => p.id === selectedPolicy)?.name || selectedPolicy;
        zipFileName += `_${policyName.replace(/\s/g, '')}`;
      }
      if (selectedClause) zipFileName += `_clause_${selectedClause}`;
      if (selectedMonth && selectedYear) {
        const monthName =
          months.find((m) => m.value === selectedMonth)?.label || selectedMonth;
        zipFileName += `_${monthName}${selectedYear}`;
      } else if (selectedYear) {
        zipFileName += `_${selectedYear}`;
      }
      zipFileName += `_${new Date().toISOString().split("T")[0]}.zip`;
      zipFileName = zipFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully downloaded ${downloadedCount} documents.`);
    } catch (error) {
      console.error("Error downloading documents:", error);
      toast.error("Failed to download documents. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const clearFilters = () => {
    setSelectedDomain("");
    setSelectedPolicy("");
    setSelectedClause("");
    setSelectedRegion("");
    setSelectedMonth("");
    setSelectedYear("");
    setSelectedObligationId("");
    setPolicies(allPolicies);
    setClauses(allClauses);
    setRegionOptions(allRegionOptions);
    setObligationIdOptions(allObligationIdOptions);
    toast.info("Filters cleared");
  };

  const applyMonthFilter = (monthValue, yearValue) => {
    setSelectedMonth(String(monthValue).padStart(2, '0'));
    setSelectedYear(String(yearValue));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
          {!isAdmin && userRegion && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full mt-1 inline-block">
              Region: {userRegion}
            </span>
          )}
          {isAdmin && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full mt-1 inline-block">
              Admin - All Regions
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            Clear Filters
          </button>
          <button
            onClick={() => fetchReportData()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center text-sm sm:text-base"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Report Configuration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Report Filters
            </h3>

            <div className="space-y-3 sm:space-y-4">
              <div className="border-t border-gray-200 pt-3 sm:pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Obligation ID
                    </label>
                    <select
                      value={selectedObligationId}
                      onChange={(e) => setSelectedObligationId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Obligation IDs</option>
                      {obligationIdOptions.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Domain
                    </label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Domains</option>
                      {domains.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Policy
                    </label>
                    <select
                      value={selectedPolicy}
                      onChange={(e) => setSelectedPolicy(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Policies</option>
                      {policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Clause
                    </label>
                    <select
                      value={selectedClause}
                      onChange={(e) => setSelectedClause(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Clauses</option>
                      {clauses.map((clause) => (
                        <option key={clause} value={clause}>
                          {clause}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Region
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                    >
                      <option value="">All Regions</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Month
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                      >
                        <option value="">All Months</option>
                        {months.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                      >
                        <option value="">All Years</option>
                        {years.map((year) => (
                          <option key={year.value} value={year.value}>
                            {year.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={downloadAllDocuments}
                  disabled={downloading || allEvidence.length === 0}
                  className="w-full bg-[#ff0099] text-white px-4 py-2.5 sm:py-3 rounded-md hover:bg-[#e40076] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
                >
                  {downloading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download All ({allEvidence.length})
                    </>
                  )}
                </button>
                {!isAdmin && userRegion && (
                  <p className="text-[9px] sm:text-[10px] text-green-600 text-center mt-1.5">
                    ✓ Only documents from {selectedRegion || userRegion} will be downloaded
                  </p>
                )}
                {selectedObligationId && (
                  <p className="text-[9px] sm:text-[10px] text-blue-600 text-center mt-1.5">
                    ✓ Only documents for {selectedObligationId} will be downloaded
                  </p>
                )}
                {selectedMonth && selectedYear && (
                  <p className="text-[9px] sm:text-[10px] text-purple-600 text-center mt-1.5">
                    ✓ Only {months.find((m) => m.value === selectedMonth)?.label} {selectedYear} documents
                  </p>
                )}
                {allEvidence.length === 0 && !downloading && (
                  <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2">
                    No documents available to download
                  </p>
                )}
                {allEvidence.length > 0 && (
                  <p className="text-[9px] sm:text-[10px] text-gray-400 text-center mt-1.5">
                    Files grouped by: obligation_id / month-year
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {reportData?.title || "Report Preview"}
              </h3>
              {reportData?.filters && (
                <span className="text-[10px] sm:text-xs text-gray-500">
                  {reportData.filters.userRegion && `Region: ${reportData.filters.userRegion} `}
                  {reportData.filters.obligationId && `• Obligation: ${reportData.filters.obligationId} `}
                  {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                  {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                  {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                  {reportData.filters.region &&
                    reportData.filters.region !== "All Regions" &&
                    `• Sub Region: ${reportData.filters.region} `}
                  {reportData.filters.month &&
                    reportData.filters.year &&
                    `• ${months.find((m) => m.value === reportData.filters.month)?.label} ${reportData.filters.year}`}
                </span>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              {reportData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Total Obligations</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">
                        {reportData.totalObligations || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Compliance Rate</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {stats.overallCompliance || 0}%
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Closed</p>
                      <p className="text-lg sm:text-2xl font-bold text-[#8cc63e]">
                        {reportData.closed || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                      <p className="text-[10px] sm:text-sm text-gray-500">Overdue</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-600">
                        {reportData.overdue || 0}
                      </p>
                    </div>
                  </div>

                  {monthlyBreakdown.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Evidence Available by Month
                        <span className="ml-2 text-[10px] font-normal text-gray-500">
                          (click a month to filter)
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {monthlyBreakdown.map((b) => {
                          const isActive =
                            String(b.month).padStart(2, '0') === selectedMonth &&
                            String(b.year) === selectedYear;
                          return (
                            <button
                              key={b.key}
                              onClick={() => applyMonthFilter(b.month, b.year)}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                                isActive
                                  ? 'bg-[#8cc63e] text-white border-[#8cc63e]'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {b.monthLabel} {b.year}
                              <span
                                className={`ml-1.5 text-[10px] ${
                                  isActive ? 'text-white/80' : 'text-gray-500'
                                }`}
                              >
                                ({b.count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {domainData.domains && domainData.domains.length > 0 ? (
                    <div>
                      <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                        Compliance by Domain
                      </h4>
                      <div className="space-y-2">
                        {domainData.domains.map((domain, index) => (
                          <div key={domain}>
                            <div className="flex justify-between text-[10px] sm:text-sm">
                              <span className="text-gray-600 truncate max-w-[150px] sm:max-w-none">
                                {domain}
                              </span>
                              <span className="font-medium">
                                {domainData.compliance[index] || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                              <div
                                className={`h-1.5 sm:h-2 rounded-full ${
                                  (domainData.compliance[index] || 0) >= 80
                                    ? "bg-[#8cc63e]"
                                    : (domainData.compliance[index] || 0) >= 60
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${domainData.compliance[index] || 0}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">No domain compliance data available</p>
                    </div>
                  )}
                </>
              )}

              <div className="text-center text-[10px] sm:text-sm text-gray-500">
                <p>Compliance Summary Report</p>
                {reportData?.filters && (
                  <p className="text-[8px] sm:text-xs mt-0.5 sm:mt-1">
                    {reportData.filters.userRegion && `Region: ${reportData.filters.userRegion} `}
                    {reportData.filters.obligationId && `• Obligation: ${reportData.filters.obligationId} `}
                    {reportData.filters.domain && `• Domain: ${reportData.filters.domain} `}
                    {reportData.filters.policy && `• Policy: ${reportData.filters.policy} `}
                    {reportData.filters.clause && `• Clause: ${reportData.filters.clause} `}
                    {reportData.filters.region &&
                      reportData.filters.region !== "All Regions" &&
                      `• Sub Region: ${reportData.filters.region} `}
                    {reportData.filters.month &&
                      reportData.filters.year &&
                      `• ${months.find((m) => m.value === reportData.filters.month)?.label} ${reportData.filters.year}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;