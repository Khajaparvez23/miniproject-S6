import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

export const exportAssessmentsCSV = (assessments) => {
  const headers = [
    'Subject',
    'Assessment Type',
    'Difficulty',
    'Total Marks',
    'Exam Date',
    'Balance Status',
  ]

  const rows = (assessments || []).map((item) => [
    item.subject,
    item.assessmentType,
    item.difficultyLevel,
    item.totalMarks,
    formatDate(item.examDate),
    item.balanceStatus,
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `assessment-report-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportAssessmentsPDF = (assessments, summary, meta = {}) => {
  const doc = new jsPDF()
  const today = new Date().toLocaleDateString()

  doc.setFontSize(16)
  doc.text('Assessment Quality Analyzer - Report', 14, 18)
  doc.setFontSize(10)
  doc.text(`Generated: ${today}`, 14, 26)

  if (summary?.overview) {
    const overview = summary.overview
    doc.text(
      `Total Assessments: ${overview.totalAssessments || 0} | Avg Difficulty: ${Number(
        overview.avgDifficultyScore || 0
      ).toFixed(1)} | Imbalanced: ${overview.imbalancedAssessments || 0}`,
      14,
      34
    )
  }

  if (summary?.marksStats) {
    const stats = summary.marksStats
    doc.text(
      `Marks (min/avg/max): ${stats.minMarks ?? 0} / ${Number(stats.avgMarks || 0).toFixed(1)} / ${stats.maxMarks ?? 0}`,
      14,
      40
    )
  }

  if (meta?.qualityScore !== undefined && meta?.qualityScore !== null) {
    doc.text(`Assessment Quality Score: ${Number(meta.qualityScore).toFixed(0)}`, 14, 46)
  }

  if (Array.isArray(meta?.riskFlags) && meta.riskFlags.length) {
    const flags = meta.riskFlags.slice(0, 4).join(' | ')
    doc.text(`Risk Flags: ${flags}`, 14, 52)
  }

  const tableBody = (assessments || []).map((item) => [
    item.subject,
    item.assessmentType,
    item.difficultyLevel,
    item.totalMarks,
    formatDate(item.examDate),
    item.balanceStatus,
  ])

  autoTable(doc, {
    startY: 58,
    head: [[
      'Subject',
      'Assessment',
      'Difficulty',
      'Total Marks',
      'Exam Date',
      'Balance',
    ]],
    body: tableBody,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 60, 136] },
  })

  doc.save(`assessment-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export const exportStudentExamResultsPDF = (rows, profile = {}) => {
  const doc = new jsPDF()
  const today = new Date().toLocaleDateString()
  const safeRows = Array.isArray(rows) ? rows : []

  doc.setFontSize(16)
  doc.text('Student Exam Results', 14, 18)
  doc.setFontSize(10)
  doc.text(`Generated: ${today}`, 14, 26)
  doc.text(`Name: ${profile.name || '-'}`, 14, 32)
  doc.text(`Roll No: ${profile.rollNo || '-'}`, 14, 38)

  autoTable(doc, {
    startY: 44,
    head: [['Course Code', 'Course Name', 'Sem', 'Grade', 'Result']],
    body: safeRows.map((row) => [
      row.courseCode,
      row.courseName,
      row.semester,
      row.grade,
      row.result,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 60, 136] },
  })

  doc.save(`${profile.rollNo || 'student'}_exam_results.pdf`)
}
