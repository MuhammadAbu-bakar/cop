import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";
import { 
  getObligations, 
  getObligationByObligationId,
  getRegions,
  getPolicies
} from "../../api/compliance";

const ComplianceRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;
  const canAddEvent = isAdmin || profile?.role === "regional_user";
  
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [hoveredObligation, setHoveredObligation] = useState(null);
  const [activeTab, setActiveTab] = useState("todo");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const searchTimeoutRef = useRef(null);
  const [regions, setRegions] = useState([]);

  // Event tab filters
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [eventFilterDomain, setEventFilterDomain] = useState("all");

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
    policy: "",
    clause: "",
    domain: "",
    obligation_name: "",
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
    current_status: "Open",
    region: userRegion || "",
    calculated_due_date: "",
    obligation_type: "Cyclic",
  });

  // Message state for center display
  const [message, setMessage] = useState({ text: "", type: "", visible: false });

  const [selectedTemplate, setSelectedTemplate] = useState(null);
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
    obligation_name: "",
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

  const [policies, setPolicies] = useState([]);
  const [eventObligationsData, setEventObligationsData] = useState([]);
  const [allEventObligations, setAllEventObligations] = useState([]);
  const [expandedObligationId, setExpandedObligationId] = useState(null);

  // Month options
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

  // Get current year for display
  const currentYear = new Date().getFullYear();

  // Show center message
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type, visible: true });
    setTimeout(() => {
      setMessage({ text: "", type: "", visible: false });
    }, 5000);
  };

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const monthParam = params.get('month');
    const regionParam = params.get('region');
    
    if (statusParam) setFilterStatus(statusParam);
    if (monthParam) setFilterMonth(monthParam);
    if (regionParam) setFilterRegion(regionParam);
  }, [location.search]);

  // Initial fetch
  useEffect(() => {
    fetchObligations();
    fetchPolicies();
    fetchObligationNameOptions();
    fetchAllEventObligations();
    fetchRegions();
  }, []);

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Re-fetch when filters change (except search - handled separately)
  useEffect(() => {
    // Don't fetch on search term change if it's the same as debounced
    if (searchTerm === debouncedSearchTerm) {
      // Only fetch if other filters changed
      fetchObligations();
    }
  }, [filterStatus, filterDomain, filterRegion, filterMonth, activeTab]);

  // Fetch when debounced search term changes
  useEffect(() => {
    fetchObligations();
  }, [debouncedSearchTerm]);

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

  const fetchRegions = async () => {
    try {
      const result = await getRegions();
      if (result.data) {
        setRegions(result.data);
      }
    } catch (error) {
      console.error("Error fetching regions:", error);
    }
  };

  // Fetch all event obligations
  const fetchAllEventObligations = async () => {
    try {
      const { data: eventObligations, error: eventError } = await supabase
        .from('event_obligations')
        .select('*')
        .order('name');

      if (eventError) throw eventError;
      setAllEventObligations(eventObligations || []);
    } catch (error) {
      console.error('Error fetching all event obligations:', error);
    }
  };

  // Fetch obligations using the API function
  const fetchObligations = async () => {
    setLoading(true);
    try {
      const filters = {};
      
      if (filterDomain && filterDomain !== 'all') {
        filters.domain = filterDomain;
      }
      
      if (filterStatus && filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      
      if (debouncedSearchTerm) {
        filters.search = debouncedSearchTerm;
      }
      
      if (activeTab === 'eventlist') {
        filters.obligation_type = 'Event';
      }

      // Pass month filter
      if (filterMonth) {
        filters.month = filterMonth;
      }
      // Always pass current year
      filters.year = currentYear.toString();

      console.log('📊 Fetching obligations with filters:', filters);
      console.log('👤 User region:', userRegion, 'Is Admin:', isAdmin);

      const result = await getObligations(filters, userRegion, isAdmin);
      
      if (result.error) {
        console.error("❌ Error fetching obligations:", result.error);
        showMessage("Failed to load obligations. Please refresh the page.", "error");
        setObligations([]);
      } else {
        console.log('✅ Obligations fetched successfully:', result.data?.length || 0, 'records');
        
        if (result.data && result.data.length > 0) {
          console.log('📅 Sample obligation calculated_due_date:', result.data[0].calculated_due_date);
          console.log('📅 Sample obligation occurrence_date:', result.data[0].occurrence_date);
          console.log('📅 Sample obligation frequency:', result.data[0].frequency);
          console.log('📅 Sample obligation current_status:', result.data[0].current_status);
          console.log('📅 Sample obligation region:', result.data[0].region);
          console.log('📅 Sample obligation region_id:', result.data[0].region_id);
        }
        
        setObligations(result.data || []);
      }
    } catch (error) {
      console.error("❌ Error fetching obligations:", error);
      showMessage("Failed to load obligations. Please refresh the page.", "error");
      setObligations([]);
    } finally {
      setLoading(false);
    }
  };

  // Add event obligation - FIXED
  const handleAddEventObligation = async (eventObligation) => {
    try {
      setAddLoading(true);
      setAddError("");
      
      const regionId = await getRegionId(userRegion || eventObligation.region);
      
      // Generate obligation ID if not provided
      let obligationId = eventObligation.obligation_id;
      if (!obligationId) {
        const existingIds = obligations
          .map((o) => o.obligation_id)
          .filter((id) => id && id.startsWith("MS-"))
          .map((id) => parseInt(id.replace("MS-", "")))
          .filter((num) => !isNaN(num));
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const nextId = maxId + 1;
        obligationId = `MS-${String(nextId).padStart(3, "0")}`;
      }

      // Check if obligation already exists in compliance_obligations
      const { data: existing, error: checkError } = await supabase
        .from("compliance_obligations")
        .select("obligation_id")
        .eq("obligation_id", obligationId)
        .single();

      let obligationExists = false;
      let obligationData = null;

      if (existing) {
        obligationExists = true;
        console.log('📋 Obligation already exists in compliance_obligations:', obligationId);
        
        const { data: existingObligation, error: fetchError } = await supabase
          .from("compliance_obligations")
          .select("*")
          .eq("obligation_id", obligationId)
          .single();
        
        if (fetchError) {
          throw fetchError;
        }
        obligationData = existingObligation;
      } else {
        const { data, error } = await supabase
          .from("compliance_obligations")
          .insert({
            obligation_id: obligationId,
            policy: eventObligation.policy || "",
            clause: eventObligation.clause || "",
            domain: eventObligation.domain || "",
            obligation_name: eventObligation.name || "",
            description: eventObligation.description || "",
            responsible: eventObligation.responsible || "",
            accountable: eventObligation.accountable || "",
            frequency: eventObligation.frequency || "Event Based",
            due_date_rule: eventObligation.due_date_rule || "",
            evidence_required: eventObligation.evidence_required || false,
            evidence_type: eventObligation.evidence_type || "",
            source_system: eventObligation.source_system || "",
            portal_action: eventObligation.portal_action || "Upload",
            manual_upload_required: eventObligation.manual_upload_required || false,
            mandatory: eventObligation.mandatory || false,
            compliance_weight: parseInt(eventObligation.compliance_weight) || 1,
            region: eventObligation.region || userRegion || "",
            calculated_due_date: eventObligation.calculated_due_date || null,
            obligation_type: "Event",
          })
          .select();

        if (error) {
          console.error('Error inserting obligation:', error);
          throw error;
        }
        obligationData = data[0];
      }

      // Check if progress record already exists for this obligation and region
      if (regionId && obligationData) {
        const { data: existingProgress, error: progressCheckError } = await supabase
          .from("compliance_progress")
          .select("id")
          .eq("obligation_id", obligationData.obligation_id)
          .eq("region_id", regionId)
          .maybeSingle();

        if (progressCheckError) {
          console.error('Error checking progress:', progressCheckError);
          throw progressCheckError;
        }

        if (existingProgress) {
          showMessage(`Event obligation "${eventObligation.name}" already has progress records.`, "info");
          setAddLoading(false);
          await fetchObligations();
          await fetchAllEventObligations();
          return;
        }

        const currentDate = new Date();
        const { error: progressError } = await supabase
          .from('compliance_progress')
          .insert({
            obligation_id: obligationData.obligation_id,
            region_id: regionId,
            occurrence_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0],
            status: 'Open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (progressError) {
          console.error('Error inserting progress:', progressError);
          if (!obligationExists) {
            await supabase
              .from("compliance_obligations")
              .delete()
              .eq("obligation_id", obligationId);
          }
          throw progressError;
        }

        showMessage(`Event obligation "${eventObligation.name}" added successfully with status "Open"!`, "success");
      } else {
        showMessage(`Event obligation "${eventObligation.name}" added successfully!`, "success");
      }

      await fetchObligations();
      await fetchAllEventObligations();
      
    } catch (error) {
      console.error("Error adding event obligation:", error);
      setAddError(error.message || "Failed to add event obligation.");
      showMessage(`❌ ${error.message || "Failed to add event obligation."}`, "error");
    } finally {
      setAddLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const result = await getPolicies();
      if (result.data) {
        setPolicies(result.data);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  const fetchObligationNameOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("event_obligations")
        .select("name, obligation_id, clause, domain, description, responsible, accountable, frequency, due_date_rule, evidence_required, evidence_type, source_system, portal_action, manual_upload_required, mandatory, compliance_weight, region, calculated_due_date")
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

  // Status badge
  const getStatusBadge = (status) => {
    const badges = {
      'Open': "bg-gray-100 text-gray-800",
      'Submitted/Under Review': "bg-yellow-100 text-yellow-800",
      'Closed': "bg-green-100 text-green-800",
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

  const getEventDomains = () => {
    const domains = new Set(allEventObligations.map((o) => o.domain));
    return ["all", ...domains];
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
      obligation_name: selectedName,
    }));
    setNameSearchTerm(selectedName);
    setFilteredNameOptions(obligationNameOptions);
    setShowNameDropdown(false);

    const obligationData = fetchEventObligationDataByName(selectedName);
    if (obligationData) {
      setAddFormData(prev => ({
        ...prev,
        obligation_id: obligationData.obligation_id || prev.obligation_id,
        policy: obligationData.policy || prev.policy,
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
      policy: "",
      clause: "",
      domain: "",
      obligation_name: "",
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
      current_status: "Open",
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
        .from("compliance_obligations")
        .select("obligation_id")
        .eq("obligation_id", obligationId)
        .single();

      if (existing) {
        setAddError(`Obligation ID ${obligationId} already exists.`);
        showMessage(`Obligation ID ${obligationId} already exists.`, "warning");
        setAddLoading(false);
        return;
      }

      const regionId = await getRegionId(addFormData.region || userRegion);

      const { data, error } = await supabase
        .from("compliance_obligations")
        .insert({
          obligation_id: obligationId,
          policy: addFormData.policy || "",
          clause: addFormData.clause,
          domain: addFormData.domain,
          obligation_name: addFormData.obligation_name,
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
          region: addFormData.region || userRegion,
          calculated_due_date: addFormData.calculated_due_date || null,
          obligation_type: addFormData.obligation_type,
        })
        .select();

      if (error) throw error;

      if (addFormData.obligation_type === "Event" && regionId && data && data[0]) {
        const currentDate = new Date();
        await supabase
          .from('compliance_progress')
          .insert({
            obligation_id: data[0].obligation_id,
            region_id: regionId,
            occurrence_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0],
            status: 'Open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      setAddSuccess(`Obligation ${obligationId} created successfully!`);
      showMessage(`Obligation ${obligationId} created successfully!`, "success");
      
      setShowAddModal(false);
      setAddFormData({
        obligation_id: "",
        policy: "",
        clause: "",
        domain: "",
        obligation_name: "",
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
        current_status: "Open",
        region: userRegion || "",
        calculated_due_date: "",
        obligation_type: "Cyclic",
      });
      setNameSearchTerm("");
      setFilteredNameOptions(obligationNameOptions);
      setAddLoading(false);
      
      await fetchObligations();
      await fetchObligationNameOptions();
      await fetchAllEventObligations();
      
    } catch (error) {
      console.error("Error creating obligation:", error);
      setAddError(error.message || "Failed to create obligation.");
      showMessage(`❌ ${error.message || "Failed to create obligation."}`, "error");
      setAddLoading(false);
    }
  };

  const handleEditClick = (obligation) => {
    setEditingObligation(obligation);
    setEditFormData({
      obligation_name: obligation.obligation_name || "",
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
      current_status: obligation.current_status || "Open",
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
        .from("compliance_obligations")
        .update({
          obligation_name: editFormData.obligation_name,
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

      if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          const currentDate = new Date();
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

          const { data: progress } = await supabase
            .from('compliance_progress')
            .select('id')
            .eq('obligation_id', editingObligation.obligation_id)
            .eq('region_id', regionId)
            .gte('occurrence_date', startDate)
            .lte('occurrence_date', endDate)
            .single();

          if (progress) {
            await supabase
              .from('compliance_progress')
              .update({
                status: editFormData.current_status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', progress.id);
          }
        }
      }

      await fetchObligations();
      setShowEditModal(false);
      setEditingObligation(null);
      setEditLoading(false);
      showMessage(`✅ Obligation updated successfully!`, "success");
    } catch (error) {
      console.error("Error updating obligation:", error);
      setEditError(error.message || "Failed to update obligation.");
      showMessage(`❌ ${error.message || "Failed to update obligation."}`, "error");
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
      
      await supabase
        .from('compliance_progress')
        .delete()
        .eq('obligation_id', deletingObligation.obligation_id);

      const { error: deleteError } = await supabase
        .from("compliance_obligations")
        .delete()
        .eq("id", deletingObligation.id);

      if (deleteError) throw deleteError;

      await fetchObligations();
      await fetchObligationNameOptions();
      await fetchAllEventObligations();
      setShowDeleteModal(false);
      setDeletingObligation(null);
      setDeleteLoading(false);
      showMessage(`Obligation ${obligationId} deleted successfully!`, "success");
    } catch (error) {
      console.error("Error deleting obligation:", error);
      setDeleteError(error.message || "Failed to delete obligation.");
      showMessage(`❌ ${error.message || "Failed to delete obligation."}`, "error");
      setDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setFilterStatus("all");
    setFilterDomain("all");
    setFilterRegion("all");
    setFilterMonth("");
    setSortField(null);
    setSortDirection('asc');
    navigate('/compliance', { replace: true });
    showMessage("Filters cleared", "info");
  };

  const clearEventFilters = () => {
    setEventSearchTerm("");
    setEventFilterDomain("all");
    showMessage("Event filters cleared", "info");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const toggleObligationName = (id) => {
    setExpandedObligationId(expandedObligationId === id ? null : id);
  };

  // Get filtered and sorted obligations
  const getFilteredAndSortedObligations = () => {
    console.log('📋 Filtering obligations with:', {
      activeTab,
      filterStatus,
      filterDomain,
      filterRegion,
      filterMonth,
      searchTerm: debouncedSearchTerm,
      totalObligations: obligations.length
    });

    let filtered = [...obligations];

    // Filter by obligation type based on tab
    if (activeTab === "todo") {
      filtered = filtered.filter(o => o.obligation_type === "Cyclic" || o.obligation_type === "Event");
    } else if (activeTab === "eventlist") {
      filtered = filtered.filter(o => o.obligation_type === "Event");
    }

    if (filtered.length > 0) {
      console.log('📅 Sample filtered obligation calculated_due_date:', filtered[0]?.calculated_due_date);
      console.log('📅 Sample filtered obligation occurrence_date:', filtered[0]?.occurrence_date);
      console.log('📅 Sample filtered obligation current_status:', filtered[0]?.current_status);
      
      const years = new Set();
      filtered.forEach(o => {
        if (o.calculated_due_date) {
          const year = new Date(o.calculated_due_date).getFullYear();
          years.add(year);
        }
      });
      console.log('📅 Years present in calculated_due_date:', [...years]);
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const name = item.obligation_name || '';
        const description = item.description || '';
        const obligationId = item.obligation_id || '';
        
        return name.toLowerCase().includes(searchLower) ||
          description.toLowerCase().includes(searchLower) ||
          obligationId.toLowerCase().includes(searchLower);
      });
    }

    // Apply status filter
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter((item) => {
        const status = item.current_status || 'Open';
        return status === filterStatus;
      });
    }

    // Apply domain filter
    if (filterDomain && filterDomain !== 'all') {
      filtered = filtered.filter((item) => {
        return item.domain === filterDomain;
      });
    }

    // Apply region filter (admin only)
    if (isAdmin && filterRegion && filterRegion !== 'all') {
      const selectedRegion = regions.find(r => r.name === filterRegion);
      console.log('🔍 Filtering by region:', filterRegion, 'Selected region object:', selectedRegion);
      
      filtered = filtered.filter((item) => {
        // Check 1: Direct region field match
        if (item.region && item.region === filterRegion) {
          console.log('✅ Matched by region field:', item.obligation_id);
          return true;
        }
        
        // Check 2: region_id match
        if (selectedRegion && item.region_id === selectedRegion.id) {
          console.log('✅ Matched by region_id:', item.obligation_id);
          return true;
        }
        
        // Check 3: Check progress records for region match
        if (item.progressRecords && Array.isArray(item.progressRecords) && item.progressRecords.length > 0) {
          const hasMatchingProgress = item.progressRecords.some(progress => {
            // Check progress.region.name
            if (progress.region && progress.region.name === filterRegion) {
              return true;
            }
            // Check progress.region_id
            if (selectedRegion && progress.region_id === selectedRegion.id) {
              return true;
            }
            return false;
          });
          if (hasMatchingProgress) {
            console.log('✅ Matched by progress records:', item.obligation_id);
            return true;
          }
        }
        
        // Check 4: Check latestProgress
        if (item.latestProgress) {
          if (item.latestProgress.region && item.latestProgress.region.name === filterRegion) {
            console.log('✅ Matched by latestProgress region:', item.obligation_id);
            return true;
          }
          if (selectedRegion && item.latestProgress.region_id === selectedRegion.id) {
            console.log('✅ Matched by latestProgress region_id:', item.obligation_id);
            return true;
          }
        }
        
        return false;
      });
      console.log(`📊 Filtered by region: ${filterRegion}, ${filtered.length} remaining`);
    }

    // Apply month filter
    if (filterMonth) {
      filtered = filtered.filter((item) => {
        const dueDate = item.calculated_due_date;
        if (!dueDate) return false;
        
        const [, month] = dueDate.split('-');
        return month === filterMonth;
      });
    }

    // Apply sorting
    if (sortField === 'dueDate') {
      filtered.sort((a, b) => {
        const dateA = a.calculated_due_date ? new Date(a.calculated_due_date) : new Date(0);
        const dateB = b.calculated_due_date ? new Date(b.calculated_due_date) : new Date(0);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (sortField === 'status') {
      const statusOrder = {
        'Closed': 1,
        'Submitted/Under Review': 2,
        'Open': 3,
      };
      filtered.sort((a, b) => {
        const aStatus = a.current_status || 'Open';
        const bStatus = b.current_status || 'Open';
        const aVal = statusOrder[aStatus] || 999;
        const bVal = statusOrder[bStatus] || 999;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    console.log(`📊 Filtered ${filtered.length} obligations`);
    return filtered;
  };

  const getFilteredEventObligations = () => {
    let filtered = allEventObligations;

    if (eventSearchTerm) {
      const term = eventSearchTerm.toLowerCase();
      filtered = filtered.filter(event => 
        event.name?.toLowerCase().includes(term) ||
        event.obligation_id?.toLowerCase().includes(term) ||
        event.description?.toLowerCase().includes(term)
      );
    }

    if (eventFilterDomain !== "all") {
      filtered = filtered.filter(event => event.domain === eventFilterDomain);
    }

    return filtered;
  };

  const filteredObligations = getFilteredAndSortedObligations();
  const filteredEventObligations = getFilteredEventObligations();

  const getTodoCount = () => {
    const todoObligations = obligations.filter(o => o.obligation_type === "Cyclic" || o.obligation_type === "Event");
    return todoObligations.length;
  };

  const getEventCount = () => {
    return allEventObligations.length;
  };

  const updateUrlParams = () => {
    const params = new URLSearchParams();
    if (filterStatus && filterStatus !== 'all') {
      params.set('status', filterStatus);
    }
    if (filterMonth) {
      params.set('month', filterMonth);
    }
    if (isAdmin && filterRegion && filterRegion !== 'all') {
      params.set('region', filterRegion);
    }
    navigate(`/compliance${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
  };

  // Render tooltip for obligation details
  const renderTooltip = (obligation, dueDateColor, dueDate) => {
    const status = obligation.current_status || 'Open';
    return (
      <div className="absolute left-0 top-full mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-start">
            <h4 className="text-xs font-semibold text-gray-900 break-words">{obligation.obligation_name}</h4>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ml-1 flex-shrink-0 ${getStatusBadge(status)}`}>
              {status}
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
    );
  };

  // Render tooltip for event obligations
  const renderEventTooltip = (event) => {
    return (
      <div className="absolute left-0 top-full mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-start">
            <h4 className="text-xs font-semibold text-gray-900 break-words">{event.name}</h4>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-orange-100 text-orange-800">
              Event
            </span>
          </div>
          <p className="text-xs text-gray-600 break-words">{event.description || 'No description'}</p>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="col-span-2">
              <span className="font-medium text-gray-500">ID:</span>
              <span className="ml-1 text-gray-700">{event.obligation_id || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Domain:</span>
              <span className="ml-1 text-gray-700">{event.domain || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Frequency:</span>
              <span className="ml-1 text-gray-700">{event.frequency || 'Event Based'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Weight:</span>
              <span className="ml-1 text-gray-700">{event.compliance_weight || 1}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Responsible:</span>
              <span className="ml-1 text-gray-700">{event.responsible || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Accountable:</span>
              <span className="ml-1 text-gray-700">{event.accountable || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Clause:</span>
              <span className="ml-1 text-gray-700">{event.clause || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-500">Region:</span>
              <span className="ml-1 text-gray-700">{event.region || 'N/A'}</span>
            </div>
            {event.evidence_required && (
              <div className="col-span-2">
                <span className="font-medium text-gray-500">Evidence:</span>
                <span className="ml-1 text-gray-700">{event.evidence_type || 'Required'}</span>
              </div>
            )}
            {event.mandatory && (
              <div className="col-span-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                  Mandatory
                </span>
              </div>
            )}
            {event.due_date_rule && (
              <div className="col-span-2">
                <span className="font-medium text-gray-500">Due Date Rule:</span>
                <span className="ml-1 text-gray-700">{event.due_date_rule}</span>
              </div>
            )}
            {event.calculated_due_date && (
              <div className="col-span-2">
                <span className="font-medium text-gray-500">Calculated Due Date:</span>
                <span className="ml-1 text-gray-700">{formatDate(event.calculated_due_date)}</span>
              </div>
            )}
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
          <p className="mt-4 text-gray-600">Loading obligations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2 sm:px-3 relative">
      {/* Center Message */}
      {message.visible && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
          <div className={`px-6 py-4 rounded-lg shadow-2xl max-w-md w-full text-center pointer-events-auto ${
            message.type === 'success' ? 'bg-green-500' :
            message.type === 'error' ? 'bg-red-500' :
            message.type === 'warning' ? 'bg-yellow-500' :
            'bg-blue-500'
          } text-white`}>
            <div className="flex items-center justify-center">
              {message.type === 'success' && (
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {message.type === 'error' && (
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {message.type === 'warning' && (
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {message.type === 'info' && (
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Compliance Register
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === "todo" 
              ? `${filteredObligations.length} obligations found`
              : `${filteredEventObligations.length} event obligations available`
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
            <span className="ml-2 inline-flex items-center">
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                Y{currentYear}
              </span>
            </span>
            {filterStatus !== "all" && activeTab === "todo" && (
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
            {filterMonth && activeTab === "todo" && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {months.find(m => m.value === filterMonth)?.label} {currentYear}
                </span>
                <button
                  onClick={() => {
                    setFilterMonth("");
                    updateUrlParams();
                  }}
                  className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </span>
            )}
            {isAdmin && filterRegion !== "all" && activeTab === "todo" && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Region: {filterRegion}
                </span>
                <button
                  onClick={() => {
                    setFilterRegion("all");
                    updateUrlParams();
                  }}
                  className="ml-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </span>
            )}
            {sortField && activeTab === "todo" && (
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
            {(eventSearchTerm || eventFilterDomain !== "all") && activeTab === "eventlist" && (
              <span className="ml-2 inline-flex items-center">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Filters applied
                </span>
                <button
                  onClick={clearEventFilters}
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
            onClick={() => setActiveTab("todo")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "todo"
                ? "border-[#8cc63e] text-[#8cc63e]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            To Do
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {getTodoCount()}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("eventlist")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "eventlist"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Event List
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {getEventCount()}
            </span>
          </button>
        </nav>
      </div>

      {/* Event Tab Filters */}
      {activeTab === "eventlist" && (
        <div className="bg-white rounded-lg shadow p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                value={eventSearchTerm}
                onChange={(e) => setEventSearchTerm(e.target.value)}
                placeholder="Search by name, ID..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              />
            </div>
            <div>
              <select
                value={eventFilterDomain}
                onChange={(e) => setEventFilterDomain(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              >
                {getEventDomains().map((domain) => (
                  <option key={domain} value={domain}>
                    {domain === "all" ? "All Domains" : domain}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button
                onClick={clearEventFilters}
                className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters - Only show for To Do tab */}
      {activeTab === "todo" && (
        <div className="bg-white rounded-lg shadow p-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3">
            <div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, or description..."
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
                <option value="Open">Open</option>
                <option value="Submitted/Under Review">Submitted/Under Review</option>
                <option value="Closed">Closed</option>
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
            {/* Region Filter - Admin Only */}
            {isAdmin && (
              <div>
                <select
                  value={filterRegion}
                  onChange={(e) => {
                    setFilterRegion(e.target.value);
                    updateUrlParams();
                  }}
                  className="w-full px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                >
                  <option value="all">All Regions</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Event List Tab */}
      {activeTab === "eventlist" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                    Obligation Name
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEventObligations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-2 py-8 text-center text-gray-500 text-sm">
                      No event obligations available.
                    </td>
                  </tr>
                ) : (
                  filteredEventObligations.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-gray-50 transition-colors relative"
                      onMouseEnter={() => setHoveredObligation(event.id)}
                      onMouseLeave={() => setHoveredObligation(null)}
                    >
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button
                          onClick={() => handleAddEventObligation(event)}
                          disabled={addLoading}
                          className="inline-flex items-center justify-center px-3 py-1 bg-[#ff0099] text-white text-xs rounded hover:bg-[#e40076] transition-colors disabled:opacity-50"
                        >
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add
                        </button>
                      </td>
                      <td className="px-2 py-2 relative max-w-[200px] sm:max-w-[250px] md:max-w-[300px]">
                        <div 
                          className="text-xs sm:text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-[#8cc63e] transition-colors"
                          onClick={() => toggleObligationName(event.id)}
                          title={event.name}
                        >
                          {event.name}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          ID: {event.obligation_id || 'N/A'}
                        </div>
                        {expandedObligationId === event.id && (
                          <div 
                            className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 cursor-pointer"
                            onClick={() => toggleObligationName(event.id)}
                          >
                            <p className="text-sm font-medium text-gray-900 break-words">{event.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Click to collapse</p>
                          </div>
                        )}
                        {hoveredObligation === event.id && !expandedObligationId && renderEventTooltip(event)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-xs text-gray-900">
                          {event.domain || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-orange-100 text-orange-800">
                          {event.frequency || 'Event Based'}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-xs text-gray-600 truncate max-w-[150px] sm:max-w-[200px]">
                          {event.description || 'No description'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* To Do Tab */}
      {activeTab === "todo" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
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
                      {!isAdmin && userRegion 
                        ? `No obligations found for region: ${userRegion}`
                        : "No obligations found matching your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredObligations.map((obligation, index) => {
                    const dueDate = obligation.calculated_due_date;
                    const isOverdue = isDueDateOverdue(dueDate);
                    const dueDateColor = getDueDateColor(dueDate);
                    const status = obligation.current_status || 'Open';
                    const uniqueKey = `${obligation.id}-${index}`;

                    return (
                      <tr
                        key={uniqueKey}
                        className="hover:bg-gray-50 transition-colors relative"
                        onMouseEnter={() => setHoveredObligation(uniqueKey)}
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
                        <td className="px-2 py-2 relative max-w-[200px] sm:max-w-[250px] md:max-w-[300px]">
                          <div 
                            className="text-xs sm:text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-[#8cc63e] transition-colors"
                            onClick={() => toggleObligationName(uniqueKey)}
                            title={obligation.obligation_name}
                          >
                            {obligation.obligation_name}
                            {obligation.obligation_type === "Event" && (
                              <span className="ml-1 text-[10px] text-orange-500 font-normal">
                                (Event)
                              </span>
                            )}
                            {obligation.occurrence_date && (
                              <span className="ml-1 text-[10px] text-gray-400 font-normal">
                                (Occurrence: {formatDate(obligation.occurrence_date)})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate hidden sm:block">
                            {obligation.description?.substring(0, 40)}...
                          </div>
                          
                          {expandedObligationId === uniqueKey && (
                            <div 
                              className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 cursor-pointer"
                              onClick={() => toggleObligationName(uniqueKey)}
                            >
                              <p className="text-sm font-medium text-gray-900 break-words">{obligation.obligation_name}</p>
                              <p className="text-xs text-gray-500 mt-1">Click to collapse</p>
                            </div>
                          )}
                          
                          {hoveredObligation === uniqueKey && !expandedObligationId && renderTooltip(obligation, dueDateColor, dueDate)}
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
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getStatusBadge(status)}`}
                          >
                            {status}
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
      )}

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
                    placeholder="e.g., NOM-MS-027"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  />
                  <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy
                  </label>
                  <select
                    name="policy"
                    value={addFormData.policy || ""}
                    onChange={handleAddInputChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                  >
                    <option value="">Select Policy</option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.name}>
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
                        setAddFormData(prev => ({ ...prev, obligation_name: value }));
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
                    Clause
                  </label>
                  <input
                    type="text"
                    name="clause"
                    value={addFormData.clause}
                    onChange={handleAddInputChange}
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
                    <option value="Open">Open</option>
                    <option value="Submitted/Under Review">Submitted/Under Review</option>
                    <option value="Closed">Closed</option>
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

      {/* Edit Modal */}
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
                    name="obligation_name"
                    value={editFormData.obligation_name}
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
                    <option value="Open">Open</option>
                    <option value="Submitted/Under Review">Submitted/Under Review</option>
                    <option value="Closed">Closed</option>
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

      {/* Delete Confirmation Modal */}
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
                cannot be undone and will also delete all related progress records.
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