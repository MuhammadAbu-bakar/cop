import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../api/supabase";
import {
  getEvidence,
  addComment,
  getActivityHistory,
  updateObligationStatus,
} from "../../api/compliance";

const ObligationDetails = () => {
  // Get params from URL - using 'id' because that's what's in the route
  const { id } = useParams();
  const obligationId = id; // Rename for clarity
  const navigate = useNavigate();
  const { profile } = useAuth();
  const fileInputRef = useRef(null);
  const templateFileInputRef = useRef(null);

  const [obligation, setObligation] = useState(null);
  const [instances, setInstances] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateUploadError, setTemplateUploadError] = useState("");

  useEffect(() => {
    if (obligationId) {
      console.log("Fetching obligation for ID:", obligationId);
      fetchObligationDetails();
    } else {
      console.error("No obligation ID provided in URL");
      console.log("Current URL:", window.location.pathname);
      setError("No obligation ID provided. Please check the URL.");
      setLoading(false);
    }
  }, [obligationId]);

  useEffect(() => {
    if (obligation) {
      fetchTemplates();
    }
  }, [obligation]);

  const fetchObligationDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching obligation with ID:", obligationId);

      // 1. Fetch obligation details directly using supabase
      const { data: obligationData, error: obligationError } = await supabase
        .from("obligations")
        .select(
          `
          *,
          policy:policies(*)
        `,
        )
        .eq("obligation_id", obligationId)
        .single();

      if (obligationError) {
        console.error("Error fetching obligation:", obligationError);
        console.log("Looking for obligation_id:", obligationId);

        // Try to fetch all obligations to see what's available
        const { data: allObligations } = await supabase
          .from("obligations")
          .select("obligation_id, name")
          .limit(10);

        console.log("Available obligations:", allObligations);

        if (allObligations && allObligations.length > 0) {
          const availableIds = allObligations
            .map((o) => o.obligation_id)
            .join(", ");
          setError(
            `Obligation "${obligationId}" not found. Available IDs: ${availableIds}`,
          );
        } else {
          setError(
            `Obligation "${obligationId}" not found. No obligations exist in the database.`,
          );
        }
        setLoading(false);
        return;
      }

      if (!obligationData) {
        console.log("No obligation found for ID:", obligationId);
        setError("Obligation not found");
        setLoading(false);
        return;
      }

      console.log("Obligation found:", obligationData);
      setObligation(obligationData);

      // 2. Fetch obligation instances
      const { data: instancesData, error: instancesError } = await supabase
        .from("obligation_instances")
        .select("*")
        .eq("obligation_id", obligationData.id)
        .order("due_date", { ascending: true });

      if (instancesError) {
        console.error("Error fetching instances:", instancesError);
        setInstances([]);
      } else {
        console.log("Instances found:", instancesData?.length || 0);
        setInstances(instancesData || []);
      }

      // 3. Fetch evidence
      const { data: evidenceData } = await getEvidence(obligationData.id);
      setEvidence(evidenceData || []);

      // 4. Fetch activity history
      const { data: activityData } = await getActivityHistory(
        obligationData.id,
      );
      setActivities(activityData || []);
    } catch (error) {
      console.error("Error fetching obligation details:", error);
      setError("An unexpected error occurred: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!obligation) return;
    
    setTemplateLoading(true);
    try {
      // Use bucket "template" with folder structure
      const folderPath = `obligations/${obligation.obligation_id}/templates/`;
      
      const { data, error } = await supabase.storage
        .from("template")
        .list(folderPath);

      if (error) {
        console.error("Error fetching templates:", error);
        setTemplates([]);
        return;
      }

      // Filter out folders and get only files
      const files = data.filter(item => !item.id.endsWith('/'));
      
      // Get public URLs for each file
      const templatesWithUrls = await Promise.all(
        files.map(async (file) => {
          const { data: urlData } = supabase.storage
            .from("template")
            .getPublicUrl(`${folderPath}${file.name}`);
          
          return {
            ...file,
            url: urlData.publicUrl,
            fullPath: `${folderPath}${file.name}`
          };
        })
      );

      setTemplates(templatesWithUrls);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setTemplates([]);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !obligation) return;

    setTemplateUploadError("");
    setTemplateUploading(true);

    try {
      // Create folder path for this obligation's templates
      const folderPath = `obligations/${obligation.obligation_id}/templates/`;
      const filePath = `${folderPath}${file.name}`;

      // Upload file to template bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("template")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true, // Overwrite if exists
        });

      if (uploadError) throw uploadError;

      // Refresh templates list
      await fetchTemplates();

      // Reset file input
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = "";
      }

      alert(`Template "${file.name}" uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading template:", error);
      setTemplateUploadError(error.message || "Failed to upload template");
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleTemplateDownload = async (template) => {
    try {
      // Download the file from template bucket
      const response = await fetch(template.url);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = template.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download template. Please try again.");
    }
  };

  const handleTemplateDelete = async (template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      const { error } = await supabase.storage
        .from("template")
        .remove([template.fullPath]);

      if (error) throw error;

      // Refresh templates list
      await fetchTemplates();
      alert(`Template "${template.name}" deleted successfully!`);
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template. Please try again.");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Completed: "bg-green-100 text-green-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Overdue: "bg-red-100 text-red-800",
      "Not Started": "bg-gray-100 text-gray-800",
      Submitted: "bg-purple-100 text-purple-800",
      Approved: "bg-emerald-100 text-emerald-800",
      Closed: "bg-gray-100 text-gray-800",
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

  const handleStatusUpdate = async (newStatus) => {
    if (!obligation) return;

    try {
      await updateObligationStatus(obligation.id, newStatus, comment);

      if (newStatus === "Completed" || newStatus === "Closed") {
        const { error: updateInstancesError } = await supabase
          .from("obligation_instances")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("obligation_id", obligation.id)
          .in("status", ["Pending", "In Progress"]);

        if (updateInstancesError) {
          console.error("Error updating instances:", updateInstancesError);
        }
      }

      fetchObligationDetails();
      setComment("");
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleInstanceStatusUpdate = async (instanceId, status) => {
    try {
      const { error } = await supabase
        .from("obligation_instances")
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          ...(status === "Submitted" && {
            submitted_by: profile?.id || null,
            submitted_at: new Date().toISOString(),
          }),
          ...(status === "Approved" && {
            approved_by: profile?.id || null,
            approved_at: new Date().toISOString(),
          }),
        })
        .eq("id", instanceId);

      if (error) throw error;

      await supabase.from("activity_history").insert({
        obligation_id: obligation.id,
        instance_id: instanceId,
        action: `Instance status updated to ${status}`,
        user_id: profile?.id || null,
        user_name: profile?.full_name || "System",
        details: { comment: comment || "Status updated" },
      });

      const { data: allInstances } = await supabase
        .from("obligation_instances")
        .select("status")
        .eq("obligation_id", obligation.id);

      const allCompleted = allInstances?.every(
        (inst) => inst.status === "Completed" || inst.status === "Approved",
      );

      if (allCompleted && allInstances?.length > 0) {
        await updateObligationStatus(
          obligation.id,
          "Completed",
          "All instances completed",
        );
      }

      fetchObligationDetails();
      setComment("");
    } catch (error) {
      console.error("Error updating instance status:", error);
      alert("Failed to update instance status. Please try again.");
    }
  };

  const getAllowedFileTypes = (evidenceType) => {
    const typeMap = {
      PDF: {
        extensions: [".pdf"],
        mimeTypes: ["application/pdf"],
        accept: ".pdf",
        label: "PDF files only (.pdf)",
      },
      Word: {
        extensions: [".doc", ".docx"],
        mimeTypes: [
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        accept: ".doc,.docx",
        label: "Word files only (.doc, .docx)",
      },
      Excel: {
        extensions: [".xls", ".xlsx", ".csv"],
        mimeTypes: [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
        ],
        accept: ".xls,.xlsx,.csv",
        label: "Excel files only (.xls, .xlsx, .csv)",
      },
      PowerPoint: {
        extensions: [".ppt", ".pptx"],
        mimeTypes: [
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        accept: ".ppt,.pptx",
        label: "PowerPoint files only (.ppt, .pptx)",
      },
      Images: {
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"],
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/bmp",
          "image/webp",
        ],
        accept: ".jpg,.jpeg,.png,.gif,.bmp,.webp",
        label: "Image files only (.jpg, .png, .gif, etc.)",
      },
      Photos: {
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"],
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/bmp",
          "image/webp",
        ],
        accept: ".jpg,.jpeg,.png,.gif,.bmp,.webp",
        label: "Photo files only (.jpg, .png, .gif, etc.)",
      },
      "Audit Report": {
        extensions: [".pdf", ".doc", ".docx"],
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        accept: ".pdf,.doc,.docx",
        label: "PDF or Word files only",
      },
      "PM Form": {
        extensions: [".pdf", ".doc", ".docx"],
        mimeTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        accept: ".pdf,.doc,.docx",
        label: "PDF or Word files only",
      },
    };

    return (
      typeMap[evidenceType] || {
        extensions: [],
        mimeTypes: [],
        accept: "*",
        label: "All file types",
      }
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError("");
    setSelectedFile(null);

    if (!obligation?.evidence_type) {
      setUploadError("No evidence type specified for this obligation.");
      e.target.value = "";
      return;
    }

    const allowedTypes = getAllowedFileTypes(obligation.evidence_type);

    if (allowedTypes.accept === "*") {
      setSelectedFile(file);
      return;
    }

    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    const isValidExtension = allowedTypes.extensions.some((ext) =>
      fileExtension.toLowerCase().includes(ext.toLowerCase()),
    );

    if (!isValidExtension) {
      setUploadError(`Invalid file type. Please upload: ${allowedTypes.label}`);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !obligation) return;

    setUploading(true);
    setUploadError("");

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create a unique file name
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `${obligation.obligation_id}/${fileName}`;

      // Upload to Supabase Storage bucket "obligation_evidence"
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("obligation_evidence")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(uploadError.message || "Failed to upload file");
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("obligation_evidence")
        .getPublicUrl(filePath);

      // Save evidence record to database
      const { data: evidenceData, error: evidenceError } = await supabase
        .from("evidence")
        .insert({
          obligation_id: obligation.id,
          instance_id: null,
          file_name: selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          uploaded_by: user.id,
          status: "Approved",
          comments: "Evidence uploaded successfully",
        })
        .select();

      if (evidenceError) throw evidenceError;

      // Update obligation status to "Completed"
      await updateObligationStatus(
        obligation.id,
        "Completed",
        "Evidence uploaded and obligation completed",
      );

      // Update all pending instances to Completed
      await supabase
        .from("obligation_instances")
        .update({
          status: "Completed",
          updated_at: new Date().toISOString(),
        })
        .eq("obligation_id", obligation.id)
        .in("status", ["Pending", "In Progress"]);

      await fetchObligationDetails();
      alert(
        "Evidence uploaded successfully! Obligation status updated to Completed.",
      );
      setSelectedFile(null);
      // Reset the file input using the ref
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading evidence:", error);
      setUploadError(
        error.message || "Failed to upload evidence. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !obligation) return;

    try {
      await addComment(obligation.id, comment);
      fetchObligationDetails();
      setComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  console.log("Current state:", {
    loading,
    error,
    obligationId,
    hasObligation: !!obligation,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading obligation details...</p>
          <p className="text-xs text-gray-400 mt-2">
            ID: {obligationId || "No ID provided"}
          </p>
        </div>
      </div>
    );
  }

  if (error || !obligation) {
    return (
      <div className="text-center py-8 sm:py-12 max-w-2xl mx-auto px-4">
        <div className="mb-4">
          <svg
            className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto"
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
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          {error || "Obligation not found"}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          The obligation "{obligationId || "No ID"}" couldn't be loaded.
        </p>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left overflow-x-auto">
          <p className="text-xs sm:text-sm text-gray-500">Debug Info:</p>
          <p className="text-xs text-gray-400 mt-1 break-all">
            Obligation ID from URL: {obligationId || "Not provided"}
          </p>
          <p className="text-xs text-gray-400 break-all">Error: {error || "Not found"}</p>
        </div>
        <button
          onClick={() => navigate("/compliance")}
          className="mt-4 bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] text-sm sm:text-base"
        >
          Back to Register
        </button>
      </div>
    );
  }

  const allowedTypes = obligation.evidence_type
    ? getAllowedFileTypes(obligation.evidence_type)
    : { accept: "*", label: "All file types" };

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
            {obligation.obligation_id}
          </h1>
          <p className="text-sm text-gray-600 break-words">{obligation.name}</p>
        </div>
        <button
          onClick={() => navigate("/compliance")}
          className="w-full sm:w-auto bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm sm:text-base"
        >
          Back to Register
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Overview
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Obligation ID
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.obligation_id || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Policy</dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-words">
                  {obligation.policy?.name || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Clause</dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.clause || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Domain</dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.domain || "N/A"}
                </dd>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Description
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-words">
                  {obligation.description || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Responsible
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.responsible || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Accountable
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.accountable || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Frequency</dt>
                <dd className="mt-1">
                  <span
                    className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full ${getFrequencyBadge(obligation.frequency)}`}
                  >
                    {obligation.frequency || "N/A"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Due Date Rule
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.due_date_rule || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full ${getStatusBadge(obligation.current_status)}`}
                  >
                    {obligation.current_status || "N/A"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Compliance Weight
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                  {obligation.compliance_weight || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Source System
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.source_system || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Portal Action
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.portal_action || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Evidence Required
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                  {obligation.evidence_required ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Evidence Type
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.evidence_type || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">
                  Manual Upload Required
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                  {obligation.manual_upload_required ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Mandatory</dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                  {obligation.mandatory ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500">Region</dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-all">
                  {obligation.region || "N/A"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Obligation Instances */}
          {instances.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Obligation Instances
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {instances.map((instance) => (
                      <tr key={instance.id}>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          {instance.period || "N/A"}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          {formatDate(instance.due_date)}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-full ${getStatusBadge(instance.status)}`}
                          >
                            {instance.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          <select
                            onChange={(e) =>
                              handleInstanceStatusUpdate(
                                instance.id,
                                e.target.value,
                              )
                            }
                            value={instance.status}
                            className="text-xs sm:text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                          >
                            <option value="Not Started">Not Started</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Approved">Approved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status Update */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Update Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                "Not Started",
                "Pending",
                "In Progress",
                "Completed",
                "Overdue",
                "Closed",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
                    obligation.current_status === status
                      ? `bg-${getStatusColor(status)}-600 text-white`
                      : `bg-${getStatusColor(status)}-100 text-${getStatusColor(status)}-700 hover:bg-${getStatusColor(status)}-200`
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Comments & Activity
            </h3>
            <div className="space-y-3 sm:space-y-4 max-h-60 overflow-y-auto">
              {activities.map((activity) => (
                <div key={activity.id} className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-1 sm:gap-0">
                    <span className="font-medium text-xs sm:text-sm text-gray-900">
                      {activity.user_name || "System"}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                    {activity.action}
                  </p>
                  {activity.details?.comment && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 italic break-words">
                      "{activity.details.comment}"
                    </p>
                  )}
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-xs sm:text-sm text-gray-500 text-center py-4">
                  No activity yet
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
              />
              <button
                onClick={handleAddComment}
                className="w-full sm:w-auto bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] text-sm sm:text-base"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Evidence Upload */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Evidence
            </h3>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center">
                <svg
                  className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <p className="mt-2 text-xs sm:text-sm text-gray-600">
                  Upload evidence documents
                </p>
                {obligation.evidence_type && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                    Allowed: {allowedTypes.label}
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  accept={allowedTypes.accept}
                  className="mt-2 block w-full text-xs sm:text-sm text-gray-500 file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-md file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-[#8cc63e]/10 file:text-[#8cc63e] hover:file:bg-[#8cc63e]/20"
                />
                {uploadError && (
                  <div className="mt-2 text-xs sm:text-sm text-red-600 break-words">
                    {uploadError}
                  </div>
                )}
                {selectedFile && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs sm:text-sm text-green-700 font-medium break-words">
                      File selected: {selectedFile.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-green-600">
                      Size: {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={handleFileUpload}
                      disabled={uploading}
                      className="w-full mt-2 bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {uploading ? (
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
                          Uploading...
                        </>
                      ) : (
                        "Upload Evidence"
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Evidence List */}
              {evidence.map((item) => (
                <div key={item.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                        {item.file_name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        Uploaded: {formatDateTime(item.uploaded_at)}
                      </p>
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full ${getStatusBadge(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-900 flex-shrink-0"
                      >
                        <svg
                          className="h-5 w-5"
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
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {evidence.length === 0 && (
                <p className="text-xs sm:text-sm text-gray-500 text-center py-2">
                  No evidence uploaded yet
                </p>
              )}
            </div>
          </div>

          {/* Evidence Templates - Using bucket "template" */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Evidence Templates
            </h3>
            <div className="space-y-4">
              {/* Upload Template */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <svg
                  className="h-8 w-8 text-gray-400 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">
                  Upload template file
                </p>
                <input
                  ref={templateFileInputRef}
                  type="file"
                  onChange={handleTemplateUpload}
                  disabled={templateUploading}
                  className="mt-2 block w-full text-xs sm:text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {templateUploadError && (
                  <div className="mt-2 text-xs text-red-600 break-words">
                    {templateUploadError}
                  </div>
                )}
                {templateUploading && (
                  <div className="mt-2 text-xs text-gray-500">
                    <svg
                      className="animate-spin h-4 w-4 inline mr-2"
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
                    Uploading...
                  </div>
                )}
              </div>

              {/* Templates List */}
              {templateLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8cc63e] mx-auto"></div>
                  <p className="mt-2 text-xs text-gray-500">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs sm:text-sm text-gray-500">
                    No templates available
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Upload a template file to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                            {template.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {template.metadata?.size && (
                              <span className="text-[10px] text-gray-500">
                                {formatFileSize(template.metadata.size)}
                              </span>
                            )}
                            {template.updated_at && (
                              <span className="text-[10px] text-gray-500">
                                Updated: {formatDate(template.updated_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleTemplateDownload(template)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Download template"
                          >
                            <svg
                              className="h-4 w-4"
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
                          </button>
                          <button
                            onClick={() => handleTemplateDelete(template)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Delete template"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function for status colors
const getStatusColor = (status) => {
  const colors = {
    "Not Started": "gray",
    Pending: "yellow",
    "In Progress": "blue",
    Completed: "green",
    Overdue: "red",
    Closed: "gray",
  };
  return colors[status] || "gray";
};

export default ObligationDetails;