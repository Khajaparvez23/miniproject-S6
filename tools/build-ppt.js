const pptxgen = require('pptxgenjs');
const path = require('path');

const pptx = new pptxgen();

pptx.layout = 'LAYOUT_WIDE';

const theme = {
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  lang: 'en-US',
};

pptx.theme = theme;

const colors = {
  ink: '0F172A',
  muted: '475569',
  ocean: '1F3C88',
  teal: '0F766E',
  sand: 'F7F4EF',
  card: 'FFFFFF',
};

const dashboardImage = path.resolve(__dirname, '..', 'assets', 'dashboard.png');

const addTitle = (slide, title, subtitle) => {
  slide.addText(title, {
    x: 0.6,
    y: 0.6,
    w: 12.1,
    h: 0.8,
    fontSize: 36,
    bold: true,
    color: colors.ink,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6,
      y: 1.5,
      w: 12,
      h: 0.6,
      fontSize: 18,
      color: colors.muted,
    });
  }
};

const addSectionHeader = (slide, title) => {
  slide.addText(title, {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: colors.ink,
  });
};

const addBullets = (slide, items, opts = {}) => {
  const { x = 0.8, y = 1.4, w = 5.8, h = 4.8 } = opts;
  slide.addText(
    items.map((text) => ({ text, options: { bullet: { indent: 18 } } })),
    {
      x,
      y,
      w,
      h,
      fontSize: 18,
      color: colors.muted,
      paraSpaceAfter: 10,
    }
  );
};

// Slide 1: Title
{
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: colors.sand },
    line: { color: colors.sand },
  });
  slide.addText('Academic Assessment Quality Analyzer', {
    x: 0.7,
    y: 0.9,
    w: 7.2,
    h: 1.2,
    fontSize: 38,
    bold: true,
    color: colors.ink,
  });
  slide.addText('School Work Checker Dashboard', {
    x: 0.7,
    y: 2.0,
    w: 6.8,
    h: 0.5,
    fontSize: 20,
    color: colors.muted,
  });
  slide.addText('Prepared for project demonstration · February 16, 2026', {
    x: 0.7,
    y: 2.6,
    w: 6.8,
    h: 0.4,
    fontSize: 14,
    color: colors.muted,
  });
  slide.addImage({ path: dashboardImage, x: 7.2, y: 0.9, w: 5.6, h: 5.2 });
  slide.addText('Role-based analytics for faculty and admins', {
    x: 7.2,
    y: 6.2,
    w: 5.6,
    h: 0.5,
    fontSize: 14,
    color: colors.muted,
  });
}

// Slide 2: Problem
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Problem Statement');
  addBullets(slide, [
    'Assessment quality is often reviewed manually, which is time-consuming and inconsistent.',
    'Departments struggle to track difficulty balance, coverage gaps, and student performance trends.',
    'Lack of visibility makes it hard to improve question paper design and pass rates.',
  ]);
}

// Slide 3: Objectives
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Project Objectives');
  addBullets(slide, [
    'Centralize assessment uploads for faculty and administrators.',
    'Provide analytics on difficulty, marks distribution, and pass rate trends.',
    'Generate actionable insights and improvement suggestions automatically.',
    'Enable quick reporting and PDF export for quality reviews.',
  ]);
}

// Slide 4: Solution Overview
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Solution Overview');
  slide.addText(
    'A web platform that ingests assessment data and produces real-time analytics for academic review.',
    {
      x: 0.8,
      y: 1.3,
      w: 12,
      h: 0.6,
      fontSize: 18,
      color: colors.muted,
    }
  );
  addBullets(slide, [
    'Upload question structures or marks distributions.',
    'Automatic calculation of difficulty score, balance, and coverage.',
    'Insights panel highlights risks and recommendations.',
    'Comparison view for two assessments side-by-side.',
  ], { y: 2.1, w: 6.2 });
  slide.addImage({ path: dashboardImage, x: 7.1, y: 1.5, w: 5.7, h: 4.5 });
}

// Slide 5: Core Features
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Core Features');
  addBullets(slide, [
    'Secure login with faculty/admin roles and Google OAuth option.',
    'Assessment analytics dashboard with charts and quality score.',
    'Pass criteria slider and automatic pass-rate prediction.',
    'Assessment comparison analytics (difficulty, avg score, pass rate).',
    'Filters, pagination, and PDF report export.',
  ], { w: 6.4 });
  slide.addImage({ path: dashboardImage, x: 7.3, y: 1.6, w: 5.5, h: 4.1 });
}

// Slide 6: UI/UX Wireframes
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'UI/UX Wireframes (Implemented)');
  slide.addImage({ path: dashboardImage, x: 0.6, y: 1.2, w: 12.1, h: 5.9 });
  slide.addText('Actual dashboard UI used in the system', {
    x: 0.6,
    y: 6.9,
    w: 12,
    h: 0.4,
    fontSize: 14,
    color: colors.muted,
    align: 'center',
  });
}

// Slide 7: Dashboard Insights
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Dashboard Insights');
  addBullets(slide, [
    'Quality score combines difficulty balance, pass rate, and topic coverage.',
    'Marks distribution highlights imbalances across sections.',
    'Performance trends reveal shifts in average scores over time.',
    'Risk flags and suggestions guide quick interventions.',
  ], { w: 6.3 });
  slide.addImage({ path: dashboardImage, x: 7.1, y: 1.5, w: 5.7, h: 4.5 });
}

// Slide 8: Tech Stack
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Technology Stack');
  addBullets(slide, [
    'Frontend: React + Vite, Recharts, responsive CSS.',
    'Backend: Node.js + Express with JWT authentication.',
    'Database: MongoDB for assessments, users, and preferences.',
    'Reporting: PDF export with jsPDF.',
  ]);
}

// Slide 9: What We Built
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'What We Implemented');
  addBullets(slide, [
    'End-to-end assessment workflow from upload to analytics.',
    'Role-based admin controls for user management.',
    'Configurable pass criteria and comparison dashboards.',
    'Clean UI with reusable components and charts.',
  ], { w: 6.2 });
  slide.addImage({ path: dashboardImage, x: 7.2, y: 1.4, w: 5.6, h: 4.4 });
}

// Slide 10: Future Work
{
  const slide = pptx.addSlide();
  addSectionHeader(slide, 'Future Enhancements');
  addBullets(slide, [
    'Automated syllabus mapping and topic coverage heatmaps.',
    'Batch uploads and integration with LMS platforms.',
    'Advanced analytics for plagiarism and question quality checks.',
    'Role-based notifications and scheduled reports.',
  ]);
}

// Slide 11: Thank You
{
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: colors.ocean },
    line: { color: colors.ocean },
  });
  slide.addText('Thank You', {
    x: 0,
    y: 2.8,
    w: 13.333,
    h: 1,
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
  });
  slide.addText('Questions?', {
    x: 0,
    y: 3.9,
    w: 13.333,
    h: 0.6,
    fontSize: 20,
    color: 'FFFFFF',
    align: 'center',
  });
}

const outPath = path.resolve('e:/School-Work-Checker.pptx');

pptx.writeFile({ fileName: outPath });
