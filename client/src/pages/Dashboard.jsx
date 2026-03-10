import { useEffect, useMemo, useState } from 'react'
import {
  createAssessment,
  getFacultyStudentResults,
  getAdvancedSummary,
  getAssessments,
  getPreferences,
  getSummary,
  getUsers,
  updatePreferences,
} from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import AssessmentForm from '../components/AssessmentForm.jsx'
import RecordsTable from '../components/RecordsTable.jsx'
import {
  DifficultyChart,
  MarksDistributionChart,
  PerformanceTrendChart,
  SgpaBarChart,
  ComparisonChart,
} from '../components/Charts.jsx'
import Pagination from '../components/Pagination.jsx'
import { exportStudentExamResultsPDF } from '../utils/export.js'

const initialFilters = {
  subject: '',
  difficultyLevel: '',
  fromDate: '',
  toDate: '',
}
const DEFAULT_PASS_THRESHOLD_PERCENT = 45

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatShortDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const parseRangeLabel = (label, totalMarks) => {
  if (!label) return null
  const matches = String(label).match(/\d+(\.\d+)?/g)
  if (!matches || !matches.length) return null
  const nums = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (!nums.length) return null
  if (nums.length >= 2) {
    const [first, second] = nums
    return { min: Math.min(first, second), max: Math.max(first, second) }
  }
  const single = nums[0]
  if (String(label).includes('+')) {
    const max = totalMarks > 0 ? totalMarks : single
    return { min: single, max }
  }
  return { min: 0, max: single }
}

const computeMarksStats = (assessments) => {
  const totals = (assessments || []).map((item) => toNumber(item.totalMarks))
  if (!totals.length) {
    return { minMarks: 0, maxMarks: 0, avgMarks: 0 }
  }
  const sum = totals.reduce((acc, value) => acc + value, 0)
  return {
    minMarks: Math.min(...totals),
    maxMarks: Math.max(...totals),
    avgMarks: sum / totals.length,
  }
}

const normalizePassThresholdPercent = (value) => {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) return DEFAULT_PASS_THRESHOLD_PERCENT
  return Math.min(100, Math.max(1, normalized))
}

const computeRangeStats = (distribution, totalMarks, passThresholdPercent = DEFAULT_PASS_THRESHOLD_PERCENT) => {
  const buckets = (distribution || [])
    .map((entry) => ({
      count: toNumber(entry.marks),
      range: parseRangeLabel(entry.section, totalMarks),
    }))
    .filter((entry) => entry.range && entry.count > 0)

  if (!buckets.length) return null

  const normalizedPassThreshold = normalizePassThresholdPercent(passThresholdPercent)
  const passThreshold = totalMarks * (normalizedPassThreshold / 100)
  const topThreshold = totalMarks * (Math.max(70, normalizedPassThreshold) / 100)

  let weak = 0
  let average = 0
  let top = 0
  let total = 0
  let weightedSum = 0

  buckets.forEach(({ count, range }) => {
    const midpoint = (range.min + range.max) / 2
    total += count
    weightedSum += count * midpoint
    if (midpoint < passThreshold) {
      weak += count
    } else if (midpoint < topThreshold) {
      average += count
    } else {
      top += count
    }
  })

  return {
    weak,
    average,
    top,
    total,
    avgScore: total ? weightedSum / total : 0,
    passRate: total ? ((average + top) / total) * 100 : 0,
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const computeDistributionBalanceScore = (distribution, totalMarks) => {
  const entries = Array.isArray(distribution) ? distribution : []
  const sum = entries.reduce((acc, entry) => acc + toNumber(entry.marks), 0)
  const denom = totalMarks > 0 ? totalMarks : sum
  if (denom <= 0 || !entries.length) return null
  const shares = entries.map((entry) => toNumber(entry.marks) / denom).filter((value) => value > 0)
  if (!shares.length) return null
  const maxShare = Math.max(...shares)
  const ideal = 1 / shares.length
  const spread = Math.max(0, maxShare - ideal)
  return clamp(100 - spread * 140, 0, 100)
}

const computeDifficultyBalanceScore = (difficultyScore) => {
  if (!Number.isFinite(difficultyScore)) return null
  return clamp(100 - Math.abs(difficultyScore - 60) * 2, 0, 100)
}

const computeQualityScore = ({ difficultyScore, distributionScore, passRate, topicCoverage }) => {
  const items = [
    { value: computeDifficultyBalanceScore(difficultyScore), weight: 0.3 },
    { value: distributionScore, weight: 0.25 },
    { value: Number.isFinite(passRate) ? passRate : null, weight: 0.25 },
    { value: Number.isFinite(topicCoverage) ? topicCoverage : null, weight: 0.2 },
  ].filter((item) => item.value !== null)
  const totalWeight = items.reduce((acc, item) => acc + item.weight, 0)
  if (!items.length || totalWeight === 0) return null
  const score = items.reduce((acc, item) => acc + item.value * item.weight, 0) / totalWeight
  return clamp(score, 0, 100)
}

const dedupe = (items) => [...new Set(items.filter(Boolean))]
const formatRefreshDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
const romanToNumber = (value) => {
  const map = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
    XI: 11,
    XII: 12,
  }
  return map[String(value || '').toUpperCase()] || 1
}
const numberToRoman = (value) => {
  const map = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
    11: 'XI',
    12: 'XII',
  }
  return map[value] || String(value)
}
const buildStudentProfile = (user) => {
  const identity = String(user?.username || user?.name || '').toLowerCase()
  const match = identity.match(/student\s*(\d+)/i)
  const studentNo = match ? Number(match[1]) : 1
  const normalizedNo = Number.isFinite(studentNo) && studentNo > 0 ? studentNo : 1

  return {
    studentNo: normalizedNo,
    name: `Student ${normalizedNo}`,
    rollNo: `2026${String(normalizedNo).padStart(2, '0')}`,
    sem: 'VI',
    dept: 'EEE',
  }
}
const buildExamRowsForStudent = (studentNo) => {
  const offset = Math.max(0, studentNo - 1)
  return [
    { subject: 'Digital Signal Processing', subjectMarks: 78 + offset, totalMarks: 100 },
    { subject: 'Embedded Systems', subjectMarks: 74 + offset, totalMarks: 100 },
    { subject: 'Control Systems', subjectMarks: 81 + offset, totalMarks: 100 },
    { subject: 'Power Electronics', subjectMarks: 76 + offset, totalMarks: 100 },
    { subject: 'Microprocessors', subjectMarks: 79 + offset, totalMarks: 100 },
    { subject: 'Signals and Systems', subjectMarks: 73 + offset, totalMarks: 100 },
  ]
}
const buildFacultyStudentRows = (results) => {
  const sourceRows = Array.isArray(results) && results.length
    ? results.slice(0, 4).map((entry, index) => ({
        student: entry.student,
        studentNo: index + 1,
        latestAssessment: entry.assessments?.[0] || null,
      }))
    : Array.from({ length: 4 }, (_, index) => ({
        student: {
          id: `fallback-${index + 1}`,
          name: `Student ${index + 1}`,
        },
        studentNo: index + 1,
        latestAssessment: null,
      }))

  return sourceRows.map(({ student, studentNo, latestAssessment }) => {
    const profile = buildStudentProfile({
      name: student?.name,
      username: student?.username || `student${studentNo}`,
    })
    const examRows = buildExamRowsForStudent(profile.studentNo)
    const averageMarks = examRows.length
      ? examRows.reduce((sum, row) => sum + toNumber(row.subjectMarks), 0) / examRows.length
      : 0
    const assessmentMarks = toNumber(latestAssessment?.averageScore)
    const marks = assessmentMarks > 0 ? assessmentMarks : averageMarks

    return {
      id: student?.id || profile.rollNo,
      name: student?.name || profile.name,
      registerNumber: profile.rollNo,
      department: profile.dept,
      semester: profile.sem,
      marks: `${Math.round(marks)}/100`,
    }
  })
}

