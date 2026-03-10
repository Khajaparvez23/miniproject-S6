const isEmpty = (value) => !value && value !== 0

export const validateAssessment = (form) => {
  const errors = {}

  if (!form.subject?.trim()) errors.subject = 'Subject is required'
  if (!form.examiner?.trim()) errors.examiner = 'Examiner is required'
  if (!form.examDate) errors.examDate = 'Exam date is required'

  const totalMarks = Number(form.totalMarks)
  if (Number.isNaN(totalMarks) || totalMarks <= 0) {
    errors.totalMarks = 'Total marks must be greater than 0'
  }

  if (!Array.isArray(form.marksDistribution) || form.marksDistribution.length === 0) {
    errors.marksDistribution = 'At least one marks distribution entry is required'
  } else {
    form.marksDistribution.forEach((entry, index) => {
      if (!entry.section?.trim()) {
        errors[`marksDistribution.${index}.section`] = 'Section name is required'
      }
      const marks = Number(entry.marks)
      if (Number.isNaN(marks) || marks < 0) {
        errors[`marksDistribution.${index}.marks`] = 'Marks must be 0 or more'
      }
    })
  }

  const complexity = form.questionComplexity || {}
  ;['easy', 'medium', 'hard'].forEach((key) => {
    if (isEmpty(complexity[key])) return
    const value = Number(complexity[key])
    if (Number.isNaN(value) || value < 0) {
      errors[`questionComplexity.${key}`] = 'Value must be 0 or more'
    }
  })

  const distributionSum = (form.marksDistribution || []).reduce((sum, entry) => {
    const value = Number(entry.marks)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  if (Number.isFinite(totalMarks) && distributionSum > totalMarks) {
    errors.marksDistributionTotal = 'Distribution total exceeds total marks'
  }

  return errors
}

export const normalizeAssessmentPayload = (form) => ({
  subject: form.subject.trim(),
  examiner: form.examiner.trim(),
  assessmentType: form.assessmentType,
  examDate: form.examDate,
  totalMarks: Number(form.totalMarks),
  marksDistribution: form.marksDistribution.map((entry) => ({
    section: entry.section.trim(),
    marks: Number(entry.marks),
  })),
  questionComplexity: {
    easy: Number(form.questionComplexity.easy || 0),
    medium: Number(form.questionComplexity.medium || 0),
    hard: Number(form.questionComplexity.hard || 0),
  },
})
