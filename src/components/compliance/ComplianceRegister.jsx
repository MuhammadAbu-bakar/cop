import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getObligations } from "../../api/compliance";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";

const ComplianceRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrequency, setFilterFrequency] = useState("all");
  const [filterDomain, setFilterDomain] = useState("all");
  const [hoveredObligation, setHoveredObligation] = useState(null);

  // Add Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [addFormData, setAddFormData] = useState({
    obligation_id: "",
    policy_id: null,
    clause: "",
    domain: "",
    name: "",
    description: "",
    responsible: "",
    accountable: "",
    frequency: "Monthly",
    due_date_rule: "",
    evidence_required: false,
    evidence_type: "",
    source_system: "",
    portal_action: "Upload",
    manual_upload_required: false,
    mandatory: false,
    compliance_weight: 1,
    current_status: "Not Started",
    region: "",
  });

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingObligation, setEditingObligation] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    domain: "",
    frequency: "",
    responsible: "",
    accountable: "",
    due_date_rule: "",
    evidence_required: false,
    evidence_type: "",
    source_system: "",
    portal_action: "",
    manual_upload_required: false,
    mandatory: false,
    compliance_weight: 1,
    current_status: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingObligation, setDeletingObligation] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Policies state for dropdown
  const [policies, setPolicies] = useState([]);

  // Parse URL parameters on mount and when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [location.search]);

  useEffect(() => {
    fetchObligations();
    fetchPolicies();
  }, []);

  const fetchObligations = async () => {
    setLoading(true);
    try {
      const { data, error } = await getObligations();
      if (!error && data) {
        setObligations(data);
      }
    } catch (error) {
      console.error("Error fetching obligations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from("policies")
        .select("id, name, version")
        .order("name");
      if (!error && data) {
        setPolicies(data);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      "Not Started": "bg-gray-100 text-gray-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getFrequencyBadge = (frequency) => {
    const badges = {
      Monthly: "bg-blue-100 text-blue-800",
      Quarterly: "bg-purple-100 text-purple-800",
      Yearly: "bg-green-100 text-green-800",
      Annual: "bg-green-100 text-green-800",
      "Event Based": "bg-orange-100 text-orange-800",
      Continuous: "bg-indigo-100 text-indigo-800",
      "Bi-Annual": "bg-teal-100 text-teal-800",
    };
    return badges[frequency] || "bg-gray-100 text-gray-800";
  };

  const getDomains = () => {
    const domains = new Set(obligations.map((o) => o.domain));
    return ["all", ...domains];
  };

  const getFrequencies = () => {
    const frequencies = new Set(obligations.map((o) => o.frequency));
    return ["all", ...frequencies];
  };

  // Function to get the next due date based on frequency and due date rule
  const getNextDueDate = (obligation) => {
    const today = new Date();
    const dueDateRule = obligation.due_date_rule || "";
    const frequency = obligation.frequency || "";

    if (dueDateRule) {
      if (
        dueDateRule.toLowerCase().includes("month end") ||
        dueDateRule.toLowerCase().includes("end of month")
      ) {
        const lastDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
        );
        return lastDayOfMonth.toISOString().split("T")[0];
      }

      if (dueDateRule.toLowerCase().includes("start of month")) {
        const firstDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        );
        return firstDayOfMonth.toISOString().split("T")[0];
      }

      if (dueDateRule.toLowerCase().includes("quarter end")) {
        const quarter = Math.floor(today.getMonth() / 3);
        const lastMonthOfQuarter = (quarter + 1) * 3;
        const lastDay = new Date(today.getFullYear(), lastMonthOfQuarter, 0);
        return lastDay.toISOString().split("T")[0];
      }

      const withinDaysMatch = dueDateRule.match(/within\s*(\d+)\s*days?/i);
      if (withinDaysMatch) {
        const days = parseInt(withinDaysMatch[1]);
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate.toISOString().split("T")[0];
      }

      if (
        dueDateRule.toLowerCase().includes("purchase") ||
        dueDateRule.toLowerCase().includes("immediately") ||
        dueDateRule.toLowerCase().includes("as required") ||
        dueDateRule.toLowerCase().includes("ongoing") ||
        dueDateRule.toLowerCase().includes("n/a")
      ) {
        return "N/A";
      }
    }

    switch (frequency) {
      case "Monthly":
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        return nextMonth.toISOString().split("T")[0];

      case "Quarterly":
        const nextQuarter = new Date(today);
        const currentQuarter = Math.floor(today.getMonth() / 3);
        nextQuarter.setMonth((currentQuarter + 1) * 3);
        nextQuarter.setDate(1);
        return nextQuarter.toISOString().split("T")[0];

      case "Yearly":
      case "Annual":
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        nextYear.setMonth(0);
        nextYear.setDate(1);
        return nextYear.toISOString().split("T")[0];

      case "Bi-Annual":
        const nextBiAnnual = new Date(today);
        nextBiAnnual.setMonth(nextBiAnnual.getMonth() + 6);
        nextBiAnnual.setDate(1);
        return nextBiAnnual.toISOString().split("T")[0];

      default:
        return "N/A";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "N/A") return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDueDateColor = (dueDate) => {
    if (!dueDate || dueDate === "N/A") return "text-gray-500";

    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "text-red-600 font-bold";
    if (diffDays === 0) return "text-orange-600 font-bold";
    if (diffDays <= 7) return "text-yellow-600";
    return "text-green-600";
  };

  const isDueDateOverdue = (dueDate) => {
    if (!dueDate || dueDate === "N/A") return false;
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  // Add Functions
  const handleAddClick = () => {
    setAddFormData({
      obligation_id: "",
      policy_id: null,
      clause: "",
      domain: "",
      name: "",
      description: "",
      responsible: "",
      accountable: "",
      frequency: "Monthly",
      due_date_rule: "",
      evidence_required: false,
      evidence_type: "",
      source_system: "",
      portal_action: "Upload",
      manual_upload_required: false,
      mandatory: false,
      compliance_weight: 1,
      current_status: "Not Started",
      region: "",
    });
    setAddError("");
    setAddSuccess("");
    setShowAddModal(true);
  };

  const handleAddInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const generateObligationId = () => {
    const existingIds = obligations
      .map((o) => o.obligation_id)
      .filter((id) => id && id.startsWith("MS-"))
      .map((id) => parseInt(id.replace("MS-", "")))
      .filter((num) => !isNaN(num));

    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextId = maxId + 1;
    return `MS-${String(nextId).padStart(3, "0")}`;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");

    try {
      let obligationId = addFormData.obligation_id.trim();
      if (!obligationId) {
        obligationId = generateObligationId();
      }

      const { data: existing, error: checkError } = await supabase
        .from("obligations")
        .select("obligation_id")
        .eq("obligation_id", obligationId)
        .single();

      if (existing) {
        setAddError(
          `Obligation ID ${obligationId} already exists. Please use a different ID.`,
        );
        setAddLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("obligations")
        .insert({
          obligation_id: obligationId,
          policy_id: addFormData.policy_id || null,
          clause: addFormData.clause,
          domain: addFormData.domain,
          name: addFormData.name,
          description: addFormData.description,
          responsible: addFormData.responsible,
          accountable: addFormData.accountable,
          frequency: addFormData.frequency,
          due_date_rule: addFormData.due_date_rule,
          evidence_required: addFormData.evidence_required,
          evidence_type: addFormData.evidence_type,
          source_system: addFormData.source_system,
          portal_action: addFormData.portal_action,
          manual_upload_required: addFormData.manual_upload_required,
          mandatory: addFormData.mandatory,
          compliance_weight: parseInt(addFormData.compliance_weight),
          current_status: addFormData.current_status,
          region: addFormData.region,
        })
        .select();

      if (error) throw error;

      setAddSuccess(`Obligation ${obligationId} created successfully!`);
      await fetchObligations();

      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess("");
        alert(`Obligation ${obligationId} created successfully!`);
      }, 1500);
    } catch (error) {
      console.error("Error creating obligation:", error);
      setAddError(
        error.message || "Failed to create obligation. Please try again.",
      );
    } finally {
      setAddLoading(false);
    }
  };

  // Edit Functions
  const handleEditClick = (obligation) => {
    setEditingObligation(obligation);
    setEditFormData({
      name: obligation.name || "",
      description: obligation.description || "",
      domain: obligation.domain || "",
      frequency: obligation.frequency || "",
      responsible: obligation.responsible || "",
      accountable: obligation.accountable || "",
      due_date_rule: obligation.due_date_rule || "",
      evidence_required: obligation.evidence_required || false,
      evidence_type: obligation.evidence_type || "",
      source_system: obligation.source_system || "",
      portal_action: obligation.portal_action || "",
      manual_upload_required: obligation.manual_upload_required || false,
      mandatory: obligation.mandatory || false,
      compliance_weight: obligation.compliance_weight || 1,
      current_status: obligation.current_status || "Not Started",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");

    try {
      const { data, error } = await supabase
        .from("obligations")
        .update({
          name: editFormData.name,
          description: editFormData.description,
          domain: editFormData.domain,
          frequency: editFormData.frequency,
          responsible: editFormData.responsible,
          accountable: editFormData.accountable,
          due_date_rule: editFormData.due_date_rule,
          evidence_required: editFormData.evidence_required,
          evidence_type: editFormData.evidence_type,
          source_system: editFormData.source_system,
          portal_action: editFormData.portal_action,
          manual_upload_required: editFormData.manual_upload_required,
          mandatory: editFormData.mandatory,
          compliance_weight: parseInt(editFormData.compliance_weight),
          current_status: editFormData.current_status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingObligation.id)
        .select();

      if (error) throw error;

      await fetchObligations();
      setShowEditModal(false);
      setEditingObligation(null);
      alert("Obligation updated successfully!");
    } catch (error) {
      console.error("Error updating obligation:", error);
      setEditError(
        error.message || "Failed to update obligation. Please try again.",
      );
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Functions
  const handleDeleteClick = (obligation) => {
    setDeletingObligation(obligation);
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError("");

    try {
      const { data: instances, error: instancesError } = await supabase
        .from("obligation_instances")
        .select("id")
        .eq("obligation_id", deletingObligation.id);

      if (instancesError) throw instancesError;

      if (instances && instances.length > 0) {
        const { error: deleteInstancesError } = await supabase
          .from("obligation_instances")
          .delete()
          .eq("obligation_id", deletingObligation.id);

        if (deleteInstancesError) throw deleteInstancesError;

        const { error: deleteEvidenceError } = await supabase
          .from("evidence")
          .delete()
          .eq("obligation_id", deletingObligation.id);

        if (deleteEvidenceError) throw deleteEvidenceError;

        const { error: deleteActivityError } = await supabase
          .from("activity_history")
          .delete()
          .eq("obligation_id", deletingObligation.id);

        if (deleteActivityError) throw deleteActivityError;
      }

      const { error: deleteError } = await supabase
        .from("obligations")
        .delete()
        .eq("id", deletingObligation.id);

      if (deleteError) throw deleteError;

      await fetchObligations();
      setShowDeleteModal(false);
      setDeletingObligation(null);
      alert("Obligation deleted successfully!");
    } catch (error) {
      console.error("Error deleting obligation:", error);
      setDeleteError(
        error.message || "Failed to delete obligation. Please try again.",
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Clear filters function
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterFrequency("all");
    setFilterDomain("all");
    // Remove URL parameters
    navigate('/compliance', { replace: true });
  };

  const filteredObligations = obligations.filter((obligation) => {
    const matchesSearch =
      obligation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obligation.description
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      obligation.obligation_id
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || obligation.current_status === filterStatus;
    const matchesFrequency =
      filterFrequency === "all" || obligation.frequency === filterFrequency;
    const matchesDomain =
      filterDomain === "all" || obligation.domain === filterDomain;

    return matchesSearch && matchesStatus && matchesFrequency && matchesDomain;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading obligations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Compliance Register
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredObligations.length} obligations found
            {filterStatus !== "all" && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Filtered by: {filterStatus}
                </span>
                <button
                  onClick={clearFilters}
                  className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleAddClick}
            className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center w-full sm:w-auto justify-center"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New Obligation
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, or description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                // Update URL when status changes
                const params = new URLSearchParams(location.search);
                if (e.target.value === "all") {
                  params.delete('status');
                } else {
                  params.set('status', e.target.value);
                }
                navigate(`/compliance${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            >
              <option value="all">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
          <div>
            <select
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            >
              {getFrequencies().map((freq) => (
                <option key={freq} value={freq}>
                  {freq === "all" ? "All Frequencies" : freq}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            >
              {getDomains().map((domain) => (
                <option key={domain} value={domain}>
                  {domain === "all" ? "All Domains" : domain}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Obligation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredObligations.map((obligation) => {
                const dueDate = getNextDueDate(obligation);
                const isOverdue = isDueDateOverdue(dueDate);
                const dueDateColor = getDueDateColor(dueDate);

                return (
                  <tr
                    key={obligation.id}
                    className="hover:bg-gray-50 transition-colors relative"
                    onMouseEnter={() => setHoveredObligation(obligation.id)}
                    onMouseLeave={() => setHoveredObligation(null)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/compliance/${obligation.obligation_id}`}
                          className="inline-flex items-center justify-center p-2 bg-[#8cc63e] text-white rounded-md hover:bg-[#7ab83a] transition-colors"
                          title="View"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleEditClick(obligation)}
                              className="inline-flex items-center justify-center p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              title="Edit"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteClick(obligation)}
                              className="inline-flex items-center justify-center p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {obligation.obligation_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 relative">
                      <div className="text-sm font-medium text-gray-900">
                        {obligation.name}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {obligation.description?.substring(0, 100)}...
                      </div>
                      
                      {/* Hover Tooltip with Full Details */}
                      {hoveredObligation === obligation.id && (
                        <div className="absolute left-0 top-full mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-semibold text-gray-900">{obligation.name}</h4>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(obligation.current_status)}`}>
                                {obligation.current_status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{obligation.description}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="font-medium text-gray-500">ID:</span>
                                <span className="ml-1 text-gray-700">{obligation.obligation_id}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Domain:</span>
                                <span className="ml-1 text-gray-700">{obligation.domain}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Frequency:</span>
                                <span className="ml-1 text-gray-700">{obligation.frequency}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Due Date:</span>
                                <span className={`ml-1 ${dueDateColor}`}>{formatDate(dueDate)}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Responsible:</span>
                                <span className="ml-1 text-gray-700">{obligation.responsible}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Accountable:</span>
                                <span className="ml-1 text-gray-700">{obligation.accountable}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Weight:</span>
                                <span className="ml-1 text-gray-700">{obligation.compliance_weight}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Clause:</span>
                                <span className="ml-1 text-gray-700">{obligation.clause || 'N/A'}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium text-gray-500">Region:</span>
                                <span className="ml-1 text-gray-700">{obligation.region || 'N/A'}</span>
                              </div>
                              {obligation.evidence_required && (
                                <div className="col-span-2">
                                  <span className="font-medium text-gray-500">Evidence:</span>
                                  <span className="ml-1 text-gray-700">{obligation.evidence_type || 'Required'}</span>
                                </div>
                              )}
                              {obligation.mandatory && (
                                <div className="col-span-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    Mandatory
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {obligation.domain}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getFrequencyBadge(obligation.frequency)}`}
                      >
                        {obligation.frequency}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span className={`text-sm ${dueDateColor}`}>
                          {formatDate(dueDate)}
                        </span>
                        {isOverdue && dueDate !== "N/A" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Overdue
                          </span>
                        )}
                        {dueDate !== "N/A" && !isOverdue && (
                          <span className="text-xs text-gray-400">
                            (
                            {Math.ceil(
                              (new Date(dueDate) - new Date()) /
                                (1000 * 60 * 60 * 24),
                            )}{" "}
                            days)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(obligation.current_status)}`}
                      >
                        {obligation.current_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {obligation.compliance_weight}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredObligations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No obligations found matching your filters.
          </div>
        )}
      </div>

      {/* Add New Obligation Modal - Only for Admin */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Add New Obligation
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6">
              {addError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
                  {addError}
                </div>
              )}
              {addSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md">
                  {addSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obligation ID *
                  </label>
                  <input
                    type="text"
                    name="obligation_id"
                    value={addFormData.obligation_id}
                    onChange={handleAddInputChange}
                    placeholder="e.g., MS-027 (Auto-generated if empty)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to auto-generate (MS-XXX format)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy
                  </label>
                  <select
                    name="policy_id"
                    value={addFormData.policy_id || ""}
                    onChange={handleAddInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="">Select Policy</option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name} - {policy.version}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clause *
                  </label>
                  <input
                    type="text"
                    name="clause"
                    value={addFormData.clause}
                    onChange={handleAddInputChange}
                    required
                    placeholder="e.g., 3.x"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain *
                  </label>
                  <input
                    type="text"
                    name="domain"
                    value={addFormData.domain}
                    onChange={handleAddInputChange}
                    required
                    placeholder="e.g., Audit, Preventive Maintenance"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obligation Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={addFormData.name}
                    onChange={handleAddInputChange}
                    required
                    placeholder="Enter obligation name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={addFormData.description}
                    onChange={handleAddInputChange}
                    rows="3"
                    placeholder="Enter description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsible *
                  </label>
                  <input
                    type="text"
                    name="responsible"
                    value={addFormData.responsible}
                    onChange={handleAddInputChange}
                    required
                    placeholder="e.g., CMPak Regional Team"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accountable *
                  </label>
                  <input
                    type="text"
                    name="accountable"
                    value={addFormData.accountable}
                    onChange={handleAddInputChange}
                    required
                    placeholder="e.g., Regional Manager"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency *
                  </label>
                  <select
                    name="frequency"
                    value={addFormData.frequency}
                    onChange={handleAddInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Annual">Annual</option>
                    <option value="Event Based">Event Based</option>
                    <option value="Continuous">Continuous</option>
                    <option value="Bi-Annual">Bi-Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date Rule
                  </label>
                  <input
                    type="text"
                    name="due_date_rule"
                    value={addFormData.due_date_rule}
                    onChange={handleAddInputChange}
                    placeholder="e.g., End of Month, Within 7 Days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region
                  </label>
                  <input
                    type="text"
                    name="region"
                    value={addFormData.region}
                    onChange={handleAddInputChange}
                    placeholder="e.g., North America"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="current_status"
                    value={addFormData.current_status}
                    onChange={handleAddInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compliance Weight
                  </label>
                  <input
                    type="number"
                    name="compliance_weight"
                    value={addFormData.compliance_weight}
                    onChange={handleAddInputChange}
                    min="1"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evidence Type
                  </label>
                  <input
                    type="text"
                    name="evidence_type"
                    value={addFormData.evidence_type}
                    onChange={handleAddInputChange}
                    placeholder="e.g., PDF, Excel, Photos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source System
                  </label>
                  <input
                    type="text"
                    name="source_system"
                    value={addFormData.source_system}
                    onChange={handleAddInputChange}
                    placeholder="e.g., Compliance Portal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portal Action
                  </label>
                  <select
                    name="portal_action"
                    value={addFormData.portal_action}
                    onChange={handleAddInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Upload">Upload</option>
                    <option value="Integrate">Integrate</option>
                    <option value="Monitor">Monitor</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="evidence_required"
                        checked={addFormData.evidence_required}
                        onChange={handleAddInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Evidence Required
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="manual_upload_required"
                        checked={addFormData.manual_upload_required}
                        onChange={handleAddInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Manual Upload Required
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="mandatory"
                        checked={addFormData.mandatory}
                        onChange={handleAddInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Mandatory
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
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
                      Creating...
                    </>
                  ) : (
                    "Create Obligation"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal - Only for Admin */}
      {showEditModal && editingObligation && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Obligation - {editingObligation.obligation_id}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obligation Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain *
                  </label>
                  <input
                    type="text"
                    name="domain"
                    value={editFormData.domain}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={editFormData.description}
                    onChange={handleEditInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency *
                  </label>
                  <select
                    name="frequency"
                    value={editFormData.frequency}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Annual">Annual</option>
                    <option value="Event Based">Event Based</option>
                    <option value="Continuous">Continuous</option>
                    <option value="Bi-Annual">Bi-Annual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date Rule
                  </label>
                  <input
                    type="text"
                    name="due_date_rule"
                    value={editFormData.due_date_rule}
                    onChange={handleEditInputChange}
                    placeholder="e.g., End of Month, Within 7 Days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsible *
                  </label>
                  <input
                    type="text"
                    name="responsible"
                    value={editFormData.responsible}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accountable *
                  </label>
                  <input
                    type="text"
                    name="accountable"
                    value={editFormData.accountable}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evidence Type
                  </label>
                  <input
                    type="text"
                    name="evidence_type"
                    value={editFormData.evidence_type}
                    onChange={handleEditInputChange}
                    placeholder="e.g., PDF, Excel, Photos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source System
                  </label>
                  <input
                    type="text"
                    name="source_system"
                    value={editFormData.source_system}
                    onChange={handleEditInputChange}
                    placeholder="e.g., Compliance Portal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portal Action
                  </label>
                  <select
                    name="portal_action"
                    value={editFormData.portal_action}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Upload">Upload</option>
                    <option value="Integrate">Integrate</option>
                    <option value="Monitor">Monitor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="current_status"
                    value={editFormData.current_status}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compliance Weight
                  </label>
                  <input
                    type="number"
                    name="compliance_weight"
                    value={editFormData.compliance_weight}
                    onChange={handleEditInputChange}
                    min="1"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="evidence_required"
                        checked={editFormData.evidence_required}
                        onChange={handleEditInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Evidence Required
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="manual_upload_required"
                        checked={editFormData.manual_upload_required}
                        onChange={handleEditInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Manual Upload Required
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="mandatory"
                        checked={editFormData.mandatory}
                        onChange={handleEditInputChange}
                        className="h-4 w-4 text-[#8cc63e] focus:ring-[#8cc63e] border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Mandatory
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
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
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Only for Admin */}
      {showDeleteModal && deletingObligation && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Obligation
              </h3>

              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to delete{" "}
                <strong>{deletingObligation.obligation_id}</strong>? This action
                cannot be undone and will also delete all related instances,
                evidence, and activity history.
              </p>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                  {deleteError}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
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
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors"
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

export default ComplianceRegister;