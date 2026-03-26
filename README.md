# CrediSense – Alternative AI Credit Scoring

**CrediSense** is a fintech platform designed to bridge the "missing middle" in East Africa's informal economy. By turning informal digital footprints—Mobile Money (MoMo) logs, utility bills (Yaka!, Water), and trade ledgers—into a robust **Trust Score**, we empower the unbanked to build a digital credit identity.

## 🚀 Key Features

- **AI Scoring Brain**: A weighted mathematical model ($S = \sum weight_i \times normalized\_value_i$) that analyzes:
  - **Velocity & Volume (40%)**: Frequency and amount of Mobile Money movement.
  - **Consistency (30%)**: Timely payment of utility bills (Water, Umeme/Yaka).
  - **Resilience (20%)**: Savings ratio and balance maintenance.
  - **Social Proof/Trade (10%)**: Digital ledger entries from local suppliers.
- **Gemini OCR Integration**: Upload screenshots of MoMo receipts or utility bills. The app uses Google's Gemini AI to extract transaction details (amount, date, category) automatically.
- **Credit Passport**: Export a verified JSON "Credit Passport" containing your profile, score breakdown, and transaction history to share with SACCOs or Fintech lenders.
- **Technical Dashboard**: A high-precision, data-dense interface designed for professional financial monitoring.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4.
- **Backend**: Firebase (Authentication, Firestore).
- **AI**: Google Generative AI SDK (Gemini 3 Flash).
- **Visualization**: Recharts (Radar & Bar charts).
- **Icons**: Lucide React.

## 🧠 Scoring Logic

The final Trust Score is scaled between **300 (High Risk)** and **850 (Exceptional Trust)**.

| Metric | Weight | Description |
| :--- | :--- | :--- |
| **Velocity** | 40% | Measures cash flow health and transaction frequency. |
| **Consistency** | 30% | Tracks recurring utility payments as a proxy for reliability. |
| **Resilience** | 20% | Analyzes the ratio of income vs. expenses (savings capacity). |
| **Social Proof** | 10% | Validates trade relationships through digital ledger entries. |

## ⚙️ Setup & Configuration

### 1. Environment Variables
Ensure the following variables are set in your environment or `.env` file:
- `GEMINI_API_KEY`: Your Google AI Studio API key.
- `APP_URL`: The base URL of your application.

### 2. Firebase Configuration
The project requires a `src/firebase-applet-config.json` file with your Firebase project credentials:
```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "..."
}
```

### 3. Firestore Security Rules
The project includes a `firestore.rules` file that enforces:
- **Ownership-only access**: Users can only read/write their own profiles, scores, and transactions.
- **Data Validation**: Strict type and schema checking for all incoming data.
- **Admin Overrides**: Secure access for authorized administrators.

## 🛡️ Security & Privacy

CrediSense is built with a "Privacy First" approach:
- **PII Protection**: Personally Identifiable Information is strictly scoped to the document owner.
- **Immutable Metadata**: Critical fields like `uid` and `createdAt` are protected from tampering via security rules.
- **No Mixed Content**: Sensitive data is never co-mingled with public profiles.

## 🌍 Vision

In East Africa, a "thin file" doesn't mean a bad borrower; it means a hidden opportunity. CrediSense transforms raw, messy, informal data into a clean 'Credit Passport' that unlocks financial inclusion for millions.

---
*Developed for the East African Informal Economy (Kampala, Nairobi, Kigali).*
