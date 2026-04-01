import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const DIFFICULTY_COLORS = {
  Easy: '#38bdf8',
  Medium: '#fbbf24',
  Hard: '#f87171',
}

const GRADE_COLORS = {
  'A+': '#2563eb',
  A: '#0f766e',
  'B+': '#d97706',
  B: '#7c3aed',
  C: '#dc2626',
}

const getChartTheme = (theme = 'light') =>
  theme === 'dark'
    ? {
        axis: '#cbd5e1',
        grid: 'rgba(148, 163, 184, 0.2)',
        tooltipBackground: '#0f172a',
        tooltipBorder: 'rgba(148, 163, 184, 0.35)',
        tooltipText: '#e2e8f0',
      }
    : {
        axis: '#64748b',
        grid: '#e2e8f0',
        tooltipBackground: '#ffffff',
        tooltipBorder: '#e2e8f0',
        tooltipText: '#0f172a',
      }

const getTooltipProps = (theme = 'light') => {
  const palette = getChartTheme(theme)
  return {
    contentStyle: {
      backgroundColor: palette.tooltipBackground,
      border: `1px solid ${palette.tooltipBorder}`,
      borderRadius: 12,
      color: palette.tooltipText,
    },
    itemStyle: {
      color: palette.tooltipText,
    },
    labelStyle: {
      color: palette.tooltipText,
    },
  }
}

export function DifficultyChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry._id || 'Unknown',
    value: entry.count || 0,
  }))

  if (!prepared.length) {
    return <div className="empty">No difficulty data yet.</div>
  }

  return (
    <div className="chart-card">
      <h4>Difficulty distribution</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={prepared} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
              {prepared.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={DIFFICULTY_COLORS[entry.name] || '#94a3b8'}
                />
              ))}
            </Pie>
            <Tooltip {...getTooltipProps(theme)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {prepared.map((entry) => (
          <span key={entry.name}>
            <i style={{ background: DIFFICULTY_COLORS[entry.name] || '#94a3b8' }} />
            {entry.name}: {entry.value}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MarksChart({ assessments, theme = 'light' }) {
  const prepared = (assessments || [])
    .slice(0, 6)
    .map((item) => ({
      name: item.subject.length > 10 ? `${item.subject.slice(0, 10)}…` : item.subject,
      marks: item.totalMarks || 0,
    }))
    .reverse()

  if (!prepared.length) {
    return <div className="empty">No marks analytics yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>Marks by assessment</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={prepared}>
            <XAxis dataKey="name" tick={{ fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} />
            <YAxis tick={{ fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} />
            <Tooltip {...getTooltipProps(theme)} />
            <Bar dataKey="marks" fill="#1f3c88" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function MarksDistributionChart({ data, title = 'Marks distribution', theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.section || entry.name || 'Section',
    value: Number(entry.marks ?? entry.value ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">No marks distribution data yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={prepared}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="name"
              hide
              tickLine={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Bar dataKey="value" fill="#0f766e" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function PerformanceTrendChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.name,
    avgScore: Number(entry.avgScore ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">No performance trend data yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>Student performance trend</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={prepared}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="#1f3c88"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SgpaBarChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.name,
    sgpa: Number(entry.avgScore ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">No semester SGPA data yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card sgpa-chart-card">
      <h4>Semester-wise SGPA</h4>
      <div className="chart sgpa-chart">
        <ResponsiveContainer width="100%" height={268}>
          <BarChart data={prepared}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="name"
              hide
              tickLine={false}
              tick={{ fill: chartTheme.axis, fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fill: chartTheme.axis, fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Bar dataKey="sgpa" fill="#1f3c88" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ComparisonChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.name,
    assessmentA: Number(entry.assessmentA ?? 0),
    assessmentB: Number(entry.assessmentB ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">Select two assessments to compare.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>Assessment comparison</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={prepared}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="name"
              hide
              tickLine={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis tick={{ fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} />
            <Tooltip {...getTooltipProps(theme)} />
            <Legend wrapperStyle={{ color: chartTheme.axis }} />
            <Bar dataKey="assessmentA" fill="#1f3c88" radius={[10, 10, 0, 0]} />
            <Bar dataKey="assessmentB" fill="#0f766e" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function BalanceChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry._id || 'Unknown',
    value: entry.count || 0,
  }))

  if (!prepared.length) {
    return <div className="empty">No balance data yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>Balance status</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={prepared}>
            <XAxis dataKey="name" tick={{ fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Legend wrapperStyle={{ color: chartTheme.axis }} />
            <Bar dataKey="value" fill="#0f766e" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SubjectChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry._id?.length > 10 ? `${entry._id.slice(0, 10)}…` : entry._id,
    total: entry.total || 0,
  }))

  if (!prepared.length) {
    return <div className="empty">No subject data yet.</div>
  }

  const chartTheme = getChartTheme(theme)

  return (
    <div className="chart-card">
      <h4>Top subjects by volume</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={prepared}>
            <XAxis dataKey="name" tick={{ fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: chartTheme.axis }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Bar dataKey="total" fill="#1f3c88" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SubjectMarksChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.subject?.length > 12 ? `${entry.subject.slice(0, 12)}...` : entry.subject,
    marks: Number(entry.marks ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">No subject-wise marks yet.</div>
  }

  const chartTheme = getChartTheme(theme)
  const labelColor = theme === 'dark' ? '#e2e8f0' : '#0f172a'
  const axisColor = theme === 'dark' ? '#e2e8f0' : '#334155'

  return (
    <div className="chart-card">
      <h4>Subject-wise marks</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={prepared}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tick={{ fill: axisColor, fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axisColor, fontSize: 12, fontWeight: 600 }}
              axisLine={{ stroke: chartTheme.grid }}
            />
            <Tooltip {...getTooltipProps(theme)} />
            <Bar dataKey="marks" fill="#1f3c88" radius={[10, 10, 0, 0]}>
              <LabelList dataKey="marks" position="top" fill={labelColor} fontSize={12} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function GradeDistributionChart({ data, theme = 'light' }) {
  const prepared = (data || []).map((entry) => ({
    name: entry.grade || 'Unknown',
    value: Number(entry.count ?? 0),
  }))

  if (!prepared.length) {
    return <div className="empty">No grade distribution yet.</div>
  }

  return (
    <div className="chart-card">
      <h4>Grade distribution</h4>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={prepared} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
              {prepared.map((entry) => (
                <Cell key={entry.name} fill={GRADE_COLORS[entry.name] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip {...getTooltipProps(theme)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {prepared.map((entry) => (
          <span key={entry.name}>
            <i style={{ background: GRADE_COLORS[entry.name] || '#94a3b8' }} />
            {entry.name}: {entry.value} subjects
          </span>
        ))}
      </div>
    </div>
  )
}
