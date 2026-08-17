// ============================================================
// ComplianceTrend.jsx - Line Chart using Recharts
// ============================================================

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts';

const ComplianceTrend = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Compliance Trend
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          No trend data available
        </div>
      </div>
    );
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-sm font-bold" style={{ color: '#8cc63e' }}>
            {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Format Y-axis ticks
  const formatYAxis = (value) => `${value}%`;

  // Get min and max for Y-axis domain
  const minValue = Math.min(...data.map(d => d.value)) - 5;
  const maxValue = Math.max(...data.map(d => d.value)) + 5;

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <div>
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
            Compliance Trend
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Last 6 Months</p>
        </div>
        <div className="text-right">
          <span className="text-lg sm:text-xl md:text-2xl font-bold" style={{ color: '#8cc63e' }}>
            {data[data.length - 1]?.value || 0}%
          </span>
          <p className="text-[10px] text-gray-500">Current</p>
        </div>
      </div>
      
      {/* Line Chart */}
      <div className="h-48 sm:h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8cc63e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8cc63e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            {/* Grid */}
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false}
              stroke="#e5e7eb"
              strokeOpacity={0.5}
            />
            
            {/* X-Axis */}
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              dy={5}
            />
            
            {/* Y-Axis */}
            <YAxis 
              domain={[minValue, maxValue]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={formatYAxis}
              dx={-5}
              width={30}
            />
            
            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} />
            
            {/* Area under the line */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#colorGradient)"
              fillOpacity={1}
            />
            
            {/* Line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8cc63e"
              strokeWidth={2.5}
              dot={{
                fill: '#8cc63e',
                stroke: '#fff',
                strokeWidth: 2,
                r: 4
              }}
              activeDot={{
                fill: '#8cc63e',
                stroke: '#fff',
                strokeWidth: 2,
                r: 6
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100">
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Start</p>
          <p className="text-sm font-semibold text-gray-700">{data[0]?.value || 0}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Change</p>
          <p className={`text-sm font-semibold ${
            (data[data.length - 1]?.value || 0) > (data[0]?.value || 0) 
              ? 'text-[#8cc63e]' 
              : 'text-red-600'
          }`}>
            {((data[data.length - 1]?.value || 0) - (data[0]?.value || 0)) > 0 ? '+' : ''}
            {((data[data.length - 1]?.value || 0) - (data[0]?.value || 0)).toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Peak</p>
          <p className="text-sm font-semibold text-gray-700">
            {Math.max(...data.map(d => d.value))}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComplianceTrend;