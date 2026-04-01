const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

export default function RecordsTable({ assessments }) {
  if (!assessments?.length) {
    return <div className="empty">No assessments recorded yet.</div>
  }

  return (
    <div className="table">
      <div className="table-head">
        <span>Subject</span>
        <span>Assessment</span>
        <span>Total marks</span>
        <span>Exam date</span>
      </div>
      {assessments.map((row) => (
        <div className="table-row" key={row._id}>
          <span>{row.subject}</span>
          <span>{row.assessmentType}</span>
          <span>{row.totalMarks}</span>
          <span>{formatDate(row.examDate)}</span>
        </div>
      ))}
    </div>
  )
}
