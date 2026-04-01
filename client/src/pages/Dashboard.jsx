import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  createAssessment,
  createUser,
  deleteAssessmentById,
  deleteUserById,
  getClassPerformanceOverview,
  getFacultyStudentResults,
  getAdvancedSummary,
  getAssessments,
  getPreferences,
  getUsers,
  updateAssessmentById,
  updateUserById,
  updatePreferences,
} from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import AssessmentForm from '../components/AssessmentForm.jsx'
import RecordsTable from '../components/RecordsTable.jsx'
import {
  MarksChart,
  MarksDistributionChart,
  PerformanceTrendChart,
  SgpaBarChart,
  ComparisonChart,
  SubjectMarksChart,
  GradeDistributionChart,
} from '../components/Charts.jsx'
import Pagination from '../components/Pagination.jsx'
import { exportStudentExamResultsPDF } from '../utils/export.js'

const initialFilters = {
  subject: '',
  fromDate: '',
  toDate: '',
}
const initialStudentForm = {
  name: '',
  email: '',
  password: '',
  registerNumber: '',
  department: '',
  semester: 6,
}
const initialFacultyForm = {
  name: '',
  email: '',
  password: '',
  department: '',
  assignedSubjects: '',
}
const initialAcademicRecordForm = {
  studentId: '',
  semester: 1,
  subject: '',
  score: '',
  totalMarks: 100,
}
const DEFAULT_PASS_THRESHOLD_PERCENT = 45
const STUDENT_FIXED_PASS_PERCENT = 45
const FIXED_DASHBOARD_PASS_PERCENT = 45
const FACULTY_TARGET_SEMESTER = 6
const FACULTY_TOTAL_STUDENTS = 4
const initialAdminAdvancedFilters = {
  studentId: '',
  department: '',
  semester: '',
  subject: '',
  result: '',
}
const normalizeFilterValue = (value) => String(value || '').trim().toLowerCase()
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

