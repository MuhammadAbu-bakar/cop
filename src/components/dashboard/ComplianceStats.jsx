const ComplianceStats = ({ stats }) => {
  // Calculate percentage safely to avoid division by zero
  const calculatePercentage = (completed, total) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  // Calculate overall compliance percentage
  const overallCompliance = calculatePercentage(
    stats.completed || 0,
    stats.totalObligations || 0,
  );

  // Half-circle Speedometer component
  const HalfSpeedometer = ({ percentage }) => {
    const radius = 40;
    const strokeWidth = 10;
    const circumference = Math.PI * radius;

    const halfCircumference = circumference;
    const dashOffset =
      halfCircumference - (percentage / 100) * halfCircumference;

    const getColor = (value) => {
      if (value >= 80) return "#22c55e";
      if (value >= 60) return "#84cc16";
      if (value >= 40) return "#eab308";
      if (value >= 20) return "#f97316";
      return "#ef4444";
    };

    const color = getColor(percentage);

    return (
      <div className="relative inline-flex items-center justify-start w-full">
        <svg className="w-full max-w-[90px] sm:max-w-[110px] md:max-w-[130px] h-14 sm:h-16 md:h-20 mx-auto" viewBox="0 0 120 65">
          {/* Background arc - half circle from left to right */}
          <path
            d="M 20 50 A 40 40 0 0 1 100 50"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress arc - half circle with dash array */}
          <path
            d="M 20 50 A 40 40 0 0 1 100 50"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-in-out"
          />

          {/* Percentage text inside speedometer */}
          <text
            x="60"
            y="44"
            textAnchor="middle"
            className="text-lg sm:text-xl md:text-2xl font-bold"
            fill={color}
          >
            {percentage}%
          </text>
          <text
            x="60"
            y="56"
            textAnchor="middle"
            className="text-[7px] sm:text-[8px] md:text-[10px]"
            fill="#9ca3af"
          >
            Compliance
          </text>
        </svg>
      </div>
    );
  };

  const statCards = [
    {
      title: "Overall Compliance",
      subtitle: `${stats.completed || 0} of ${stats.totalObligations || 0} completed`,
      color: "purple",
      isSpeedometer: true,
      percentage: overallCompliance,
    },
    {
      title: "Total Obligations",
      value: stats.totalObligations || 0,
      subtitle: `${stats.completed || 0} completed • ${stats.inProgress || stats.notStarted || 0} in progress`,
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
      color: "blue",
    },
    {
      title: "Completed",
      value: stats.completed || 0,
      subtitle: `${calculatePercentage(stats.completed, stats.totalObligations)}% of total`,
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "green",
    },
    {
      title: "In Progress",
      value: stats.inProgress || stats.notStarted || 0,
      subtitle: `${calculatePercentage(stats.inProgress || stats.notStarted || 0, stats.totalObligations)}% of total`,
      icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "gray",
    },
    {
      title: "Overdue",
      value: stats.overdue || 0,
      subtitle: `${stats.pending || 0} pending overall`,
      icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "red",
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-100 text-blue-600",
      purple: "bg-purple-100 text-purple-600",
      green: "bg-green-100 text-green-600",
      orange: "bg-orange-100 text-orange-600",
      red: "bg-red-100 text-red-600",
      gray: "bg-gray-100 text-gray-600",
    };
    return colors[color] || colors.blue;
  };

  const getBorderColor = (color) => {
    const colors = {
      blue: "#3b82f6",
      green: "#8cc63e",
      orange: "#f97316",
      red: "#ef4444",
      purple: "#8b5cf6",
      gray: "#9ca3af",
    };
    return colors[color] || "#8cc63e";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 flex flex-col h-full"
          style={{
            borderLeftColor: getBorderColor(stat.color),
          }}
        >
          <div className="p-3 sm:p-4 md:p-5 flex-1 flex flex-col">
            {!stat.isSpeedometer ? (
              <div className="flex items-center justify-between flex-1">
                {/* Left side - Text content for regular cards */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium whitespace-normal break-words">
                    {stat.title}
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-tight mt-3 sm:mt-4">
                    {stat.value}
                  </p>
                  <p className="text-[8px] sm:text-[10px] text-gray-500 mt-3 sm:mt-4 whitespace-normal break-words">
                    {stat.subtitle}
                  </p>
                </div>
                {/* Right side - Icon */}
                <div
                  className={`flex-shrink-0 p-1.5 sm:p-2 md:p-2.5 rounded-full ${getColorClasses(stat.color)}`}
                >
                  <svg
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={stat.icon}
                    />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center flex-1 justify-center">
                {/* Title */}
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium text-center w-full whitespace-normal break-words">
                  {stat.title}
                </p>

                {/* Speedometer in the middle */}
                <div className="my-0.5 sm:my-1 w-full flex justify-center">
                  <HalfSpeedometer percentage={stat.percentage} />
                </div>

                {/* Subtitle */}
                <p className="text-[8px] sm:text-[10px] text-gray-500 text-center w-full whitespace-normal break-words">
                  {stat.subtitle}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ComplianceStats;