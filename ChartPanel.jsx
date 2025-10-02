import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function ChartPanel({ data }) {
  if (!data || !data.result || data.result.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No chart data yet
      </div>
    );
  }

  const chartType = data.chart || "Bar";
  const result = data.result;

  // infer keys from SQL result
  const keys = Object.keys(result[0]);
  const xKey = keys[0];
  const yKey = keys[1];
  const typeKey = keys.includes("type") ? "type" : null;

  const historical = typeKey
    ? result.filter(r => r[typeKey] === "historical")
    : result;
  const forecast = typeKey
    ? result.filter(r => r[typeKey] === "forecast")
    : [];

  // merge if forecast exists
  const combined = [...historical, ...forecast];

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#00C49F"];

  switch (chartType) {
    case "Bar":
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={combined}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey={yKey}
              name="Sales"
              fill="#8884d8"
            >
              {combined.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.type === "forecast" ? "#ff7f50" : "#82ca9d"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

      );

    case "Line":
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={combined}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#8884d8"
              name="Sales"
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={payload.type === "forecast" ? "#ff7f50" : "#82ca9d"}
                  />
                );
              }}
              strokeDasharray={(data) =>
                data.payload.type === "forecast" ? "5 5" : ""
              }
            />
          </LineChart>
        </ResponsiveContainer>

      );

    case "Pie":
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={historical}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              label
            >
              {historical.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            {forecast.length > 0 && (
              <Pie
                data={forecast}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                innerRadius={110}
                outerRadius={140}
                fill="#ff7f50"
                label
              />
            )}
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case "KPI":
      return (
        <div className="flex items-center justify-center h-full space-x-6">
          <div className="bg-white shadow-lg rounded-2xl p-6 text-center">
            <h2 className="text-gray-500 text-lg mb-2">Current</h2>
            <p className="text-4xl font-bold text-indigo-600">
              {historical[historical.length - 1][xKey]}
            </p>
          </div>
          {forecast.length > 0 && (
            <div className="bg-white shadow-lg rounded-2xl p-6 text-center">
              <h2 className="text-gray-500 text-lg mb-2">Forecast</h2>
              <p className="text-4xl font-bold text-orange-600">
                {forecast[forecast.length - 1][xKey]}
              </p>
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Chart type "{chartType}" not supported yet
        </div>
      );
  }
}
