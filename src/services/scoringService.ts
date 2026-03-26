import { Transaction, CreditScore } from '../types';

export const calculateCreditScore = (transactions: Transaction[], uid: string): CreditScore => {
  if (transactions.length === 0) {
    return {
      uid,
      score: 300,
      velocityScore: 0,
      consistencyScore: 0,
      resilienceScore: 0,
      socialProofScore: 0,
      lastCalculated: new Date().toISOString(),
      insights: "No transaction data found. Start by uploading your MoMo logs or trade ledgers."
    };
  }

  // 1. Velocity & Volume (40%)
  const totalIn = transactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.amount, 0);
  const velocity = transactions.length;
  // Normalize: 100 transactions/month = 1.0, 1M UGX/month = 1.0 (simplified)
  const normalizedVelocity = Math.min(velocity / 50, 1) * 0.5 + Math.min(totalIn / 5000000, 1) * 0.5;
  const velocityScore = normalizedVelocity * 100;

  // 2. Consistency (30%) - Utility payments
  const utilityPayments = transactions.filter(t => t.category === 'Utility');
  const normalizedConsistency = Math.min(utilityPayments.length / 4, 1); // 4 utility payments/month = 1.0
  const consistencyScore = normalizedConsistency * 100;

  // 3. Resilience (20%) - IN vs OUT ratio
  const totalOut = transactions.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.amount, 0);
  const ratio = totalIn > 0 ? (totalIn - totalOut) / totalIn : 0;
  const normalizedResilience = Math.max(0, Math.min(ratio * 2, 1)); // 50% savings = 1.0
  const resilienceScore = normalizedResilience * 100;

  // 4. Social Proof/Trade (10%)
  const tradeTransactions = transactions.filter(t => t.category === 'Trade');
  const normalizedSocial = Math.min(tradeTransactions.length / 5, 1);
  const socialProofScore = normalizedSocial * 100;

  // Final Score S = sum(weight_i * normalized_value_i)
  // Weights: 0.4, 0.3, 0.2, 0.1
  const S_normalized = (velocityScore * 0.4) + (consistencyScore * 0.3) + (resilienceScore * 0.2) + (socialProofScore * 0.1);
  
  // Scale to 300 - 850
  const finalScore = Math.round(300 + (S_normalized / 100) * (850 - 300));

  let insights = "";
  if (finalScore > 700) insights = "Excellent trust profile. You are eligible for higher loan limits at lower interest rates.";
  else if (finalScore > 500) insights = "Good progress. Increase your trade ledger entries to boost your score further.";
  else insights = "High risk. Try to maintain a higher balance in your MoMo account and pay utilities consistently.";

  return {
    uid,
    score: finalScore,
    velocityScore,
    consistencyScore,
    resilienceScore,
    socialProofScore,
    lastCalculated: new Date().toISOString(),
    insights
  };
};
