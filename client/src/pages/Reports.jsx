import { useEffect, useMemo, useState } from 'react'
import { getAssessments } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { BalanceChart, DifficultyChart, MarksChart, SubjectChart } from '../components/Charts.jsx'
import { exportAssessmentsCSV, exportAssessmentsPDF } from '../utils/export.js'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

const initialFilters = {
  subject: '',
  difficultyLevel: '',
  fromDate: '',
  toDate: '',
}

export default function Reports() {
  const { token } = useAuth()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const hasData = assessments.length > 0

  useEffect(() => {
    const load = async () => {
      try {
        const assessmentData = await getAssessments(token)
        setAssessments(assessmentData)
      } catch (err) {
        setError(err.message || 'Failed to load reports.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const loadAssessments = async (nextFilters = filters) => {
    setTableLoading(true)
    try {
      const assessmentData = await getAssessments(token, nextFilters)
      setAssessments(assessmentData)
    } catch (err) {
      setError(err.message || 'Failed to load filtered reports.')
    } finally {
      setTableLoading(false)
    }
  }

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = async () => {
    await loadAssessments(filters)
  }

  const clearFilters = async () => {
    setFilters(initialFilters)
    await loadAssessments(initialFilters)
  }

  const insightCards = useMemo(() => {
    return (assessments || []).slice(0, 4).map((assessment) => ({
      id: assessment._id,
      title: `${assessment.subject} (${assessment.assessmentType})`,
      date: formatDate(assessment.examDate),
      insights: assessment.insights || [],
      suggestions: assessment.suggestions || [],
    }))
  }, [assessments])

  const filteredSummary = useMemo(() => {
    const totalAssessments = assessments.length
    const avgDifficultyScore = totalAssessments
      ? assessments.reduce((sum, item) => sum + (item.difficultyScore || 0), 0) /
        totalAssessments
      : 0
    const imbalancedAssessments = assessments.filter(
      (item) => item.balanceStatus === 'Imbalanced'
    ).length
    return {
      overview: {
        totalAssessments,
        avgDifficultyScore,
        imbalancedAssessments,
      },
      marksStats: {
        minMarks: totalAssessments ? Math.min(...assessments.map((item) => item.totalMarks || 0)) : 0,
        maxMarks: totalAssessments ? Math.max(...assessments.map((item) => item.totalMarks || 0)) : 0,
        avgMarks: totalAssessments
          ? assessments.reduce((sum, item) => sum + (item.totalMarks || 0), 0) / totalAssessments
          : 0,
      },
    }
  }, [assessments])

  const difficultySplit = useMemo(() => {
    const counts = assessments.reduce((acc, item) => {
      const key = item.difficultyLevel || 'Medium'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([key, value]) => ({ _id: key, count: value }))
  }, [assessments])

  const balanceSplit = useMemo(() => {
    const counts = assessments.reduce((acc, item) => {
      const key = item.balanceStatus || 'Balanced'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([key, value]) => ({ _id: key, count: value }))
  }, [assessments])

  const bySubject = useMemo(() => {
    const counts = assessments.reduce((acc, item) => {
      const key = item.subject || 'Unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .map(([key, value]) => ({ _id: key, total: value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [assessments])

  return (
    <div className="page">
      <header className="page-hero">
        <div>
          <p className="pill">Reports</p>
          <h1>Reporting and insights</h1>
          <p className="lead">
            Review balance status, difficulty trends, and actionable suggestions for future assessments.
          </p>
        </div>
        <div className="export-actions">
          <button
            className="secondary"
            type="button"
            onClick={() => exportAssessmentsCSV(assessments)}
            disabled={!hasData}
          >
            Export CSV
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => exportAssessmentsPDF(assessments, filteredSummary)}
            disabled={!hasData}
          >
            Export PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="status error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="empty">Loading reports...</div>
      ) : (
        <>
          <div className="filters">
            <div className="filter-row">
              <label>
                Subject
                <input
                  type="text"
                  value={filters.subject}
                  onChange={(event) => updateFilter('subject', event.target.value)}
                  placeholder="Search by subject"
                />
              </label>
              <label>
                Difficulty
                <select
                  value={filters.difficultyLevel}
                  onChange={(event) => updateFilter('difficultyLevel', event.target.value)}
                >
                  <option value="">All</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </label>
              <label>
                From
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => updateFilter('fromDate', event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => updateFilter('toDate', event.target.value)}
                />
              </label>
            </div>
            <div className="filter-actions">
              <button className="secondary" type="button" onClick={applyFilters}>
                Apply filters
              </button>
              <button className="ghost" type="button" onClick={clearFilters}>
                Clear
              </button>
            </div>
          </div>

          <section className="section charts">
            <div className="section-head">
              <h2>Difficulty and marks analytics</h2>
              <p>Visual summaries based on your stored assessment data.</p>
            </div>
            {tableLoading ? (
              <div className="empty">Loading filtered data...</div>
            ) : (
              <div className="chart-grid">
                <DifficultyChart data={difficultySplit} />
                <MarksChart assessments={assessments} />
              </div>
            )}
          </section>

          <section className="section charts">
            <div className="section-head">
              <h2>Advanced reporting</h2>
              <p>Balance status and subject volume for planning and audits.</p>
            </div>
            {tableLoading ? (
              <div className="empty">Loading advanced reporting...</div>
            ) : (
              <div className="chart-grid">
                <BalanceChart data={balanceSplit} />
                <SubjectChart data={bySubject} />
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Recent assessment insights</h2>
              <p>System-generated notes based on difficulty and balance checks.</p>
            </div>
            <div className="insight-grid">
              {insightCards.length ? (
                insightCards.map((card) => (
                  <article className="insight" key={card.id}>
                    <h3>{card.title}</h3>
                    <p className="muted">Exam date: {card.date}</p>
                    <div className="insight-list">
                      {card.insights.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                    <div className="suggestions">
                      {card.suggestions.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty">No insights generated yet.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
