import { useState, useEffect } from "react";
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
import { supabase } from "../../api/supabase";

const AgingGaps = ({ userRegion, isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([
    { label: '0-30 days', count: 0 },
    { label: '31-60 days', count: 0 },
    { label: '61-90 days', count: 0 },
    { label: '90+ days', count: 0 },
  ]);

  useEffect(() => {
    fetchAgingData();
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

  const fetchAgingData = async () => {
    setLoading(true);
    try {
      let regionId = null;
      if (!isAdmin && userRegion) {
        regionId = await getRegionId(userRegion);
      }

      let progressQuery = supabase
        .from('obligation_progress')
        .select('obligation_id')
        .eq('status', 'Overdue');

      if (regionId) {
        progressQuery = progressQuery.eq('region_id', regionId);
      }

      const { data: overdueProgress, error } = await progressQuery;
      if (error) throw error;

      const overdueIds = overdueProgress?.map(p => p.obligation_id) || [];

      if (overdueIds.length === 0) {
        setData([
          { label: '0-30 days', count: 0 },
          { label: '31-60 days', count: 0 },
          { label: '61-90 days', count: 0 },
          { label: '90+ days', count: 0 },
        ]);
        setLoading(false);
        return;
      }

      const { data: overdueObligations } = await supabase
        .from('obligations')
        .select('id, calculated_due_date')
        .in('id', overdueIds);

      const today = new Date();
      const aging = {
        '0-30 days': 0,
        '31-60 days': 0,
        '61-90 days': 0,
        '90+ days': 0,
      };

      overdueObligations?.forEach(o => {
        if (!o.calculated_due_date) return;
        const dueDate = new Date(o.calculated_due_date);
        const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          if (diffDays <= 30) aging['0-30 days']++;
          else if (diffDays <= 60) aging['31-60 days']++;
          else if (diffDays <= 90) aging['61-90 days']++;
          else aging['90+ days']++;
        }
      });

      const agingData = Object.entries(aging).map(([label, count]) => ({
        label,
        count,
      }));

      setData(agingData);

    } catch (error) {
      console.error('Error fetching aging data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-4">
          Aging of Compliance Gaps
        </h3>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

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
              fill="#8cc63e"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="#8cc63e"
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
                  style={{ backgroundColor: "#8cc63e" }}
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