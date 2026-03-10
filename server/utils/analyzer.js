const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const analyzeAssessment = ({
    marksDistribution,
    questionComplexity,
    totalMarks,
    studentMarks
}) => {
    const distribution = Array.isArray(marksDistribution) ? marksDistribution : [];
    const complexity = questionComplexity || {};
    const studentScores = Array.isArray(studentMarks)
        ? studentMarks
            .map((entry) => (typeof entry === "number" ? entry : entry?.score))
            .map(toNumber)
            .filter((value) => value >= 0)
        : [];

    const easy = toNumber(complexity.easy);
    const medium = toNumber(complexity.medium);
    const hard = toNumber(complexity.hard);
    const complexityTotal = easy + medium + hard;

    let difficultyScore = 50;
    if (complexityTotal > 0) {
        const weighted = easy * 30 + medium * 60 + hard * 100;
        difficultyScore = weighted / complexityTotal;
    }

    const roundedDifficultyScore = Number(difficultyScore.toFixed(2));
    let difficultyLevel = "Medium";
    if (roundedDifficultyScore < 45) {
        difficultyLevel = "Easy";
    } else if (roundedDifficultyScore > 70) {
        difficultyLevel = "Hard";
    }

    const distributionTotal = distribution.reduce((sum, entry) => sum + toNumber(entry.marks), 0);
    const denominator = toNumber(totalMarks) > 0 ? toNumber(totalMarks) : distributionTotal;
    const shares = denominator > 0
        ? distribution.map((entry) => toNumber(entry.marks) / denominator)
        : [];

    const maxShare = shares.length ? Math.max(...shares) : 0;
    const minShare = shares.length ? Math.min(...shares) : 0;
    const isImbalanced = shares.length > 1 && (maxShare > 0.5 || maxShare - minShare > 0.35);
    const balanceStatus = isImbalanced ? "Imbalanced" : "Balanced";

    let averageScore = null;
    let passRate = null;
    let performanceGap = null;

    if (studentScores.length) {
        const totalScore = studentScores.reduce((sum, value) => sum + value, 0);
        averageScore = Number((totalScore / studentScores.length).toFixed(2));
        const passThreshold = toNumber(totalMarks) * 0.4;
        const passes = studentScores.filter((value) => value >= passThreshold).length;
        passRate = Number(((passes / studentScores.length) * 100).toFixed(2));
        performanceGap = Number((Math.max(...studentScores) - Math.min(...studentScores)).toFixed(2));
    }

    const insights = [
        `Difficulty score: ${roundedDifficultyScore}/100 (${difficultyLevel})`,
        `Marks balance status: ${balanceStatus}`
    ];

    if (averageScore !== null) {
        insights.push(`Average student score: ${averageScore}`);
    }
    if (passRate !== null) {
        insights.push(`Pass rate: ${passRate}%`);
    }

    if (denominator > 0 && Math.abs(distributionTotal - denominator) > 0.001) {
        insights.push(
            `Marks distribution total (${distributionTotal}) does not match total marks (${denominator}).`
        );
    }

    const suggestions = [];
    if (difficultyLevel === "Hard") {
        suggestions.push("Reduce the proportion of hard questions or rebalance marks for accessibility.");
    }
    if (difficultyLevel === "Easy") {
        suggestions.push("Increase medium/hard question ratio to improve assessment rigor.");
    }
    if (isImbalanced) {
        suggestions.push("Redistribute marks more evenly across sections.");
    }
    if (passRate !== null && passRate < 50) {
        suggestions.push("Consider more scaffolded questions to improve pass rates.");
    }
    if (suggestions.length === 0) {
        suggestions.push("Current setup looks balanced. Reuse this blueprint for future assessments.");
    }

    return {
        difficultyLevel,
        difficultyScore: roundedDifficultyScore,
        balanceStatus,
        averageScore,
        passRate,
        performanceGap,
        insights,
        suggestions
    };
};

module.exports = { analyzeAssessment };