function SidebarIcon({ type }) {
  if (type === 'overview') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="8" height="7" rx="1.5" />
        <rect x="13" y="4" width="8" height="4" rx="1.5" />
        <rect x="13" y="10" width="8" height="10" rx="1.5" />
        <rect x="3" y="13" width="8" height="7" rx="1.5" />
      </svg>
    )
  }
  if (type === 'analytics') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h16" />
        <rect x="6" y="11" width="3" height="7" rx="1" />
        <rect x="11" y="8" width="3" height="10" rx="1" />
        <rect x="16" y="5" width="3" height="13" rx="1" />
      </svg>
    )
  }
  if (type === 'insights') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a7 7 0 0 0-4 12.8c.6.4 1 1.1 1.1 1.8h5.8c.1-.7.5-1.4 1.1-1.8A7 7 0 0 0 12 3Z" />
        <path d="M9.5 20h5" />
      </svg>
    )
  }
  if (type === 'comparison') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h4V7H4v10Zm12 0h4V4h-4v13ZM10 20h4v-9h-4v9Z" />
      </svg>
    )
  }
  if (type === 'upload') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V6" />
        <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
        <path d="M4 18h16" />
      </svg>
    )
  }
  if (type === 'students') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="10" r="2.5" />
        <path d="M3.5 18a4.5 4.5 0 0 1 9 0" />
        <path d="M12.5 18a3.5 3.5 0 0 1 7 0" />
      </svg>
    )
  }
  if (type === 'accounts') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <circle cx="12" cy="10" r="2.5" />
        <path d="M8 17a4 4 0 0 1 8 0" />
      </svg>
    )
  }
  if (type === 'download') {
    return (
      <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M4 19h16" />
      </svg>
    )
  }
  return (
    <svg className="sidebar-link-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h14" />
    </svg>
  )
}