const computeAssessmentStudentStats = (assessment, passThresholdPercent = DEFAULT_PASS_THRESHOLD_PERCENT) => {
  if (!assessment) return null

  const totalMarks = toNumber(assessment.totalMarks)
  const passThreshold = totalMarks * (normalizePassThresholdPercent(passThresholdPercent) / 100)
  const studentScores = Array.isArray(assessment.studentMarks)
    ? assessment.studentMarks
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

  const rangeStats = computeRangeStats(
    assessment.marksDistribution,
    totalMarks,
    passThresholdPercent
  )

  if (rangeStats) {
    return {
      passRate: rangeStats.passRate,
      avgScore: rangeStats.avgScore,
      performanceGap: assessment.performanceGap ?? null,
      total: rangeStats.total,
    }
  }

  const hasFallbackData =
    assessment.averageScore !== undefined || assessment.performanceGap !== undefined

  if (!hasFallbackData) return null

  return {
    passRate: null,
    avgScore: assessment.averageScore ?? null,
    performanceGap: assessment.performanceGap ?? null,
    total: Array.isArray(assessment.studentMarks) ? assessment.studentMarks.length : null,
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
const parseAssignedSubjects = (value) =>
  dedupe(String(value || '').split(',').map((item) => item.trim()))
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
const SEMESTER_COURSES = {
  1: [
    { code: 'MA1101', subject: 'Engineering Mathematics I', credits: 4 },
    { code: 'PH1101', subject: 'Engineering Physics', credits: 3 },
    { code: 'EE1101', subject: 'Basic Electrical Engineering', credits: 4 },
    { code: 'CS1101', subject: 'Programming in C', credits: 3 },
    { code: 'GE1101', subject: 'Engineering Graphics', credits: 3 },
    { code: 'HS1101', subject: 'Communication Skills', credits: 2 },
  ],
  2: [
    { code: 'MA1201', subject: 'Engineering Mathematics II', credits: 4 },
    { code: 'EC1201', subject: 'Electronic Devices', credits: 3 },
    { code: 'EE1201', subject: 'Circuit Theory', credits: 4 },
    { code: 'CS1201', subject: 'Data Structures', credits: 3 },
    { code: 'GE1201', subject: 'Environmental Science', credits: 2 },
    { code: 'ME1201', subject: 'Workshop Practice', credits: 2 },
  ],
  3: [
    { code: 'EE2301', subject: 'Electrical Machines I', credits: 4 },
    { code: 'EE2302', subject: 'Network Analysis', credits: 4 },
    { code: 'EC2301', subject: 'Digital Electronics', credits: 3 },
    { code: 'EC2302', subject: 'Signals and Systems', credits: 3 },
    { code: 'EE2303', subject: 'Measurements and Instrumentation', credits: 3 },
    { code: 'MA2301', subject: 'Probability and Statistics', credits: 3 },
  ],
  4: [
    { code: 'EE2401', subject: 'Electrical Machines II', credits: 4 },
    { code: 'EE2402', subject: 'Control Systems', credits: 4 },
    { code: 'EC2401', subject: 'Microprocessors and Microcontrollers', credits: 3 },
    { code: 'EE2403', subject: 'Power Systems I', credits: 4 },
    { code: 'EC2402', subject: 'Linear Integrated Circuits', credits: 3 },
    { code: 'EE2404', subject: 'Electromagnetic Fields', credits: 3 },
  ],
  5: [
    { code: 'EE3501', subject: 'Power Electronics', credits: 4 },
    { code: 'EE3502', subject: 'Power Systems II', credits: 4 },
    { code: 'EC3501', subject: 'Digital Signal Processing', credits: 3 },
    { code: 'EC3502', subject: 'Embedded Systems', credits: 3 },
    { code: 'EE3503', subject: 'Renewable Energy Systems', credits: 3 },
    { code: 'EE35E1', subject: 'Professional Elective I', credits: 3 },
  ],
  6: [
    { code: 'EC3601', subject: 'VLSI Design', credits: 3 },
    { code: 'EE3601', subject: 'Electric Drives and Control', credits: 4 },
    { code: 'EE3602', subject: 'High Voltage Engineering', credits: 3 },
    { code: 'EE3603', subject: 'Industrial Automation', credits: 3 },
    { code: 'EE3604', subject: 'Internet of Things for Energy Systems', credits: 3 },
    { code: 'EE36E2', subject: 'Professional Elective II', credits: 3 },
  ],
}
const FACULTY_TARGET_SUBJECTS = new Set(
  (SEMESTER_COURSES[FACULTY_TARGET_SEMESTER] || []).map((course) => course.subject)
)
const buildStudentProfile = (user) => {
  const identity = String(user?.username || user?.name || '').toLowerCase()
  const match = identity.match(/student\s*(\d+)/i)
  const studentNo = match ? Number(match[1]) : 1
  const normalizedNo = Number.isFinite(studentNo) && studentNo > 0 ? studentNo : 1
  const avatarStyles = [
    { accent: '#2563eb', glow: 'rgba(37, 99, 235, 0.22)', image: '/avatar-student-1.svg' },
    { accent: '#0f766e', glow: 'rgba(15, 118, 110, 0.22)', image: '/avatar-student-2.svg' },
    { accent: '#d97706', glow: 'rgba(217, 119, 6, 0.22)', image: '/avatar-student-3.svg' },
    { accent: '#7c3aed', glow: 'rgba(124, 58, 237, 0.2)', image: '/avatar-student-4.svg' },
  ]
  const avatarStyle = avatarStyles[(normalizedNo - 1) % avatarStyles.length]

  return {
    studentNo: normalizedNo,
    name: user?.name || `Student ${normalizedNo}`,
    rollNo: user?.registerNumber || `2026${String(normalizedNo).padStart(2, '0')}`,
    sem: numberToRoman(toNumber(user?.semester) || 6),
    dept: user?.department || 'EEE',
    email: user?.email || `Student${normalizedNo}@example.edu`,
    phone: `987654${String(normalizedNo).padStart(4, '0')}`,
    batch: '2022–2026',
    avatarAccent: avatarStyle.accent,
    avatarGlow: avatarStyle.glow,
    avatarImage: avatarStyle.image,
  }
}
const buildStudentManagementRecord = (user) => {
  const profile = buildStudentProfile(user)

  return {
    ...user,
    registerNumber: user?.registerNumber || profile.rollNo,
    department: user?.department || profile.dept,
    semester: user?.semester || romanToNumber(profile.sem) || FACULTY_TARGET_SEMESTER,
  }
}
const buildFacultyManagementRecord = (user, subjectOptions = []) => {
  const identity = String(user?.username || user?.name || '').toLowerCase()
  const match = identity.match(/faculty\s*(\d+)/i)
  const facultyNo = match ? Number(match[1]) : 1
  const normalizedNo = Number.isFinite(facultyNo) && facultyNo > 0 ? facultyNo : 1
  const fallbackStart = ((normalizedNo - 1) * 2) % Math.max(subjectOptions.length || 1, 1)
  const fallbackSubjects = subjectOptions.length
    ? subjectOptions.slice(fallbackStart, fallbackStart + 3)
    : ['Mathematics', 'Physics', 'Chemistry']
  const normalizedAssignedSubjects = Array.isArray(user?.assignedSubjects) && user.assignedSubjects.length
    ? dedupe(user.assignedSubjects.map((item) => String(item).trim()))
    : dedupe(fallbackSubjects)

  return {
    ...user,
    department: user?.department || (normalizedNo === 1 ? 'Science and Humanities' : 'EEE'),
    assignedSubjects: normalizedAssignedSubjects,
  }
}
const buildAcademicRecordRow = (assessment, studentLookup = new Map()) => {
  const rawUser = assessment?.user
  const userId = typeof rawUser === 'object' ? rawUser?._id || rawUser?.id : rawUser
  const sourceUser = (userId && studentLookup.get(String(userId))) || rawUser || {}
  const normalizedStudent = buildStudentManagementRecord(sourceUser)
  const scoreEntry = Array.isArray(assessment?.studentMarks) ? assessment.studentMarks[0] : null
  const score = toNumber(scoreEntry?.score ?? assessment?.averageScore)
  const totalMarks = Math.max(1, toNumber(assessment?.totalMarks || 100))
  const semester = toNumber(assessment?.semester) || toNumber(normalizedStudent.semester) || 1
  const percent = totalMarks ? (score / totalMarks) * 100 : 0

  return {
    id: assessment?._id,
    studentId: normalizedStudent._id || normalizedStudent.id || userId || '',
    studentName: normalizedStudent.name || 'Student',
    registerNumber: normalizedStudent.registerNumber || '—',
    department: normalizedStudent.department || '—',
    semester,
    subject: assessment?.subject || '—',
    score,
    totalMarks,
    examDate: assessment?.examDate || '',
    result: percent >= FIXED_DASHBOARD_PASS_PERCENT ? 'Pass' : 'Fail',
    assessment,
  }
}
const buildStoredExamRowsForStudent = (assessments) => {
  const courseLookup = Object.entries(SEMESTER_COURSES).reduce((acc, [semesterValue, courses]) => {
    acc[semesterValue] = new Map(courses.map((course) => [course.subject, course]))
    return acc
  }, {})

  return (Array.isArray(assessments) ? assessments : [])
    .filter((assessment) => toNumber(assessment?.semester) >= 1 && toNumber(assessment?.semester) <= 8)
    .map((assessment) => {
      const semester = toNumber(assessment?.semester) || 1
      const course = courseLookup[String(semester)]?.get(assessment?.subject) || {}
      const totalMarks = Math.max(1, toNumber(assessment?.totalMarks || 100))
      const scoreEntry = Array.isArray(assessment?.studentMarks) ? assessment.studentMarks[0] : null
      const subjectMarks = toNumber(scoreEntry?.score ?? assessment?.averageScore)
      return {
        semester,
        subject: assessment?.subject || '—',
        courseCode: course.code || `SEM${semester}`,
        credits: course.credits || 3,
        subjectMarks,
        totalMarks,
      }
    })
    .sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester
      return a.subject.localeCompare(b.subject)
    })
}
const buildFacultyPerformanceRecords = (results) => {
  const records = (Array.isArray(results) ? results : []).flatMap((entry, index) => {
    const student = entry?.student || {}
    const profile = buildStudentProfile({
      name: student?.name,
      username: student?.username || `student${index + 1}`,
    })
    const assessments = Array.isArray(entry?.assessments) ? entry.assessments : []
    const semesterMatchedAssessments = assessments.filter((assessment) =>
      FACULTY_TARGET_SUBJECTS.has(assessment?.subject)
    )

    if (semesterMatchedAssessments.length) {
      return semesterMatchedAssessments.map((assessment, assessmentIndex) => {
        const totalMarks = Math.max(1, toNumber(assessment?.totalMarks || 100))
        const marks = toNumber(assessment?.averageScore)
        const percent = (marks / totalMarks) * 100
        const result = percent >= FIXED_DASHBOARD_PASS_PERCENT ? 'Pass' : 'Fail'

        return {
          id: `${student?.id || profile.rollNo}-${assessment?._id || assessmentIndex}`,
          name: student?.name || profile.name,
          rollNo: student?.registerNumber || profile.rollNo,
          department: student?.department || profile.dept,
          semester: student?.semester || FACULTY_TARGET_SEMESTER,
          email: student?.email || profile.email,
          subject: assessment?.subject || '—',
          marks: `${Math.round(marks)}/${totalMarks}`,
          difficultyLevel: assessment?.difficultyLevel || '',
          result,
        }
      })
    }

    return []
  })

  return records
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
  const { dashboardTheme = 'light' } = useOutletContext() || {}
  const { token, user, refreshProfile } = useAuth()
  const dashboardLoadKeyRef = useRef('')
  const isAdmin = user?.role === 'admin'
  const isFaculty = user?.role === 'faculty'
  const isStudent = user?.role === 'student'
  const studentProfile = buildStudentProfile(user)
  const signedInDisplayName =
    user?.role === 'admin' ? 'Admin' : user?.username || user?.name || 'user'
  const [advancedSummary, setAdvancedSummary] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [facultyStudentResults, setFacultyStudentResults] = useState([])
  const [classPerformanceOverview, setClassPerformanceOverview] = useState({
    totalStudents: 0,
    classAverage: 0,
    passPercentage: 0,
    topScore: 0,
    failedStudents: 0,
  })
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualRefreshLoading, setManualRefreshLoading] = useState(false)
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [compareAId, setCompareAId] = useState('')
  const [compareBId, setCompareBId] = useState('')
  const [passThresholdPercent, setPassThresholdPercent] = useState(DEFAULT_PASS_THRESHOLD_PERCENT)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [studentSubjectSearch, setStudentSubjectSearch] = useState('')
  const [studentArchivePage, setStudentArchivePage] = useState(1)
  const [facultyPerformanceSearch, setFacultyPerformanceSearch] = useState('')
  const [facultyPerformanceSubject, setFacultyPerformanceSubject] = useState('')
  const [facultyPerformanceResult, setFacultyPerformanceResult] = useState('')
  const [facultyPerformancePage, setFacultyPerformancePage] = useState(1)
  const [facultyPerformancePageSize, setFacultyPerformancePageSize] = useState(10)
  const [studentManagementSearch, setStudentManagementSearch] = useState('')
  const [studentManagementSemester, setStudentManagementSemester] = useState('')
  const [studentManagementForm, setStudentManagementForm] = useState(initialStudentForm)
  const [editingStudentId, setEditingStudentId] = useState('')
  const [facultyManagementSearch, setFacultyManagementSearch] = useState('')
  const [facultyManagementForm, setFacultyManagementForm] = useState(initialFacultyForm)
  const [editingFacultyId, setEditingFacultyId] = useState('')
  const [academicRecordForm, setAcademicRecordForm] = useState(initialAcademicRecordForm)
  const [editingAcademicRecordId, setEditingAcademicRecordId] = useState('')
  const [academicRecordFilters, setAcademicRecordFilters] = useState({
    studentId: '',
    semester: '',
    subject: '',
  })
  const [adminAdvancedFilters, setAdminAdvancedFilters] = useState(initialAdminAdvancedFilters)
  const [adminQualityPage, setAdminQualityPage] = useState(1)
  const [adminQualityPageSize, setAdminQualityPageSize] = useState(10)
  const [adminAdvancedPage, setAdminAdvancedPage] = useState(1)
  const [adminAdvancedPageSize, setAdminAdvancedPageSize] = useState(10)
  const [academicRecordPage, setAcademicRecordPage] = useState(1)
  const [academicRecordPageSize, setAcademicRecordPageSize] = useState(10)
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
    } catch (err) {
      setError(err.message || 'Failed to load assessments.')
    } finally {
      setTableLoading(false)
    }
  }

  const refreshAssessmentDashboardData = async (nextFilters = filters) => {
    try {
      const [assessmentData, advancedData, facultyResults, classOverviewData] = await Promise.all([
        getAssessments(token, nextFilters),
        getAdvancedSummary(token),
        isFaculty || isAdmin ? getFacultyStudentResults(token) : Promise.resolve([]),
        getClassPerformanceOverview(token).catch(() => ({
          totalStudents: 0,
          classAverage: 0,
          passPercentage: 0,
          topScore: 0,
          failedStudents: 0,
        })),
      ])

      setAssessments(assessmentData)
      setAdvancedSummary(advancedData)
      setFacultyStudentResults(facultyResults)
      setClassPerformanceOverview(classOverviewData)
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard data.')
    }
  }

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [assessmentData, advancedData, prefData, facultyResults, allUsers] = await Promise.all([
        getAssessments(token),
        getAdvancedSummary(token),
        getPreferences(token),
        isFaculty ? getFacultyStudentResults(token) : Promise.resolve([]),
        isAdmin ? getUsers(token) : Promise.resolve([]),
      ])
      setAssessments(assessmentData)
      setAdvancedSummary(advancedData)
      setFacultyStudentResults(facultyResults)
      setUsersList(allUsers)
      if (prefData?.comparison) {
        setCompareAId(prefData.comparison.assessmentA || '')
        setCompareBId(prefData.comparison.assessmentB || '')
      }
      setPassThresholdPercent(DEFAULT_PASS_THRESHOLD_PERCENT)
      try {
        const classOverviewData = await getClassPerformanceOverview(token)
        setClassPerformanceOverview(classOverviewData)
      } catch {
        setClassPerformanceOverview({
          totalStudents: 0,
          classAverage: 0,
          passPercentage: 0,
          topScore: 0,
          failedStudents: 0,
        })
      }
      setPreferencesReady(true)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, isFaculty, token])

  useEffect(() => {
    const loadKey = [token, user?._id || user?.id || user?.email || user?.username || '', user?.role || ''].join(':')
    if (!token || !user || dashboardLoadKeyRef.current === loadKey) return
    dashboardLoadKeyRef.current = loadKey
    loadData()
  }, [loadData, token, user])

  const handleManualDashboardRefresh = async () => {
    setManualRefreshLoading(true)
    setError('')
    try {
      await refreshProfile().catch(() => null)
      await refreshAssessmentDashboardData()
    } catch {
      // refreshAssessmentDashboardData already sets a user-facing error
    } finally {
      setManualRefreshLoading(false)
    }
  }

  useEffect(() => {
    if (!preferencesReady || !isAdmin) return
    const persist = async () => {
      try {
        await updatePreferences(token, {
          comparison: {
            assessmentA: compareAId || null,
            assessmentB: compareBId || null,
          },
          passThresholdPercent: DEFAULT_PASS_THRESHOLD_PERCENT,
        })
      } catch (err) {
        setError(err.message || 'Failed to save comparison preferences.')
      }
    }
    persist()
  }, [compareAId, compareBId, preferencesReady, token, isAdmin])

  const handleCreate = async (payload) => {
    if (!isAdmin) {
      throw new Error('Only admin can create assessments.')
    }
    const created = await createAssessment(token, payload)
    setAssessments((prev) => [created, ...prev])
    await refreshAssessmentDashboardData(filters)
  }

  const resetStudentManagementForm = () => {
    setStudentManagementForm(initialStudentForm)
    setEditingStudentId('')
  }

  const resetFacultyManagementForm = () => {
    setFacultyManagementForm(initialFacultyForm)
    setEditingFacultyId('')
  }

  const resetAcademicRecordForm = () => {
    setAcademicRecordForm(initialAcademicRecordForm)
    setEditingAcademicRecordId('')
  }

  const handleStudentFormChange = (key, value) => {
    setStudentManagementForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFacultyFormChange = (key, value) => {
    setFacultyManagementForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleAcademicRecordFormChange = (key, value) => {
    setAcademicRecordForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleAcademicRecordFilterChange = (key, value) => {
    setAcademicRecordFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleAdminAdvancedFilterChange = (key, value) => {
    setAdminAdvancedFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmitStudentManagement = async () => {
    const payload = {
      ...studentManagementForm,
      semester: toNumber(studentManagementForm.semester) || 6,
      role: 'student',
    }

    try {
      if (editingStudentId) {
        const updated = await updateUserById(token, editingStudentId, payload)
        setUsersList((prev) => prev.map((userItem) => (userItem._id === editingStudentId || userItem.id === editingStudentId
          ? { ...userItem, ...updated, _id: userItem._id || updated.id }
          : userItem)))
      } else {
        const created = await createUser(token, payload)
        setUsersList((prev) => [...prev, { ...created, _id: created.id, provider: 'local' }])
      }
      resetStudentManagementForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to save student.')
    }
  }

  const handleEditStudent = (student) => {
    const normalizedStudent = buildStudentManagementRecord(student)
    setEditingStudentId(student._id || student.id)
    setStudentManagementForm({
      name: normalizedStudent.name || '',
      email: normalizedStudent.email || '',
      password: '',
      registerNumber: normalizedStudent.registerNumber || '',
      department: normalizedStudent.department || '',
      semester: normalizedStudent.semester || 6,
    })
  }

  const handleDeleteStudent = async (studentId) => {
    try {
      await deleteUserById(token, studentId)
      setUsersList((prev) => prev.filter((userItem) => (userItem._id || userItem.id) !== studentId))
      if (editingStudentId === studentId) {
        resetStudentManagementForm()
      }
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to delete student.')
    }
  }

  const handleSubmitFacultyManagement = async () => {
    const payload = {
      ...facultyManagementForm,
      department: facultyManagementForm.department.trim(),
      assignedSubjects: parseAssignedSubjects(facultyManagementForm.assignedSubjects),
      role: 'faculty',
    }

    try {
      if (editingFacultyId) {
        const updated = await updateUserById(token, editingFacultyId, payload)
        setUsersList((prev) => prev.map((userItem) => (userItem._id === editingFacultyId || userItem.id === editingFacultyId
          ? { ...userItem, ...updated, _id: userItem._id || updated.id }
          : userItem)))
      } else {
        const created = await createUser(token, payload)
        setUsersList((prev) => [...prev, { ...created, _id: created.id, provider: 'local' }])
      }
      resetFacultyManagementForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to save faculty.')
    }
  }

  const handleEditFaculty = (faculty, subjectOptions) => {
    const normalizedFaculty = buildFacultyManagementRecord(faculty, subjectOptions)
    setEditingFacultyId(faculty._id || faculty.id)
    setFacultyManagementForm({
      name: normalizedFaculty.name || '',
      email: normalizedFaculty.email || '',
      password: '',
      department: normalizedFaculty.department || '',
      assignedSubjects: (normalizedFaculty.assignedSubjects || []).join(', '),
    })
  }

  const handleDeleteFaculty = async (facultyId) => {
    try {
      await deleteUserById(token, facultyId)
      setUsersList((prev) => prev.filter((userItem) => (userItem._id || userItem.id) !== facultyId))
      if (editingFacultyId === facultyId) {
        resetFacultyManagementForm()
      }
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to delete faculty.')
    }
  }

  const handleSubmitAcademicRecord = async () => {
    const selectedStudent = usersList.find(
      (userItem) => String(userItem._id || userItem.id) === String(academicRecordForm.studentId)
    )

    if (!selectedStudent) {
      setError('Please select a student for the academic record.')
      return
    }
    if (!academicRecordForm.subject.trim()) {
      setError('Please select a subject for the academic record.')
      return
    }

    const normalizedStudent = buildStudentManagementRecord(selectedStudent)
    const score = toNumber(academicRecordForm.score)
    if (!Number.isFinite(score) || score < 0) {
      setError('Please enter a valid mark for the academic record.')
      return
    }
    const totalMarks = Math.max(1, toNumber(academicRecordForm.totalMarks) || 100)
    const semester = Math.min(8, Math.max(1, toNumber(academicRecordForm.semester) || 1))
    const payload = {
      user: selectedStudent._id || selectedStudent.id,
      subject: academicRecordForm.subject.trim(),
      semester,
      examiner: signedInDisplayName,
      assessmentType: 'exam',
      examDate: new Date().toISOString().slice(0, 10),
      totalMarks,
      marksDistribution: [{ section: 'Semester Record', marks: totalMarks }],
      questionComplexity: { easy: 35, medium: 45, hard: 20 },
      studentMarks: [{
        studentId: normalizedStudent.registerNumber || String(selectedStudent._id || selectedStudent.id),
        score,
      }],
      averageScore: score,
    }

    try {
      if (editingAcademicRecordId) {
        const updated = await updateAssessmentById(token, editingAcademicRecordId, payload)
        setAssessments((prev) => prev.map((item) => (item._id === editingAcademicRecordId ? updated : item)))
      } else {
        const created = await createAssessment(token, payload)
        setAssessments((prev) => [created, ...prev])
      }
      resetAcademicRecordForm()
      await refreshAssessmentDashboardData(filters)
    } catch (err) {
      setError(err.message || 'Failed to save academic record.')
    }
  }

  const handleEditAcademicRecord = (record) => {
    setEditingAcademicRecordId(record.id)
    setAcademicRecordForm({
      studentId: record.studentId || '',
      semester: record.semester || 1,
      subject: record.subject || '',
      score: record.score || '',
      totalMarks: record.totalMarks || 100,
    })
    setAcademicRecordFilters((prev) => ({
      ...prev,
      studentId: record.studentId || prev.studentId,
      semester: String(record.semester || prev.semester || ''),
      subject: record.subject || prev.subject,
    }))
  }

  const handleDeleteAcademicRecord = async (recordId) => {
    try {
      await deleteAssessmentById(token, recordId)
      setAssessments((prev) => prev.filter((item) => item._id !== recordId))
      if (editingAcademicRecordId === recordId) {
        resetAcademicRecordForm()
      }
      await refreshAssessmentDashboardData(filters)
    } catch (err) {
      setError(err.message || 'Failed to delete academic record.')
    }
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
    return computeAssessmentStudentStats(latestAssessment, passThresholdPercent)
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
    const statsA = computeAssessmentStudentStats(selectedA, passThresholdPercent)
    const statsB = computeAssessmentStudentStats(selectedB, passThresholdPercent)
    return {
      difficultyA: toNumber(selectedA.difficultyScore),
      difficultyB: toNumber(selectedB.difficultyScore),
      avgScoreA: selectedA.averageScore ?? statsA?.avgScore ?? null,
      avgScoreB: selectedB.averageScore ?? statsB?.avgScore ?? null,
      passRateA: statsA?.passRate ?? null,
      passRateB: statsB?.passRate ?? null,
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
    const rows = buildStoredExamRowsForStudent(assessments)

    return rows.map((row) => {
      const percent = (row.subjectMarks / row.totalMarks) * 100
      const grade =
        percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B+' : percent >= 60 ? 'B' : 'C'
      const status = percent >= STUDENT_FIXED_PASS_PERCENT ? 'P' : 'U'
      return { ...row, grade, status }
    })
  }, [assessments])
  const currentSemNo = romanToNumber(studentProfile.sem)
  const currentSemesterExamResults = useMemo(
    () => studentExamResults.filter((row) => toNumber(row.semester) === currentSemNo),
    [studentExamResults, currentSemNo]
  )
  const facultyPerformanceRecords = useMemo(
    () => buildFacultyPerformanceRecords(facultyStudentResults),
    [facultyStudentResults]
  )
  const facultyPerformanceSubjects = useMemo(
    () =>
      [...new Set(facultyPerformanceRecords.map((record) => String(record.subject || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [facultyPerformanceRecords]
  )
  const filteredFacultyPerformanceRecords = useMemo(() => {
    const normalizedSearch = facultyPerformanceSearch.trim().toLowerCase()
    const normalizedSubjectFilter = normalizeFilterValue(facultyPerformanceSubject)
    const normalizedResultFilter = normalizeFilterValue(facultyPerformanceResult)

    return facultyPerformanceRecords.filter((record) => {
      const matchesSearch = normalizedSearch
        ? record.name.toLowerCase().includes(normalizedSearch) ||
          record.rollNo.toLowerCase().includes(normalizedSearch) ||
          normalizeFilterValue(record.subject).includes(normalizedSearch) ||
          record.department.toLowerCase().includes(normalizedSearch) ||
          record.email.toLowerCase().includes(normalizedSearch)
        : true
      const matchesSubject = normalizedSubjectFilter
        ? normalizeFilterValue(record.subject) === normalizedSubjectFilter
        : true
      const matchesResult = normalizedResultFilter
        ? normalizeFilterValue(record.result) === normalizedResultFilter
        : true

      return matchesSearch && matchesSubject && matchesResult
    })
  }, [
    facultyPerformanceRecords,
    facultyPerformanceSearch,
    facultyPerformanceSubject,
    facultyPerformanceResult,
  ])
  const facultyMarksDistribution = useMemo(() => {
    const buckets = [
      { section: '0–40', marks: 0, min: 0, max: 40 },
      { section: '40–60', marks: 0, min: 40, max: 60 },
      { section: '60–80', marks: 0, min: 60, max: 80 },
      { section: '80–100', marks: 0, min: 80, max: 101 },
    ]

    facultyPerformanceRecords.forEach((record) => {
      const marks = toNumber(String(record.marks || '').split('/')[0])
      const bucket = buckets.find((entry) => marks >= entry.min && marks < entry.max)
      if (bucket) {
        bucket.marks += 1
      }
    })

    return buckets.map(({ section, marks }) => ({ section, marks }))
  }, [facultyPerformanceRecords])
  const facultySubjectAverages = useMemo(() => {
    const bySubject = facultyPerformanceRecords.reduce((acc, record) => {
      const subject = String(record.subject || '—')
      const marks = toNumber(String(record.marks || '').split('/')[0])
      if (!acc[subject]) {
        acc[subject] = { subject, total: 0, count: 0 }
      }
      acc[subject].total += marks
      acc[subject].count += 1
      return acc
    }, {})

    return Object.values(bySubject)
      .map((entry) => ({
        subject: entry.subject,
        average: entry.count ? entry.total / entry.count : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject))
  }, [facultyPerformanceRecords])
  const facultySubjectInsights = useMemo(() => {
    const bySubject = facultyPerformanceRecords.reduce((acc, record) => {
      const subject = String(record.subject || '—')
      const marks = toNumber(String(record.marks || '').split('/')[0])

      if (!acc[subject]) {
        acc[subject] = {
          subject,
          totalMarks: 0,
          count: 0,
          passCount: 0,
          highestScore: 0,
          difficultyCounts: {},
        }
      }

      acc[subject].totalMarks += marks
      acc[subject].count += 1
      if (record.result === 'Pass') {
        acc[subject].passCount += 1
      }
      acc[subject].highestScore = Math.max(acc[subject].highestScore, marks)
      if (record.difficultyLevel) {
        acc[subject].difficultyCounts[record.difficultyLevel] =
          (acc[subject].difficultyCounts[record.difficultyLevel] || 0) + 1
      }
      return acc
    }, {})

    return Object.values(bySubject)
      .map((entry) => ({
        subject: entry.subject,
        averageMarks: entry.count ? entry.totalMarks / entry.count : 0,
        passPercent: entry.count ? (entry.passCount / entry.count) * 100 : 0,
        highestScore: entry.highestScore,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject))
  }, [facultyPerformanceRecords])
  const facultyGradeDistribution = useMemo(() => {
    const counts = facultyPerformanceRecords.reduce((acc, record) => {
      const marks = toNumber(String(record.marks || '').split('/')[0])
      const grade =
        marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B+' : marks >= 60 ? 'B' : 'C'
      acc[grade] = (acc[grade] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts).map(([grade, count]) => ({ grade, count }))
  }, [facultyPerformanceRecords])
  const facultyPassFailData = useMemo(() => {
    const passCount = facultyPerformanceRecords.filter((record) => record.result === 'Pass').length
    const failCount = facultyPerformanceRecords.filter((record) => record.result === 'Fail').length

    return [
      { section: 'Pass', marks: passCount },
      { section: 'Fail', marks: failCount },
    ]
  }, [facultyPerformanceRecords])
  const facultyTopLowPerformersData = useMemo(() => {
    const counts = facultyPerformanceRecords.reduce(
      (acc, record) => {
        const marks = toNumber(String(record.marks || '').split('/')[0])
        if (marks >= 80) {
          acc.top += 1
        } else if (marks < 60) {
          acc.low += 1
        }
        return acc
      },
      { top: 0, low: 0 }
    )

    return [
      { section: 'Top Performers', marks: counts.top },
      { section: 'Low Performers', marks: counts.low },
    ]
  }, [facultyPerformanceRecords])
  const facultyTopLowScores = useMemo(() => {
    if (!facultyPerformanceRecords.length) {
      return {
        topScore: 0,
        lowestScore: 0,
        topSubject: '—',
        lowestSubject: '—',
      }
    }
    const topRecord = facultyPerformanceRecords.reduce((best, record) => {
      const marks = toNumber(String(record.marks || '').split('/')[0])
      if (!best || marks > best.marks) {
        return { marks, subject: record.subject || '—' }
      }
      return best
    }, null)
    const lowRecord = facultyPerformanceRecords.reduce((lowest, record) => {
      const marks = toNumber(String(record.marks || '').split('/')[0])
      if (!lowest || marks < lowest.marks) {
        return { marks, subject: record.subject || '—' }
      }
      return lowest
    }, null)

    return {
      topScore: topRecord?.marks ?? 0,
      lowestScore: lowRecord?.marks ?? 0,
      topSubject: topRecord?.subject || '—',
      lowestSubject: lowRecord?.subject || '—',
    }
  }, [facultyPerformanceRecords])
  const facultyRecentActivity = useMemo(() => {
    return [
      {
        title: 'Results updated for Semester 6',
        note: 'Semester VI records loaded',
      },
      {
        title: 'Performance analysis generated',
        note: 'Charts refreshed',
      },
      {
        title: 'New data available',
        note: 'Subject insights updated',
      },
    ]
  }, [])
  const recordsLoadedCount = isFaculty
    ? facultyPerformanceRecords.length
    : assessments.length
  const adminOverviewMetrics = useMemo(() => {
    const totalStudents = usersList.filter((userItem) => userItem.role === 'student').length
    const totalFaculty = 1
    const totalSubjects = 6

    let totalScore = 0
    let totalEntries = 0
    let passEntries = 0

    assessments.forEach((assessment) => {
      const stats = computeAssessmentStudentStats(assessment, DEFAULT_PASS_THRESHOLD_PERCENT)
      const entryCount = toNumber(stats?.total)
      const avgScore = toNumber(stats?.avgScore)
      const passRate = toNumber(stats?.passRate)

      if (entryCount > 0) {
        totalEntries += entryCount
        totalScore += avgScore * entryCount
        passEntries += (passRate / 100) * entryCount
      }
    })

    return {
      totalStudents,
      totalFaculty,
      totalSubjects,
      overallAverage: totalEntries ? totalScore / totalEntries : 0,
      overallPassPercentage: totalEntries ? (passEntries / totalEntries) * 100 : 0,
    }
  }, [usersList, assessments])
  const studentManagementRows = useMemo(() => {
    const normalizedSearch = studentManagementSearch.trim().toLowerCase()

    return usersList
      .filter((userItem) => userItem.role === 'student')
      .map((userItem) => buildStudentManagementRecord(userItem))
      .filter((userItem) => {
      const matchesSearch = normalizedSearch
        ? String(userItem.name || '').toLowerCase().includes(normalizedSearch) ||
          String(userItem.email || '').toLowerCase().includes(normalizedSearch) ||
          String(userItem.registerNumber || '').toLowerCase().includes(normalizedSearch) ||
          String(userItem.department || '').toLowerCase().includes(normalizedSearch)
        : true
      const matchesSemester = studentManagementSemester
        ? String(userItem.semester || '') === studentManagementSemester
        : true
      return matchesSearch && matchesSemester
      })
  }, [usersList, studentManagementSearch, studentManagementSemester])
  const facultySubjectOptions = useMemo(() => {
    const assessmentSubjects = assessments.map((assessment) => String(assessment.subject || '').trim()).filter(Boolean)
    const courseSubjects = Object.values(SEMESTER_COURSES)
      .flatMap((courses) => courses.map((course) => String(course.subject || '').trim()))
      .filter(Boolean)
    const seededSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Computer Science']
    return dedupe([...assessmentSubjects, ...courseSubjects, ...seededSubjects]).sort((a, b) => a.localeCompare(b))
  }, [assessments])
  const facultyManagementRows = useMemo(() => {
    const normalizedSearch = facultyManagementSearch.trim().toLowerCase()

    return usersList
      .filter((userItem) => userItem.role === 'faculty')
      .map((userItem) => buildFacultyManagementRecord(userItem, facultySubjectOptions))
      .filter((userItem) => {
        if (!normalizedSearch) return true
        return (
          String(userItem.name || '').toLowerCase().includes(normalizedSearch) ||
          String(userItem.email || '').toLowerCase().includes(normalizedSearch) ||
          String(userItem.department || '').toLowerCase().includes(normalizedSearch) ||
          String((userItem.assignedSubjects || []).join(', ')).toLowerCase().includes(normalizedSearch)
        )
      })
  }, [usersList, facultyManagementSearch, facultySubjectOptions])
  const academicRecordStudents = useMemo(
    () => usersList
      .filter((userItem) => userItem.role === 'student')
      .map((userItem) => buildStudentManagementRecord(userItem)),
    [usersList]
  )
  const academicRecordStudentLookup = useMemo(
    () => new Map(academicRecordStudents.map((student) => [String(student._id || student.id), student])),
    [academicRecordStudents]
  )
  const academicRecordSubjectOptions = useMemo(() => {
    const selectedSemester = toNumber(academicRecordFilters.semester || academicRecordForm.semester)
    const semesterSubjects = selectedSemester
      ? (SEMESTER_COURSES[selectedSemester] || []).map((course) => course.subject)
      : []
    const assessmentSubjects = assessments.map((assessment) => String(assessment.subject || '').trim()).filter(Boolean)
    return dedupe([...semesterSubjects, ...assessmentSubjects]).sort((a, b) => a.localeCompare(b))
  }, [academicRecordFilters.semester, academicRecordForm.semester, assessments])
  const academicRecordRows = useMemo(() => {
    return assessments
      .filter((assessment) => {
        const rawUser = assessment?.user
        const role = typeof rawUser === 'object' ? rawUser?.role : undefined
        const userId = typeof rawUser === 'object' ? rawUser?._id || rawUser?.id : rawUser
        const semester = toNumber(assessment?.semester)
        const isStudentRecord = role === 'student' || academicRecordStudentLookup.has(String(userId))
        return isStudentRecord && semester >= 1 && semester <= 8
      })
      .map((assessment) => buildAcademicRecordRow(assessment, academicRecordStudentLookup))
      .filter((record) => {
        if (academicRecordFilters.studentId && String(record.studentId) !== String(academicRecordFilters.studentId)) {
          return false
        }
        if (academicRecordFilters.semester && String(record.semester) !== String(academicRecordFilters.semester)) {
          return false
        }
        if (academicRecordFilters.subject && record.subject !== academicRecordFilters.subject) {
          return false
        }
        return true
      })
      .sort((a, b) => new Date(b.examDate || 0).getTime() - new Date(a.examDate || 0).getTime())
  }, [assessments, academicRecordStudentLookup, academicRecordFilters])
  const adminSemesterPerformance = useMemo(() => {
    const grouped = academicRecordRows.reduce((acc, record) => {
      const semester = toNumber(record.semester) || 0
      if (!semester) return acc
      if (!acc[semester]) {
        acc[semester] = {
          semester,
          totalScore: 0,
          totalMarks: 0,
          totalRecords: 0,
          passCount: 0,
        }
      }
      acc[semester].totalScore += toNumber(record.score)
      acc[semester].totalMarks += Math.max(1, toNumber(record.totalMarks))
      acc[semester].totalRecords += 1
      if (record.result === 'Pass') {
        acc[semester].passCount += 1
      }
      return acc
    }, {})

    return Object.values(grouped)
      .map((entry) => {
        const averageMarks = entry.totalRecords ? entry.totalScore / entry.totalRecords : 0
        const averagePercent = entry.totalMarks ? (entry.totalScore / entry.totalMarks) * 100 : 0
        return {
          semester: entry.semester,
          label: `Semester ${entry.semester}`,
          averageMarks,
          averagePercent,
          passPercent: entry.totalRecords ? (entry.passCount / entry.totalRecords) * 100 : 0,
          totalRecords: entry.totalRecords,
        }
      })
      .sort((a, b) => a.semester - b.semester)
  }, [academicRecordRows])
  const adminDepartmentPerformance = useMemo(() => {
    const grouped = academicRecordRows.reduce((acc, record) => {
      const department = String(record.department || '—')
      if (!acc[department]) {
        acc[department] = {
          department,
          totalScore: 0,
          totalMarks: 0,
          totalRecords: 0,
          passCount: 0,
        }
      }
      acc[department].totalScore += toNumber(record.score)
      acc[department].totalMarks += Math.max(1, toNumber(record.totalMarks))
      acc[department].totalRecords += 1
      if (record.result === 'Pass') {
        acc[department].passCount += 1
      }
      return acc
    }, {})

    return Object.values(grouped)
      .map((entry) => ({
        department: entry.department,
        averageMarks: entry.totalRecords ? entry.totalScore / entry.totalRecords : 0,
        averagePercent: entry.totalMarks ? (entry.totalScore / entry.totalMarks) * 100 : 0,
        passPercent: entry.totalRecords ? (entry.passCount / entry.totalRecords) * 100 : 0,
        totalRecords: entry.totalRecords,
      }))
      .sort((a, b) => b.averageMarks - a.averageMarks)
  }, [academicRecordRows])
  const adminOverallTrendData = useMemo(
    () => adminSemesterPerformance.map((entry) => ({ name: `Sem ${entry.semester}`, avgScore: entry.averageMarks })),
    [adminSemesterPerformance]
  )
  const adminPerformanceHighlights = useMemo(() => {
    const strongestSemester = adminSemesterPerformance.reduce(
      (best, entry) => (!best || entry.averageMarks > best.averageMarks ? entry : best),
      null
    )
    const strongestDepartment = adminDepartmentPerformance.reduce(
      (best, entry) => (!best || entry.averageMarks > best.averageMarks ? entry : best),
      null
    )
    return {
      strongestSemester: strongestSemester?.label || '—',
      strongestSemesterAverage: strongestSemester?.averageMarks ?? 0,
      strongestDepartment: strongestDepartment?.department || '—',
      strongestDepartmentAverage: strongestDepartment?.averageMarks ?? 0,
      totalRecords: academicRecordRows.length,
    }
  }, [adminSemesterPerformance, adminDepartmentPerformance, academicRecordRows.length])
  const adminAssessmentQualityRows = useMemo(() => {
    return academicRecordRows
      .filter((row) => {
        const assessment = row.assessment || {}
        const hasStudentMarks = Array.isArray(assessment.studentMarks) && assessment.studentMarks.length > 0
        const hasAverageScore = assessment.averageScore !== undefined && assessment.averageScore !== null
        return hasStudentMarks || hasAverageScore
      })
      .map((row) => ({
        id: row.id,
        studentName: row.studentName || 'Student',
        rollNo: row.registerNumber || '—',
        department: row.department || '—',
        semester: toNumber(row.semester) || '—',
        subject: row.subject || '—',
        examDate: formatShortDate(row.examDate),
        averageMarks: toNumber(row.score),
        passPercent: row.result === 'Pass' ? 100 : 0,
      }))
      .sort((a, b) => {
        const semesterDiff = toNumber(a.semester) - toNumber(b.semester)
        if (semesterDiff !== 0) return semesterDiff
        return String(a.studentName).localeCompare(String(b.studentName))
      })
  }, [academicRecordRows])
  const adminAssessmentQualitySummary = useMemo(() => {
    return {
      averageMarks: adminAssessmentQualityRows.length
        ? adminAssessmentQualityRows.reduce((sum, row) => sum + toNumber(row.averageMarks), 0) / adminAssessmentQualityRows.length
        : 0,
      passPercent: adminAssessmentQualityRows.length
        ? adminAssessmentQualityRows.reduce((sum, row) => sum + toNumber(row.passPercent), 0) / adminAssessmentQualityRows.length
        : 0,
    }
  }, [adminAssessmentQualityRows])
  const adminStudentOptions = useMemo(
    () =>
      academicRecordStudents
        .map((student) => ({
          id: String(student._id || student.id),
          label: `${student.name} (${student.registerNumber || '—'})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [academicRecordStudents]
  )
  const adminDepartmentOptions = useMemo(
    () =>
      [...new Set(academicRecordRows.map((row) => String(row.department || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [academicRecordRows]
  )
  const adminSemesterOptions = useMemo(
    () =>
      [...new Set(academicRecordRows.map((row) => toNumber(row.semester)).filter((semester) => semester > 0))]
        .sort((a, b) => a - b),
    [academicRecordRows]
  )
  const adminSubjectOptions = useMemo(
    () =>
      [...new Set(academicRecordRows.map((row) => String(row.subject || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [academicRecordRows]
  )
  const adminFilteredPerformanceRows = useMemo(() => {
    return academicRecordRows.filter((row) => {
      if (adminAdvancedFilters.studentId && String(row.studentId) !== String(adminAdvancedFilters.studentId)) {
        return false
      }
      if (adminAdvancedFilters.department && row.department !== adminAdvancedFilters.department) {
        return false
      }
      if (adminAdvancedFilters.semester && String(row.semester) !== String(adminAdvancedFilters.semester)) {
        return false
      }
      if (adminAdvancedFilters.subject && row.subject !== adminAdvancedFilters.subject) {
        return false
      }
      if (adminAdvancedFilters.result && row.result !== adminAdvancedFilters.result) {
        return false
      }
      return true
    })
  }, [academicRecordRows, adminAdvancedFilters])
  const pagedAdminAssessmentQualityRows = useMemo(() => {
    const start = (adminQualityPage - 1) * adminQualityPageSize
    return adminAssessmentQualityRows.slice(start, start + adminQualityPageSize)
  }, [adminAssessmentQualityRows, adminQualityPage, adminQualityPageSize])
  const pagedAdminFilteredPerformanceRows = useMemo(() => {
    const start = (adminAdvancedPage - 1) * adminAdvancedPageSize
    return adminFilteredPerformanceRows.slice(start, start + adminAdvancedPageSize)
  }, [adminFilteredPerformanceRows, adminAdvancedPage, adminAdvancedPageSize])
  const selectedAcademicRecord = useMemo(() => {
    if (!academicRecordForm.studentId || !academicRecordForm.semester || !academicRecordForm.subject) {
      return null
    }
    return assessments
      .filter((assessment) => {
        const rawUser = assessment?.user
        const userId = typeof rawUser === 'object' ? rawUser?._id || rawUser?.id : rawUser
        return String(userId) === String(academicRecordForm.studentId)
      })
      .map((assessment) => buildAcademicRecordRow(assessment, academicRecordStudentLookup))
      .find(
        (record) =>
          String(record.studentId) === String(academicRecordForm.studentId) &&
          String(record.semester) === String(academicRecordForm.semester) &&
          record.subject === academicRecordForm.subject
      ) || null
  }, [assessments, academicRecordForm.studentId, academicRecordForm.semester, academicRecordForm.subject, academicRecordStudentLookup])
  const pagedAcademicRecordRows = useMemo(() => {
    const start = (academicRecordPage - 1) * academicRecordPageSize
    return academicRecordRows.slice(start, start + academicRecordPageSize)
  }, [academicRecordRows, academicRecordPage, academicRecordPageSize])
  const pagedFacultyPerformanceRecords = useMemo(() => {
    const start = (facultyPerformancePage - 1) * facultyPerformancePageSize
    return filteredFacultyPerformanceRecords.slice(start, start + facultyPerformancePageSize)
  }, [filteredFacultyPerformanceRecords, facultyPerformancePage, facultyPerformancePageSize])
  useEffect(() => {
    if (!facultyPerformanceSubject) return
    const stillExists = facultyPerformanceSubjects.some(
      (subject) => normalizeFilterValue(subject) === normalizeFilterValue(facultyPerformanceSubject)
    )
    if (!stillExists) {
      setFacultyPerformanceSubject('')
    }
  }, [facultyPerformanceSubject, facultyPerformanceSubjects])
  useEffect(() => {
    if (!academicRecordForm.subject) return
    if (!academicRecordSubjectOptions.includes(academicRecordForm.subject)) {
      setAcademicRecordForm((prev) => ({ ...prev, subject: '' }))
    }
  }, [academicRecordForm.subject, academicRecordSubjectOptions])
  useEffect(() => {
    if (!academicRecordFilters.subject) return
    if (!academicRecordSubjectOptions.includes(academicRecordFilters.subject)) {
      setAcademicRecordFilters((prev) => ({ ...prev, subject: '' }))
    }
  }, [academicRecordFilters.subject, academicRecordSubjectOptions])
  useEffect(() => {
    if (!academicRecordForm.studentId || !academicRecordForm.semester || !academicRecordForm.subject) {
      return
    }

    if (selectedAcademicRecord) {
      setEditingAcademicRecordId(selectedAcademicRecord.id)
      setAcademicRecordForm((prev) => ({
        ...prev,
        score: selectedAcademicRecord.score,
        totalMarks: selectedAcademicRecord.totalMarks,
      }))
      return
    }

    setEditingAcademicRecordId('')
    setAcademicRecordForm((prev) => ({
      ...prev,
      score: '',
      totalMarks: 100,
    }))
  }, [
    academicRecordForm.studentId,
    academicRecordForm.semester,
    academicRecordForm.subject,
    selectedAcademicRecord,
  ])
  useEffect(() => {
    setAcademicRecordPage(1)
  }, [academicRecordFilters.studentId, academicRecordFilters.semester, academicRecordFilters.subject])
  useEffect(() => {
    setAdminAdvancedPage(1)
  }, [
    adminAdvancedFilters.studentId,
    adminAdvancedFilters.department,
    adminAdvancedFilters.semester,
    adminAdvancedFilters.subject,
    adminAdvancedFilters.result,
  ])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(academicRecordRows.length / academicRecordPageSize))
    if (academicRecordPage > totalPages) {
      setAcademicRecordPage(totalPages)
    }
  }, [academicRecordRows.length, academicRecordPage, academicRecordPageSize])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(adminAssessmentQualityRows.length / adminQualityPageSize))
    if (adminQualityPage > totalPages) {
      setAdminQualityPage(totalPages)
    }
  }, [adminAssessmentQualityRows.length, adminQualityPage, adminQualityPageSize])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(adminFilteredPerformanceRows.length / adminAdvancedPageSize))
    if (adminAdvancedPage > totalPages) {
      setAdminAdvancedPage(totalPages)
    }
  }, [adminFilteredPerformanceRows.length, adminAdvancedPage, adminAdvancedPageSize])
  useEffect(() => {
    setFacultyPerformancePage(1)
  }, [facultyPerformanceSearch, facultyPerformanceSubject, facultyPerformanceResult])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredFacultyPerformanceRecords.length / facultyPerformancePageSize))
    if (facultyPerformancePage > totalPages) {
      setFacultyPerformancePage(totalPages)
    }
  }, [filteredFacultyPerformanceRecords.length, facultyPerformancePage, facultyPerformancePageSize])
  const examQualityMetrics = useMemo(() => {
    return {
      averageClassMarks: toNumber(classPerformanceOverview.classAverage),
      passPercentage: toNumber(classPerformanceOverview.passPercentage),
      topScore: toNumber(classPerformanceOverview.topScore),
    }
  }, [classPerformanceOverview])
  const currentSemesterCgpa = useMemo(() => {
    if (!currentSemesterExamResults.length) return 0
    const totalPercent = currentSemesterExamResults.reduce(
      (sum, row) => sum + (toNumber(row.subjectMarks) / toNumber(row.totalMarks || 100)) * 100,
      0
    )
    const avgPercent = totalPercent / currentSemesterExamResults.length
    return Number(clamp(avgPercent / 10, 5.0, 9.9).toFixed(2))
  }, [currentSemesterExamResults])
  const studentSgpaTrend = useMemo(() => {
    const semesterCount = romanToNumber(studentProfile.sem)
    return Array.from({ length: semesterCount }, (_, index) => {
      const semNo = index + 1
      const semesterRows = studentExamResults.filter((row) => toNumber(row.semester) === semNo)
      const semesterPercent = semesterRows.length
        ? semesterRows.reduce(
            (sum, row) => sum + (toNumber(row.subjectMarks) / Math.max(1, toNumber(row.totalMarks || 100))) * 100,
            0
          ) / semesterRows.length
        : 0

      return {
        name: `Sem ${numberToRoman(semNo)}`,
        avgScore: Number(clamp(semesterPercent / 10, 5.0, 9.9).toFixed(2)),
      }
    })
  }, [studentExamResults, studentProfile.sem])
  const performanceSnapshot = useMemo(() => {
    const cgpa = studentSgpaTrend.length
      ? studentSgpaTrend.reduce((sum, entry) => sum + toNumber(entry.avgScore), 0) / studentSgpaTrend.length
      : 0
    const bestGrade = studentExamResults.length
      ? studentExamResults.reduce((best, row) => {
          const rank = { 'A+': 5, A: 4, 'B+': 3, B: 2, C: 1 }
          return (rank[row.grade] || 0) > (rank[best] || 0) ? row.grade : best
        }, 'C')
      : '—'
    const backlogs = studentExamResults.filter((row) => row.status === 'U').length

    return {
      cgpa: Number(cgpa.toFixed(2)),
      sgpa: currentSemesterCgpa,
      bestGrade,
      backlogs,
    }
  }, [studentExamResults, studentSgpaTrend, currentSemesterCgpa])
  const studentGradeDistribution = useMemo(() => {
    const counts = currentSemesterExamResults.reduce((acc, row) => {
      const grade = row.grade || 'Unknown'
      acc[grade] = (acc[grade] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts).map(([grade, count]) => ({ grade, count }))
  }, [currentSemesterExamResults])
  const studentTrendIndicator = useMemo(() => {
    if (studentSgpaTrend.length < 2) {
      return {
        icon: '📈',
        label: 'Improving',
        note: 'Building the first semester trend from available exam results.',
      }
    }

    const latest = toNumber(studentSgpaTrend[studentSgpaTrend.length - 1]?.avgScore)
    const previous = toNumber(studentSgpaTrend[studentSgpaTrend.length - 2]?.avgScore)

    if (latest >= previous) {
      return {
        icon: '📈',
        label: 'Improving',
        note: `Up from ${previous.toFixed(2)} to ${latest.toFixed(2)} in the latest semester view.`,
      }
    }

    return {
      icon: '📉',
      label: 'Decreasing',
      note: `Down from ${previous.toFixed(2)} to ${latest.toFixed(2)} in the latest semester view.`,
    }
  }, [studentSgpaTrend])
  const studentPerformanceInsights = useMemo(() => {
    const latest = toNumber(studentSgpaTrend[studentSgpaTrend.length - 1]?.avgScore)
    const previous = toNumber(studentSgpaTrend[studentSgpaTrend.length - 2]?.avgScore)
    const sgpaDelta = studentSgpaTrend.length >= 2 ? latest - previous : 0
    const previousSemesterNo = Math.max(0, currentSemNo - 1)
    const currentSemesterLabel = currentSemNo ? numberToRoman(currentSemNo) : String(currentSemNo)
    const latestSemesterRows = studentExamResults.filter(
      (row) => toNumber(row.semester) === currentSemNo
    )
    const strongestSubject = latestSemesterRows.reduce(
      (best, row) => (!best || toNumber(row.subjectMarks) > toNumber(best.subjectMarks) ? row : best),
      null
    )
    const focusSubject = latestSemesterRows.reduce(
      (lowest, row) => (!lowest || toNumber(row.subjectMarks) < toNumber(lowest.subjectMarks) ? row : lowest),
      null
    )

    return [
      studentSgpaTrend.length >= 2
        ? `You ${sgpaDelta >= 0 ? 'improved' : 'changed'} by ${sgpaDelta >= 0 ? '+' : ''}${sgpaDelta.toFixed(1)} SGPA from Sem ${previousSemesterNo} to Sem ${currentSemNo} (${numberToRoman(previousSemesterNo)} to ${currentSemesterLabel})`
        : `Your current SGPA is ${latest.toFixed(1)} based on the latest semester records`,
      strongestSubject
        ? `Your strongest subject in Sem ${currentSemNo}: ${strongestSubject.subject}`
        : `Your strongest subject from Sem ${currentSemNo} will appear once marks are available`,
      focusSubject
        ? `Focus needed on ${focusSubject.subject} in Sem ${currentSemNo}`
        : `Focus area from Sem ${currentSemNo} will appear once marks are available`,
    ]
  }, [currentSemNo, studentExamResults, studentSgpaTrend])
  const studentExamResultRows = useMemo(() => {
    return studentExamResults.map((entry) => {
      return {
        semester: entry.semester,
        courseName: entry.subject,
        courseCode: entry.courseCode,
        credits: entry.credits,
        grade: entry.grade,
        result: entry.status,
      }
    })
  }, [studentExamResults])
  const filteredStudentExamResultRows = useMemo(() => {
    const normalizedSearch = studentSubjectSearch.trim().toLowerCase()

    return studentExamResultRows.filter((row) => {
      const matchesSearch = normalizedSearch
        ? row.courseName.toLowerCase().includes(normalizedSearch) ||
          row.courseCode.toLowerCase().includes(normalizedSearch)
        : true

      return matchesSearch
    })
  }, [studentExamResultRows, studentSubjectSearch])
  const latestSemesterResultRows = useMemo(
    () => filteredStudentExamResultRows.filter((row) => toNumber(row.semester) === currentSemNo),
    [filteredStudentExamResultRows, currentSemNo]
  )
  const archivedSemesterOptions = useMemo(
    () =>
      [...new Set(filteredStudentExamResultRows.map((row) => toNumber(row.semester)))]
        .filter((semester) => semester < currentSemNo)
        .sort((a, b) => b - a),
    [filteredStudentExamResultRows, currentSemNo]
  )
  const activeArchivedSemester = archivedSemesterOptions[Math.max(0, studentArchivePage - 1)] || null
  const archivedSemesterRows = useMemo(
    () =>
      activeArchivedSemester === null
        ? []
        : filteredStudentExamResultRows.filter((row) => toNumber(row.semester) === activeArchivedSemester),
    [filteredStudentExamResultRows, activeArchivedSemester]
  )

  useEffect(() => {
    const totalArchivedPages = Math.max(1, archivedSemesterOptions.length)
    if (studentArchivePage > totalArchivedPages) {
      setStudentArchivePage(totalArchivedPages)
    }
  }, [archivedSemesterOptions.length, studentArchivePage])

  return (
    <div className={`dashboard-shell ${dashboardTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <aside className="dashboard-sidebar">
        <nav className="sidebar-nav">
          {isStudent ? (
            <a href="#performance-snapshot">
              <SidebarIcon type="overview" />
              <span>Performance Snapshot</span>
            </a>
          ) : null}
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
          {isStudent ? (
            <a href="#goals-insights">
              <SidebarIcon type="insights" />
              <span>Goals / Insights</span>
            </a>
          ) : null}
          {!isStudent ? (
            <a href="#overview">
              <SidebarIcon type="overview" />
              <span>Overview</span>
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#student-management">
              <SidebarIcon type="students" />
              <span>Student Management</span>
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#faculty-management">
              <SidebarIcon type="accounts" />
              <span>Faculty Management</span>
            </a>
          ) : null}
          {isAdmin ? (
            <a href="#academic-records-management">
              <SidebarIcon type="records" />
              <span>Academic Records</span>
            </a>
          ) : null}
          {isFaculty ? (
            <a href="#student-performance">
              <SidebarIcon type="students" />
              <span>Student Records</span>
            </a>
          ) : null}
          {isFaculty ? (
            <a href="#performance-analysis-faculty">
              <SidebarIcon type="analytics" />
              <span>Performance Analysis</span>
            </a>
          ) : null}
          {isFaculty ? (
            <a href="#subject-insights">
              <SidebarIcon type="insights" />
              <span>Subject Insight</span>
            </a>
          ) : null}
          {isFaculty ? (
            <a href="#recent-activity">
              <SidebarIcon type="records" />
              <span>Recent Activity</span>
            </a>
          ) : null}
        </nav>
        <div className="sidebar-meta">
          <span className="muted">Signed in as</span>
          <strong>{signedInDisplayName}</strong>
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
            <section className="dashboard-hero">
              <div className="dashboard-hero-card">
                <div className="dashboard-hero-copy">
                  <h1>{isStudent ? `Welcome back, ${studentProfile.name}` : `Welcome back, ${signedInDisplayName}`}</h1>
                  <p>
                    {isStudent
                      ? 'Track your academic performance, profile details, and semester results in one polished workspace.'
                      : 'Monitor assessments, records, and academic operations from one organized dashboard.'}
                  </p>
                  {isStudent || isFaculty ? (
                    <div className="dashboard-hero-actions">
                      <button
                        className="secondary dashboard-refresh-button"
                        type="button"
                        onClick={handleManualDashboardRefresh}
                        disabled={manualRefreshLoading}
                      >
                        {manualRefreshLoading ? 'Refreshing...' : 'Refresh Data'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="dashboard-hero-stats">
                  <div>
                    <span className="muted">Role</span>
                    <strong>{user?.role || 'user'}</strong>
                  </div>
                  {!isStudent ? (
                    <div>
                      <span className="muted">Semester</span>
                      <strong>VI</strong>
                    </div>
                  ) : null}
                  <div>
                    <span className="muted">{isStudent ? 'Current sem' : 'Records loaded'}</span>
                    <strong>{isStudent ? studentProfile.sem : recordsLoadedCount}</strong>
                  </div>
                </div>
              </div>
            </section>

            {isStudent ? (
              <section className="dashboard-section" id="performance-snapshot">
                <div className="section-head">
                  <h2>Performance Snapshot</h2>
                  <p>Key academic indicators presented in a quick executive summary.</p>
                </div>
                <div className="summary-strip student-snapshot-row">
                  <div className="summary-card snapshot-card snapshot-card-cgpa">
                    <span className="snapshot-icon" aria-hidden="true">🎯</span>
                    <span className="muted">CGPA</span>
                    <h3>{performanceSnapshot.cgpa.toFixed(2)}</h3>
                  </div>
                  <div className="summary-card snapshot-card snapshot-card-sgpa">
                    <span className="snapshot-icon" aria-hidden="true">📊</span>
                    <span className="muted">SGPA</span>
                    <h3>{performanceSnapshot.sgpa.toFixed(2)}</h3>
                  </div>
                  <div className="summary-card snapshot-card snapshot-card-grade">
                    <span className="snapshot-icon" aria-hidden="true">🏆</span>
                    <span className="muted">Best Grade</span>
                    <h3>{performanceSnapshot.bestGrade}</h3>
                  </div>
                  <div className="summary-card snapshot-card snapshot-card-backlogs">
                    <span className="snapshot-icon" aria-hidden="true">⚠️</span>
                    <span className="muted">Backlogs</span>
                    <h3>{performanceSnapshot.backlogs}</h3>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section personal-profile-section" id="personal-profile">
                <div className="section-head">
                  <h2>Student Details</h2>
                  <p>Verified academic and contact information for the active student record.</p>
                </div>
                <div className="comparison-panel profile-panel">
                  <div className="student-profile-avatar-card">
                    <div
                      className="student-profile-avatar"
                      style={{
                        '--student-avatar-accent': studentProfile.avatarAccent,
                        '--student-avatar-glow': studentProfile.avatarGlow,
                      }}
                    >
                      <img src={studentProfile.avatarImage} alt={`${studentProfile.name} profile`} />
                    </div>
                    <div className="student-profile-avatar-meta">
                      <strong>{studentProfile.name}</strong>
                      <span>{studentProfile.dept}</span>
                    </div>
                  </div>
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
                    <p className="profile-line">
                      <span className="muted">Email:</span>
                      <strong>{studentProfile.email}</strong>
                    </p>
                    <p className="profile-line">
                      <span className="muted">Phone:</span>
                      <strong>{studentProfile.phone}</strong>
                    </p>
                    <p className="profile-line">
                      <span className="muted">Batch:</span>
                      <strong>{studentProfile.batch}</strong>
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="performance-analysis">
                <div className="section-head">
                  <h2>Performance Analysis</h2>
                  <p>Semester trends and subject-level insights for fast review.</p>
                </div>
                <div className="chart-grid performance-analysis-grid">
                  <SgpaBarChart data={studentSgpaTrend} theme={dashboardTheme} />
                  <GradeDistributionChart data={studentGradeDistribution} theme={dashboardTheme} />
                  <div className="chart-card trend-indicator-card">
                    <h4>Performance Trend</h4>
                    <div className="chart trend-indicator-body">
                      <div className="trend-indicator-value">
                        <span className="trend-indicator-icon" aria-hidden="true">
                          {studentTrendIndicator.icon}
                        </span>
                        <strong>{studentTrendIndicator.label}</strong>
                      </div>
                    </div>
                    <p className="muted">{studentTrendIndicator.note}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="exam-quality-metrics">
                <div className="section-head">
                  <h2>Exam Quality Metrics</h2>
                  <p>Contextual class benchmarks to compare academic performance fairly.</p>
                </div>
                <div className="analytics-row">
                  <div className="score-card">
                    <h3>Class Average</h3>
                    <div className="score-value">{examQualityMetrics.averageClassMarks.toFixed(1)}</div>
                    <p className="muted">Computed from all students across exam-result subjects.</p>
                  </div>
                  <div className="score-card">
                    <h3>Pass Percentage</h3>
                    <div className="score-value">{examQualityMetrics.passPercentage.toFixed(0)}%</div>
                    <p className="muted">Calculated dynamically as passed students divided by total students, with a 45% pass mark.</p>
                  </div>
                  <div className="score-card">
                    <h3>Top Score</h3>
                    <div className="score-value">{examQualityMetrics.topScore.toFixed(0)}</div>
                    <p className="muted">Highest mark achieved across the class records.</p>
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="exam-results">
                <div className="section-head section-head-inline">
                  <div>
                    <h2>Exam Results</h2>
                    <p>Browse current and archived semester results with clean filtering.</p>
                  </div>
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
                  <div className="filter-row student-result-filters">
                    <label>
                      Search subject
                      <input
                        type="text"
                        value={studentSubjectSearch}
                        onChange={(event) => setStudentSubjectSearch(event.target.value)}
                        placeholder="Search by subject or code"
                      />
                    </label>
                  </div>
                  <div className="section-head compact-section-head">
                    <h3>Latest Semester Result</h3>
                    <p>Showing Semester {currentSemNo} results by default.</p>
                  </div>
                  <div className="table">
                    <div className="table-head exam-results-head">
                      <span>Course Code</span>
                      <span>Course Name</span>
                      <span>Sem</span>
                      <span>Result</span>
                      <span>Grade</span>
                    </div>
                    {latestSemesterResultRows.map((row, index) => (
                      <div className="table-row exam-results-row" key={`${row.courseCode}-${index}`}>
                        <span>{row.courseCode}</span>
                        <span>{row.courseName}</span>
                        <span>{row.semester}</span>
                        <span>{row.result}</span>
                        <span>{row.grade}</span>
                      </div>
                    ))}
                    {!latestSemesterResultRows.length ? (
                      <div className="empty">No exam results match the selected filters.</div>
                    ) : null}
                  </div>
                  <div className="archived-results-panel">
                    <div className="section-head compact-section-head">
                      <h3>Archived Semester Pages</h3>
                      <p>Open older semester results one page at a time.</p>
                    </div>
                    {activeArchivedSemester !== null ? (
                      <>
                        <div className="table">
                          <div className="table-head exam-results-head">
                            <span>Course Code</span>
                            <span>Course Name</span>
                            <span>Sem</span>
                            <span>Result</span>
                            <span>Grade</span>
                          </div>
                          {archivedSemesterRows.map((row, index) => (
                            <div className="table-row exam-results-row" key={`${row.courseCode}-archive-${index}`}>
                              <span>{row.courseCode}</span>
                              <span>{row.courseName}</span>
                              <span>{row.semester}</span>
                              <span>{row.result}</span>
                              <span>{row.grade}</span>
                            </div>
                          ))}
                        </div>
                        <Pagination
                          total={archivedSemesterOptions.length}
                          page={studentArchivePage}
                          pageSize={1}
                          onPageChange={setStudentArchivePage}
                          onPageSizeChange={() => {}}
                        />
                      </>
                    ) : (
                      <div className="empty">No archived semester results are available for the current search.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isStudent ? (
              <section className="dashboard-section" id="goals-insights">
                <div className="section-head">
                  <h2>Goals / Insights</h2>
                  <p>Performance insights generated from the student&apos;s marks-based records.</p>
                </div>
                <div className="chart-card student-goals-card">
                  <h4>Performance Insights</h4>
                  <div className="student-insights-list">
                    {studentPerformanceInsights.map((item) => (
                      <div className="student-insight-item" key={item}>
                        <span className="student-insight-dot" aria-hidden="true" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="overview">
                <div className="section-head">
                  <h2>Overview</h2>
                  <p>High-level academic totals and overall performance across the system.</p>
                </div>
                <div className="summary-strip faculty-overview-strip">
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">👨‍🎓</span>
                    <span className="muted">Total Students</span>
                    <h3>{adminOverviewMetrics.totalStudents}</h3>
                  </div>
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">👩‍🏫</span>
                    <span className="muted">Total Faculty</span>
                    <h3>{adminOverviewMetrics.totalFaculty}</h3>
                  </div>
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">📚</span>
                    <span className="muted">Total Subjects</span>
                    <h3>{adminOverviewMetrics.totalSubjects}</h3>
                  </div>
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">📊</span>
                    <span className="muted">Overall Average</span>
                    <h3>{adminOverviewMetrics.overallAverage.toFixed(1)}</h3>
                  </div>
                  <div className="summary-card faculty-overview-card highlight">
                    <span className="faculty-overview-icon" aria-hidden="true">✅</span>
                    <span className="muted">Overall Pass %</span>
                    <h3>{adminOverviewMetrics.overallPassPercentage.toFixed(0)}%</h3>
                  </div>
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="full-performance-analysis">
                <div className="section-head">
                  <h2>Full Performance Analysis (ALL SEMESTERS)</h2>
                  <p>Admin sees every student record across semesters, departments, and overall academic trends.</p>
                </div>
                <div className="summary-strip faculty-overview-strip">
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">📘</span>
                    <span className="muted">Best Semester</span>
                    <h3>{adminPerformanceHighlights.strongestSemester}</h3>
                    <p className="muted">{adminPerformanceHighlights.strongestSemesterAverage.toFixed(1)} average marks</p>
                  </div>
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">🏫</span>
                    <span className="muted">Best Department</span>
                    <h3>{adminPerformanceHighlights.strongestDepartment}</h3>
                    <p className="muted">{adminPerformanceHighlights.strongestDepartmentAverage.toFixed(1)} average marks</p>
                  </div>
                  <div className="summary-card faculty-overview-card highlight">
                    <span className="faculty-overview-icon" aria-hidden="true">🧾</span>
                    <span className="muted">Performance Records</span>
                    <h3>{adminPerformanceHighlights.totalRecords}</h3>
                    <p className="muted">All stored student semester results used in this analysis.</p>
                  </div>
                </div>
                <div className="chart-grid">
                  <PerformanceTrendChart data={adminOverallTrendData} theme={dashboardTheme} />
                  <MarksDistributionChart
                    data={adminSemesterPerformance.map((entry) => ({
                      section: `Sem ${entry.semester}`,
                      marks: Number(entry.passPercent.toFixed(0)),
                    }))}
                    title="Semester-wise pass percentage"
                    theme={dashboardTheme}
                  />
                </div>
                <div className="comparison-panel admin-page-panel">
                  <div className="section-head">
                    <h3>Semester-wise performance</h3>
                    <p>Average marks and pass rate across every semester.</p>
                  </div>
                  <div className="table admin-table admin-performance-table">
                    <div className="table-head">
                      <span>Semester</span>
                      <span>Average Marks</span>
                      <span>Average %</span>
                      <span>Pass %</span>
                      <span>Records</span>
                    </div>
                    {adminSemesterPerformance.length ? (
                      adminSemesterPerformance.map((entry) => (
                        <div className="table-row" key={entry.semester}>
                          <span>{entry.label}</span>
                          <span>{entry.averageMarks.toFixed(1)}</span>
                          <span>{entry.averagePercent.toFixed(0)}%</span>
                          <span>{entry.passPercent.toFixed(0)}%</span>
                          <span>{entry.totalRecords}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty">No semester-wise performance data is available yet.</div>
                    )}
                  </div>
                </div>
                <div className="comparison-panel admin-page-panel">
                  <div className="section-head">
                    <h3>Department-wise performance</h3>
                    <p>Admin view of department averages, pass rates, and record counts.</p>
                  </div>
                  <div className="table admin-table admin-performance-table">
                    <div className="table-head">
                      <span>Department</span>
                      <span>Average Marks</span>
                      <span>Average %</span>
                      <span>Pass %</span>
                      <span>Records</span>
                    </div>
                    {adminDepartmentPerformance.length ? (
                      adminDepartmentPerformance.map((entry) => (
                        <div className="table-row" key={entry.department}>
                          <span>{entry.department}</span>
                          <span>{entry.averageMarks.toFixed(1)}</span>
                          <span>{entry.averagePercent.toFixed(0)}%</span>
                          <span>{entry.passPercent.toFixed(0)}%</span>
                          <span>{entry.totalRecords}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty">No department-wise performance data is available yet.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="assessment-quality-analysis">
                <div className="section-head">
                  <h2>Assessment Quality Analysis</h2>
                  <p>Admin overview of written exam records with marks and pass status across semesters.</p>
                </div>
                <div className="summary-strip faculty-overview-strip">
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">📝</span>
                    <span className="muted">Average Marks</span>
                    <h3>{adminAssessmentQualitySummary.averageMarks.toFixed(1)}</h3>
                  </div>
                  <div className="summary-card faculty-overview-card">
                    <span className="faculty-overview-icon" aria-hidden="true">✅</span>
                    <span className="muted">Pass %</span>
                    <h3>{adminAssessmentQualitySummary.passPercent.toFixed(0)}%</h3>
                  </div>
                </div>
                <div className="chart-grid">
                  <MarksChart assessments={assessments} theme={dashboardTheme} />
                  <MarksDistributionChart
                    data={adminAssessmentQualityRows.slice(0, 6).map((row) => ({
                      section: row.subject,
                      marks: Number(row.passPercent.toFixed(0)),
                    }))}
                    title="Pass % by assessment"
                    theme={dashboardTheme}
                  />
                </div>
                <div className="comparison-panel admin-page-panel">
                  <div className="section-head">
                    <h3>Written exam records</h3>
                    <p>Only written exams are shown below. Student roll number is included for quick review.</p>
                  </div>
                  <div className="table admin-table admin-quality-table">
                    <div className="table-head">
                      <span>Student</span>
                      <span>Roll No</span>
                      <span>Subject</span>
                      <span>Semester</span>
                      <span>Exam Date</span>
                      <span>Marks</span>
                      <span>Pass %</span>
                    </div>
                    {adminAssessmentQualityRows.length ? (
                      pagedAdminAssessmentQualityRows.map((row) => (
                        <div className="table-row" key={row.id}>
                          <span>{row.studentName}</span>
                          <span>{row.rollNo}</span>
                          <span>{row.subject}</span>
                          <span>Semester {row.semester}</span>
                          <span>{row.examDate}</span>
                          <span>{row.averageMarks.toFixed(1)}</span>
                          <span>{row.passPercent.toFixed(0)}%</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty">No written assessment records are available yet.</div>
                    )}
                  </div>
                  {adminAssessmentQualityRows.length ? (
                    <Pagination
                      total={adminAssessmentQualityRows.length}
                      page={adminQualityPage}
                      pageSize={adminQualityPageSize}
                      onPageChange={setAdminQualityPage}
                      onPageSizeChange={(size) => {
                        setAdminQualityPageSize(size)
                        setAdminQualityPage(1)
                      }}
                    />
                  ) : null}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="advanced-filters">
                <div className="section-head">
                  <h2>Advanced Filters</h2>
                  <p>Filter student performance records by student, department, semester, subject, and result.</p>
                </div>
                <div className="comparison-panel admin-page-panel">
                  <div className="section-head">
                    <h3>Filter performance records</h3>
                    <p>Use the controls below to narrow the full student performance dataset.</p>
                  </div>
                <div className="filters admin-filters-panel">
                  <div className="filter-row admin-filter-row">
                    <label>
                      Student
                      <select
                        value={adminAdvancedFilters.studentId}
                        onChange={(event) => handleAdminAdvancedFilterChange('studentId', event.target.value)}
                      >
                        <option value="">All students</option>
                        {adminStudentOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Department
                      <select
                        value={adminAdvancedFilters.department}
                        onChange={(event) => handleAdminAdvancedFilterChange('department', event.target.value)}
                      >
                        <option value="">All departments</option>
                        {adminDepartmentOptions.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Semester
                      <select
                        value={adminAdvancedFilters.semester}
                        onChange={(event) => handleAdminAdvancedFilterChange('semester', event.target.value)}
                      >
                        <option value="">All semesters</option>
                        {adminSemesterOptions.map((semester) => (
                          <option key={semester} value={semester}>
                            Semester {semester}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <select
                        value={adminAdvancedFilters.subject}
                        onChange={(event) => handleAdminAdvancedFilterChange('subject', event.target.value)}
                      >
                        <option value="">All subjects</option>
                        {adminSubjectOptions.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Pass/Fail
                      <select
                        value={adminAdvancedFilters.result}
                        onChange={(event) => handleAdminAdvancedFilterChange('result', event.target.value)}
                      >
                        <option value="">All</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    </label>
                  </div>
                  <div className="filter-actions">
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => setAdminAdvancedFilters(initialAdminAdvancedFilters)}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
                  <div className="table admin-table admin-advanced-table">
                    <div className="table-head">
                      <span>Student</span>
                      <span>Department</span>
                      <span>Semester</span>
                      <span>Subject</span>
                      <span>Marks</span>
                      <span>Result</span>
                    </div>
                    {adminFilteredPerformanceRows.length ? (
                      pagedAdminFilteredPerformanceRows.map((row) => (
                        <div className="table-row" key={row.id}>
                          <span>{row.studentName}</span>
                          <span>{row.department}</span>
                          <span>Semester {row.semester}</span>
                          <span>{row.subject}</span>
                          <span>{row.score}/{row.totalMarks}</span>
                          <span>{row.result}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty">No records match the selected advanced filters.</div>
                    )}
                  </div>
                  {adminFilteredPerformanceRows.length ? (
                    <Pagination
                      total={adminFilteredPerformanceRows.length}
                      page={adminAdvancedPage}
                      pageSize={adminAdvancedPageSize}
                      onPageChange={setAdminAdvancedPage}
                      onPageSizeChange={(size) => {
                        setAdminAdvancedPageSize(size)
                        setAdminAdvancedPage(1)
                      }}
                    />
                  ) : null}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="student-management">
                <div className="section-head">
                  <h2>Student Management</h2>
                  <p>Add, edit, delete, search, and filter student records with register number, department, and current semester.</p>
                </div>
                <div className="comparison-panel">
                  <div className="filter-row">
                    <label>
                      Name
                      <input
                        type="text"
                        value={studentManagementForm.name}
                        onChange={(event) => handleStudentFormChange('name', event.target.value)}
                        placeholder="Student name"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={studentManagementForm.email}
                        onChange={(event) => handleStudentFormChange('email', event.target.value)}
                        placeholder="student@example.edu"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="text"
                        value={studentManagementForm.password}
                        onChange={(event) => handleStudentFormChange('password', event.target.value)}
                        placeholder={editingStudentId ? 'Leave blank to keep current' : 'Set password'}
                      />
                    </label>
                  </div>
                  <div className="filter-row">
                    <label>
                      Student Register No
                      <input
                        type="text"
                        value={studentManagementForm.registerNumber}
                        onChange={(event) => handleStudentFormChange('registerNumber', event.target.value)}
                        placeholder="Student register number"
                      />
                    </label>
                    <label>
                      Department
                      <input
                        type="text"
                        value={studentManagementForm.department}
                        onChange={(event) => handleStudentFormChange('department', event.target.value)}
                        placeholder="Department"
                      />
                    </label>
                    <label>
                      Current Semester
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={studentManagementForm.semester}
                        onChange={(event) => handleStudentFormChange('semester', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="filter-actions">
                    <button className="secondary" type="button" onClick={handleSubmitStudentManagement}>
                      {editingStudentId ? 'Update Student' : 'Add Student'}
                    </button>
                    <button className="ghost" type="button" onClick={resetStudentManagementForm}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="filters">
                  <div className="filter-row">
                    <label>
                      Search
                      <input
                        type="text"
                        value={studentManagementSearch}
                        onChange={(event) => setStudentManagementSearch(event.target.value)}
                        placeholder="Search by name, email, register no, or department"
                      />
                    </label>
                    <label>
                      Current Semester
                      <select
                        value={studentManagementSemester}
                        onChange={(event) => setStudentManagementSemester(event.target.value)}
                      >
                        <option value="">All semesters</option>
                        {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
                          <option key={semester} value={String(semester)}>
                            Semester {semester}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Student Register No</span>
                    <span>Department</span>
                    <span>Current Semester</span>
                    <span>Actions</span>
                  </div>
                  {studentManagementRows.length ? (
                    studentManagementRows.map((student) => (
                      <div className="table-row" key={student._id || student.id}>
                        <span>{student.name}</span>
                        <span>{student.email}</span>
                        <span>{student.registerNumber || '—'}</span>
                        <span>{student.department || '—'}</span>
                        <span>{student.semester || '—'}</span>
                        <span>
                          <button className="ghost" type="button" onClick={() => handleEditStudent(student)}>
                            Edit
                          </button>{' '}
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => handleDeleteStudent(student._id || student.id)}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No student records match the current search or semester filter.</div>
                  )}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="faculty-management">
                <div className="section-head">
                  <h2>Faculty Management</h2>
                  <p>Add Faculty, Edit Faculty, Delete Faculty, and Assign Subjects from one admin workspace.</p>
                </div>
                <div className="comparison-panel">
                  <div className="filter-row">
                    <label>
                      Name
                      <input
                        type="text"
                        value={facultyManagementForm.name}
                        onChange={(event) => handleFacultyFormChange('name', event.target.value)}
                        placeholder="Faculty name"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={facultyManagementForm.email}
                        onChange={(event) => handleFacultyFormChange('email', event.target.value)}
                        placeholder="faculty@example.edu"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="text"
                        value={facultyManagementForm.password}
                        onChange={(event) => handleFacultyFormChange('password', event.target.value)}
                        placeholder={editingFacultyId ? 'Leave blank to keep current' : 'Set password'}
                      />
                    </label>
                  </div>
                  <div className="filter-row">
                    <label>
                      Department
                      <input
                        type="text"
                        value={facultyManagementForm.department}
                        onChange={(event) => handleFacultyFormChange('department', event.target.value)}
                        placeholder="Department"
                      />
                    </label>
                    <label>
                      Assign Subjects
                      <input
                        type="text"
                        list="faculty-subject-options"
                        value={facultyManagementForm.assignedSubjects}
                        onChange={(event) => handleFacultyFormChange('assignedSubjects', event.target.value)}
                        placeholder="Mathematics, Physics, Chemistry"
                      />
                    </label>
                  </div>
                  <div className="filter-actions">
                    <button className="secondary" type="button" onClick={handleSubmitFacultyManagement}>
                      {editingFacultyId ? 'Update Faculty' : 'Add Faculty'}
                    </button>
                    <button className="ghost" type="button" onClick={resetFacultyManagementForm}>
                      Clear
                    </button>
                  </div>
                  <datalist id="faculty-subject-options">
                    {facultySubjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </div>
                <div className="filters">
                  <div className="filter-row">
                    <label>
                      Search
                      <input
                        type="text"
                        value={facultyManagementSearch}
                        onChange={(event) => setFacultyManagementSearch(event.target.value)}
                        placeholder="Search by name, email, department, or assigned subject"
                      />
                    </label>
                  </div>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Department</span>
                    <span>Assigned Subjects</span>
                    <span>Actions</span>
                  </div>
                  {facultyManagementRows.length ? (
                    facultyManagementRows.map((faculty) => (
                      <div className="table-row" key={faculty._id || faculty.id}>
                        <span>{faculty.name}</span>
                        <span>{faculty.email}</span>
                        <span>{faculty.department || '—'}</span>
                        <span>{faculty.assignedSubjects?.length ? faculty.assignedSubjects.join(', ') : '—'}</span>
                        <span>
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => handleEditFaculty(faculty, facultySubjectOptions)}
                          >
                            Edit
                          </button>{' '}
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => handleDeleteFaculty(faculty._id || faculty.id)}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No faculty records match the current search.</div>
                  )}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
              <section className="dashboard-section" id="academic-records-management">
                <div className="section-head">
                  <h2>Academic Records Management</h2>
                  <p>Upload marks semester-wise, edit marks for any student and semester, and view records by student, semester, and subject.</p>
                </div>
                <div className="comparison-panel">
                  <div className="filter-row">
                    <label>
                      Student
                      <select
                        value={academicRecordForm.studentId}
                        onChange={(event) => handleAcademicRecordFormChange('studentId', event.target.value)}
                      >
                        <option value="">Select student</option>
                        {academicRecordStudents.map((student) => (
                          <option key={student._id || student.id} value={student._id || student.id}>
                            {student.name} ({student.registerNumber})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Semester
                      <select
                        value={academicRecordForm.semester}
                        onChange={(event) => handleAcademicRecordFormChange('semester', event.target.value)}
                      >
                        {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
                          <option key={semester} value={semester}>
                            Semester {semester}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <select
                        value={academicRecordForm.subject}
                        onChange={(event) => handleAcademicRecordFormChange('subject', event.target.value)}
                      >
                        <option value="">Select subject</option>
                        {academicRecordSubjectOptions.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="filter-row">
                    <label>
                      Marks Obtained
                      <input
                        type="number"
                        min="0"
                        value={academicRecordForm.score}
                        onChange={(event) => handleAcademicRecordFormChange('score', event.target.value)}
                        placeholder="Enter marks"
                      />
                    </label>
                    <label>
                      Total Marks
                      <input
                        type="number"
                        min="1"
                        value={academicRecordForm.totalMarks}
                        onChange={(event) => handleAcademicRecordFormChange('totalMarks', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="filter-actions">
                    <button className="secondary" type="button" onClick={handleSubmitAcademicRecord}>
                      {editingAcademicRecordId ? 'Update Marks' : 'Upload Marks'}
                    </button>
                    <button className="ghost" type="button" onClick={resetAcademicRecordForm}>
                      Clear
                    </button>
                  </div>
                </div>

                <div className="filters">
                  <div className="filter-row">
                    <label>
                      Student
                      <select
                        value={academicRecordFilters.studentId}
                        onChange={(event) => handleAcademicRecordFilterChange('studentId', event.target.value)}
                      >
                        <option value="">All students</option>
                        {academicRecordStudents.map((student) => (
                          <option key={student._id || student.id} value={student._id || student.id}>
                            {student.name} ({student.registerNumber})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Semester
                      <select
                        value={academicRecordFilters.semester}
                        onChange={(event) => handleAcademicRecordFilterChange('semester', event.target.value)}
                      >
                        <option value="">All semesters</option>
                        {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
                          <option key={semester} value={semester}>
                            Semester {semester}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Subject
                      <select
                        value={academicRecordFilters.subject}
                        onChange={(event) => handleAcademicRecordFilterChange('subject', event.target.value)}
                      >
                        <option value="">All subjects</option>
                        {academicRecordSubjectOptions.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="table">
                  <div className="table-head">
                    <span>Student</span>
                    <span>Semester</span>
                    <span>Subject</span>
                    <span>Marks</span>
                    <span>Result</span>
                    <span>Actions</span>
                  </div>
                  {academicRecordRows.length ? (
                    pagedAcademicRecordRows.map((record) => (
                      <div className="table-row" key={record.id}>
                        <span>{record.studentName}</span>
                        <span>{record.semester}</span>
                        <span>{record.subject}</span>
                        <span>{record.score}/{record.totalMarks}</span>
                        <span>{record.result}</span>
                        <span>
                          <button className="ghost" type="button" onClick={() => handleEditAcademicRecord(record)}>
                            Edit
                          </button>{' '}
                          <button className="ghost" type="button" onClick={() => handleDeleteAcademicRecord(record.id)}>
                            Delete
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No academic records match the selected student, semester, and subject.</div>
                  )}
                </div>
                {academicRecordRows.length ? (
                  <Pagination
                    total={academicRecordRows.length}
                    page={academicRecordPage}
                    pageSize={academicRecordPageSize}
                    onPageChange={setAcademicRecordPage}
                    onPageSizeChange={(size) => {
                      setAcademicRecordPageSize(size)
                      setAcademicRecordPage(1)
                    }}
                  />
                ) : null}
              </section>
            ) : null}

            {isFaculty ? (
            <>
            <section className="dashboard-section" id="overview">
              <div className="section-head">
                <h2>Class Performance Overview</h2>
                <p>Calculated from all student exam-score records across the exam results.</p>
              </div>
              <div className="summary-strip faculty-overview-strip">
                <div className="summary-card faculty-overview-card">
                  <span className="faculty-overview-icon" aria-hidden="true">👨‍🎓</span>
                  <span className="muted">Total Students</span>
                  <h3>{FACULTY_TOTAL_STUDENTS}</h3>
                  <p className="muted">Students with recorded exam-result marks.</p>
                </div>
                <div className="summary-card faculty-overview-card">
                  <span className="faculty-overview-icon" aria-hidden="true">📊</span>
                  <span className="muted">Class Average</span>
                  <h3>{classPerformanceOverview.classAverage.toFixed(1)}</h3>
                  <p className="muted">Average score across all student exam records.</p>
                </div>
                <div className="summary-card faculty-overview-card">
                  <span className="faculty-overview-icon" aria-hidden="true">✅</span>
                  <span className="muted">Pass Percentage</span>
                  <h3>{classPerformanceOverview.passPercentage.toFixed(0)}%</h3>
                  <p className="muted">Calculated as passed students divided by total students, using the 45% pass mark.</p>
                </div>
                <div className="summary-card faculty-overview-card highlight">
                  <span className="faculty-overview-icon" aria-hidden="true">🏆</span>
                  <span className="muted">Top Score</span>
                  <h3>{classPerformanceOverview.topScore.toFixed(0)}</h3>
                  <p className="muted">Highest score found across all exam-result records.</p>
                </div>
                <div className="summary-card faculty-overview-card">
                  <span className="faculty-overview-icon" aria-hidden="true">⚠️</span>
                  <span className="muted">Failed Students</span>
                  <h3>{classPerformanceOverview.failedStudents}</h3>
                  <p className="muted">Students with exam scores below the fixed 45% pass mark.</p>
                </div>
              </div>
            </section>

            {isFaculty ? (
              <section className="dashboard-section" id="student-performance">
                <div className="section-head">
                  <h2>Student Performance</h2>
                  <p>Displaying all students&apos; last semester marks and details, with search and filters.</p>
                </div>
                <div className="filters">
                  <div className="filter-row">
                    <label>
                      Search
                      <input
                        type="text"
                        value={facultyPerformanceSearch}
                        onChange={(event) => setFacultyPerformanceSearch(event.target.value)}
                        placeholder="Search by name, roll no, subject, department, or email"
                      />
                    </label>
                    <label>
                      Subject
                      <select
                        value={facultyPerformanceSubject}
                        onChange={(event) => setFacultyPerformanceSubject(event.target.value)}
                      >
                        <option value="">All 6th semester subjects</option>
                        {facultyPerformanceSubjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Result
                      <select
                        value={facultyPerformanceResult}
                        onChange={(event) => setFacultyPerformanceResult(event.target.value)}
                      >
                        <option value="">All results</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="table enrolled-students-table">
                  <div className="table-head">
                    <span>Name</span>
                    <span>Roll No</span>
                    <span>Subject</span>
                    <span>Marks</span>
                    <span>Result</span>
                  </div>
                  {pagedFacultyPerformanceRecords.length ? (
                    pagedFacultyPerformanceRecords.map((record) => (
                      <div className="table-row" key={`overview-${record.id}`}>
                        <span>{record.name}</span>
                        <span>{record.rollNo}</span>
                        <span>{record.subject}</span>
                        <span>{record.marks}</span>
                        <span>{record.result}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No 6th semester student performance records match the current search or filters.</div>
                  )}
                </div>
                {filteredFacultyPerformanceRecords.length ? (
                  <Pagination
                    total={filteredFacultyPerformanceRecords.length}
                    page={facultyPerformancePage}
                    pageSize={facultyPerformancePageSize}
                    onPageChange={setFacultyPerformancePage}
                    onPageSizeChange={(size) => {
                      setFacultyPerformancePageSize(size)
                      setFacultyPerformancePage(1)
                    }}
                  />
                ) : null}
              </section>
            ) : null}

            {isFaculty ? (
              <section className="dashboard-section" id="performance-analysis-faculty">
                <div className="section-head">
                  <h2>PERFORMANCE ANALYSIS</h2>
                  <p>Marks distribution for all students based only on the last semester dataset.</p>
                </div>
                <div className="chart-grid">
                  <MarksDistributionChart
                    data={facultyMarksDistribution}
                    title="Marks Distribution (All Students)"
                    theme={dashboardTheme}
                  />
                  <div className="chart-card">
                    <h4>Distribution Summary</h4>
                    <div className="insight-list">
                      {facultyMarksDistribution.map((bucket) => (
                        <span key={bucket.section}>
                          {bucket.section} {'->'} {bucket.marks} students
                        </span>
                      ))}
                    </div>
                    <p className="muted">Shows the overall performance spread for the last semester.</p>
                  </div>
                </div>
                <div className="chart-grid">
                  <GradeDistributionChart data={facultyGradeDistribution} theme={dashboardTheme} />
                  <MarksDistributionChart
                    data={facultyPassFailData}
                    title="Pass vs Fail"
                    theme={dashboardTheme}
                  />
                  <MarksDistributionChart
                    data={facultyTopLowPerformersData}
                    title="Top vs Low Performers"
                    theme={dashboardTheme}
                  />
                </div>
                <div className="analytics-row">
                  <div className="score-card">
                    <h3>Top Score</h3>
                    <div className="score-value">{facultyTopLowScores.topScore.toFixed(0)}</div>
                    <p className="muted">{facultyTopLowScores.topSubject}</p>
                  </div>
                  <div className="score-card">
                    <h3>Lowest Score</h3>
                    <div className="score-value">{facultyTopLowScores.lowestScore.toFixed(0)}</div>
                    <p className="muted">{facultyTopLowScores.lowestSubject}</p>
                  </div>
                </div>
                <div className="comparison-panel">
                  <div className="section-head">
                    <h3>Subject-wise Average</h3>
                    <p>Average marks by subject for the last semester student records.</p>
                  </div>
                  <div className="table">
                    <div className="table-head">
                      <span>Subject</span>
                      <span>Average Marks</span>
                    </div>
                    {facultySubjectAverages.length ? (
                      facultySubjectAverages.map((entry) => (
                        <div className="table-row" key={entry.subject}>
                          <span>{entry.subject}</span>
                          <span>{entry.average.toFixed(1)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty">No subject-wise average data available for the last semester.</div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isFaculty ? (
              <section className="dashboard-section" id="subject-insights">
                <div className="section-head">
                  <h2>Subject Insights</h2>
                  <p>Last semester subject-level performance summary for all students.</p>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span>Subject Name</span>
                    <span>Average Marks</span>
                    <span>Pass %</span>
                    <span>Highest Score</span>
                  </div>
                  {facultySubjectInsights.length ? (
                    facultySubjectInsights.map((entry) => (
                      <div className="table-row" key={entry.subject}>
                        <span>{entry.subject}</span>
                        <span>{entry.averageMarks.toFixed(1)}</span>
                        <span>{entry.passPercent.toFixed(0)}%</span>
                        <span>{entry.highestScore.toFixed(0)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No subject insights are available for the last semester.</div>
                  )}
                </div>
              </section>
            ) : null}

            {isFaculty ? (
              <section className="dashboard-section" id="recent-activity">
                <div className="section-head">
                  <h2>Recent Activity</h2>
                  <p>Recent updates.</p>
                </div>
                <div className="recent-activity-grid">
                  {facultyRecentActivity.map((item) => (
                    <article className="recent-activity-card" key={item.title}>
                      <span className="recent-activity-bullet" aria-hidden="true">•</span>
                      <div className="recent-activity-copy">
                        <strong>{item.title}</strong>
                        <p>{item.note}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {isAdmin ? (
            <section className="dashboard-section" id="analytics">
              <div className="section-head">
                <h2>Assessment analytics</h2>
                <p>Visualize marks distribution and student performance trends.</p>
              </div>
              <div className="chart-center">
                <div className="chart-grid">
                  <MarksChart assessments={assessments} theme={dashboardTheme} />
                  <MarksDistributionChart
                    data={latestAssessment?.marksDistribution || []}
                    title={`Marks distribution ${latestAssessment?.subject ? `(${latestAssessment.subject})` : ''}`}
                    theme={dashboardTheme}
                  />
                  <PerformanceTrendChart data={performanceTrend} theme={dashboardTheme} />
                </div>
              </div>
              <div className="analytics-row">
                <div className="score-card">
                  <h3>Prediction</h3>
                  <p className="muted">Current pass percentage based on the available marks data.</p>
                  <div className="score-value">
                    {predictedPassRate === null ? '—' : `${predictedPassRate.toFixed(0)}%`}
                  </div>
                  <div className="progress">
                    <span style={{ width: `${predictedPassRate ?? 0}%` }} />
                  </div>
                  <p className="muted">
                    Calculated dynamically using student-level marks, score ranges, or assessment difficulty when needed.
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
                        disabled
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
                        disabled
                        onChange={(event) =>
                          setPassThresholdPercent(
                            normalizePassThresholdPercent(event.target.value)
                          )
                        }
                      />
                    </div>
                    <p className="muted">
                      Students scoring at least 45% of total marks are counted as pass across all dashboards.
                    </p>
                  </div>
                </div>
              </div>
            </section>
            ) : null}

            {isAdmin ? (
            <section className="dashboard-section" id="insights">
              <div className="section-head">
                <h2>Insights &amp; suggestions</h2>
                <p>Automated guidance based on difficulty, coverage, and score spread.</p>
              </div>
              <div className="insight-grid">
                <article className="insight">
                  <h3>Quality signals</h3>
                  <div className="insight-list">
                    <span>
                      Topic coverage:{' '}
                      {topicCoverage === null ? '—' : `${topicCoverage.toFixed(0)}%`}
                    </span>
                    <span>Balance: {latestAssessment?.balanceStatus || '—'}</span>
                    <span>Average marks: {Number(marksStats.avgMarks || 0).toFixed(1)}</span>
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
            ) : null}

            {isAdmin ? (
            <section className="dashboard-section" id="comparison">
              <div className="section-head">
                <h2>Exam comparison</h2>
                <p>Compare two assessments on average score and pass rate.</p>
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
                  <ComparisonChart data={comparisonChartData} theme={dashboardTheme} />
                  <div className="comparison-summary">
                    <h3>Comparison summary</h3>
                    {comparisonStats ? (
                      <div className="summary-stack">
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
            ) : null}

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
                      <li>Score distribution and marks trends.</li>
                      <li>Topic coverage percentage.</li>
                      <li>Performance groups and trends.</li>
                    </ul>
                  </div>
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

            {isAdmin ? (
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
            ) : null}
            </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
