/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, CreditScore, Transaction } from './types';
import { calculateCreditScore } from './services/scoringService';
import { analyzeReceipt } from './services/geminiService';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  Plus, 
  Upload, 
  History, 
  ShieldCheck, 
  LogOut, 
  Zap, 
  TrendingUp, 
  Users, 
  AlertCircle,
  Loader2,
  Camera,
  FileJson,
  FileText,
  ChevronDown
} from 'lucide-react';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [score, setScore] = useState<CreditScore | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDocFromServer(userRef);
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'Anonymous Trader',
            email: u.email || '',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    const scoreUnsub = onSnapshot(doc(db, 'scores', user.uid), (snap) => {
      if (snap.exists()) setScore(snap.data() as CreditScore);
    });

    const transQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );
    const transUnsub = onSnapshot(transQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(list);
    });

    return () => {
      profileUnsub();
      scoreUnsub();
      transUnsub();
    };
  }, [user]);

  // Recalculate Score when transactions change
  useEffect(() => {
    if (user && transactions.length > 0) {
      const newScore = calculateCreditScore(transactions, user.uid);
      setDoc(doc(db, 'scores', user.uid), newScore);
    }
  }, [transactions, user]);

  const handleLogin = async () => {
    setAppError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameters to force account selection if needed
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      setAppError(error.message || "Failed to sign in. Please check if popups are blocked.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const data = await analyzeReceipt(base64);
      if (data.amount) {
        await addDoc(collection(db, 'transactions'), {
          ...data,
          uid: user.uid,
          date: data.date || new Date().toISOString()
        });
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExportJSON = () => {
    if (!user) return;
    const passport = {
      profile,
      score,
      recentTransactions: transactions.slice(0, 10),
      timestamp: new Date().toISOString(),
      verificationId: Math.random().toString(36).substring(7).toUpperCase()
    };
    const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CrediSense_Passport_${user.uid.substring(0, 6)}.json`;
    a.click();
    setShowExportMenu(false);
  };

  const handleExportPDF = async () => {
    if (!passportRef.current || !user) return;
    setIsExporting(true);
    setShowExportMenu(false);

    try {
      // Use a more reliable way to show the element for capture
      const element = passportRef.current;
      element.style.display = 'block';
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.zIndex = '-1';

      // Wait a bit for layout
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#E4E3E0',
        logging: true,
        useCORS: true,
        allowTaint: true,
        windowWidth: 800
      });

      element.style.display = 'none';
      element.style.position = 'static';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`CrediSense_Passport_${user.uid.substring(0, 6)}.pdf`);
    } catch (error) {
      console.error('PDF Export failed', error);
      setAppError('PDF Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("Starting full data deletion for user:", user.uid);
      
      const batch = writeBatch(db);

      // 1. Delete all transactions
      const transQuery = query(collection(db, 'transactions'), where('uid', '==', user.uid));
      const transSnap = await getDocs(transQuery);
      console.log(`Found ${transSnap.size} transactions to delete`);
      transSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 2. Delete score
      const scoreRef = doc(db, 'scores', user.uid);
      batch.delete(scoreRef);

      // 3. Delete user profile
      const userRef = doc(db, 'users', user.uid);
      batch.delete(userRef);

      // 4. Commit all deletions
      await batch.commit();
      console.log("Firestore data deletion committed successfully");
      
      // 5. Sign out
      await signOut(auth);
      // We'll use a local state to show success if needed, but signout will redirect to login
      window.location.reload(); 
    } catch (e: any) {
      console.error("Deletion Error:", e);
      setAppError("Failed to delete data. Please try again later.");
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
      setShowPrivacyModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#141414] w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-6xl font-serif italic tracking-tighter">CrediSense</h1>
            <p className="text-sm uppercase tracking-widest opacity-60">Alternative AI Credit Scoring</p>
          </div>
          <div className="p-8 border border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <p className="mb-8 text-lg leading-relaxed">
              Bridging the "missing middle" in East Africa. Turn your MoMo logs, Yaka! tokens, and trade ledgers into a Credit Passport.
            </p>
            {appError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {appError}
              </div>
            )}
            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-[#141414] text-[#E4E3E0] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Connect with Google
            </button>
          </div>
          <p className="text-[10px] opacity-40 uppercase">Trusted by SACCOs across Kampala, Nairobi & Kigali</p>
        </div>
      </div>
    );
  }

  const radarData = score ? [
    { subject: 'Velocity', A: score.velocityScore, fullMark: 100 },
    { subject: 'Consistency', A: score.consistencyScore, fullMark: 100 },
    { subject: 'Resilience', A: score.resilienceScore, fullMark: 100 },
    { subject: 'Social Proof', A: score.socialProofScore, fullMark: 100 },
  ] : [];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-4 sticky top-0 bg-[#E4E3E0]/80 backdrop-blur-md z-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-serif italic">CrediSense</h1>
            <div className="h-4 w-[1px] bg-[#141414]/20" />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">East Africa v1.0</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            >
              Privacy & Data
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-mono uppercase opacity-40">Connected As</p>
              <p className="text-xs font-bold">{profile?.displayName}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-full">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        {appError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {appError}
            </div>
            <button onClick={() => setAppError(null)} className="text-lg">&times;</button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Score & Stats */}
        <div className="lg:col-span-8 space-y-8">
          {/* Score Card */}
          <section className="border border-[#141414] bg-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <ShieldCheck className="w-48 h-48" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
              <div className="space-y-4">
                <h2 className="text-xs font-serif italic uppercase opacity-50">Trust Score</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-8xl font-mono font-bold tracking-tighter">{score?.score || 300}</span>
                  <span className="text-xl font-mono opacity-30">/ 850</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest w-fit">
                  <TrendingUp className="w-3 h-3" />
                  {score?.score && score.score > 600 ? 'High Trust' : 'Building Trust'}
                </div>
              </div>

              <div className="w-full sm:w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#141414" strokeOpacity={0.1} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#141414', fontSize: 10, fontFamily: 'monospace' }} />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#141414"
                      fill="#141414"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-[#141414]/10">
              <p className="text-sm font-serif italic leading-relaxed max-w-2xl">
                "{score?.insights}"
              </p>
            </div>
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Volume', value: `UGX ${transactions.reduce((s, t) => s + (t.type === 'IN' ? t.amount : 0), 0).toLocaleString()}`, icon: Zap },
              { label: 'Consistency', value: `${transactions.filter(t => t.category === 'Utility').length} Bills Paid`, icon: History },
              { label: 'Trade Proof', value: `${transactions.filter(t => t.category === 'Trade').length} Digital Ledger`, icon: Users },
            ].map((stat, i) => (
              <div key={i} className="border border-[#141414] p-4 bg-white flex flex-col justify-between h-32">
                <stat.icon className="w-5 h-5 opacity-20" />
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-40">{stat.label}</p>
                  <p className="text-lg font-bold truncate">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Transaction History */}
          <section className="border border-[#141414] bg-white overflow-hidden">
            <div className="p-4 border-b border-[#141414] flex justify-between items-center">
              <h2 className="text-xs font-serif italic uppercase opacity-50">Transaction Ledger</h2>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  OCR Receipt
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#141414]/10 bg-[#141414]/5">
                    <th className="p-4 text-[10px] font-mono uppercase opacity-40">Date</th>
                    <th className="p-4 text-[10px] font-mono uppercase opacity-40">Category</th>
                    <th className="p-4 text-[10px] font-mono uppercase opacity-40">Type</th>
                    <th className="p-4 text-[10px] font-mono uppercase opacity-40 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center opacity-30 italic">No transactions recorded yet.</td>
                    </tr>
                  ) : (
                    transactions.map((t, i) => (
                      <tr key={t.id || i} className="border-b border-[#141414]/5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-default">
                        <td className="p-4">{format(new Date(t.date), 'dd MMM yyyy')}</td>
                        <td className="p-4 uppercase tracking-tighter">{t.category}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold",
                            t.type === 'IN' ? "bg-green-100 text-green-800 group-hover:bg-green-900 group-hover:text-green-100" : "bg-red-100 text-red-800 group-hover:bg-red-900 group-hover:text-red-100"
                          )}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold">UGX {t.amount.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Actions & Insights */}
        <div className="lg:col-span-4 space-y-8">
          {/* Manual Entry */}
          <section className="border border-[#141414] bg-white p-6 space-y-6">
            <h2 className="text-xs font-serif italic uppercase opacity-50">Manual Entry</h2>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const amount = Number(formData.get('amount'));
              const type = formData.get('type') as 'IN' | 'OUT';
              const category = formData.get('category') as any;
              
              if (amount && user) {
                await addDoc(collection(db, 'transactions'), {
                  uid: user.uid,
                  amount,
                  type,
                  category,
                  date: new Date().toISOString(),
                  description: 'Manual entry'
                });
                form.reset();
              }
            }}>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-40">Amount (UGX)</label>
                <input name="amount" type="number" required className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase opacity-40">Type</label>
                  <select name="type" className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none">
                    <option value="IN">IN (Income)</option>
                    <option value="OUT">OUT (Expense)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase opacity-40">Category</label>
                  <select name="category" className="w-full p-2 border border-[#141414] font-mono text-sm focus:outline-none">
                    <option value="MoMo">MoMo</option>
                    <option value="Trade">Trade</option>
                    <option value="Utility">Utility</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-[#141414] text-[#E4E3E0] font-bold uppercase tracking-widest text-xs hover:bg-opacity-90 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            </form>
          </section>

          {/* Credit Passport Export */}
          <section className="border border-[#141414] bg-[#141414] text-[#E4E3E0] p-6 space-y-4 relative">
            <h2 className="text-xs font-serif italic uppercase opacity-50">Credit Passport</h2>
            <p className="text-xs leading-relaxed opacity-80">
              Generate a verified passport to share with SACCOs or Fintech partners for loan applications.
            </p>
            
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="w-full py-3 border border-[#E4E3E0] text-[#E4E3E0] font-bold uppercase tracking-widest text-xs hover:bg-[#E4E3E0] hover:text-[#141414] transition-all flex items-center justify-center gap-2"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Export Passport
                <ChevronDown className={cn("w-4 h-4 transition-transform", showExportMenu && "rotate-180")} />
              </button>

              {showExportMenu && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] z-50">
                  <button 
                    onClick={handleExportJSON}
                    className="w-full p-4 text-[#141414] text-left text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] flex items-center gap-3 transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    Download JSON
                  </button>
                  <div className="h-[1px] bg-[#141414]/10" />
                  <button 
                    onClick={handleExportPDF}
                    className="w-full p-4 text-[#141414] text-left text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] flex items-center gap-3 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Download PDF (Visual)
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Tips */}
          <div className="p-6 border border-[#141414] bg-white space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Growth Tip</h3>
            </div>
            <p className="text-xs leading-relaxed italic">
              "Paying your Yaka! tokens on the same day every month increases your Consistency Score by up to 15%."
            </p>
          </div>
        </div>
      </main>

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-[#141414] max-w-md w-full p-8 space-y-6 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif italic">Data Protection & Privacy</h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-2xl">&times;</button>
            </div>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>In accordance with data protection regulations, you have full control over your digital footprint on CrediSense.</p>
              
              <div className="space-y-2">
                <h3 className="font-bold uppercase text-[10px] tracking-widest">1. Data Portability</h3>
                <p className="text-xs opacity-60">Download a complete machine-readable copy of all your historical data, including transactions and trust scores.</p>
                <button 
                  onClick={handleExportJSON}
                  className="w-full py-2 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  Download My Data (JSON)
                </button>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#141414]/10">
                <h3 className="font-bold uppercase text-[10px] tracking-widest text-red-600">2. Right to Erasure</h3>
                <p className="text-xs opacity-60">Permanently delete your account and all associated data from our servers. This action is irreversible.</p>
                <div className="p-4 bg-red-50 border border-red-100 space-y-4">
                  <p className="text-[10px] text-red-800 italic">"I understand that this will delete all my Mobile Money logs, utility history, and my Trust Score permanently."</p>
                  {!showConfirmDelete ? (
                    <button 
                      onClick={() => setShowConfirmDelete(true)}
                      className="w-full py-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
                    >
                      Delete Everything
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-red-600">Are you absolutely sure? This is irreversible.</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleDeleteAllData}
                          className="flex-1 py-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700"
                        >
                          Yes, Delete
                        </button>
                        <button 
                          onClick={() => setShowConfirmDelete(false)}
                          className="flex-1 py-2 border border-[#141414] text-[10px] font-bold uppercase tracking-widest"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-3 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Hidden Passport Template for PDF Export */}
      <div 
        ref={passportRef} 
        style={{ display: 'none', width: '800px', backgroundColor: '#E4E3E0', color: '#141414' }} 
        className="p-12 font-sans"
      >
        <div className="border-4 border-[#141414] p-12 bg-white space-y-12">
          {/* Passport Header */}
          <div className="flex justify-between items-start border-b-2 border-[#141414] pb-8">
            <div className="space-y-2">
              <h1 className="text-6xl font-serif italic tracking-tighter">CrediSense</h1>
              <p className="text-sm uppercase tracking-widest" style={{ color: 'rgba(20, 20, 20, 0.6)' }}>Official Credit Passport</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Verification ID</p>
              <p className="text-lg font-bold font-mono">#{Math.random().toString(36).substring(7).toUpperCase()}</p>
              <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Issued On</p>
              <p className="text-xs font-bold">{format(new Date(), 'dd MMMM yyyy')}</p>
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="text-xs font-mono uppercase tracking-widest pb-2" style={{ color: 'rgba(20, 20, 20, 0.4)', borderBottom: '1px solid rgba(20, 20, 20, 0.1)' }}>Holder Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Full Name</p>
                  <p className="text-xl font-bold">{profile?.displayName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Business Sector</p>
                  <p className="text-lg font-bold">{profile?.businessType || 'General Trade'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Location</p>
                  <p className="text-lg font-bold">{profile?.location || 'East Africa'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-mono uppercase tracking-widest pb-2" style={{ color: 'rgba(20, 20, 20, 0.4)', borderBottom: '1px solid rgba(20, 20, 20, 0.1)' }}>Trust Analysis</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-8xl font-mono font-bold tracking-tighter">{score?.score || 300}</span>
                <span className="text-xl font-mono" style={{ color: 'rgba(20, 20, 20, 0.3)' }}>/ 850</span>
              </div>
              <div className="p-4 bg-[#141414] text-[#E4E3E0] text-xs font-bold uppercase tracking-widest text-center">
                {score?.score && score.score > 600 ? 'Verified High Trust' : 'Emerging Trust Profile'}
              </div>
            </div>
          </div>

          {/* Radar Visualization Placeholder (CSS based) */}
          <div className="grid grid-cols-4 gap-4 py-8 border-y" style={{ borderColor: 'rgba(20, 20, 20, 0.1)' }}>
            {[
              { label: 'Velocity', val: score?.velocityScore },
              { label: 'Consistency', val: score?.consistencyScore },
              { label: 'Resilience', val: score?.resilienceScore },
              { label: 'Social Proof', val: score?.socialProofScore },
            ].map((m, i) => (
              <div key={i} className="text-center space-y-2">
                <p className="text-[10px] font-mono uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>{m.label}</p>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(20, 20, 20, 0.1)' }}>
                  <div className="h-full bg-[#141414]" style={{ width: `${m.val}%` }} />
                </div>
                <p className="text-xs font-bold font-mono">{Math.round(m.val || 0)}%</p>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>AI Auditor Insights</h3>
            <p className="text-lg font-serif italic leading-relaxed border-l-4 border-[#141414] pl-6 py-2">
              "{score?.insights}"
            </p>
          </div>

          {/* Recent Ledger */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Recent Verified Ledger</h3>
            <table className="w-full text-left border-collapse font-mono text-[10px]">
              <thead>
                <tr className="border-b border-[#141414]" style={{ backgroundColor: 'rgba(20, 20, 20, 0.05)' }}>
                  <th className="p-2 uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Date</th>
                  <th className="p-2 uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Category</th>
                  <th className="p-2 uppercase" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Type</th>
                  <th className="p-2 uppercase text-right" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(20, 20, 20, 0.05)' }}>
                    <td className="p-2">{format(new Date(t.date), 'dd MMM yyyy')}</td>
                    <td className="p-2 uppercase">{t.category}</td>
                    <td className="p-2 font-bold">{t.type}</td>
                    <td className="p-2 text-right font-bold">UGX {t.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="pt-12 flex justify-between items-end" style={{ color: 'rgba(20, 20, 20, 0.4)' }}>
            <div className="space-y-1">
              <p className="text-[8px] font-mono uppercase">Generated by CrediSense AI Engine</p>
              <p className="text-[8px] font-mono uppercase">Kampala • Nairobi • Kigali</p>
            </div>
            <div className="text-right">
              <ShieldCheck className="w-12 h-12" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#141414] p-8 text-center space-y-4">
        <p className="text-[10px] font-mono uppercase opacity-40">© 2026 CrediSense AI • Financial Inclusion for the Informal Economy</p>
        <div className="flex justify-center gap-4 opacity-20">
          <div className="w-8 h-8 rounded-full border border-[#141414]" />
          <div className="w-8 h-8 rounded-full border border-[#141414]" />
          <div className="w-8 h-8 rounded-full border border-[#141414]" />
        </div>
      </footer>
    </div>
  );
}
