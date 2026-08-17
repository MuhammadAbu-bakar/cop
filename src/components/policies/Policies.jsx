import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../api/supabase";

const Policies = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [policies, setPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  useEffect(() => {
    filterPolicies();
  }, [searchTerm, policies]);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("policies_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
      setFilteredPolicies(data || []);
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterPolicies = () => {
    if (!searchTerm.trim()) {
      setFilteredPolicies(policies);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = policies.filter(
      (policy) =>
        policy.title?.toLowerCase().includes(searchLower) ||
        policy.description?.toLowerCase().includes(searchLower) ||
        policy.file_name?.toLowerCase().includes(searchLower),
    );
    setFilteredPolicies(filtered);
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
    if (!isAdmin) return;
    
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
          className="h-8 w-8 text-red-500 flex-shrink-0"
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
          className="h-8 w-8 text-blue-500 flex-shrink-0"
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
          className="h-8 w-8 text-gray-500 flex-shrink-0"
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredPolicies.length} policies found
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowUploadModal(true);
              setUploadError("");
              setUploadSuccess("");
            }}
            className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab52e] transition-colors flex items-center"
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

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search policies by title, description, or file name..."
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Policies List - Full Row Format */}
      {filteredPolicies.length > 0 ? (
        <div className="space-y-3">
          {filteredPolicies.map((policy) => (
            <div
              key={policy.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {/* Left side - Icon and Info */}
                <div className="flex items-start sm:items-center flex-1 min-w-0 space-x-3 sm:space-x-4">
                  <div className="p-2 sm:p-3 bg-gray-100 rounded-lg flex-shrink-0">
                    {getFileIcon(policy.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {policy.title}
                    </h3>
                    {policy.description && (
                      <p className="text-xs sm:text-sm text-gray-500 break-words mt-0.5">
                        {policy.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                      <span className="text-[10px] sm:text-xs text-gray-400">
                        File: {policy.file_name}
                      </span>
                      <span className="hidden sm:inline text-gray-300">|</span>
                      <span className="text-[10px] sm:text-xs text-gray-400">
                        {formatFileSize(policy.file_size)}
                      </span>
                      <span className="hidden sm:inline text-gray-300">|</span>
                      <span className="text-[10px] sm:text-xs text-gray-400">
                        Uploaded: {formatDate(policy.uploaded_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <a
                    href={policy.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#8cc63e] text-white text-xs sm:text-sm rounded-md hover:bg-[#7ab52e] transition-colors flex items-center"
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
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-md hover:bg-gray-300 transition-colors flex items-center"
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(policy.id)}
                      disabled={deleteLoading}
                      className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete policy"
                    >
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
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
          <h3 className="text-lg font-medium text-gray-900">
            {searchTerm ? "No policies match your search" : "No policies uploaded"}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm
              ? `No policies found matching "${searchTerm}"`
              : isAdmin
              ? "Upload your first policy document to get started."
              : "No policies have been uploaded yet."}
          </p>
          {isAdmin && !searchTerm && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab52e] transition-colors"
            >
              Upload Policy
            </button>
          )}
        </div>
      )}

      {/* Upload Modal - Only for Admin */}
      {showUploadModal && isAdmin && (
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
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab52e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Policies;