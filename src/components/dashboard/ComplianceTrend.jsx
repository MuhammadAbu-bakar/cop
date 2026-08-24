import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { supabase } from "../../api/supabase";

const ComplianceTrend = ({ userRegion, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchTrendData();
  }, [userRegion, isAdmin]);

  const getRegionId = async (regionName) => {
    if (!regionName) return null;
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id')
        .eq('name', regionName)
        .single();
      
      if (error) return null;
      return data?.id || null;
    } catch (error) {
      console.error('Error getting region ID:', error);
      return null;
    }
  };

  const fetchTrendData = async () => {
    setLoading(true);
    try {
      // Get region ID
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      // Generate last 6 months
      const months = [];
      const currentDate = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setMonth(date.getMonth() - i);
        months.push({
          month: date.toLocaleString('default', { month: 'short' }),
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          monthName: date.toLocaleString('default', { month: 'long' }),
        });
      }

      const trendData = [];
      
      for (const month of months) {
        const startDate = new Date(month.year, month.monthIndex, 1);
        const endDate = new Date(month.year, month.monthIndex + 1, 0);
        
        // Format dates for comparison
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Get obligations that have progress in this month
        let progressQuery = supabase
          .from('compliance_progress')
          .select('obligation_id, status, occurrence_date, calculated_due_date')
          .gte('occurrence_date', startDateStr)
          .lte('occurrence_date', endDateStr);

        if (regionId) {
          progressQuery = progressQuery.eq('region_id', regionId);
        }

        const { data: monthProgress, error: progressError } = await progressQuery;

        if (progressError) {
          console.error('Error fetching progress for month:', progressError);
          trendData.push({
            month: month.month,
            value: 0,
          });
          continue;
        }

        // Get unique obligation IDs for this month
        const obligationIds = [...new Set(monthProgress?.map(p => p.obligation_id) || [])];
        const total = obligationIds.length;

        // Count closed obligations
        const closed = monthProgress?.filter(p => p.status === 'Closed').length || 0;
        
        // Calculate compliance percentage
        const compliance = total > 0 ? Math.round((closed / total) * 100) : 0;

        // Alternative: Count unique obligations that are Closed
        const uniqueClosed = monthProgress?.filter(p => p.status === 'Closed')
          .map(p => p.obligation_id)
          .filter((id, index, self) => self.indexOf(id) === index).length || 0;
        
        // Use unique closed count for better accuracy
        const uniqueCompliance = obligationIds.length > 0 
          ? Math.round((uniqueClosed / obligationIds.length) * 100) 
          : 0;

        trendData.push({
          month: month.month,
          value: uniqueCompliance > 0 ? uniqueCompliance : 0,
          total: total,
          closed: uniqueClosed,
          inProgress: monthProgress?.filter(p => p.status === 'Submitted/Under Review').length || 0,
        });
      }

      setData(trendData);

    } catch (error) {
      console.error('Error fetching trend data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
              Compliance Trend
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Loading...</p>
          </div>
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="h-48 sm:h-56 md:h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

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
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-sm font-bold" style={{ color: '#ff0099' }}>
            {payload[0].value}%
          </p>
          {dataPoint && (
            <div className="text-[10px] text-gray-500 mt-1">
              <p>{dataPoint.closed || 0} of {dataPoint.total || 0} closed</p>
              {dataPoint.inProgress > 0 && (
                <p>{dataPoint.inProgress} under review</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis ticks
  const formatYAxis = (value) => `${value}%`;

  // Get min and max for Y-axis domain
  const allValues = data.map(d => d.value);
  const minValue = Math.min(...allValues) - 5 < 0 ? 0 : Math.min(...allValues) - 5;
  const maxValue = Math.max(...allValues) + 5 > 100 ? 100 : Math.max(...allValues) + 5;

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
          <span className="text-lg sm:text-xl md:text-2xl font-bold" style={{ color: '#ff0099' }}>
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
                <stop offset="5%" stopColor="#ff0099" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ff0099" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false}
              stroke="#e5e7eb"
              strokeOpacity={0.5}
            />
            
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              dy={5}
            />
            
            <YAxis 
              domain={[minValue, maxValue]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={formatYAxis}
              dx={-5}
              width={30}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#colorGradient)"
              fillOpacity={1}
            />
            
            <Line
              type="monotone"
              dataKey="value"
              stroke="#ff0099"
              strokeWidth={2.5}
              dot={{
                fill: '#ff0099',
                stroke: '#fff',
                strokeWidth: 2,
                r: 4
              }}
              activeDot={{
                fill: '#ff0099',
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
              ? 'text-[#ff0099]' 
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