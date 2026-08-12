import { useState, useEffect } from "react";
import { supabase } from "../../api/supabase";
import { useAuth } from "../../context/AuthContext";

const AuditHistory = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAudit, setStatusAudit] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchAudits();
  }, []);

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAudits(data || []);
    } catch (error) {
      console.error("Error fetching audits:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      Open: "bg-yellow-100 text-yellow-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Closed: "bg-green-100 text-green-800",
      "Under Review": "bg-purple-100 text-purple-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status) => {
    const colors = {
      Open: "text-yellow-600",
      "In Progress": "text-blue-600",
      Closed: "text-green-600",
      "Under Review": "text-purple-600",
    };
    return colors[status] || "text-gray-600";
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

  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.policy_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.relevant_cft_member?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || audit.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const openStatusModal = (audit) => {
    if (!isAdmin) return;
    setStatusAudit(audit);
    setSelectedStatus(audit.status);
    setStatusComment("");
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async () => {
    if (!statusAudit) return;
    
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("audit_history")
        .update({ 
          status: selectedStatus,
          updated_at: new Date().toISOString(),
          ...(selectedStatus === "Closed" && { closed_at: new Date().toISOString() }),
          ...(statusComment && { comments: statusComment })
        })
        .eq("id", statusAudit.id);

      if (error) throw error;
      
      await fetchAudits();
      setShowStatusModal(false);
      setStatusAudit(null);
      setStatusComment("");
      
      alert(`Status updated to "${selectedStatus}" successfully!`);
    } catch (error) {
      console.error("Error updating audit status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8cc63e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit History</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredAudits.length} audits found
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              // Open add audit modal (future enhancement)
              alert("Add audit functionality coming soon!");
            }}
            className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors flex items-center"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Audit
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by department, policy, or CFT member..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Under Review">Under Review</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Cards */}
      <div className="space-y-4">
        {filteredAudits.map((audit) => (
          <div
            key={audit.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {audit.policy_reference}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(audit.status)}`}
                  >
                    {audit.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Department:</span>
                    <span className="ml-2 text-gray-900">{audit.department}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">CFT Member:</span>
                    <span className="ml-2 text-gray-900">{audit.relevant_cft_member}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                {isAdmin && (
                  <button
                    onClick={() => openStatusModal(audit)}
                    className="bg-[#8cc63e] text-white px-3 py-1 rounded-md hover:bg-[#7ab83a] transition-colors text-sm"
                  >
                    Change Status
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedAudit(audit);
                    setShowModal(true);
                  }}
                  className="text-[#8cc63e] hover:text-[#7ab83a]"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAudits.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l3 3 3-3" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No audits found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm || filterStatus !== "all"
              ? "No audits match your search criteria."
              : "No audit records have been created yet."}
          </p>
        </div>
      )}

      {/* Audit Detail Modal */}
      {showModal && selectedAudit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">
                Audit Details
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Policy Reference</h4>
                <p className="mt-1 text-gray-900 font-semibold">{selectedAudit.policy_reference}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Department</h4>
                  <p className="mt-1 text-gray-900">{selectedAudit.department}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">CFT Member</h4>
                  <p className="mt-1 text-gray-900">{selectedAudit.relevant_cft_member}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Check Point</h4>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAudit.check_point}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Observation</h4>
                <div className="mt-1 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAudit.observation}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Rectification Plan</h4>
                <div className="mt-1 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAudit.rectification_plan}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status</h4>
                  <span className={`mt-1 inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedAudit.status)}`}>
                    {selectedAudit.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Created</h4>
                  <p className="mt-1 text-gray-900">{formatDate(selectedAudit.created_at)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Last Updated</h4>
                  <p className="mt-1 text-gray-900">{formatDate(selectedAudit.updated_at)}</p>
                </div>
              </div>

              {selectedAudit.comments && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Comments</h4>
                  <p className="mt-1 text-gray-700">{selectedAudit.comments}</p>
                </div>
              )}

              {isAdmin && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      openStatusModal(selectedAudit);
                    }}
                    className="bg-[#8cc63e] text-white px-4 py-2 rounded-md hover:bg-[#7ab83a] transition-colors"
                  >
                    Change Status
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal - Only for Admin */}
      {showStatusModal && statusAudit && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Change Status
              </h3>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusAudit(null);
                  setStatusComment("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Audit</p>
                <p className="font-medium text-gray-900">{statusAudit.policy_reference}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Current Status</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(statusAudit.status)}`}>
                  {statusAudit.status}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Open", "In Progress", "Under Review", "Closed"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`px-4 py-2 rounded-md border-2 transition-colors ${
                        selectedStatus === status
                          ? `border-[#8cc63e] bg-[#8cc63e]/10 ${getStatusColor(status)}`
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (Optional)
                </label>
                <textarea
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Add a comment about this status change..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8cc63e]"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleStatusUpdate}
                  disabled={updatingStatus || !selectedStatus}
                  className="flex-1 bg-[#8cc63e] text-white py-2 rounded-md hover:bg-[#7ab83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingStatus ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusAudit(null);
                    setStatusComment("");
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

export default AuditHistory;