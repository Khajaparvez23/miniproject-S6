$ErrorActionPreference = "Stop"

$outPath = "E:\Implemented_SRS.docx"
$tmp = Join-Path $env:TEMP ("srs_docx_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmp | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp "docProps") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp "word\\_rels") | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
'@
Set-Content -LiteralPath (Join-Path $tmp "[Content_Types].xml") -Value $contentTypes -Encoding UTF8

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
'@
Set-Content -LiteralPath (Join-Path $tmp "_rels\\.rels") -Value $rels -Encoding UTF8

$now = [DateTime]::UtcNow.ToString("s") + "Z"
$core = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Academic Assessment Quality Analyzer - Implemented SRS</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified>
</cp:coreProperties>
"@
Set-Content -LiteralPath (Join-Path $tmp "docProps\\core.xml") -Value $core -Encoding UTF8

$app = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
'@
Set-Content -LiteralPath (Join-Path $tmp "docProps\\app.xml") -Value $app -Encoding UTF8

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>
'@
Set-Content -LiteralPath (Join-Path $tmp "word\\_rels\\document.xml.rels") -Value $docRels -Encoding UTF8

function Escape-Xml([string]$s) {
    return ($s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' -replace "'","&apos;")
}

$lines = @(
    "SOFTWARE REQUIREMENT SPECIFICATION (SRS)",
    "Academic Assessment Quality Analyzer - Implemented Scope",
    "",
    "1. Introduction",
    "1.1 Purpose",
    "The Academic Assessment Quality Analyzer Web Application is a centralized platform that assists educational institutions in evaluating the quality of academic assessments such as quizzes, assignments, and examinations. It helps faculty members analyze question difficulty, marks distribution, student performance, and overall assessment effectiveness to ensure fair and balanced evaluation of students. The application replaces manual assessment review processes with an automated, data-driven approach that improves academic decision-making and maintains educational standards.",
    "",
    "1.2 Scope",
    "This web-based application is designed for faculty members and academic administrators. The system allows users to upload or enter assessment details, analyze difficulty levels, evaluate marks distribution, store assessment records securely, generate insights and recommendations, and export reports. The platform provides a professional dashboard UI and uses a MongoDB database for reliable data storage. This project focuses on transparency, consistency, and quality in academic evaluations.",
    "",
    "1.3 Definitions, Acronyms, and Abbreviations",
    "SRS: Software Requirement Specification",
    "UI: User Interface",
    "API: Application Programming Interface",
    "DB: Database",
    "Admin: Authorized academic staff",
    "Analyzer: Module that evaluates assessment quality",
    "",
    "1.4 References",
    "MongoDB Documentation",
    "Node.js Official Documentation",
    "Express.js Guide",
    "Vite Documentation",
    "React Documentation",
    "",
    "1.5 Overview",
    "This document describes the implemented system functionality, user requirements, system features, and constraints for the Academic Assessment Quality Analyzer.",
    "",
    "2. Overall Description",
    "2.1 Product Perspective",
    "The Academic Assessment Quality Analyzer is a standalone web application built with a client-server architecture: a React frontend, a Node.js/Express backend, and a MongoDB database. The system is scalable and can be extended in the future.",
    "",
    "2.2 Product Functions",
    "User authentication and role-based access (faculty/admin).",
    "Entry and management of assessment data.",
    "Automated difficulty classification and balance status.",
    "Automated insights and recommendations.",
    "Student-level marks analysis to compute average score, pass rate, and performance gaps.",
    "Analytics dashboard with charts and comparison tools.",
    "Storage and retrieval of assessment records.",
    "Export reports to PDF and CSV.",
    "",
    "2.3 User Classes and Characteristics",
    "Faculty Members: Primary users, upload assessments and review analytics.",
    "Administrators: Manage system access and monitor stored data.",
    "",
    "2.4 Operating Environment",
    "Modern web browsers (Chrome, Edge, Firefox).",
    "Internet connectivity.",
    "Database access.",
    "Technology stack: React, Node.js/Express, MongoDB.",
    "",
    "2.5 Design and Implementation Constraints",
    "Requires continuous internet connection.",
    "Depends on database availability.",
    "Must ensure data privacy and security.",
    "Designed primarily for academic institutions.",
    "",
    "2.6 Assumptions and Dependencies",
    "Users possess basic computer literacy.",
    "Institutions support digital assessment methods.",
    "Server uptime is maintained.",
    "",
    "3. System Features",
    "3.1 User Authentication",
    "Secure login functionality. Users must log in with valid credentials. Unauthorized users cannot access the system. Passwords are encrypted.",
    "",
    "3.2 Assessment Data Entry",
    "Faculty members can input details related to academic assessments: subject name, examiner details, marks distribution, exam date, and optional student-level marks.",
    "",
    "3.3 Difficulty Analysis",
    "The system evaluates assessment difficulty based on marks allocation and question complexity. Assessments are classified as Easy, Medium, or Hard with automated suggestions.",
    "",
    "3.4 Student Performance Analytics",
    "When student-level marks are provided, the system computes average score, pass rate, and performance gaps. Performance trends and risk flags are presented on the dashboard.",
    "",
    "3.5 Data Storage and Retrieval",
    "All assessment records are stored securely in the database. Users can retrieve and filter past records.",
    "",
    "3.6 Reporting and Insights",
    "The system generates insights and recommendations to improve assessment quality. Reports can be exported as PDF or CSV.",
    "",
    "3.7 Exam Comparison",
    "Faculty can compare two assessments by difficulty, average marks, and pass rate. Selection preferences are stored per user.",
    "",
    "4. External Interface Requirements",
    "4.1 User Interface",
    "Clean, responsive dashboard UI with sidebar navigation, summary cards, charts, and insights.",
    "",
    "4.2 Hardware Interface",
    "Standard computing devices with internet connectivity.",
    "",
    "4.3 Software Interface",
    "Web browser, Node.js runtime, MongoDB database.",
    "",
    "5. Non-Functional Requirements",
    "5.1 Performance: Fast response time and efficient queries.",
    "5.2 Security: Authentication required; protected database access; secure API endpoints.",
    "5.3 Reliability: High availability and minimal downtime.",
    "5.4 Scalability: Architecture supports future expansion.",
    "5.5 Usability: Simple, user-friendly interface.",
    "",
    "6. Future Enhancements (Not Implemented)",
    "Integration with Learning Management Systems.",
    "AI-powered question evaluation.",
    "Multi-institution support.",
    ""
)

$paraXml = $lines | ForEach-Object {
    $text = Escape-Xml $_
    "<w:p><w:r><w:t xml:space=""preserve"">$text</w:t></w:r></w:p>"
}
$docXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($paraXml -join "`n    ")
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>
"@
Set-Content -LiteralPath (Join-Path $tmp "word\\document.xml") -Value $docXml -Encoding UTF8

if (Test-Path $outPath) {
    Remove-Item -LiteralPath $outPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $outPath)
Remove-Item -Recurse -Force $tmp

Write-Output ("WROTE:" + $outPath)
