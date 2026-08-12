import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../api/supabase";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("policies");

  const tabs = [
    {
      id: "policies",
      name: "Policies",
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      id: "obligations",
      name: "Obligations",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
      id: "users",
      name: "Users",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      id: "regions",
      name: "Regions",
      icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "master-data",
      name: "Master Data",
      icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#8cc63e] text-[#8cc63e]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
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
                    d={tab.icon}
                  />
                </svg>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "policies" && <ManagePolicies />}
          {activeTab === "obligations" && <ManageObligations />}
          {activeTab === "users" && <ManageUsers />}
          {activeTab === "regions" && <ManageRegions />}
          {activeTab === "master-data" && <ManageMasterData />}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MANAGE POLICIES COMPONENT (FULL FUNCTIONAL)
// ============================================
const ManagePolicies = () => {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef(null);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("policies_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (
      !allowedTypes.includes(file.type) &&
      !file.name.match(/\.(pdf|doc|docx|txt)$/i)
    ) {
      setUploadError("Please upload PDF, Word, or Text files only.");
      e.target.value = "";
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be less than 10MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadError("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    if (!title.trim()) {
      setUploadError("Please enter a title for the policy.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExtension = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}_${title.replace(/\s+/g, "_")}.${fileExtension}`;
      const filePath = `policies/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("policies")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload file");
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("policies")
        .getPublicUrl(filePath);

      // Save to database
      const { data: policyData, error: policyError } = await supabase
        .from("policies_documents")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_name: selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          uploaded_by: user.id,
          status: "Active",
        })
        .select();

      if (policyError) throw policyError;

      setUploadSuccess("Policy uploaded successfully!");
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchPolicies();

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess("");
      }, 1500);
    } catch (error) {
      console.error("Error uploading policy:", error);
      setUploadError(
        error.message || "Failed to upload policy. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (policyId) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;

    setDeleteLoading(true);
    try {
      const policy = policies.find((p) => p.id === policyId);
      if (!policy) throw new Error("Policy not found");

      // Delete from storage
      const filePath = policy.file_url.split("/").pop();
      const { error: storageError } = await supabase.storage
        .from("policies")
        .remove([`policies/${filePath}`]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("policies_documents")
        .delete()
        .eq("id", policyId);

      if (dbError) throw dbError;

      await fetchPolicies();
      alert("Policy deleted successfully!");
    } catch (error) {
      console.error("Error deleting policy:", error);
      alert("Failed to delete policy. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString) => {
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

  const getFileIcon = (fileType) => {
    if (fileType?.includes("pdf")) {
      return (
        <svg
          className="h-8 w-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    } else if (fileType?.includes("word") || fileType?.includes("document")) {
      return (
        <svg
          className="h-8 w-8 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    } else {
      return (
        <svg
          className="h-8 w-8 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Manage Policies</h3>
          <p className="text-sm text-gray-500">
            {policies.length} policies found
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowUploadModal(true);
              setUploadError("");
              setUploadSuccess("");
            }}
            className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center"
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
            Upload Policy
          </button>
        )}
      </div>

      {/* Policies Grid */}
      {policies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                    {getFileIcon(policy.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {policy.title}
                    </h4>
                    {policy.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {policy.description}
                      </p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(policy.id)}
                    disabled={deleteLoading}
                    className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">File:</span>
                  <span className="text-gray-700 truncate max-w-[150px]">
                    {policy.file_name}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Size:</span>
                  <span className="text-gray-700">
                    {formatFileSize(policy.file_size)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Uploaded:</span>
                  <span className="text-gray-700">
                    {formatDate(policy.uploaded_at)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex space-x-2">
                <a
                  href={policy.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#8cc63e] text-white text-sm py-1.5 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center justify-center"
                >
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  View
                </a>
                <a
                  href={policy.file_url}
                  download
                  className="flex-1 bg-gray-200 text-gray-700 text-sm py-1.5 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  <svg
                    className="h-4 w-4 mr-1"
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
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="h-16 w-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h4 className="text-lg font-medium text-gray-900">
            No policies uploaded
          </h4>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? "Upload your first policy document to get started."
              : "No policies have been uploaded yet."}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors"
            >
              Upload Policy
            </button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Policy Document
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError("");
                  setUploadSuccess("");
                }}
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

            <div className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-md">
                  {uploadSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter policy title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter policy description (optional)"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#8cc63e]/10 file:text-[#8cc63e] hover:file:bg-[#8cc63e]/20"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, Word, Text (Max 10MB)
                </p>
                {selectedFile && (
                  <p className="text-sm text-[#8cc63e] mt-2">
                    Selected: {selectedFile.name} (
                    {formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    "Upload Policy"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError("");
                    setUploadSuccess("");
                  }}
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

// ============================================
// MANAGE OBLIGATIONS COMPONENT
// ============================================
const ManageObligations = () => {
  const [obligations] = useState([
    {
      id: 1,
      name: "Network Security Audit",
      frequency: "Monthly",
      owner: "John Smith",
      status: "Active",
    },
    {
      id: 2,
      name: "Data Backup Verification",
      frequency: "Quarterly",
      owner: "Sarah Johnson",
      status: "Active",
    },
    {
      id: 3,
      name: "Access Control Review",
      frequency: "Monthly",
      owner: "Mike Chen",
      status: "Inactive",
    },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Manage Obligations
        </h3>
        <button className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors text-sm">
          Add Obligation
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Obligation
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Frequency
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {obligations.map((obligation) => (
              <tr key={obligation.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {obligation.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {obligation.frequency}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {obligation.owner}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      obligation.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {obligation.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <button className="text-[#8cc63e] hover:text-[#7ab83a] mr-3">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MANAGE USERS COMPONENT
// ============================================
const ManageUsers = () => {
  const [users] = useState([
    {
      id: 1,
      name: "John Smith",
      email: "john@example.com",
      role: "Regional User",
      region: "North America",
      status: "Active",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah@example.com",
      role: "Reviewer",
      region: "Europe",
      status: "Active",
    },
    {
      id: 3,
      name: "Mike Chen",
      email: "mike@example.com",
      role: "Management",
      region: "Asia Pacific",
      status: "Inactive",
    },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Manage Users</h3>
        <button className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors text-sm">
          Add User
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Region
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{user.role}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {user.region}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <button className="text-[#8cc63e] hover:text-[#7ab83a] mr-3">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MANAGE REGIONS COMPONENT
// ============================================
const ManageRegions = () => {
  const [regions] = useState([
    {
      id: 1,
      name: "North America",
      code: "NA",
      obligations: 89,
      status: "Active",
    },
    { id: 2, name: "Europe", code: "EU", obligations: 67, status: "Active" },
    {
      id: 3,
      name: "Asia Pacific",
      code: "APAC",
      obligations: 54,
      status: "Active",
    },
    {
      id: 4,
      name: "Middle East",
      code: "ME",
      obligations: 23,
      status: "Active",
    },
    { id: 5, name: "Africa", code: "AF", obligations: 12, status: "Inactive" },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Manage Regions</h3>
        <button className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors text-sm">
          Add Region
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Region
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Obligations
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {regions.map((region) => (
              <tr key={region.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {region.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {region.code}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {region.obligations}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      region.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {region.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <button className="text-[#8cc63e] hover:text-[#7ab83a] mr-3">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MANAGE MASTER DATA COMPONENT
// ============================================
const ManageMasterData = () => {
  const categories = [
    {
      name: "Frequency Types",
      items: ["Monthly", "Quarterly", "Annual", "Event"],
    },
    {
      name: "Execution Modes",
      items: ["Submission", "Integration", "Verification"],
    },
    {
      name: "Departments",
      items: ["Compliance", "Legal", "Operations", "IT", "Finance"],
    },
    {
      name: "Status Types",
      items: ["Pending", "In Progress", "Completed", "Overdue"],
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Master Data Configuration
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">{category.name}</h4>
              <button className="text-[#8cc63e] hover:text-[#7ab83a] text-sm">
                Add
              </button>
            </div>
            <ul className="space-y-1">
              {category.items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center px-2 py-1 hover:bg-gray-50 rounded"
                >
                  <span className="text-sm text-gray-600">{item}</span>
                  <button className="text-red-600 hover:text-red-900 text-xs">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPanel;
