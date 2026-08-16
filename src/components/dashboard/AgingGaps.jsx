// ============================================================
// AgingGaps.jsx
// ============================================================

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const AgingGaps = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Aging of Compliance Gaps
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No gap data available
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  // All bars in #00008b color with different opacity levels for visual distinction
  const getColor = (label, index) => {
    // Different shades of #00008b for visual distinction
    const shades = [
      "#00008b", // Full opacity
      "#00008b", 
      "#00008b",
      "#00008b",
    ];
    return shades[index] || "#00008b";
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-gray-900">{data.label}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-bold">{data.count}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-bold">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
        Aging of Compliance Gaps
      </h3>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 40,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#666" }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#666" }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
            />
            <Bar
              dataKey="count"
              name="Number of Gaps"
              radius={[4, 4, 0, 0]}
              barSize={40}
              fill="#00008b"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="#00008b"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats below chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
          return (
            <div key={index} className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
              <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1">
                <div
                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                  style={{ backgroundColor: "#00008b" }}
                ></div>
                <span className="text-[10px] sm:text-xs text-gray-600">
                  {item.label}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-gray-900">
                {item.count}
              </p>
              <p className="text-[9px] sm:text-xs text-gray-500">
                {percentage}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgingGaps;