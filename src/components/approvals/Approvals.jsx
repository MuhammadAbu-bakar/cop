import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../api/supabase";
import { 
  getPendingApprovals, 
  getApprovedOccurrences,
  approveOccurrence,
  rejectOccurrence 
} from "../../api/compliance";
import { toast } from 'react-toastify';

const Approvals = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;
  
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvedOccurrences, setApprovedOccurrences] = useState([]);
  const [selectedTab, setSelectedTab] = useState("todo");
  const [processingId, setProcessingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [filterRegion, setFilterRegion] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [regions, setRegions] = useState([]);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [viewingEvidence, setViewingEvidence] = useState(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [regionMap, setRegionMap] = useState({});
  const [obligationMap, setObligationMap] = useState({});

  useEffect(() => {
    fetchRegions();
    fetchApprovalsData();
  }, []);

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name, code')
        .order('name');
      
      if (!error && data) {
        setRegions(data);
        const map = {};
        data.forEach(region => {
          map[region.id] = region.name;
        });
        setRegionMap(map);
        console.log('🔍 [DEBUG] Regions loaded:', data);
        console.log('🔍 [DEBUG] Region Map:', map);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

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

  const fetchApprovalsData = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        getPendingApprovals(userRegion, isAdmin),
        getApprovedOccurrences(userRegion, isAdmin)
      ]);

      if (pendingRes.error) throw pendingRes.error;
      if (approvedRes.error) throw approvedRes.error;

      console.log('🔍 [DEBUG] Raw Pending Approvals:', JSON.stringify(pendingRes.data, null, 2));
      console.log('🔍 [DEBUG] Raw Approved Occurrences:', JSON.stringify(approvedRes.data, null, 2));

      // Process pending approvals to add region name
      const processedPending = await Promise.all((pendingRes.data || []).map(async (item) => {
        const regionName = await getRegionName(item);
        const obligationDetails = await getObligationDetails(item.obligation_id);
        return {
          ...item,
          region_name: regionName,
          obligation: obligationDetails || item.obligation
        };
      }));

      const processedApproved = await Promise.all((approvedRes.data || []).map(async (item) => {
        const regionName = await getRegionName(item);
        const obligationDetails = await getObligationDetails(item.obligation_id);
        return {
          ...item,
          region_name: regionName,
          obligation: obligationDetails || item.obligation
        };
      }));

      console.log('🔍 [DEBUG] Processed Pending with regions:', processedPending.map(p => ({ id: p.id, region: p.region_name })));
      console.log('🔍 [DEBUG] Processed Approved with regions:', processedApproved.map(p => ({ id: p.id, region: p.region_name })));

      setPendingApprovals(processedPending);
      setApprovedOccurrences(processedApproved);
    } catch (error) {
      console.error("Error fetching approvals data:", error);
      toast.error("Failed to load approvals data");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get region name from occurrence
  const getRegionName = async (occurrence) => {
    // First try to get region from obligation.region
    if (occurrence.obligation?.region) {
      return occurrence.obligation.region;
    }
    
    // If not, try to get from region_id in occurrence
    if (occurrence.region_id && regionMap[occurrence.region_id]) {
      return regionMap[occurrence.region_id];
    }
    
    // If still not found, try to get from obligation's region_id
    if (occurrence.obligation?.region_id && regionMap[occurrence.obligation.region_id]) {
      return regionMap[occurrence.obligation.region_id];
    }
    
    // If we have an obligation_id but no region, fetch it from compliance_obligations
    if (occurrence.obligation_id) {
      try {
        const { data } = await supabase
          .from('compliance_obligations')
          .select('region')
          .eq('obligation_id', occurrence.obligation_id)
          .single();
        
        if (data?.region) {
          return data.region;
        }
      } catch (error) {
        console.log('Error fetching obligation region:', error);
      }
    }
    
    console.log('🔍 [DEBUG] Region not found for occurrence:', {
      id: occurrence.id,
      obligation_region: occurrence.obligation?.region,
      occurrence_region_id: occurrence.region_id,
      obligation_region_id: occurrence.obligation?.region_id,
      obligation_id: occurrence.obligation_id
    });
    
    return "N/A";
  };

  // Helper function to get obligation details
  const getObligationDetails = async (obligationId) => {
    if (!obligationId) return null;
    
    // Check cache first
    if (obligationMap[obligationId]) {
      return obligationMap[obligationId];
    }
    
    try {
      const { data, error } = await supabase
        .from('compliance_obligations')
        .select('*')
        .eq('obligation_id', obligationId)
        .single();
      
      if (!error && data) {
        // Cache the result
        setObligationMap(prev => ({ ...prev, [obligationId]: data }));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching obligation details:', error);
      return null;
    }
  };

  const handleApprove = async (occurrenceId) => {
    setProcessingId(occurrenceId);
    try {
      const result = await approveOccurrence(occurrenceId);
      if (result.error) throw result.error;
      
      toast.success("✅ Occurrence approved successfully!");
      await fetchApprovalsData();
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedOccurrence) return;
    
    setProcessingId(selectedOccurrence.id);
    try {
      const result = await rejectOccurrence(selectedOccurrence.id, rejectReason);
      if (result.error) throw result.error;
      
      toast.success("Occurrence rejected successfully!");
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedOccurrence(null);
      await fetchApprovalsData();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (occurrence) => {
    setSelectedOccurrence(occurrence);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleDownloadEvidence = async (evidence) => {
    if (!evidence || !evidence.file_url) {
      toast.error("No evidence file available for download");
      return;
    }

    setDownloadingFile(evidence.id);
    try {
      window.open(evidence.file_url, '_blank');
      toast.success("Downloading evidence...");
    } catch (error) {
      console.error("Error downloading evidence:", error);
      toast.error("Failed to download evidence. Please try again.");
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleViewEvidence = (evidence) => {
    if (!evidence || !evidence.file_url) {
      toast.error("No evidence file available to view");
      return;
    }
    setViewingEvidence(evidence);
    setShowEvidenceModal(true);
  };

  const closeEvidenceModal = () => {
    setShowEvidenceModal(false);
    setViewingEvidence(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Open': "bg-gray-100 text-gray-800",
      'Submitted/Under Review': "bg-yellow-100 text-yellow-800",
      'Closed': "bg-green-100 text-green-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getTypeBadge = (frequency) => {
    const badges = {
      Monthly: "bg-blue-100 text-blue-800",
      Quarterly: "bg-purple-100 text-purple-800",
      "Bi-Annual": "bg-teal-100 text-teal-800",
      Annual: "bg-green-100 text-green-800",
      "Event Based": "bg-orange-100 text-orange-800",
      Continuous: "bg-indigo-100 text-indigo-800",
    };
    return badges[frequency] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "N/A";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0 || isNaN(bytes)) return "Unknown size";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return size + " " + sizes[i];
  };

  const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  };

  const getFileIcon = (filename) => {
    const ext = getFileExtension(filename);
    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'ppt': '📽️',
      'pptx': '📽️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'zip': '📦',
      'rar': '📦',
      'txt': '📃',
    };
    return icons[ext] || '📎';
  };

  const isImageFile = (filename) => {
    const ext = getFileExtension(filename);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
    return imageExtensions.includes(ext);
  };

  const isPDFFile = (filename) => {
    const ext = getFileExtension(filename);
    return ext === 'pdf';
  };

  const isTextFile = (filename) => {
    const ext = getFileExtension(filename);
    const textExtensions = ['txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'];
    return textExtensions.includes(ext);
  };

  // Filter functions
  const getFilteredPending = () => {
    let filtered = pendingApprovals;
    
    if (filterRegion) {
      filtered = filtered.filter(item => {
        const regionName = item.region_name || item.obligation?.region || "N/A";
        return regionName === filterRegion;
      });
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.obligation?.obligation_name?.toLowerCase().includes(term) ||
        item.obligation?.obligation_id?.toLowerCase().includes(term) ||
        item.obligation?.domain?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  const getFilteredApproved = () => {
    let filtered = approvedOccurrences;
    
    if (filterRegion) {
      filtered = filtered.filter(item => {
        const regionName = item.region_name || item.obligation?.region || "N/A";
        return regionName === filterRegion;
      });
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.obligation?.obligation_name?.toLowerCase().includes(term) ||
        item.obligation?.obligation_id?.toLowerCase().includes(term) ||
        item.obligation?.domain?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  const filteredPending = getFilteredPending();
  const filteredApproved = getFilteredApproved();

  // Render evidence item with View and Download buttons
  const renderEvidenceItem = (evidenceItem) => {
    if (!evidenceItem) return null;
    
    return (
      <div key={evidenceItem.id} className="p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{getFileIcon(evidenceItem.file_name)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {evidenceItem.file_name || "Unnamed file"}
              </p>
              <p className="text-xs text-gray-400">
                {formatFileSize(evidenceItem.file_size)} • Uploaded: {formatDateTime(evidenceItem.uploaded_at)}
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => handleViewEvidence(evidenceItem)}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </button>
            <button
              onClick={() => handleDownloadEvidence(evidenceItem)}
              disabled={downloadingFile === evidenceItem.id}
              className="px-3 py-1 bg-[#8cc63e] text-white text-xs rounded hover:bg-[#7ab83a] transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {downloadingFile === evidenceItem.id ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 sm:px-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Approvals
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedTab === "todo" 
              ? `${filteredPending.length} items pending approval`
              : `${filteredApproved.length} items approved`
            }
            {!isAdmin && userRegion && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Region: {userRegion}
                </span>
              </span>
            )}
            {isAdmin && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Admin - All Regions
                </span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchApprovalsData}
          className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center text-sm"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or domain..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            />
          </div>
          <div>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            >
              <option value="">All Regions</option>
              {regions.map((region) => (
                <option key={region.code} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterRegion("");
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm flex-1"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedTab("todo")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === "todo"
                ? "border-[#ff0099] text-[#ff0099]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            To Do
            <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
              {filteredPending.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedTab("approved")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              selectedTab === "approved"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Approved
            <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
              {filteredApproved.length}
            </span>
          </button>
        </nav>
      </div>

      {/* To Do Section */}
      {selectedTab === "todo" && (
        <div className="space-y-4">
          {filteredPending.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No pending approvals</p>
              <p className="text-sm text-gray-400 mt-1">All obligations are up to date</p>
            </div>
          ) : (
            filteredPending.map((occurrence) => {
              const regionName = occurrence.region_name || occurrence.obligation?.region || "N/A";
              const dueDate = occurrence.calculated_due_date || occurrence.due_date;
              const occurrenceDate = occurrence.occurrence_date || occurrence.instance_date;
              
              return (
                <div key={occurrence.id} className="bg-white rounded-lg shadow p-4 sm:p-6 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-900">
                          {occurrence.obligation?.obligation_name || "Unknown Obligation"}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(occurrence.status)}`}>
                          {occurrence.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {occurrence.obligation?.obligation_id || "N/A"} • {occurrence.obligation?.domain || "N/A"}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(occurrence.obligation?.frequency)}`}>
                          {occurrence.obligation?.frequency || "N/A"}
                        </span>
                        <span className="text-xs text-gray-500">
                          Region: {regionName}
                        </span>
                        <span className="text-xs text-gray-500">
                          Due: {formatDate(dueDate)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Occurrence: {formatDate(occurrenceDate)}
                        </span>
                      </div>
                      
                      {occurrence.comments && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Comment:</span> {occurrence.comments}
                        </p>
                      )}
                      
                      {/* Evidence Display */}
                      {occurrence.evidence && Array.isArray(occurrence.evidence) && occurrence.evidence.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {occurrence.evidence.map((evidenceItem) => renderEvidenceItem(evidenceItem))}
                        </div>
                      ) : occurrence.evidence && !Array.isArray(occurrence.evidence) ? (
                        renderEvidenceItem(occurrence.evidence)
                      ) : null}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleApprove(occurrence.id)}
                        disabled={processingId === occurrence.id}
                        className="flex-1 sm:flex-none bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 text-sm flex items-center justify-center"
                      >
                        {processingId === occurrence.id ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          "Approve"
                        )}
                      </button>
                      <button
                        onClick={() => openRejectModal(occurrence)}
                        disabled={processingId === occurrence.id}
                        className="flex-1 sm:flex-none bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>Submitted: {formatDateTime(occurrence.updated_at)}</span>
                    <span>Occurrence: {formatDate(occurrenceDate)}</span>
                    {occurrence.evidence?.uploaded_by && (
                      <span>Uploaded by: {occurrence.evidence.uploaded_by}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Approved Section */}
      {selectedTab === "approved" && (
        <div className="space-y-4">
          {filteredApproved.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-500">No approved items yet</p>
              <p className="text-sm text-gray-400 mt-1">Approved items will appear here</p>
            </div>
          ) : (
            filteredApproved.map((occurrence) => {
              const regionName = occurrence.region_name || occurrence.obligation?.region || "N/A";
              const dueDate = occurrence.calculated_due_date || occurrence.due_date;
              const occurrenceDate = occurrence.occurrence_date || occurrence.instance_date;
              
              return (
                <div key={occurrence.id} className="bg-white rounded-lg shadow p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-900">
                          {occurrence.obligation?.obligation_name || "Unknown Obligation"}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(occurrence.status)}`}>
                          {occurrence.status}
                        </span>
                        <span className="text-xs text-green-600 font-medium">✓ Approved</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {occurrence.obligation?.obligation_id || "N/A"} • {occurrence.obligation?.domain || "N/A"}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(occurrence.obligation?.frequency)}`}>
                          {occurrence.obligation?.frequency || "N/A"}
                        </span>
                        <span className="text-xs text-gray-500">
                          Region: {regionName}
                        </span>
                        <span className="text-xs text-gray-500">
                          Due: {formatDate(dueDate)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Occurrence: {formatDate(occurrenceDate)}
                        </span>
                      </div>
                      
                      {/* Evidence Display for Approved */}
                      {occurrence.evidence && Array.isArray(occurrence.evidence) && occurrence.evidence.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {occurrence.evidence.map((evidenceItem) => renderEvidenceItem(evidenceItem))}
                        </div>
                      ) : occurrence.evidence && !Array.isArray(occurrence.evidence) ? (
                        renderEvidenceItem(occurrence.evidence)
                      ) : null}
                      
                      {occurrence.comments && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Approval Note:</span> {occurrence.comments}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 text-right">
                      <p className="text-xs text-gray-400">Approved on</p>
                      <p>{formatDateTime(occurrence.updated_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>Occurrence: {formatDate(occurrenceDate)}</span>
                    <span>Due: {formatDate(dueDate)}</span>
                    {occurrence.evidence?.uploaded_by && (
                      <span>Uploaded by: {occurrence.evidence.uploaded_by}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Evidence View Modal */}
      {showEvidenceModal && viewingEvidence && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(viewingEvidence.file_name)}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {viewingEvidence.file_name || "Unnamed file"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(viewingEvidence.file_size)} • Uploaded: {formatDateTime(viewingEvidence.uploaded_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadEvidence(viewingEvidence)}
                  disabled={downloadingFile === viewingEvidence.id}
                  className="px-4 py-2 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {downloadingFile === viewingEvidence.id ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </>
                  )}
                </button>
                <button
                  onClick={closeEvidenceModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {isImageFile(viewingEvidence.file_name) ? (
                <div className="flex items-center justify-center h-full">
                  <img 
                    src={viewingEvidence.file_url} 
                    alt={viewingEvidence.file_name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="text-center p-8">
                            <p class="text-gray-500">Unable to preview image</p>
                            <button 
                              onclick="window.open('${viewingEvidence.file_url}', '_blank')"
                              class="mt-4 px-4 py-2 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
                            >
                              Open in New Tab
                            </button>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : isPDFFile(viewingEvidence.file_name) ? (
                <iframe 
                  src={`${viewingEvidence.file_url}#toolbar=1`}
                  className="w-full h-full min-h-[600px]"
                  title={viewingEvidence.file_name}
                />
              ) : isTextFile(viewingEvidence.file_name) ? (
                <iframe 
                  src={viewingEvidence.file_url}
                  className="w-full h-full min-h-[400px] border-0"
                  title={viewingEvidence.file_name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <span className="text-6xl mb-4">{getFileIcon(viewingEvidence.file_name)}</span>
                  <p className="text-gray-600 mb-2">Preview not available for this file type</p>
                  <p className="text-sm text-gray-400 mb-4">Click Download to view or save the file</p>
                  <button
                    onClick={() => handleDownloadEvidence(viewingEvidence)}
                    disabled={downloadingFile === viewingEvidence.id}
                    className="px-6 py-3 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                  >
                    {downloadingFile === viewingEvidence.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download File
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedOccurrence && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Reject Approval
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to reject "{selectedOccurrence.obligation?.obligation_name || 'this obligation'}"?
                This will move it back to "Open" status.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for rejection
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={processingId === selectedOccurrence.id}
                  className="flex-1 bg-red-500 text-white py-2 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
                >
                  {processingId === selectedOccurrence.id ? "Processing..." : "Reject"}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedOccurrence(null);
                    setRejectReason("");
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;