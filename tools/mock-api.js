const http = require('http');

const assessments = [
  {
    _id: 'a1',
    subject: 'Mathematics',
    assessmentType: 'Midterm',
    examDate: '2026-02-05',
    totalMarks: 100,
    difficultyScore: 62,
    difficultyLevel: 'Medium',
    balanceStatus: 'Balanced',
    marksDistribution: [
      { section: 'Section A (0-25)', marks: 25 },
      { section: 'Section B (26-50)', marks: 25 },
      { section: 'Section C (51-75)', marks: 25 },
      { section: 'Section D (76-100)', marks: 25 },
    ],
    studentMarks: [78, 65, 52, 91, 44, 69, 73, 58, 84, 62, 49, 71],
    passRate: 76,
    averageScore: 66,
    performanceGap: 47,
    insights: ['Balanced difficulty with a healthy pass rate.'],
    suggestions: ['Maintain the current distribution with minor refinements.'],
  },
  {
    _id: 'a2',
    subject: 'Physics',
    assessmentType: 'Quiz',
    examDate: '2026-01-26',
    totalMarks: 60,
    difficultyScore: 70,
    difficultyLevel: 'Hard',
    balanceStatus: 'Imbalanced',
    marksDistribution: [
      { section: 'MCQ (0-20)', marks: 18 },
      { section: 'Numericals (21-40)', marks: 14 },
      { section: 'Derivations (41-60)', marks: 28 },
    ],
    studentMarks: [45, 33, 28, 50, 36, 41, 22, 54, 31, 47],
    passRate: 58,
    averageScore: 39,
    performanceGap: 32,
    insights: ['Heavier weight on derivations is raising difficulty.'],
    suggestions: ['Redistribute marks to reduce imbalance.'],
  },
  {
    _id: 'a3',
    subject: 'Computer Science',
    assessmentType: 'Final',
    examDate: '2026-01-18',
    totalMarks: 120,
    difficultyScore: 55,
    difficultyLevel: 'Medium',
    balanceStatus: 'Balanced',
    marksDistribution: [
      { section: 'Theory (0-40)', marks: 35 },
      { section: 'Programming (41-80)', marks: 50 },
      { section: 'Case study (81-120)', marks: 35 },
    ],
    studentMarks: [88, 96, 72, 101, 69, 85, 92, 77],
    passRate: 82,
    averageScore: 85,
    performanceGap: 32,
    insights: ['Strong performance on programming tasks.'],
    suggestions: ['Add more mid-level theory questions to balance.'],
  },
  {
    _id: 'a4',
    subject: 'Chemistry',
    assessmentType: 'Unit Test',
    examDate: '2026-01-10',
    totalMarks: 80,
    difficultyScore: 48,
    difficultyLevel: 'Easy',
    balanceStatus: 'Balanced',
    marksDistribution: [
      { section: 'MCQ (0-20)', marks: 20 },
      { section: 'Short answer (21-50)', marks: 30 },
      { section: 'Long answer (51-80)', marks: 30 },
    ],
    studentMarks: [72, 68, 58, 61, 76, 63, 70, 64],
    passRate: 90,
    averageScore: 66,
    performanceGap: 18,
    insights: ['Assessment is easier than baseline.'],
    suggestions: ['Increase higher-order problem solving.'],
  },
  {
    _id: 'a5',
    subject: 'English',
    assessmentType: 'Project',
    examDate: '2025-12-18',
    totalMarks: 50,
    difficultyScore: 52,
    difficultyLevel: 'Medium',
    balanceStatus: 'Balanced',
    marksDistribution: [
      { section: 'Writing (0-20)', marks: 20 },
      { section: 'Reading (21-40)', marks: 20 },
      { section: 'Presentation (41-50)', marks: 10 },
    ],
    studentMarks: [40, 38, 36, 44, 41, 39],
    passRate: 88,
    averageScore: 40,
    performanceGap: 8,
    insights: ['Strong consistency across students.'],
    suggestions: ['Keep the rubric for consistency.'],
  },
  {
    _id: 'a6',
    subject: 'Biology',
    assessmentType: 'Assignment',
    examDate: '2025-12-05',
    totalMarks: 70,
    difficultyScore: 60,
    difficultyLevel: 'Medium',
    balanceStatus: 'Balanced',
    marksDistribution: [
      { section: 'MCQ (0-25)', marks: 20 },
      { section: 'Short answer (26-50)', marks: 25 },
      { section: 'Diagram (51-70)', marks: 25 },
    ],
    studentMarks: [55, 49, 60, 52, 46, 57, 62],
    passRate: 80,
    averageScore: 54,
    performanceGap: 16,
    insights: ['Diagram questions correlate with stronger scores.'],
    suggestions: ['Add more application-based questions.'],
  },
];

