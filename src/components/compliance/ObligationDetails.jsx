import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../api/supabase";

const ObligationDetails = () => {
  const { id } = useParams();
  const obligationId = id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const userRegion = profile?.region_name || null;
  const fileInputRef = useRef(null);
  const templateFileInputRef = useRef(null);

  const [obligation, setObligation] = useState(null);
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
  const [regionProgress, setRegionProgress] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [progressRecords, setProgressRecords] = useState([]);

  // Message state for center display
  const [message, setMessage] = useState({ text: "", type: "", visible: false });

  // Show center message
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type, visible: true });
    setTimeout(() => {
      setMessage({ text: "", type: "", visible: false });
    }, 5000);
  };

  useEffect(() => {
    if (obligationId) {
      fetchObligationDetails();
    } else {
      setError("No obligation ID provided. Please check the URL.");
      setLoading(false);
    }
  }, [obligationId]);

  useEffect(() => {
    if (obligation) {
      fetchTemplates();
      fetchRegionProgress();
      fetchOccurrences();
      checkPendingApproval();
      fetchProgressRecords();
    }
  }, [obligation]);

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

  const fetchRegionProgress = async () => {
    if (!obligation || !userRegion || isAdmin) return;

    try {
      const regionId = await getRegionId(userRegion);
      if (!regionId) return;

      const { data, error } = await supabase
        .from('compliance_progress')
        .select('*')
        .eq('obligation_id', obligation.obligation_id)
        .eq('region_id', regionId)
        .order('occurrence_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      setRegionProgress(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching region progress:', error);
    }
  };

  const fetchProgressRecords = async () => {
    if (!obligation) return;

    try {
      let query = supabase
        .from('compliance_progress')
        .select(`
          *,
          region:regions(id, name, code)
        `)
        .eq('obligation_id', obligation.obligation_id)
        .order('occurrence_date', { ascending: false });

      if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          query = query.eq('region_id', regionId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setProgressRecords(data || []);
    } catch (error) {
      console.error('Error fetching progress records:', error);
    }
  };

  const fetchOccurrences = async () => {
    if (!obligation || !userRegion || isAdmin) return;

    try {
      const regionId = await getRegionId(userRegion);
      if (!regionId) return;

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('compliance_progress')
        .select('*')
        .eq('obligation_id', obligation.obligation_id)
        .eq('region_id', regionId)
        .gte('occurrence_date', startDate)
        .lte('occurrence_date', endDate)
        .order('occurrence_date', { ascending: true });

      if (error) throw error;
      setOccurrences(data || []);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
    }
  };

  const checkPendingApproval = async () => {
    if (!obligation || !isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('compliance_progress')
        .select(`
          *,
          evidence:evidence!left(
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
        .eq('obligation_id', obligation.obligation_id)
        .eq('status', 'Submitted/Under Review')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      setPendingApproval(data?.[0] || null);
    } catch (error) {
      console.error('Error checking pending approval:', error);
    }
  };

  const fetchObligationDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: obligationData, error: obligationError } = await supabase
        .from("compliance_obligations")
        .select(`*`)
        .eq("obligation_id", obligationId)
        .single();

      if (obligationError) {
        console.error("Error fetching obligation:", obligationError);
        setError("Obligation not found");
        setLoading(false);
        return;
      }

      if (!obligationData) {
        setError("Obligation not found");
        setLoading(false);
        return;
      }

      setObligation(obligationData);

      // Fetch evidence
      let evidenceQuery = supabase
        .from('evidence')
        .select(`
          *,
          progress:compliance_progress(
            id,
            occurrence_date,
            status,
            region:regions(id, name, code)
          )
        `)
        .eq('obligation_id', obligationData.obligation_id)
        .order('uploaded_at', { ascending: false });

      if (!isAdmin && userRegion) {
        const regionId = await getRegionId(userRegion);
        if (regionId) {
          evidenceQuery = evidenceQuery.eq('region_id', regionId);
        }
      }

      const { data: evidenceData, error: evidenceError } = await evidenceQuery;
      if (!evidenceError) {
        setEvidence(evidenceData || []);
      }

      // Fetch activity history
      const { data: activityData, error: activityError } = await supabase
        .from('activity_history')
        .select('*')
        .eq('obligation_id', obligationData.obligation_id)
        .order('created_at', { ascending: false });

      if (!activityError) {
        setActivities(activityData || []);
      }

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
      const folderPath = `obligations/${obligation.obligation_id}/templates/`;
      
      const { data, error } = await supabase.storage
        .from("template")
        .list(folderPath);

      if (error) {
        setTemplates([]);
        return;
      }

      const files = data.filter(item => !item.id.endsWith('/'));
      
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
      const folderPath = `obligations/${obligation.obligation_id}/templates/`;
      const filePath = `${folderPath}${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("template")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await fetchTemplates();

      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = "";
      }

      showMessage(`Template "${file.name}" uploaded successfully!`, "success");
    } catch (error) {
      console.error("Error uploading template:", error);
      setTemplateUploadError(error.message || "Failed to upload template");
      showMessage("Failed to upload template", "error");
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleTemplateDownload = async (template) => {
    try {
      const response = await fetch(template.url);
      const blob = await response.blob();
      
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
      showMessage("Failed to download template. Please try again.", "error");
    }
  };

  const handleTemplateDelete = async (template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      const { error } = await supabase.storage
        .from("template")
        .remove([template.fullPath]);

      if (error) throw error;

      await fetchTemplates();
      showMessage(`Template "${template.name}" deleted successfully!`, "success");
    } catch (error) {
      console.error("Error deleting template:", error);
      showMessage("Failed to delete template. Please try again.", "error");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Open': "bg-gray-100 text-gray-800",
      'Submitted/Under Review': "bg-yellow-100 text-yellow-800",
      'Closed': "bg-green-100 text-green-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status) => {
    const colors = {
      "Open": "gray",
      "Submitted/Under Review": "yellow",
      "Closed": "green",
    };
    return colors[status] || "gray";
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

    if (!isAdmin && userRegion) {
      const regionId = await getRegionId(userRegion);
      if (!regionId) {
        showMessage("Region not found for user.", "error");
        return;
      }

      try {
        // Find the current progress record or create one
        let progressId = null;
        const { data: existingProgress, error: findError } = await supabase
          .from('compliance_progress')
          .select('id, status, occurrence_date')
          .eq('obligation_id', obligation.obligation_id)
          .eq('region_id', regionId)
          .order('occurrence_date', { ascending: false })
          .limit(1);

        if (findError) throw findError;

        if (existingProgress && existingProgress.length > 0) {
          progressId = existingProgress[0].id;
          
          const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
          };

          if (comment) {
            updateData.comments = comment;
          }

          const { error: updateError } = await supabase
            .from('compliance_progress')
            .update(updateData)
            .eq('id', progressId);

          if (updateError) throw updateError;
        } else {
          // Create new progress record
          const currentDate = new Date();
          const dueDate = obligation.calculated_due_date || 
            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

          const { error: insertError } = await supabase
            .from('compliance_progress')
            .insert({
              obligation_id: obligation.obligation_id,
              region_id: regionId,
              occurrence_date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0],
              status: newStatus,
              comments: comment || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) throw insertError;
        }

        await Promise.all([
          fetchRegionProgress(),
          fetchObligationDetails(),
          fetchProgressRecords(),
          fetchOccurrences()
        ]);

        showMessage(`Status updated to "${newStatus}" for region ${userRegion}`, "success");
        setComment("");
      } catch (error) {
        console.error("Error updating status:", error);
        showMessage("Failed to update status. Please try again.", "error");
      }
      return;
    }

    // Admin status update
    try {
      const { error } = await supabase
        .from("compliance_obligations")
        .update({
          current_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", obligation.id);

      if (error) throw error;

      // Update all open progress records
      if (newStatus === "Closed") {
        await supabase
          .from("compliance_progress")
          .update({
            status: "Closed",
            updated_at: new Date().toISOString()
          })
          .eq("obligation_id", obligation.obligation_id)
          .in("status", ["Open", "Submitted/Under Review"]);
      }

      // Add activity
      await supabase.from("activity_history").insert({
        obligation_id: obligation.id,
        action: `Status updated to ${newStatus}`,
        user_id: profile?.id || null,
        user_name: profile?.full_name || "System",
        details: { comment: comment || "Status updated" },
        created_at: new Date().toISOString()
      });

      fetchObligationDetails();
      setComment("");
      showMessage(`Status updated to "${newStatus}"`, "success");
    } catch (error) {
      console.error("Error updating status:", error);
      showMessage("Failed to update status. Please try again.", "error");
    }
  };

  const getProgressStatusForRegion = (regionId) => {
    const record = progressRecords.find(p => p.region_id === regionId);
    return record?.status || 'Open';
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
      if (!isAdmin && !userRegion) {
        throw new Error('Your profile does not have a region assigned. Please contact your administrator.');
      }

      const regionId = await getRegionId(userRegion);
      if (!regionId && !isAdmin) {
        throw new Error('Region not found for user.');
      }

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      let progressId = null;
      
      // Find or create progress record for this obligation in the current month
      if (!isAdmin && regionId) {
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data: existingProgress, error: findError } = await supabase
          .from('compliance_progress')
          .select('id')
          .eq('obligation_id', obligation.obligation_id)
          .eq('region_id', regionId)
          .gte('occurrence_date', startDate)
          .lte('occurrence_date', endDate)
          .limit(1);

        if (findError) throw findError;

        if (existingProgress && existingProgress.length > 0) {
          progressId = existingProgress[0].id;
        } else {
          // Create new progress record
          const dueDate = obligation.calculated_due_date || 
            new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

          const { data: newProgress, error: insertError } = await supabase
            .from('compliance_progress')
            .insert({
              obligation_id: obligation.obligation_id,
              region_id: regionId,
              occurrence_date: new Date(year, month, 1).toISOString().split('T')[0],
              status: 'Open',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select();

          if (insertError) throw insertError;
          if (newProgress && newProgress[0]) {
            progressId = newProgress[0].id;
          }
        }
      }

      if (!progressId) {
        throw new Error('Could not find or create a progress record for this month.');
      }

      // Upload the file
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `evidence/${obligation.id}/${progressId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('obligation_evidence')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('obligation_evidence')
        .getPublicUrl(filePath);

      // Save evidence record
      const { data: evidenceData, error: evidenceError } = await supabase
        .from('evidence')
        .insert({
          obligation_id: obligation.obligation_id,
          occurrence_id: progressId,
          region_id: regionId,
          file_name: selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          uploaded_by: profile?.id || null,
          status: 'Pending'
        })
        .select();

      if (evidenceError) throw evidenceError;

      // Update progress status to "Submitted/Under Review"
      if (evidenceData && evidenceData[0]) {
        const updateResult = await supabase
          .from('compliance_progress')
          .update({
            status: 'Submitted/Under Review',
            evidence_id: evidenceData[0].id,
            uploaded_by: profile?.id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', progressId)
          .select();

        if (updateResult.error) {
          console.error('Error updating progress status:', updateResult.error);
          throw updateResult.error;
        }

        showMessage('Evidence submitted for review. Status updated to "Submitted/Under Review"', "success");
      }

      // Refresh data
      await Promise.all([
        fetchObligationDetails(),
        fetchRegionProgress(),
        fetchOccurrences(),
        checkPendingApproval(),
        fetchProgressRecords()
      ]);
      
      showMessage(`Evidence uploaded successfully${!isAdmin && userRegion ? ` for region ${userRegion}` : ''}!`, "success");
      setSelectedFile(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading evidence:", error);
      setUploadError(
        error.message || "Failed to upload evidence. Please try again.",
      );
      showMessage("Failed to upload evidence: " + error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingApproval) return;

    try {
      const { error } = await supabase
        .from('compliance_progress')
        .update({
          status: 'Closed',
          updated_by: profile?.id || null,
          comments: comment || 'Approved by admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingApproval.id);

      if (error) throw error;

      await supabase.from("activity_history").insert({
        obligation_id: obligation.id,
        progress_id: pendingApproval.id,
        action: 'Approved and closed',
        user_id: profile?.id || null,
        user_name: profile?.full_name || "System",
        details: { comment: comment || "Approved by admin" },
        created_at: new Date().toISOString()
      });

      showMessage('Occurrence approved and closed successfully!', "success");
      setComment('');
      await Promise.all([
        fetchObligationDetails(),
        checkPendingApproval(),
        fetchProgressRecords()
      ]);
    } catch (error) {
      console.error('Error approving:', error);
      showMessage('Failed to approve. Please try again.', "error");
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;

    try {
      const { error } = await supabase
        .from('compliance_progress')
        .update({
          status: 'Open',
          updated_by: profile?.id || null,
          comments: comment || 'Rejected, please resubmit',
          updated_at: new Date().toISOString()
        })
        .eq('id', pendingApproval.id);

      if (error) throw error;

      await supabase.from("activity_history").insert({
        obligation_id: obligation.id,
        progress_id: pendingApproval.id,
        action: 'Rejected',
        user_id: profile?.id || null,
        user_name: profile?.full_name || "System",
        details: { comment: comment || "Rejected by admin" },
        created_at: new Date().toISOString()
      });

      showMessage('Occurrence rejected successfully!', "success");
      setComment('');
      await Promise.all([
        fetchObligationDetails(),
        checkPendingApproval(),
        fetchProgressRecords()
      ]);
    } catch (error) {
      console.error('Error rejecting:', error);
      showMessage('Failed to reject. Please try again.', "error");
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !obligation) return;

    try {
      await supabase.from("activity_history").insert({
        obligation_id: obligation.id,
        action: 'Comment added',
        user_id: profile?.id || null,
        user_name: profile?.full_name || "System",
        details: { comment: comment },
        created_at: new Date().toISOString()
      });

      fetchObligationDetails();
      setComment("");
      showMessage("Comment added successfully", "success");
    } catch (error) {
      console.error("Error adding comment:", error);
      showMessage("Failed to add comment. Please try again.", "error");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading obligation details...</p>
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
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0 relative">
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
            {obligation.obligation_id}
          </h1>
          <p className="text-sm text-gray-600 break-words">{obligation.obligation_name}</p>
          {!isAdmin && userRegion && (
            <span className="inline-flex items-center mt-1">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Region: {userRegion}
              </span>
              {regionProgress && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${getStatusBadge(regionProgress.status)}`}>
                  Status: {regionProgress.status}
                </span>
              )}
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center mt-1">
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                Admin - All Regions
              </span>
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/compliance")}
          className="w-full sm:w-auto bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm sm:text-base"
        >
          Back to Register
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
                  {obligation.policy || "N/A"}
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

          

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Update Status {!isAdmin && userRegion && `(Region: ${userRegion})`}
            </h3>
            <div className="flex flex-wrap gap-2">
              {["Open", "Submitted/Under Review", "Closed"].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm ${
                    (obligation.current_status === status) ||
                    (regionProgress?.status === status && !isAdmin && userRegion)
                      ? `bg-${getStatusColor(status)}-600 text-white`
                      : `bg-${getStatusColor(status)}-100 text-${getStatusColor(status)}-700 hover:bg-${getStatusColor(status)}-200`
                  }`}
                >
                  {status}
                  {!isAdmin && userRegion && regionProgress?.status === status && (
                    <span className="ml-1 text-[8px]">✓</span>
                  )}
                </button>
              ))}
            </div>
            {!isAdmin && userRegion && regionProgress && (
              <p className="text-xs text-gray-500 mt-2">
                Current region status: <span className="font-medium">{regionProgress.status}</span>
                {regionProgress.occurrence_date && ` • Occurrence: ${formatDate(regionProgress.occurrence_date)}`}
              </p>
            )}
          </div>

          {/* Admin Approval Actions */}
          {isAdmin && pendingApproval && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-l-4 border-yellow-400">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Pending Approval
              </h3>
              <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border border-yellow-200 mb-4">
                <p className="text-sm text-yellow-800">
                  This obligation has been submitted for review and is waiting for your approval.
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Region: <span className="font-medium">{pendingApproval.region?.name || "N/A"}</span>
                </p>
                {pendingApproval.comments && (
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Submission Note:</span> {pendingApproval.comments}
                  </p>
                )}
                {pendingApproval.evidence && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700">Evidence:</p>
                    <a 
                      href={pendingApproval.evidence.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#8cc63e] hover:underline text-sm flex items-center gap-1"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {pendingApproval.evidence.file_name}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApprove}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors text-sm"
                >
                  Approve & Close
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors text-sm"
                >
                  Reject
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {comment ? `Comment: "${comment}"` : 'Add a comment in the box below before approving or rejecting.'}
              </p>
            </div>
          )}

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

        <div className="space-y-4 sm:space-y-6">
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
                      {item.region_id && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-800">
                          Region
                        </span>
                      )}
                      {item.occurrence_id && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-800">
                          Progress
                        </span>
                      )}
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

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Evidence Templates
            </h3>
            <div className="space-y-4">
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

export default ObligationDetails;