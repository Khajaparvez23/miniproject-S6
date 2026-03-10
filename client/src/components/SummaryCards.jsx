export default function SummaryCards({ summary }) {
  const overview = summary?.overview || {}

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <p>Total assessments</p>
        <h3>{overview.totalAssessments ?? 0}</h3>
      </div>
      <div className="summary-card">
        <p>Average difficulty</p>
        <h3>{Number(overview.avgDifficultyScore || 0).toFixed(1)}</h3>
      </div>
      <div className="summary-card">
        <p>Imbalanced assessments</p>
        <h3>{overview.imbalancedAssessments ?? 0}</h3>
      </div>
    </div>
  )
}