export default function Dashboard() {
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isFaculty = user?.role === 'faculty'
  const isStudent = user?.role === 'student'
  const studentProfile = buildStudentProfile(user)
  const signedInDisplayName =
    user?.role === 'admin' ? 'Admin' : user?.username || user?.name || 'user'
  const [summary, setSummary] = useState(null)
  const [advancedSummary, setAdvancedSummary] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [facultyStudentResults, setFacultyStudentResults] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [compareAId, setCompareAId] = useState('')
  const [compareBId, setCompareBId] = useState('')
  const [passThresholdPercent, setPassThresholdPercent] = useState(DEFAULT_PASS_THRESHOLD_PERCENT)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(null)
  const markRefreshed = () => setLastRefreshAt(new Date().toISOString())
  const downloadStudentExamResults = () =>
    exportStudentExamResultsPDF(studentExamResultRows, {
      name: studentProfile.name,
      rollNo: studentProfile.rollNo,
    })

  const loadAssessments = async (nextFilters = filters) => {
    setTableLoading(true)
    try {
      const assessmentData = await getAssessments(token, nextFilters)
      setAssessments(assessmentData)
      markRefreshed()
    } catch (err) {
      setError(err.message || 'Failed to load assessments.')
    } finally {
      setTableLoading(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError('')
    setSummary(null)
    setAdvancedSummary(null)
    setAssessments([])
    setFacultyStudentResults([])
    setUsersList([])
    setLastRefreshAt(null)
    try {
      const [summaryData, assessmentData, advancedData, prefData, facultyResults, allUsers] = await Promise.all([
        getSummary(token),
        getAssessments(token),
        getAdvancedSummary(token),
        getPreferences(token),
        isFaculty ? getFacultyStudentResults(token) : Promise.resolve([]),
        isAdmin ? getUsers(token) : Promise.resolve([]),
      ])
      setSummary(summaryData)
      setAssessments(assessmentData)
      setAdvancedSummary(advancedData)
      setFacultyStudentResults(facultyResults)
      setUsersList(allUsers)
      if (prefData?.comparison) {
        setCompareAId(prefData.comparison.assessmentA || '')
        setCompareBId(prefData.comparison.assessmentB || '')
      }
      if (prefData?.passThresholdPercent !== undefined && prefData?.passThresholdPercent !== null) {
        setPassThresholdPercent(normalizePassThresholdPercent(prefData.passThresholdPercent))
      }
      setPreferencesReady(true)
      markRefreshed()
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, isFaculty, isAdmin])

  useEffect(() => {
    if (!preferencesReady || !isAdmin) return
    const persist = async () => {
      try {
        await updatePreferences(token, {
          comparison: {
            assessmentA: compareAId || null,
            assessmentB: compareBId || null,
          },
          passThresholdPercent: normalizePassThresholdPercent(passThresholdPercent),
        })
      } catch (err) {
        setError(err.message || 'Failed to save comparison preferences.')
      }
    }
    persist()
  }, [compareAId, compareBId, passThresholdPercent, preferencesReady, token, isAdmin])

  const handleCreate = async (payload) => {
    if (!isAdmin) {
      throw new Error('Only admin can create assessments.')
    }
    const created = await createAssessment(token, payload)
    setAssessments((prev) => [created, ...prev])
    const [summaryData, advancedData] = await Promise.all([
      getSummary(token),
      getAdvancedSummary(token),
    ])
    setSummary(summaryData)
    setAdvancedSummary(advancedData)
    await loadAssessments(filters)
  }

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = async () => {
    setPage(1)
    await loadAssessments(filters)
  }

  const clearFilters = async () => {
    setFilters(initialFilters)
    setPage(1)
    await loadAssessments(initialFilters)
  }

  const pagedAssessments = useMemo(() => {
    const start = (page - 1) * pageSize
    return assessments.slice(start, start + pageSize)
  }, [assessments, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(assessments.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const latestAssessment = assessments[0]
  const marksStats = advancedSummary?.marksStats || computeMarksStats(assessments)
  const overview = summary?.overview || {
    totalAssessments: assessments.length,
    avgDifficultyScore: assessments.length
      ? assessments.reduce((sum, item) => sum + toNumber(item.difficultyScore), 0) /
        assessments.length
      : 0,
    imbalancedAssessments: assessments.filter((item) => item.balanceStatus === 'Imbalanced')
      .length,
  }
  const distributionTotal = useMemo(() => {
    return (latestAssessment?.marksDistribution || []).reduce(
      (sum, entry) => sum + toNumber(entry.marks),
      0
    )
  }, [latestAssessment])
  const topicCoverage = latestAssessment?.totalMarks
    ? Math.min(100, (distributionTotal / latestAssessment.totalMarks) * 100)
    : null

  const rangeStats = useMemo(() => {
    if (!latestAssessment) return null
    return computeRangeStats(
      latestAssessment.marksDistribution,
      toNumber(latestAssessment.totalMarks),
      passThresholdPercent
    )
  }, [latestAssessment, passThresholdPercent])

  const studentStats = useMemo(() => {
    if (!latestAssessment) return null
    const passThreshold = toNumber(latestAssessment.totalMarks) * (passThresholdPercent / 100)
    const studentScores = Array.isArray(latestAssessment.studentMarks)
      ? latestAssessment.studentMarks
        .map((entry) => (typeof entry === 'number' ? entry : entry?.score))
        .map(toNumber)
        .filter((score) => score >= 0)
      : []
    if (studentScores.length) {
      const totalScore = studentScores.reduce((sum, score) => sum + score, 0)
      const passCount = studentScores.filter((score) => score >= passThreshold).length
      return {
        passRate: (passCount / studentScores.length) * 100,
        avgScore: totalScore / studentScores.length,
        performanceGap: Math.max(...studentScores) - Math.min(...studentScores),
        total: studentScores.length,
      }
    }
    const hasStudentData =
      latestAssessment.passRate !== undefined ||
      latestAssessment.averageScore !== undefined ||
      latestAssessment.performanceGap !== undefined
    if (!hasStudentData) return null
    return {
      passRate: latestAssessment.passRate ?? null,
      avgScore: latestAssessment.averageScore ?? null,
      performanceGap: latestAssessment.performanceGap ?? null,
      total: Array.isArray(latestAssessment.studentMarks)
        ? latestAssessment.studentMarks.length
        : null,
    }
  }, [latestAssessment, passThresholdPercent])

  const effectivePassRate = studentStats?.passRate ?? rangeStats?.passRate ?? null

  const distributionBalanceScore = useMemo(() => {
    if (!latestAssessment) return null
    return computeDistributionBalanceScore(
      latestAssessment.marksDistribution,
      toNumber(latestAssessment.totalMarks)
    )
  }, [latestAssessment])

  const qualityScore = useMemo(() => {
    return computeQualityScore({
      difficultyScore: latestAssessment?.difficultyScore,
      distributionScore: distributionBalanceScore,
      passRate: effectivePassRate,
      topicCoverage: topicCoverage ?? null,
    })
  }, [latestAssessment, distributionBalanceScore, effectivePassRate, topicCoverage])

  const predictedPassRate = useMemo(() => {
    if (effectivePassRate !== null) {
      return effectivePassRate
    }
    const diffScore = toNumber(latestAssessment?.difficultyScore)
    if (!Number.isFinite(diffScore) || diffScore === 0) return null
    return clamp(85 - (diffScore - 55) * 0.9, 20, 95)
  }, [latestAssessment, effectivePassRate])

  const performanceTrend = useMemo(() => {
    return (assessments || [])
      .slice(0, 8)
      .map((assessment) => {
        const stats = computeRangeStats(
          assessment.marksDistribution,
          toNumber(assessment.totalMarks),
          passThresholdPercent
        )
        if (!stats && !assessment.averageScore) return null
        return {
          name: formatShortDate(assessment.examDate),
          avgScore: assessment.averageScore ?? stats?.avgScore ?? 0,
        }
      })
      .filter(Boolean)
      .reverse()
  }, [assessments, passThresholdPercent])

  const riskFlags = useMemo(() => {
    if (!latestAssessment) return []
    const flags = []
    const diffScore = toNumber(latestAssessment.difficultyScore)
    if (latestAssessment.difficultyLevel === 'Hard' || diffScore >= 70) {
      flags.push('Exam appears too difficult.')
    }
    if (latestAssessment.difficultyLevel === 'Easy' || diffScore <= 40) {
      flags.push('Exam appears too easy.')
    }
    if (latestAssessment.balanceStatus === 'Imbalanced' || (distributionBalanceScore ?? 100) < 60) {
      flags.push('Marks distribution is poorly balanced.')
    }
    if (topicCoverage !== null && topicCoverage < 75) {
      flags.push('Topic coverage may be missing key syllabus areas.')
    }
    if (Number.isFinite(studentStats?.performanceGap) && latestAssessment.totalMarks) {
      const gapRatio = studentStats.performanceGap / latestAssessment.totalMarks
      if (gapRatio > 0.5) {
        flags.push('Large performance gaps detected among students.')
      }
    } else if (rangeStats && rangeStats.total > 0) {
      const gapRatio = Math.abs(rangeStats.top - rangeStats.weak) / rangeStats.total
      if (gapRatio > 0.4) {
        flags.push('Large performance gaps detected among students.')
      }
    }
    if (effectivePassRate !== null && effectivePassRate < 45) {
      flags.push('Pass rate is below the expected baseline.')
    }
    return dedupe(flags)
  }, [latestAssessment, distributionBalanceScore, topicCoverage, rangeStats, studentStats, effectivePassRate])

  const insights = useMemo(() => {
    const items = []
    if (latestAssessment?.difficultyLevel === 'Hard') {
      items.push('Exam appears too difficult based on recent difficulty scores.')
    }
    if (latestAssessment?.difficultyLevel === 'Easy') {
      items.push('Exam appears easy. Consider increasing mid-to-hard questions.')
    }
    if (rangeStats && rangeStats.passRate < 50) {
      items.push('Most students scored below average in the latest upload.')
    }
    if (topicCoverage !== null && topicCoverage < 80) {
      items.push('Important topics may be missing from the coverage range.')
    }
    if (latestAssessment?.balanceStatus === 'Imbalanced') {
      items.push('Marks distribution is uneven across sections.')
    }
    if (latestAssessment?.balanceStatus === 'Balanced') {
      items.push('Assessment is well-balanced across sections.')
    }
    return dedupe(items)
  }, [latestAssessment, rangeStats, topicCoverage])

  const combinedInsights = dedupe([
    ...(latestAssessment?.insights || []),
    ...insights,
  ])

  const smartRecommendations = useMemo(() => {
    const recommendations = []
    if (qualityScore !== null && qualityScore < 60) {
      recommendations.push('Overall quality is trending low. Revisit difficulty balance and coverage.')
    }
    if (distributionBalanceScore !== null && distributionBalanceScore < 65) {
      recommendations.push('Rebalance marks distribution to avoid heavy weighting on a single section.')
    }
    if (effectivePassRate !== null && effectivePassRate < 50) {
      recommendations.push('Introduce more mid-level questions to lift pass rate.')
    }
    if (topicCoverage !== null && topicCoverage < 80) {
      recommendations.push('Expand the question map to include missing syllabus topics.')
    }
    if (riskFlags.length === 0 && qualityScore !== null && qualityScore >= 80) {
      recommendations.push('Maintain the current blueprint. Results indicate a well-balanced assessment.')
    }
    return dedupe(recommendations)
  }, [qualityScore, distributionBalanceScore, effectivePassRate, topicCoverage, riskFlags])

  const combinedSuggestions = dedupe([
    ...(latestAssessment?.suggestions || []),
    ...(latestAssessment?.balanceStatus === 'Imbalanced'
      ? ['Redistribute marks to balance the section weights.']
      : []),
    ...smartRecommendations,
  ])

  const comparisonOptions = useMemo(() => {
    return (assessments || []).map((assessment) => ({
      id: assessment._id,
      label: `${assessment.subject} · ${formatShortDate(assessment.examDate)}`,
    }))
  }, [assessments])

  const selectedA = useMemo(
    () => assessments.find((item) => item._id === compareAId),
    [assessments, compareAId]
  )
  const selectedB = useMemo(
    () => assessments.find((item) => item._id === compareBId),
    [assessments, compareBId]
  )

  const comparisonStats = useMemo(() => {
    if (!selectedA || !selectedB) return null
    const statsA = computeRangeStats(
      selectedA.marksDistribution,
      toNumber(selectedA.totalMarks),
      passThresholdPercent
    )
    const statsB = computeRangeStats(
      selectedB.marksDistribution,
      toNumber(selectedB.totalMarks),
      passThresholdPercent
    )
    return {
      difficultyA: toNumber(selectedA.difficultyScore),
      difficultyB: toNumber(selectedB.difficultyScore),
      avgScoreA: selectedA.averageScore ?? statsA?.avgScore ?? null,
      avgScoreB: selectedB.averageScore ?? statsB?.avgScore ?? null,
      passRateA: selectedA.passRate ?? statsA?.passRate ?? null,
      passRateB: selectedB.passRate ?? statsB?.passRate ?? null,
    }
  }, [selectedA, selectedB, passThresholdPercent])

  const comparisonChartData = useMemo(() => {
    if (!comparisonStats) return []
    return [
      {
        name: 'Difficulty',
        assessmentA: comparisonStats.difficultyA,
        assessmentB: comparisonStats.difficultyB,
      },
      {
        name: 'Avg score',
        assessmentA: comparisonStats.avgScoreA ?? 0,
        assessmentB: comparisonStats.avgScoreB ?? 0,
      },
      {
        name: 'Pass rate',
        assessmentA: comparisonStats.passRateA ?? 0,
        assessmentB: comparisonStats.passRateB ?? 0,
      },
    ]
  }, [comparisonStats])

  const studentExamResults = useMemo(() => {
    const rows = buildExamRowsForStudent(studentProfile.studentNo)

    return rows.map((row) => {
      const percent = (row.subjectMarks / row.totalMarks) * 100
      const grade =
        percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B+' : percent >= 60 ? 'B' : 'C'
      const status = percent >= passThresholdPercent ? 'P' : 'U'
      return { ...row, grade, status }
    })
  }, [studentProfile.studentNo, passThresholdPercent])
  const facultyEnrolledStudents = useMemo(
    () => buildFacultyStudentRows(facultyStudentResults),
    [facultyStudentResults]
  )
  const examQualityMetrics = useMemo(() => {
    const allStudents = [1, 2, 3, 4]
    const allRows = allStudents.flatMap((studentNo) => buildExamRowsForStudent(studentNo))
    if (!allRows.length) {
      return { difficultyLevel: 'Medium', averageClassMarks: 0 }
    }
    const totalMarks = allRows.reduce((sum, row) => sum + toNumber(row.subjectMarks), 0)
    const averageClassMarks = totalMarks / allRows.length
    const difficultyLevel =
      averageClassMarks >= 75 ? 'Easy' : averageClassMarks >= 60 ? 'Medium' : 'Hard'
    return {
      difficultyLevel,
      averageClassMarks,
    }
  }, [])
  const currentSemesterCgpa = useMemo(() => {
    if (!studentExamResults.length) return 0
    const totalPercent = studentExamResults.reduce(
      (sum, row) => sum + (toNumber(row.subjectMarks) / toNumber(row.totalMarks || 100)) * 100,
      0
    )
    const avgPercent = totalPercent / studentExamResults.length
    return Number(clamp(avgPercent / 10, 5.0, 9.9).toFixed(2))
  }, [studentExamResults])
  const studentSgpaTrend = useMemo(() => {
    const semesterCount = romanToNumber(studentProfile.sem)
    const offset = Math.max(0, studentProfile.studentNo - 1) * 0.08
    const trend = Array.from({ length: semesterCount }, (_, index) => {
      const semNo = index + 1
      const raw = 7 + offset + semNo * 0.18 + ((semNo % 2 === 0 ? 1 : -1) * 0.07)
      const sgpa = Math.min(9.9, Math.max(5.0, raw))
      return {
        name: `Sem ${numberToRoman(semNo)}`,
        avgScore: Number(sgpa.toFixed(2)),
      }
    })
    if (trend.length) {
      trend[trend.length - 1] = {
        ...trend[trend.length - 1],
        avgScore: currentSemesterCgpa,
      }
    }
    return trend
  }, [studentProfile.sem, studentProfile.studentNo, currentSemesterCgpa])
  const studentExamResultRows = useMemo(() => {
    const currentSemNo = romanToNumber(studentProfile.sem)
    return studentExamResults.map((entry, index) => {
      const courseName = entry.subject
      const courseCode = `EE${200 + currentSemNo}${(studentProfile.studentNo * 7 + index + 1)
        .toString()
        .padStart(2, '0')}`
      return {
        semester: currentSemNo,
        courseName,
        courseCode,
        grade: entry.grade,
        result: entry.status,
      }
    })
  }, [studentExamResults, studentProfile.sem, studentProfile.studentNo])

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <nav className="sidebar-nav">
          {isStudent ? (
            <a href="#personal-profile">
              <SidebarIcon type="accounts" />
              <span>Student Details</span>
            </a>
          ) : null}
          {isStudent ? (
            <a href="#performance-analysis">
              <SidebarIcon type="analytics" />
              <span>Performance Analysis</span>
            </a>
          ) : null}
          {isStudent ? (
            <a href="#exam-quality-metrics">
              <SidebarIcon type="insights" />
              <span>Exam Quality Metrics</span>
            </a>
          ) : null}
          {isStudent ? (
            <a href="#exam-results">
              <SidebarIcon type="records" />
              <span>Exam Results</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#overview">
              <SidebarIcon type="overview" />
              <span>Overview</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#analytics">
              <SidebarIcon type="analytics" />
              <span>Analytics</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#insights">
              <SidebarIcon type="insights" />
              <span>Insights</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#comparison">
              <SidebarIcon type="comparison" />
              <span>Comparison</span>
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#upload">
              <SidebarIcon type="upload" />
              <span>Upload</span>
            </a>
          ) : null}
          {isFaculty ? (
            <a href="#students">
              <SidebarIcon type="students" />
              <span>Students</span>
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#accounts">
              <SidebarIcon type="accounts" />
              <span>Accounts</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#records">
              <SidebarIcon type="records" />
              <span>Records</span>
            </a>
          ) : null}
        </nav>
        <div className="sidebar-meta">
          <span className="muted">Signed in as</span>
          <strong>{signedInDisplayName}</strong>
          <span className="muted">Last refresh</span>
          <strong>{formatRefreshDateTime(lastRefreshAt)}</strong>
        </div>
      </aside>

      <div className="dashboard-content">
        {error && (
          <div className="status error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="empty">Loading dashboard...</div>
        ) : (
          <>
            {isStudent ? (
              <section className="dashboard-section personal-profile-section" id="personal-profile">
                <div className="section-head">
                  <h2>Student Details</h2>
                </div>
                <div className="comparison-panel profile-panel">
                  <div className="profile-lines">
                    <p className="profile-line">
                      <span className="muted">Name:</span>
                      <strong>{studentProfile.name}</strong>
                    </p>
                    <p className="profile-line">
                      <span className="muted">Roll No:</span>
                      <strong>{studentProfile.rollNo}</strong>
                    </p>
                    <p className="profile-line">
                      <span className="muted">Sem:</span>
                      <strong>{studentProfile.sem}</strong>
                    </p>
                    <p className="profile-line">
                      <span className="muted">Dept:</span>
                      <strong>{studentProfile.dept}</strong>
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="performance-analysis">
                <div className="section-head">
                  <h2>Performance Analysis</h2>
                </div>
                <div className="analytics-row">
                  <div className="score-card">
                    <h3>Semester-wise SGPA</h3>
                    <div className="score-value">{currentSemesterCgpa.toFixed(2)}</div>
                    <p className="muted">
                      Latest semester SGPA (Sem {studentProfile.sem}) from exam results.
                    </p>
                  </div>
                  <SgpaBarChart data={studentSgpaTrend} />
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="exam-quality-metrics">
                <div className="section-head">
                  <h2>Exam Quality Metrics</h2>
                </div>
                <div className="analytics-row">
                  <div className="score-card">
                    <h3>Difficulty level of exam</h3>
                    <div className="score-value">{examQualityMetrics.difficultyLevel}</div>
                    <p className="muted">Based on all students' exam results.</p>
                  </div>
                  <div className="score-card">
                    <h3>Average marks of class</h3>
                    <div className="score-value">{examQualityMetrics.averageClassMarks.toFixed(1)}</div>
                    <p className="muted">Computed from all students across exam-result subjects.</p>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="exam-results">
                <div className="section-head section-head-inline">
                  <h2>Exam Results</h2>
                  <button
                    className="ghost download-exam-btn"
                    type="button"
                    onClick={downloadStudentExamResults}
                  >
                    <SidebarIcon type="download" />
                    <span>Download</span>
                  </button>
                </div>
                <div className="comparison-panel exam-results-panel">
                  <div className="table">
                    <div className="table-head exam-results-head">
                      <span>Course Code</span>
                      <span>Course Name</span>
                      <span>Sem</span>
                      <span>Grade</span>
                      <span>Result</span>
                    </div>
                    {studentExamResultRows.map((row, index) => (
                      <div className="table-row exam-results-row" key={`${row.courseCode}-${index}`}>
                        <span>{row.courseCode}</span>
                        <span>{row.courseName}</span>
                        <span>{row.semester}</span>
                        <span>{row.grade}</span>
                        <span>{row.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {!isStudent ? (
            <>
            <section className="dashboard-section" id="overview">
              <div className="summary-strip">
                <div className="summary-card">
                  <span className="muted">Average marks</span>
                  <h3>{Number(marksStats.avgMarks || 0).toFixed(1)}</h3>
                  <p className="muted">Across {overview.totalAssessments || 0} assessments</p>
                </div>
                <div className="summary-card">
                  <span className="muted">Highest marks</span>
                  <h3>{marksStats.maxMarks ?? 0}</h3>
                  <p className="muted">Highest total marks</p>
                </div>
                <div className="summary-card">
                  <span className="muted">Lowest marks</span>
                  <h3>{marksStats.minMarks ?? 0}</h3>
                  <p className="muted">Lowest total marks</p>
                </div>
                <div className="summary-card">
                  <span className="muted">Pass rate</span>
                  <h3>
                    {effectivePassRate === null ? '—' : `${effectivePassRate.toFixed(0)}%`}
                  </h3>
                  <p className="muted">Pass mark: {passThresholdPercent}%</p>
                </div>
                <div className="summary-card highlight">
                  <span className="muted">Assessment quality score</span>
                  <h3>{qualityScore === null ? '—' : `${qualityScore.toFixed(0)}`}</h3>
                  <p className="muted">Composite of balance, pass rate, coverage</p>
                </div>
              </div>
            </section>

            <section className="dashboard-section" id="analytics">
              <div className="section-head">
                <h2>Assessment analytics</h2>
                <p>Visualize difficulty, marks distribution, and student performance trends.</p>
              </div>
              <div className="chart-center">
                <div className="chart-grid">
                  <DifficultyChart data={summary?.difficultySplit || []} />
                  <MarksDistributionChart
                    data={latestAssessment?.marksDistribution || []}
                    title={`Marks distribution ${latestAssessment?.subject ? `(${latestAssessment.subject})` : ''}`}
                  />
                  <PerformanceTrendChart data={performanceTrend} />
                </div>
              </div>
              <div className="analytics-row">
                <div className="score-card">
                  <h3>Prediction</h3>
                  <p className="muted">Expected pass percentage based on score distribution.</p>
                  <div className="score-value">
                    {predictedPassRate === null ? '—' : `${predictedPassRate.toFixed(0)}%`}
                  </div>
                  <div className="progress">
                    <span style={{ width: `${predictedPassRate ?? 0}%` }} />
                  </div>
                  <p className="muted">
                    {studentStats?.passRate !== null
                      ? 'Based on student-level marks.'
                      : rangeStats
                        ? 'Derived from score ranges.'
                        : 'Estimated from difficulty score when ranges are unavailable.'}
                  </p>
                </div>
                <div className="score-card">
                  <h3>Pass criteria</h3>
                  <p className="muted">
                    {isAdmin
                      ? 'Admin-controlled pass mark for all dashboard pass calculations.'
                      : 'Read-only pass mark configured by admin.'}
                  </p>
                  <div className="pass-control">
                    <label htmlFor="passThresholdPercent">Pass mark (%)</label>
                    <div className="pass-control-row">
                      <input
                        id="passThresholdPercent"
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={passThresholdPercent}
                        disabled={!isAdmin}
                        onChange={(event) =>
                          setPassThresholdPercent(
                            normalizePassThresholdPercent(event.target.value)
                          )
                        }
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={passThresholdPercent}
                        disabled={!isAdmin}
                        onChange={(event) =>
                          setPassThresholdPercent(
                            normalizePassThresholdPercent(event.target.value)
                          )
                        }
                      />
                    </div>
                    <p className="muted">
                      Students scoring at least {passThresholdPercent}% of total marks are counted as pass.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-section" id="insights">
              <div className="section-head">
                <h2>Insights &amp; suggestions</h2>
                <p>Automated guidance based on difficulty, coverage, and score spread.</p>
              </div>
              <div className="insight-grid">
                <article className="insight">
                  <h3>Quality signals</h3>
                  <div className="insight-list">
                    <span>Difficulty: {latestAssessment?.difficultyLevel || '—'}</span>
                    <span>
                      Topic coverage:{' '}
                      {topicCoverage === null ? '—' : `${topicCoverage.toFixed(0)}%`}
                    </span>
                    <span>Balance: {latestAssessment?.balanceStatus || '—'}</span>
                    <span>
                      Avg difficulty score: {Number(overview.avgDifficultyScore || 0).toFixed(1)}
                    </span>
                  </div>
                </article>
                <article className="insight">
                  <h3>Performance groups</h3>
                  {rangeStats ? (
                    <div className="performance-grid">
                      <div>
                        <span className="muted">Top performers</span>
                        <strong>{rangeStats.top}</strong>
                      </div>
                      <div>
                        <span className="muted">Average performers</span>
                        <strong>{rangeStats.average}</strong>
                      </div>
                      <div>
                        <span className="muted">Weak students</span>
                        <strong>{rangeStats.weak}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">
                      Provide score ranges or student marks to generate performance groups.
                    </p>
                  )}
                </article>
                <article className="insight">
                  <h3>System insights</h3>
                  <div className="insight-list">
                    {combinedInsights.length ? (
                      combinedInsights.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span className="muted">No insights generated yet.</span>
                    )}
                  </div>
                </article>
                <article className="insight">
                  <h3>Suggestions</h3>
                  <div className="suggestions">
                    {combinedSuggestions.length ? (
                      combinedSuggestions.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span className="muted">No suggestions yet.</span>
                    )}
                  </div>
                </article>
              </div>
            </section>

            <section className="dashboard-section" id="comparison">
              <div className="section-head">
                <h2>Exam comparison</h2>
                <p>Compare two assessments on difficulty, average score, and pass rate.</p>
              </div>
              <div className="comparison-panel">
                <div className="comparison-select">
                  <label>
                    Assessment A
                    <select
                      value={compareAId}
                      onChange={(event) => setCompareAId(event.target.value)}
                    >
                      <option value="">Select assessment</option>
                      {comparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Assessment B
                    <select
                      value={compareBId}
                      onChange={(event) => setCompareBId(event.target.value)}
                    >
                      <option value="">Select assessment</option>
                      {comparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="comparison-grid">
                  <ComparisonChart data={comparisonChartData} />
                  <div className="comparison-summary">
                    <h3>Comparison summary</h3>
                    {comparisonStats ? (
                      <div className="summary-stack">
                        <div>
                          <span className="muted">Difficulty</span>
                          <strong>
                            {comparisonStats.difficultyA.toFixed(1)} vs{' '}
                            {comparisonStats.difficultyB.toFixed(1)}
                          </strong>
                        </div>
                        <div>
                          <span className="muted">Avg score</span>
                          <strong>
                            {comparisonStats.avgScoreA === null
                              ? '—'
                              : comparisonStats.avgScoreA.toFixed(1)}{' '}
                            vs{' '}
                            {comparisonStats.avgScoreB === null
                              ? '—'
                              : comparisonStats.avgScoreB.toFixed(1)}
                          </strong>
                        </div>
                        <div>
                          <span className="muted">Pass rate</span>
                          <strong>
                            {comparisonStats.passRateA === null
                              ? '—'
                              : `${comparisonStats.passRateA.toFixed(0)}%`}{' '}
                            vs{' '}
                            {comparisonStats.passRateB === null
                              ? '—'
                              : `${comparisonStats.passRateB.toFixed(0)}%`}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">
                        Select two assessments to unlock the comparison summary.
                      </p>
                    )}
                    {comparisonStats?.avgScoreA === null || comparisonStats?.avgScoreB === null ? (
                      <p className="muted">
                        Average score and pass rate require score ranges or student-level marks.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {isAdmin ? (
              <section className="dashboard-section" id="upload">
                <div className="section-head">
                  <h2>Upload assessment data</h2>
                  <p>Enter question paper structure or marks distribution to trigger analytics.</p>
                </div>
                <div className="entry-grid">
                  <AssessmentForm onSubmit={handleCreate} />
                  <div className="side-note">
                    <h3>What happens next</h3>
                    <p>
                      Once uploaded, the system checks difficulty, marks balance, and generates actionable
                      insights for curriculum planning.
                    </p>
                    <ul className="note-list">
                      <li>Difficulty level and score distribution.</li>
                      <li>Topic coverage percentage.</li>
                      <li>Performance groups and trends.</li>
                    </ul>
                  </div>
                </div>
              </section>
            ) : null}

            {isFaculty ? (
              <section className="dashboard-section" id="students">
                <div className="section-head">
                  <h2>Enrolled Students</h2>
                  <p>Faculty can view four student exam records with register details and marks.</p>
                </div>
                <div className="table enrolled-students-table">
                  <div className="table-head">
                    <span>Student Name</span>
                    <span>Register Number</span>
                    <span>Department</span>
                    <span>Semester</span>
                    <span>Marks</span>
                  </div>
                  {facultyEnrolledStudents.map((student) => (
                    <div className="table-row" key={student.id}>
                      <span>{student.name}</span>
                      <span>{student.registerNumber}</span>
                      <span>{student.department}</span>
                      <span>{student.semester}</span>
                      <span>{student.marks}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="accounts">
                <div className="section-head">
                  <h2>User accounts</h2>
                  <p>Admin can view all accounts across student, faculty, and admin roles.</p>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span>Name</span>
                    <span>Username</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span>Provider</span>
                  </div>
                  {usersList.map((account) => (
                    <div className="table-row" key={account._id}>
                      <span>{account.name}</span>
                      <span>{account.username}</span>
                      <span>{account.email}</span>
                      <span>{account.role}</span>
                      <span>{account.provider || 'local'}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="dashboard-section" id="records">
              <div className="section-head">
                <h2>Stored assessments</h2>
                <p>Search, filter, and audit historical uploads.</p>
              </div>
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
              {tableLoading ? (
                <div className="empty">Loading assessments...</div>
              ) : (
                <>
                  <RecordsTable assessments={pagedAssessments} />
                  <Pagination
                    total={assessments.length}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                  />
                </>
              )}
            </section>
            </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
