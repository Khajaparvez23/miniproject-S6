import { useMemo, useState } from 'react'
import { normalizeAssessmentPayload, validateAssessment } from '../utils/validation.js'

const createEmptyEntry = () => ({ section: '', marks: '' })

const initialForm = {
  subject: '',
  examiner: '',
  assessmentType: 'exam',
  examDate: '',
  totalMarks: '',
  marksDistribution: [createEmptyEntry()],
  questionComplexity: {
    easy: '',
    medium: '',
    hard: '',
  },
}

export default function AssessmentForm({ onSubmit }) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const distributionTotal = useMemo(
    () =>
      form.marksDistribution.reduce((sum, entry) => {
        const value = Number(entry.marks)
        return Number.isFinite(value) ? sum + value : sum
      }, 0),
    [form.marksDistribution]
  )

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const updateDistribution = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.marksDistribution]
      next[index] = { ...next[index], [key]: value }
      return { ...prev, marksDistribution: next }
    })
  }

  const updateComplexity = (key, value) => {
    setForm((prev) => ({
      ...prev,
      questionComplexity: { ...prev.questionComplexity, [key]: value },
    }))
  }

  const addDistribution = () => {
    setForm((prev) => ({
      ...prev,
      marksDistribution: [...prev.marksDistribution, createEmptyEntry()],
    }))
  }

  const removeDistribution = (index) => {
    setForm((prev) => {
      const next = prev.marksDistribution.filter((_, idx) => idx !== index)
      return { ...prev, marksDistribution: next.length ? next : [createEmptyEntry()] }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    const validationErrors = validateAssessment(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      return
    }

    try {
      setSubmitting(true)
      const payload = normalizeAssessmentPayload(form)
      await onSubmit(payload)
      setStatus({ type: 'success', message: 'Assessment submitted successfully.' })
      setForm(initialForm)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Submission failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Subject name
          <input
            type="text"
            value={form.subject}
            onChange={(event) => updateField('subject', event.target.value)}
            className={errors.subject ? 'error' : ''}
            placeholder="Data Structures"
          />
          {errors.subject && <span className="error-text">{errors.subject}</span>}
        </label>
        <label>
          Examiner
          <input
            type="text"
            value={form.examiner}
            onChange={(event) => updateField('examiner', event.target.value)}
            className={errors.examiner ? 'error' : ''}
            placeholder="Dr. Smith"
          />
          {errors.examiner && <span className="error-text">{errors.examiner}</span>}
        </label>
      </div>

      <div className="form-row">
        <label>
          Assessment type
          <select
            value={form.assessmentType}
            onChange={(event) => updateField('assessmentType', event.target.value)}
          >
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Exam date
          <input
            type="date"
            value={form.examDate}
            onChange={(event) => updateField('examDate', event.target.value)}
            className={errors.examDate ? 'error' : ''}
          />
          {errors.examDate && <span className="error-text">{errors.examDate}</span>}
        </label>
      </div>

      <label>
        Total marks
        <input
          type="number"
          min="1"
          value={form.totalMarks}
          onChange={(event) => updateField('totalMarks', event.target.value)}
          className={errors.totalMarks ? 'error' : ''}
          placeholder="100"
        />
        {errors.totalMarks && <span className="error-text">{errors.totalMarks}</span>}
      </label>

      <div className="distribution">
        <div className="distribution-head">
          <h4>Marks distribution</h4>
          <button type="button" className="ghost small" onClick={addDistribution}>
            Add section
          </button>
        </div>
        {errors.marksDistribution && (
          <span className="error-text">{errors.marksDistribution}</span>
        )}
        {form.marksDistribution.map((entry, index) => (
          <div className="form-row" key={`${entry.section}-${index}`}>
            <label>
              Section
              <input
                type="text"
                value={entry.section}
                onChange={(event) => updateDistribution(index, 'section', event.target.value)}
                className={errors[`marksDistribution.${index}.section`] ? 'error' : ''}
                placeholder="Section A"
              />
              {errors[`marksDistribution.${index}.section`] && (
                <span className="error-text">
                  {errors[`marksDistribution.${index}.section`]}
                </span>
              )}
            </label>
            <label>
              Marks
              <input
                type="number"
                min="0"
                value={entry.marks}
                onChange={(event) => updateDistribution(index, 'marks', event.target.value)}
                className={errors[`marksDistribution.${index}.marks`] ? 'error' : ''}
              />
              {errors[`marksDistribution.${index}.marks`] && (
                <span className="error-text">
                  {errors[`marksDistribution.${index}.marks`]}
                </span>
              )}
            </label>
            <button
              type="button"
              className="ghost danger"
              onClick={() => removeDistribution(index)}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="distribution-total">
          <span>Distribution total: {distributionTotal}</span>
          {errors.marksDistributionTotal && (
            <span className="error-text">{errors.marksDistributionTotal}</span>
          )}
        </div>
      </div>

      <div className="complexity">
        <h4>Question complexity (optional)</h4>
        <div className="form-row">
          <label>
            Easy
            <input
              type="number"
              min="0"
              value={form.questionComplexity.easy}
              onChange={(event) => updateComplexity('easy', event.target.value)}
              className={errors['questionComplexity.easy'] ? 'error' : ''}
            />
            {errors['questionComplexity.easy'] && (
              <span className="error-text">{errors['questionComplexity.easy']}</span>
            )}
          </label>
          <label>
            Medium
            <input
              type="number"
              min="0"
              value={form.questionComplexity.medium}
              onChange={(event) => updateComplexity('medium', event.target.value)}
              className={errors['questionComplexity.medium'] ? 'error' : ''}
            />
            {errors['questionComplexity.medium'] && (
              <span className="error-text">{errors['questionComplexity.medium']}</span>
            )}
          </label>
          <label>
            Hard
            <input
              type="number"
              min="0"
              value={form.questionComplexity.hard}
              onChange={(event) => updateComplexity('hard', event.target.value)}
              className={errors['questionComplexity.hard'] ? 'error' : ''}
            />
            {errors['questionComplexity.hard'] && (
              <span className="error-text">{errors['questionComplexity.hard']}</span>
            )}
          </label>
        </div>
      </div>

      {status.message && (
        <div className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
          {status.message}
        </div>
      )}

      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Analyze assessment'}
      </button>
    </form>
  )
}