const summary = {
  overview: {
    totalAssessments: assessments.length,
    avgDifficultyScore: assessments.reduce((sum, item) => sum + item.difficultyScore, 0) / assessments.length,
    imbalancedAssessments: assessments.filter((item) => item.balanceStatus === 'Imbalanced').length,
  },
  difficultySplit: [
    { _id: 'Easy', count: 1 },
    { _id: 'Medium', count: 4 },
    { _id: 'Hard', count: 1 },
  ],
};

const marksTotals = assessments.map((item) => item.totalMarks);
const advancedSummary = {
  marksStats: {
    minMarks: Math.min(...marksTotals),
    maxMarks: Math.max(...marksTotals),
    avgMarks: marksTotals.reduce((sum, value) => sum + value, 0) / marksTotals.length,
  },
};

let preferences = {
  comparison: {
    assessmentA: 'a1',
    assessmentB: 'a2',
  },
  passThresholdPercent: 40,
};

const json = (res, payload, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload));
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (req.url.startsWith('/api/assessments/reports/summary')) {
    return json(res, summary);
  }
  if (req.url.startsWith('/api/assessments/reports/advanced')) {
    return json(res, advancedSummary);
  }
  if (req.url.startsWith('/api/assessments') && req.method === 'GET') {
    return json(res, assessments);
  }
  if (req.url.startsWith('/api/preferences') && req.method === 'GET') {
    return json(res, preferences);
  }
  if (req.url.startsWith('/api/preferences') && req.method === 'PUT') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        preferences = { ...preferences, ...JSON.parse(body || '{}') };
      } catch {
        // ignore malformed payloads
      }
      json(res, preferences);
    });
    return;
  }
  if (req.url.startsWith('/api/assessments') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        payload = {};
      }
      const created = {
        _id: `new-${Date.now()}`,
        subject: payload.subject || 'New Assessment',
        assessmentType: payload.assessmentType || 'Upload',
        examDate: payload.examDate || new Date().toISOString(),
        totalMarks: payload.totalMarks || 100,
        difficultyScore: payload.difficultyScore || 60,
        difficultyLevel: payload.difficultyLevel || 'Medium',
        balanceStatus: payload.balanceStatus || 'Balanced',
        marksDistribution: payload.marksDistribution || [],
        studentMarks: payload.studentMarks || [],
        passRate: payload.passRate || 70,
        averageScore: payload.averageScore || 65,
        performanceGap: payload.performanceGap || 20,
      };
      assessments.unshift(created);
      json(res, created, 201);
    });
    return;
  }
  if (req.url.startsWith('/api/auth/profile')) {
    return json(res, { name: 'Admin User', role: 'admin', email: 'admin@school.edu' });
  }
  if (req.url.startsWith('/api/auth/login') || req.url.startsWith('/api/auth/register')) {
    return json(res, { token: 'demo-token', user: { name: 'Admin User', role: 'admin', email: 'admin@school.edu' } });
  }

  json(res, { message: 'Not found' }, 404);
});

const port = 5000;
server.listen(port, () => {
  console.log(`Mock API listening on http://localhost:${port}`);
});
