const ComplianceFilters = ({
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterFrequency,
  setFilterFrequency,
}) => {
  // Updated statuses to match obligation_occurrences
  const statuses = ["all", "Open", "Submitted/Under Review", "Closed"];
  const frequencies = ["all", "Monthly", "Quarterly", "Annual", "Event Based"];

  const getStatusDisplay = (status) => {
    const display = {
      all: "All Statuses",
      Open: "Open",
      "Submitted/Under Review": "Submitted/Under Review",
      Closed: "Closed",
    };
    return display[status] || status;
  };

  const getFrequencyDisplay = (frequency) => {
    const display = {
      all: "All Frequencies",
      Monthly: "Monthly",
      Quarterly: "Quarterly",
      Annual: "Annual",
      "Event Based": "Event Based",
    };
    return display[frequency] || frequency;
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Search */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search obligations..."
              className="w-full px-3 py-2 pl-9 sm:pl-10 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
            />
            <svg
              className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
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

        {/* Status Filter */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {getStatusDisplay(status)}
              </option>
            ))}
          </select>
        </div>

        {/* Frequency Filter */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Frequency
          </label>
          <select
            value={filterFrequency}
            onChange={(e) => setFilterFrequency(e.target.value)}
            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8cc63e] focus:border-transparent"
          >
            {frequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {getFrequencyDisplay(frequency)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ComplianceFilters;