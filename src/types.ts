export interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  phoneNumber?: string;
  businessType?: 'Retail' | 'Service' | 'Agriculture' | 'Other';
  location?: string;
  createdAt?: string;
}

export interface CreditScore {
  uid: string;
  score: number;
  velocityScore: number;
  consistencyScore: number;
  resilienceScore: number;
  socialProofScore: number;
  lastCalculated: string;
  insights: string;
}

export interface Transaction {
  id?: string;
  uid: string;
  amount: number;
  type: 'IN' | 'OUT';
  category: 'MoMo' | 'Trade' | 'Utility' | 'Other';
  date: string;
  description?: string;
}

export interface CreditPassport {
  profile: UserProfile;
  score: CreditScore;
  recentTransactions: Transaction[];
}
