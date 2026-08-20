import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getObligations } from "../../api/compliance";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from 'react-toastify';

const ComplianceRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  // FIXED: Use region_name instead of region_code
  const userRegion = profile?.region_name || null;
  // Regional user can also add event obligations
  const canAddEvent = isAdmin || profile?.role === "regional_user";
  
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrequency, setFilterFrequency] = useState("all");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [hoveredObligation, setHoveredObligation] = useState(null);
  const [activeTab, setActiveTab] = useState("Cyclic");

  // Sorting states
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

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
    current_status: "In Progress",
    region: userRegion || "",
    calculated_due_date: "",
    obligation_type: "Cyclic",
  });

  // Event template options
  const [eventTemplates, setEventTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Obligation name options for dropdown (from event_obligations table for auto-fill)
  const [obligationNameOptions, setObligationNameOptions] = useState([]);
  const [filteredNameOptions, setFilteredNameOptions] = useState([]);
  const [nameSearchTerm, setNameSearchTerm] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const nameInputRef = useRef(null);
  const nameDropdownRef = useRef(null);

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
    obligation_type: "",
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

  // Store event obligations data for autofill
  const [eventObligationsData, setEventObligationsData] = useState([]);

  // Month and Year options
  const months = [
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
  ];

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i.toString());
    }
    return years;
  };

  // Parse URL parameters on mount and when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const monthParam = params.get('month');
    const yearParam = params.get('year');
    
    if (statusParam) {
      setFilterStatus(statusParam);
    }
    if (monthParam) {
      setFilterMonth(monthParam);
    }
    if (yearParam) {
      setFilterYear(yearParam);
    }
  }, [location.search]);

  useEffect(() => {
    fetchObligations();
    fetchPolicies();
    fetchEventTemplates();
    fetchObligationNameOptions();
  }, []);

  // Click outside handler for name dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        nameDropdownRef.current && 
        !nameDropdownRef.current.contains(event.target) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(event.target)
      ) {
        setShowNameDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // FIXED: Get region ID from region name (not code)
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
  };

  // Fetch all obligations with their progress for the user's region
  const fetchObligations = async () => {
    setLoading(true);
    try {
      let userRegionId = null;
      if (!isAdmin && userRegion) {
        userRegionId = await getRegionId(userRegion);
        console.log('User region name:', userRegion);
        console.log('User region ID:', userRegionId);
      }

      let query = supabase
        .from("obligations")
        .select(`
          *,
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
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (!error && data) {
        const processedData = data
          .map(obligation => {
            // For regional users, only show obligations with progress for their region
            if (!isAdmin && userRegionId) {
              const progressForRegion = obligation.obligation_progress?.find(
                p => p.region_id === userRegionId
              );
              
              // If no progress for this region, skip this obligation
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

            // For admin, use progress status if available, otherwise use obligation status
            const progress = obligation.obligation_progress?.[0] || null;
            const status = progress?.status || obligation.current_status || 'Not Started';
            
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

        setObligations(processedData);
      }
    } catch (error) {
      console.error("Error fetching obligations:", error);
      toast.error("Failed to load obligations. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  // Function to update obligation status directly in progress table
  const updateObligationStatus = async (obligationId, status, comment = '') => {
    try {
      // Get the region ID for the user
      const regionId = await getRegionId(userRegion);
      
      if (!regionId && !isAdmin) {
        toast.error("Region not found for user.");
        return false;
      }

      // For regional users, only allow valid statuses
      let progressStatus = status;
      if (!isAdmin && status !== 'Completed' && status !== 'In Progress' && status !== 'Overdue') {
        progressStatus = 'In Progress';
      }

      // Check if progress record exists
      const { data: existingProgress, error: checkError } = await supabase
        .from('obligation_progress')
        .select('id')
        .eq('obligation_id', obligationId)
        .eq('region_id', regionId)
        .single();

      let updateData = {
        status: progressStatus,
        last_updated_at: new Date().toISOString(),
      };

      // Add timestamps based on status
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
        // Update existing progress
        result = await supabase
          .from('obligation_progress')
          .update(updateData)
          .eq('id', existingProgress.id);
      } else {
        // Insert new progress record
        result = await supabase
          .from('obligation_progress')
          .insert({
            obligation_id: obligationId,
            region_id: regionId,
            status: progressStatus,
            ...(progressStatus === 'Completed' && { completed_at: new Date().toISOString() }),
            ...(progressStatus === 'In Progress' && { started_at: new Date().toISOString() }),
            ...(comment && { comments: comment }),
          });
      }

      if (result.error) throw result.error;

      // Also update the main obligations table for backward compatibility
      await supabase
        .from('obligations')
        .update({
          current_status: progressStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', obligationId);

      return true;
    } catch (error) {
      console.error('Error updating obligation status:', error);
      return false;
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

  const fetchEventTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("event_templates")
        .select("*")
        .order("name");
      if (!error && data) {
        setEventTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching event templates:", error);
    }
  };

  const fetchObligationNameOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("event_obligations")
        .select("name, obligation_id, clause, domain, description, responsible, accountable, frequency, due_date_rule, evidence_required, evidence_type, source_system, portal_action, manual_upload_required, mandatory, compliance_weight, region, calculated_due_date, policy_id")
        .order("name");

      if (!error && data) {
        const uniqueNames = [...new Set(data.map(item => item.name).filter(Boolean))];
        setObligationNameOptions(uniqueNames);
        setFilteredNameOptions(uniqueNames);
        setEventObligationsData(data);
      }
    } catch (error) {
      console.error("Error fetching obligation name options:", error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      "Due Today": "bg-orange-100 text-orange-800",
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

  const fetchEventObligationDataByName = (name) => {
    if (!name) return null;
    return eventObligationsData.find(item => item.name === name) || null;
  };

  const handleNameSearch = (searchText) => {
    setNameSearchTerm(searchText);
    setShowNameDropdown(true);
    if (searchText.trim() === "") {
      setFilteredNameOptions(obligationNameOptions);
    } else {
      const filtered = obligationNameOptions.filter(name =>
        name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredNameOptions(filtered);
    }
  };

  const handleNameSelect = async (selectedName) => {
    setAddFormData(prev => ({
      ...prev,
      name: selectedName,
    }));
    setNameSearchTerm(selectedName);
    setFilteredNameOptions(obligationNameOptions);
    setShowNameDropdown(false);

    const obligationData = fetchEventObligationDataByName(selectedName);
    if (obligationData) {
      setAddFormData(prev => ({
        ...prev,
        obligation_id: obligationData.obligation_id || prev.obligation_id,
        policy_id: obligationData.policy_id || prev.policy_id,
        clause: obligationData.clause || prev.clause,
        domain: obligationData.domain || prev.domain,
        description: obligationData.description || prev.description,
        responsible: obligationData.responsible || prev.responsible,
        accountable: obligationData.accountable || prev.accountable,
        frequency: obligationData.frequency || prev.frequency,
        due_date_rule: obligationData.due_date_rule || prev.due_date_rule,
        evidence_required: obligationData.evidence_required || prev.evidence_required,
        evidence_type: obligationData.evidence_type || prev.evidence_type,
        source_system: obligationData.source_system || prev.source_system,
        portal_action: obligationData.portal_action || prev.portal_action,
        manual_upload_required: obligationData.manual_upload_required || prev.manual_upload_required,
        mandatory: obligationData.mandatory || prev.mandatory,
        compliance_weight: obligationData.compliance_weight || prev.compliance_weight,
        region: obligationData.region || prev.region || userRegion,
        calculated_due_date: obligationData.calculated_due_date || prev.calculated_due_date,
      }));
    }
  };

  const handleAddClick = (type) => {
    setAddFormData({
      obligation_id: "",
      policy_id: null,
      clause: "",
      domain: "",
      name: "",
      description: "",
      responsible: "",
      accountable: "",
      frequency: type === "Cyclic" ? "Monthly" : "Event Based",
      due_date_rule: "",
      evidence_required: false,
      evidence_type: "",
      source_system: "",
      portal_action: "Upload",
      manual_upload_required: false,
      mandatory: false,
      compliance_weight: 1,
      current_status: "In Progress",
      region: userRegion || "",
      calculated_due_date: "",
      obligation_type: type,
    });
    setSelectedTemplate(null);
    setNameSearchTerm("");
    setFilteredNameOptions(obligationNameOptions);
    setShowNameDropdown(false);
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

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    if (!templateId) {
      setSelectedTemplate(null);
      return;
    }

    const template = eventTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setAddFormData(prev => ({
        ...prev,
        obligation_id: template.obligation_id || "",
        name: template.name || "",
        description: template.description || "",
        domain: template.domain || "",
        responsible: template.responsible || "",
        accountable: template.accountable || "",
        frequency: template.frequency || "Event Based",
        due_date_rule: template.due_date_rule || "",
        evidence_required: template.evidence_required || false,
        evidence_type: template.evidence_type || "",
        source_system: template.source_system || "",
        portal_action: template.portal_action || "Upload",
        manual_upload_required: template.manual_upload_required || false,
        mandatory: template.mandatory || false,
        compliance_weight: template.compliance_weight || 1,
        clause: template.clause || "",
        calculated_due_date: template.calculated_due_date || "",
        policy_id: template.policy_id || null,
        region: template.region || userRegion || "",
        obligation_type: "Event",
      }));
      setNameSearchTerm(template.name || "");
      setShowNameDropdown(false);
    }
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

      // Check for existing obligation_id in obligations table
      const { data: existing, error: checkError } = await supabase
        .from("obligations")
        .select("obligation_id")
        .eq("obligation_id", obligationId)
        .single();

      if (existing) {
        setAddError(
          `Obligation ID ${obligationId} already exists. Please use a different ID.`,
        );
        toast.warning(`Obligation ID ${obligationId} already exists.`);
        setAddLoading(false);
        return;
      }

      // Get region ID
      const regionId = await getRegionId(addFormData.region || userRegion);

      // Insert into obligations table
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
          region: addFormData.region || userRegion,
          calculated_due_date: addFormData.calculated_due_date || null,
          obligation_type: addFormData.obligation_type,
        })
        .select();

      if (error) throw error;

      // Insert into obligation_progress for the user's region
      if (regionId && data && data[0]) {
        // For regional users, validate status
        let progressStatus = addFormData.current_status;
        if (!isAdmin && progressStatus !== 'Completed' && progressStatus !== 'In Progress' && progressStatus !== 'Overdue') {
          progressStatus = 'In Progress';
        }

        await supabase
          .from('obligation_progress')
          .insert({
            obligation_id: data[0].id,
            region_id: regionId,
            status: progressStatus,
          });
      }

      setAddSuccess(`Obligation ${obligationId} created successfully!`);
      toast.success(`Obligation ${obligationId} created successfully!`);
      
      setShowAddModal(false);
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
        current_status: "In Progress",
        region: userRegion || "",
        calculated_due_date: "",
        obligation_type: "Cyclic",
      });
      setNameSearchTerm("");
      setFilteredNameOptions(obligationNameOptions);
      setAddLoading(false);
      
      await fetchObligations();
      await fetchObligationNameOptions();
      
    } catch (error) {
      console.error("Error creating obligation:", error);
      setAddError(
        error.message || "Failed to create obligation. Please try again.",
      );
      toast.error(`❌ ${error.message || "Failed to create obligation. Please try again."}`);
      setAddLoading(false);
    }
  };

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
      current_status: obligation.current_status || "In Progress",
      obligation_type: obligation.obligation_type || "Cyclic",
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
          obligation_type: editFormData.obligation_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingObligation.id)
        .select();

      if (error) throw error;

      // Update obligation_progress if user is regional
      if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          // Validate status for regional users
          let progressStatus = editFormData.current_status;
          if (progressStatus !== 'Completed' && progressStatus !== 'In Progress' && progressStatus !== 'Overdue') {
            progressStatus = 'In Progress';
          }

          const { data: existingProgress } = await supabase
            .from('obligation_progress')
            .select('id')
            .eq('obligation_id', editingObligation.id)
            .eq('region_id', regionId)
            .single();

          if (existingProgress) {
            await supabase
              .from('obligation_progress')
              .update({
                status: progressStatus,
                last_updated_at: new Date().toISOString(),
                ...(progressStatus === 'Completed' && { completed_at: new Date().toISOString() }),
                ...(progressStatus === 'In Progress' && { started_at: new Date().toISOString() }),
              })
              .eq('id', existingProgress.id);
          } else {
            await supabase
              .from('obligation_progress')
              .insert({
                obligation_id: editingObligation.id,
                region_id: regionId,
                status: progressStatus,
                ...(progressStatus === 'Completed' && { completed_at: new Date().toISOString() }),
                ...(progressStatus === 'In Progress' && { started_at: new Date().toISOString() }),
              });
          }
        }
      }

      await fetchObligations();
      setShowEditModal(false);
      setEditingObligation(null);
      setEditLoading(false);
      toast.success(`✅ Obligation updated successfully!`);
    } catch (error) {
      console.error("Error updating obligation:", error);
      setEditError(
        error.message || "Failed to update obligation. Please try again.",
      );
      toast.error(`❌ ${error.message || "Failed to update obligation. Please try again."}`);
      setEditLoading(false);
    }
  };

  const handleDeleteClick = (obligation) => {
    setDeletingObligation(obligation);
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError("");

    try {
      const obligationId = deletingObligation.obligation_id;
      
      // Delete from obligation_progress
      await supabase
        .from('obligation_progress')
        .delete()
        .eq('obligation_id', deletingObligation.id);

      // Delete from obligations
      const { error: deleteError } = await supabase
        .from("obligations")
        .delete()
        .eq("id", deletingObligation.id);

      if (deleteError) throw deleteError;

      await fetchObligations();
      await fetchObligationNameOptions();
      setShowDeleteModal(false);
      setDeletingObligation(null);
      setDeleteLoading(false);
      toast.success(`Obligation ${obligationId} deleted successfully!`);
    } catch (error) {
      console.error("Error deleting obligation:", error);
      setDeleteError(
        error.message || "Failed to delete obligation. Please try again.",
      );
      toast.error(`❌ ${error.message || "Failed to delete obligation. Please try again."}`);
      setDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterFrequency("all");
    setFilterDomain("all");
    setFilterMonth("");
    setFilterYear("");
    setSortField(null);
    setSortDirection('asc');
    navigate('/compliance', { replace: true });
    toast.info("Filters cleared");
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, set to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <svg className="h-3 w-3 inline ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="h-3 w-3 inline ml-1 text-[#8cc63e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-3 w-3 inline ml-1 text-[#8cc63e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Filter and sort obligations
  const getFilteredAndSortedObligations = () => {
    let filtered = obligations;

    if (activeTab === "Cyclic") {
      filtered = filtered.filter(o => o.obligation_type === "Cyclic");
    } else if (activeTab === "Event") {
      filtered = filtered.filter(o => o.obligation_type === "Event");
    }

    // Apply filters
    filtered = filtered.filter((obligation) => {
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

      // Month/Year filter on calculated_due_date
      let matchesMonth = true;
      if (filterMonth && filterYear && obligation.calculated_due_date) {
        const dueDate = new Date(obligation.calculated_due_date);
        const dueMonth = String(dueDate.getMonth() + 1).padStart(2, "0");
        const dueYear = dueDate.getFullYear().toString();
        matchesMonth = dueMonth === filterMonth && dueYear === filterYear;
      } else if (filterMonth && obligation.calculated_due_date) {
        const dueDate = new Date(obligation.calculated_due_date);
        const dueMonth = String(dueDate.getMonth() + 1).padStart(2, "0");
        matchesMonth = dueMonth === filterMonth;
      } else if (filterYear && obligation.calculated_due_date) {
        const dueDate = new Date(obligation.calculated_due_date);
        const dueYear = dueDate.getFullYear().toString();
        matchesMonth = dueYear === filterYear;
      }

      return matchesSearch && matchesStatus && matchesFrequency && matchesDomain && matchesMonth;
    });

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal, bVal;
        
        if (sortField === 'dueDate') {
          aVal = a.calculated_due_date ? new Date(a.calculated_due_date).getTime() : Infinity;
          bVal = b.calculated_due_date ? new Date(b.calculated_due_date).getTime() : Infinity;
        } else if (sortField === 'status') {
          // Status priority order: Completed, In Progress, Pending, Due Today, Not Started, Overdue
          const statusOrder = {
            'Completed': 1,
            'In Progress': 2,
            'Pending': 3,
            'Due Today': 4,
            'Not Started': 5,
            'Overdue': 6
          };
          aVal = statusOrder[a.current_status] || 999;
          bVal = statusOrder[b.current_status] || 999;
        } else {
          aVal = a[sortField] || '';
          bVal = b[sortField] || '';
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const filteredObligations = getFilteredAndSortedObligations();

  const getCyclicCount = () => {
    return obligations.filter(o => o.obligation_type === "Cyclic").length;
  };

  const getEventCount = () => {
    return obligations.filter(o => o.obligation_type === "Event").length;
  };

  const updateUrlParams = () => {
    const params = new URLSearchParams();
    if (filterStatus && filterStatus !== 'all') {
      params.set('status', filterStatus);
    }
    if (filterMonth) {
      params.set('month', filterMonth);
    }
    if (filterYear) {
      params.set('year', filterYear);
    }
    navigate(`/compliance${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  };

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
    <div className="space-y-4 px-2 sm:px-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Compliance Register
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredObligations.length} obligations found
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
            {filterStatus !== "all" && activeTab === "Cyclic" && (
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
            {(filterMonth || filterYear) && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {filterMonth && months.find(m => m.value === filterMonth)?.label} {filterYear}
                </span>
                <button
                  onClick={() => {
                    setFilterMonth("");
                    setFilterYear("");
                    updateUrlParams();
                  }}
                  className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </span>
            )}
            {sortField && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Sorted by: {sortField === 'dueDate' ? 'Due Date' : 'Status'} ({sortDirection === 'asc' ? '↑' : '↓'})
                </span>
                <button
                  onClick={() => {
                    setSortField(null);
                    setSortDirection('asc');
                  }}
                  className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => handleAddClick("Cyclic")}
              className="bg-[#8cc63e] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center text-xs sm:text-sm"
            >
              <svg
                className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1"
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
              <span className="hidden xs:inline">Add Cyclic Based</span>
              <span className="xs:hidden">Cyclic</span>
            </button>
          )}
          {canAddEvent && (
            <button
              onClick={() => handleAddClick("Event")}
              className="bg-[#ff0099] text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-[#e40076] transition-colors flex items-center text-xs sm:text-sm"
            >
              <svg
                className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1"
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
              <span className="hidden xs:inline">Add Event Based</span>
              <span className="xs:hidden">Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max">
          <button
            onClick={() => setActiveTab("Cyclic")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "Cyclic"
                ? "border-[#8cc63e] text-[#8cc63e]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Cyclic Based
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {getCyclicCount()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("Event")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "Event"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Event Based
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {getEventCount()}
            </span>
          </button>
        </nav>
      </div>

      {/* Filters - Only show for Cyclic tab */}
      {activeTab === "Cyclic" && (
        <div className="bg-white rounded-lg shadow p-3">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              />
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  updateUrlParams();
                }}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              >
                <option value="all">All Statuses</option>
                <option value="Not Started">Not Started</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
                <option value="Due Today">Due Today</option>
              </select>
            </div>
            <div>
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              >
                {getDomains().map((domain) => (
                  <option key={domain} value={domain}>
                    {domain === "all" ? "All Domains" : domain}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  updateUrlParams();
                }}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
              <select
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  updateUrlParams();
                }}
                className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              >
                <option value="">All Years</option>
                {getYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Obligation
                </th>
                <th className="hidden sm:table-cell px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="hidden md:table-cell px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Freq
                </th>
                <th 
                  className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center">
                    Due Date
                    {getSortIcon('dueDate')}
                  </div>
                </th>
                <th 
                  className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredObligations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-2 py-8 text-center text-gray-500 text-sm">
                    {activeTab === "Event" 
                      ? "No event obligations found. Click 'Add Event Based' to create one."
                      : !isAdmin && userRegion 
                        ? `No obligations found for region: ${userRegion}`
                        : "No obligations found matching your filters."}
                  </td>
                </tr>
              ) : (
                filteredObligations.map((obligation) => {
                  const dueDate = obligation.calculated_due_date;
                  const isOverdue = isDueDateOverdue(dueDate);
                  const dueDateColor = getDueDateColor(dueDate);

                  return (
                    <tr
                      key={obligation.id}
                      className="hover:bg-gray-50 transition-colors relative"
                      onMouseEnter={() => setHoveredObligation(obligation.id)}
                      onMouseLeave={() => setHoveredObligation(null)}
                    >
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <Link
                            to={`/compliance/${obligation.obligation_id}`}
                            className="inline-flex items-center justify-center p-1 bg-[#8cc63e] text-white rounded hover:bg-[#7ab83a] transition-colors"
                            title="View Details"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          </Link>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEditClick(obligation)}
                                className="inline-flex items-center justify-center p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                title="Edit"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteClick(obligation)}
                                className="inline-flex items-center justify-center p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                title="Delete"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 relative max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {obligation.name}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate hidden sm:block">
                          {obligation.description?.substring(0, 40)}...
                        </div>
                        
                        {/* Hover Tooltip */}
                        {hoveredObligation === obligation.id && (
                          <div className="absolute left-0 top-full mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-start">
                                <h4 className="text-xs font-semibold text-gray-900 break-words">{obligation.name}</h4>
                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ml-1 flex-shrink-0 ${getStatusBadge(obligation.current_status)}`}>
                                  {obligation.current_status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 break-words">{obligation.description}</p>
                              <div className="grid grid-cols-2 gap-1 text-[10px]">
                                <div>
                                  <span className="font-medium text-gray-500">ID:</span>
                                  <span className="ml-1 text-gray-700">{obligation.obligation_id}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Type:</span>
                                  <span className="ml-1 text-gray-700">{obligation.obligation_type}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Domain:</span>
                                  <span className="ml-1 text-gray-700">{obligation.domain}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Freq:</span>
                                  <span className="ml-1 text-gray-700">{obligation.frequency}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Due:</span>
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
                                <div className="col-span-2">
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
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                      Mandatory
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-2 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-900">
                          {obligation.domain}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-2 py-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getFrequencyBadge(obligation.frequency)}`}
                        >
                          {obligation.frequency}
                        </span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <span className={`text-xs ${dueDateColor}`}>
                            {formatDate(dueDate)}
                          </span>
                          {isOverdue && dueDate && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium bg-red-100 text-red-800">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getStatusBadge(obligation.current_status)}`}
                        >
                          {obligation.current_status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Obligation Modal */}
      {showAddModal && (isAdmin || canAddEvent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex justify-between items-center z-10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Add New {addFormData.obligation_type === "Cyclic" ? "Cyclic Based" : "Event Based"} Obligation
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
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

            <form onSubmit={handleAddSubmit} className="p-3 sm:p-6">
              {addError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                  {addError}
                </div>
              )}
              {addSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm">
                  {addSuccess}
                </div>
              )}

              {/* Event template selector */}
              {addFormData.obligation_type === "Event" && eventTemplates.length > 0 && (
                <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template (Auto-fill fields below)
                  </label>
                  <select
                    onChange={handleTemplateSelect}
                    value={selectedTemplate?.id || ""}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="">Select a template...</option>
                    {eventTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.obligation_id})
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Template selected: {selectedTemplate.name}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obligation ID *
                  </label>
                  <input
                    type="text"
                    name="obligation_id"
                    value={addFormData.obligation_id}
                    onChange={handleAddInputChange}
                    placeholder="e.g., MS-027"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                  <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy *
                  </label>
                  <select
                    name="policy_id"
                    value={addFormData.policy_id || ""}
                    onChange={handleAddInputChange}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="">Select Policy</option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name} - {policy.version}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obligation Name *
                  </label>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={nameSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNameSearchTerm(value);
                        handleNameSearch(value);
                        setAddFormData(prev => ({ ...prev, name: value }));
                      }}
                      onFocus={() => {
                        if (nameSearchTerm && filteredNameOptions.length > 0) {
                          setShowNameDropdown(true);
                        }
                      }}
                      placeholder="Type to search..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                    />
                    {showNameDropdown && filteredNameOptions.length > 0 && (
                      <div 
                        ref={nameDropdownRef}
                        className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 sm:max-h-60 overflow-y-auto"
                      >
                        {filteredNameOptions.map((name, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                            onClick={() => handleNameSelect(name)}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {addFormData.obligation_type === "Event" 
                      ? "Select from existing Event obligations to auto-fill fields" 
                      : "Start typing to search existing obligation names"}
                  </p>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={addFormData.description}
                    onChange={handleAddInputChange}
                    rows="2 sm:rows-3"
                    placeholder="Enter description"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    {addFormData.obligation_type === "Cyclic" ? (
                      <>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Yearly">Yearly</option>
                        <option value="Annual">Annual</option>
                        <option value="Bi-Annual">Bi-Annual</option>
                        <option value="Continuous">Continuous</option>
                      </>
                    ) : (
                      <option value="Event Based">Event Based</option>
                    )}
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
                    placeholder="e.g., End of Month"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calculated Due Date
                  </label>
                  <input
                    type="date"
                    name="calculated_due_date"
                    value={addFormData.calculated_due_date || ""}
                    onChange={handleAddInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region
                  </label>
                  {isAdmin ? (
                    <input
                      type="text"
                      name="region"
                      value={addFormData.region}
                      onChange={handleAddInputChange}
                      placeholder="e.g., Region C1, Region C2"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                    />
                  ) : (
                    <input
                      type="text"
                      name="region"
                      value={userRegion || ""}
                      disabled
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  )}
                  {!isAdmin && userRegion && (
                    <p className="text-xs text-gray-500 mt-1">
                      Region: {userRegion} (auto-assigned)
                    </p>
                  )}
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Due Today">Due Today</option>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    placeholder="e.g., PDF, Excel"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Upload">Upload</option>
                    <option value="Integrate">Integrate</option>
                    <option value="Monitor">Monitor</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
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
                        Manual Upload
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

              <div className="mt-4 sm:mt-6 flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full xs:flex-1 bg-[#ff0099] text-white py-2 rounded-md hover:bg-[#e40076] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
                  onClick={() => {
                    setShowAddModal(false);
                    setAddError("");
                    setAddSuccess("");
                    setNameSearchTerm("");
                    setSelectedTemplate(null);
                  }}
                  className="w-full xs:flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm sm:text-base"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex justify-between items-center z-10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Edit Obligation - {editingObligation.obligation_id}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
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

            <form onSubmit={handleEditSubmit} className="p-3 sm:p-6">
              {editError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={editFormData.description}
                    onChange={handleEditInputChange}
                    rows="2 sm:rows-3"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Annual">Annual</option>
                    <option value="Bi-Annual">Bi-Annual</option>
                    <option value="Continuous">Continuous</option>
                    <option value="Event Based">Event Based</option>
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
                    placeholder="e.g., End of Month"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    placeholder="e.g., PDF, Excel"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Due Today">Due Today</option>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
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
                        Manual Upload
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

              <div className="mt-4 sm:mt-6 flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-full xs:flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
                  className="w-full xs:flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm sm:text-base"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 sm:p-6">
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

              <div className="flex flex-col xs:flex-row space-y-2 xs:space-y-0 xs:space-x-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="w-full xs:flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
                  className="w-full xs:flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
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