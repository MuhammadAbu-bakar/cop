import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getEvidence,
  uploadEvidence,
  getObligations,
} from "../../api/compliance";

const EvidenceRepository = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedObligation, setSelectedObligation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    fetchEvidence();
    fetchObligations();
  }, []);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      // Get all evidence (you might want to filter by obligation or user)
      const { data, error } = await getEvidence("all"); // This needs to be modified to get all evidence
      if (!error && data) {
        setEvidence(data);
      }
    } catch (error) {
      console.error("Error fetching evidence:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchObligations = async () => {
    try {
      const { data, error } = await getObligations();
      if (!error && data) {
        setObligations(data);
      }
    } catch (error) {
      console.error("Error fetching obligations:", error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedObligation) {
      setUploadMessage("Please select a file and obligation");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    try {
      const { data, error } = await uploadEvidence(
        selectedFile,
        selectedObligation,
      );

      if (error) throw error;

      setUploadMessage("Evidence uploaded successfully!");
      setSelectedFile(null);
      setSelectedObligation("");
      setShowUploadModal(false);

      // Refresh evidence list
      fetchEvidence();

      // Reset file input
      document.getElementById("file-upload").value = "";
    } catch (error) {
      console.error("Error uploading evidence:", error);
      setUploadMessage("Failed to upload evidence. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Approved: "bg-green-100 text-green-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Rejected: "bg-red-100 text-red-800",
      approved: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getFileIcon = (type) => {
    const icons = {
      "application/pdf": "text-red-600",
      "text/csv": "text-green-600",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "text-blue-600",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "text-green-700",
      "image/jpeg": "text-purple-600",
      "image/png": "text-purple-600",
    };
    return icons[type] || "text-gray-600";
  };

  const getFileTypeDisplay = (type) => {
    const types = {
      "application/pdf": "PDF",
      "text/csv": "CSV",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "DOCX",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "XLSX",
      "image/jpeg": "JPG",
      "image/png": "PNG",
    };
    return types[type] || type?.split("/").pop()?.toUpperCase() || "Unknown";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const filteredEvidence = evidence.filter((item) => {
    const matchesSearch =
      item.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.obligation?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" ||
      getFileTypeDisplay(item.file_type)?.toLowerCase() ===
        filterType.toLowerCase();

    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading evidence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Evidence Repository
        </h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="w-full sm:w-auto bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab52e] transition-colors flex items-center justify-center"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Evidence
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by file name or obligation..."
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
        </div>
      </div>

      {/* Evidence Count */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-gray-600">
          Showing <span className="font-medium">{filteredEvidence.length}</span>{" "}
          evidence files
        </p>
      </div>

      {/* Evidence Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {filteredEvidence.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`p-2 sm:p-3 rounded-lg bg-gray-100 flex-shrink-0 ${getFileIcon(item.file_type)}`}
                  >
                    <svg
                      className="h-6 w-6 sm:h-8 sm:w-8"
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
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-[150px]">
                      {item.file_name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {getFileTypeDisplay(item.file_type)} •{" "}
                      {formatFileSize(item.file_size)}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ml-2 ${getStatusBadge(item.status)}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-4 space-y-1 sm:space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Obligation:</span>
                  <span className="text-gray-900 truncate max-w-[120px] sm:max-w-[150px] text-right">
                    {item.obligation?.obligation_id || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Uploaded by:</span>
                  <span className="text-gray-900 truncate max-w-[120px] sm:max-w-[150px] text-right">
                    {item.profiles?.full_name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Uploaded:</span>
                  <span className="text-gray-900">
                    {item.uploaded_at
                      ? new Date(item.uploaded_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Modified:</span>
                  <span className="text-gray-900">
                    {item.modified_at
                      ? new Date(item.modified_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:flex-1 bg-[#8cc63e] text-white text-xs sm:text-sm py-2 rounded-md hover:bg-[#7ab52e] transition-colors flex items-center justify-center"
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
                )}
                <button className="w-full sm:flex-1 bg-gray-200 text-gray-700 text-xs sm:text-sm py-2 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center">
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
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEvidence.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <svg
            className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4"
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
          <h3 className="text-base sm:text-lg font-medium text-gray-900">
            No evidence found
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Upload evidence to get started
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab52e] transition-colors"
          >
            Upload Evidence
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Upload Evidence
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Obligation *
                </label>
                <select
                  value={selectedObligation}
                  onChange={(e) => setSelectedObligation(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                >
                  <option value="">Select an obligation</option>
                  {obligations.map((ob) => (
                    <option key={ob.id} value={ob.id}>
                      {ob.obligation_id} - {ob.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select File *
                </label>
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
                />
                {selectedFile && (
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 break-words">
                    Selected: {selectedFile.name} (
                    {formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {uploadMessage && (
                <div
                  className={`p-3 rounded-md text-sm ${
                    uploadMessage.includes("successfully")
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {uploadMessage}
                </div>
              )}

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !selectedObligation}
                  className="w-full sm:flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab52e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="w-full sm:flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm sm:text-base"
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

export default EvidenceRepository;