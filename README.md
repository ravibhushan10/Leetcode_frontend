# CodeForge — Full-Stack Competitive Coding Platform

A modern, full-stack competitive coding platform with **AI-powered tutoring**, real-time code execution, mock interviews, and an ML-driven dashboard. Built with React, Vite, Node.js, and MongoDB — featuring a LeetCode-style problem solver, global leaderboard, Razorpay payments, and Firebase OAuth.

---


## 📸 Screenshots

<table align="center">
  <tr>
    <td align="center">
      <img src="screenshots/fornt.png" ><br/>
      <em>Home Page</em>
    </td>
    <td align="center">
      <img src="screenshots/first.png" ><br/>
      <em>Sign up section</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/second.png" ><br/>
      <em>Login section</em>
    </td>
    <td align="center">
      <img src="screenshots/third.png"><br/>
      <em>Toggle theme</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/fourth.png" ><br/>
      <em>Resume creation</em>
    </td>
     <td align="center">
      <img src="screenshots/fifth.png" ><br/>
      <em>Download Resume</em>
    </td>
  </tr>
</table>

---

## 🌐 [Live Demo](https://codeforgeai.in)

## 🌟 Features

### ⚡ Real Code Execution
- Judge0-powered code runner supporting **C++, Python, Java, C, and JavaScript**
- Run against sample test cases or submit against all hidden test cases
- Live verdict: Accepted, Wrong Answer, Runtime Error, TLE, Compilation Error

### 🤖 AI Tutor & Code Review
- Groq **LLaMA 3.3 70B**-powered AI tutor embedded in the problem solver
- Gives hints, approach strategies, and complexity analysis without spoiling solutions
- AI Code Review for Pro users — feedback on submitted solutions

### 💼 Problem Library
- 160+ handcrafted DSA problems with difficulty ratings (Easy / Medium / Hard)
- Company tags (Google, Amazon, Microsoft, Facebook, Apple, etc.)
- Premium problem lock with Pro plan unlock
- "Pick Random" for spontaneous practice

### 📊 ML-Powered Dashboard (Pro)
- **Weakness Radar** — SVG radar chart showing accuracy per DSA topic
- **Interview Readiness Score** — per-company readiness based on solved problems
- **Smart Recommendations** — ML picks the best next problems based on weak tags
- **30-Day Study Plan** — personalised milestones with progress bars
- **Submission Heatmap** — GitHub-style activity calendar

### 🎤 Mock Interview Mode (Pro)
- Choose target company (Google, Amazon, Microsoft, etc.) and duration (45/90/120 min)
- 3 problems picked (1 Easy, 1 Medium, 1 Hard) from company-tagged pool
- Countdown timer with urgency alerts
- Scored result on completion

### 🏆 Leaderboard & Rating
- Global leaderboard ranked by rating points
- Rating titles from Beginner → Legendary Coder
- Streak tracking, coin system, and podium display for top 3

### 💳 Razorpay Payments
- Monthly (₹10) and yearly (₹50) Pro plans
- Webhook-based payment verification
- Transparent fee breakdown (gateway + GST)

### 🔐 Auth System
- Email/password with 6-digit OTP verification
- Google & GitHub OAuth via Firebase
- JWT access tokens (15 min) + HTTP-only refresh tokens (1 year)
- Forgot password with OTP-based reset flow
- Automatic cleanup of unverified accounts after 24 hours

### 🎨 UI/UX
- Fully responsive — mobile, tablet, desktop
- Dark theme with CSS variable design token system
- Resizable split-panel problem solver
- Page transition animations and skeleton loaders
- Offline detection banner

---

## 🛠️ Technologies Used

### Frontend 

| Technology             | Purpose                        | Version  |
|------------------------|--------------------------------|----------|
| React                  | UI Framework                   | 18+      |
| Vite                   | Build Tool                     | 5+       |
| React Router DOM       | Client-side Routing            | 6+       |
| TanStack React Query   | Data Fetching & Caching        | 5+       |
| Axios                  | HTTP Client                    | 1+       |
| Firebase               | Google & GitHub OAuth          | 10+      |
| React Icons            | Icon Library                   | 5+       |
| React Helmet Async     | SEO & Meta Tags                | 3+       |
| CSS Modules            | Component-scoped Styling       | —        |

### Backend 

| Technology          | Purpose                        | Version |
|---------------------|--------------------------------|---------|
| Node.js             | Runtime Environment            | 18+     |
| Express.js          | Web Framework                  | 4+      |
| MongoDB + Mongoose  | Database & ODM                 | 8+      |
| bcryptjs            | Password Hashing               | 2+      |
| jsonwebtoken        | JWT Auth                       | 9+      |
| Nodemailer          | Transactional Email (dev)      | 6+      |
| Resend HTTP API     | Transactional Email (prod)     | —       |
| Razorpay            | Payment Processing             | 2+      |
| Multer + Sharp      | File Upload & Image Processing | —       |
| node-fetch          | Groq AI API calls              | 3+      |
| dotenv              | Environment Variables          | 16+     |
| cors                | Cross-Origin Resource Sharing  | 2+      |
| cookie-parser       | HTTP Cookie Parsing            | 1+      |
| express-rate-limit  | API Rate Limiting              | 8+      |

### Admin Panel 

| Technology | Purpose         | Version |
|------------|-----------------|---------|
| React      | UI Framework    | 18+     |
| Vite       | Build Tool      | 5+      |

### DevOps & Tools

| Tool      | Purpose               |
|-----------|-----------------------|
| Vercel    | Frontend Deployment   |
| Render    | Backend Deployment    |
| Judge0    | Code Execution Engine |
| Nodemon   | Dev Server Auto-reload|
| Git       | Version Control       |

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18.0.0`
- npm `>= 8.0.0`
- MongoDB URI (Atlas or local)
- Groq API key ([get one free at console.groq.com](https://console.groq.com))
- Firebase project with Google & GitHub auth enabled
- Razorpay account (for payment features)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ravibhushan10/CodeforgeAI.git
   cd codeforge
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Install Admin Dependencies**
   ```bash
   cd admin
   npm install
   ```

5. **Backend Environment Variables — create `.env` in `backend/`**
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   REFRESH_TOKEN_SECRET=any_random_long_string
   GROQ_API_KEY=your_groq_api_key
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   FRONTEND_URL=http://localhost:5173
   ADMIN_URL=http://localhost:3001
   GMAIL_USER=yourname@gmail.com
   GMAIL_PASS=xxxx_xxxx_xxxx_xxxx
   NODE_ENV=development
   ```

6. **Frontend Environment Variables — create `.env` in `frontend/`**
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
   ```

7. **Start the Backend**
   ```bash
   cd backend
   npm run dev
   # Server runs on http://localhost:5000
   ```

8. **Start the Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   # Client runs on http://localhost:5173
   ```

9. **Start the Admin Panel** (optional, in a new terminal)
   ```bash
   cd admin
   npm run dev
   # Admin runs on http://localhost:5174
   ```

---

## 📖 Usage Guide

### Navigating the Platform

- **Home** — Landing page with hero section and features overview
- **Problems** — Browse all DSA problems with filters by difficulty, tag, and company
- **Problem Solver** — Split-panel editor with description, AI Tutor, and submission tabs
- **Dashboard** — ML insights, submission heatmap, and Pro features
- **Leaderboard** — Global ranking by rating points
- **Profile** — Personal stats, badge collection, and submission history

### Using the Problem Solver

1. Navigate to **Problems** and click any problem
2. Select your preferred language (C++, Python, Java, C, JavaScript)
3. Write your solution in the code editor
4. Click **▶ Run** to test against sample cases
5. Click **Submit** to judge against all hidden test cases
6. Use the **AI Tutor** tab for hints without spoilers

### Using the Admin Panel

1. Navigate to `http://localhost:5174`
2. Sign in with an admin account
3. Manage problems (add, edit, delete, bulk upload JSON)
4. Toggle premium status per problem
5. View and manage registered users
6. Check platform statistics

---

## 📁 Project Structure

```
codeforge/
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Navbar.jsx
│   │   │   ├── AuthModals.jsx # Login + Register with OTP flow
│   │   │   ├── PaymentModal.jsx
│   │   │   ├── MockInterview.jsx
│   │   │   ├── WeaknessRadar.jsx
│   │   │   └── ReadinessScore.jsx
│   │   ├── context/
│   │   │   └── AppContext.jsx  # Global auth + toast state
│   │   ├── hooks/
│   │   │   ├── useAuth.js      # Firebase OAuth hook
│   │   │   └── useResizable.js # Drag-to-resize panels
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Problems.jsx
│   │   │   ├── Solve.jsx       # Split-panel problem solver
│   │   │   ├── Dashboard.jsx   # ML insights
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── Help.jsx
│   │   └── styles/
│   │       └── globals.css     # Design token system
│   └── vite.config.js
│
├── backend/
│   └── src/
│       ├── models/
│       │   ├── User.js
│       │   ├── Problem.js
│       │   └── Submission.js
│       ├── routes/
│       │   ├── users.js        # Auth, profile, leaderboard
│       │   ├── problems.js     # CRUD + bulk import
│       │   ├── submissions.js  # Run + Submit + Judge0 integration
│       │   ├── ai.js           # Groq AI hint + code review
│       │   └── payments.js     # Razorpay order + verify + webhook
│       ├── middleware/
│       │   └── auth.js         # JWT + admin middleware
│       ├── utils/
│       │   └── sendEmail.js    # Resend (prod) / Gmail (dev)
│       └── server.js
│
└── admin/
    └── src/
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── ProblemsPage.jsx
        │   ├── UsersPage.jsx
        │   └── StatsPage.jsx
        └── components/
            ├── ProblemModal.jsx
            └── DeleteByNumModal.jsx
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint                         | Description                    |
|--------|----------------------------------|--------------------------------|
| POST   | `/api/users/register`            | Register with email/password   |
| POST   | `/api/users/verify-otp-register` | Verify registration OTP        |
| POST   | `/api/users/login`               | Login with email/password      |
| POST   | `/api/users/logout`              | Invalidate refresh token       |
| POST   | `/api/users/refresh`             | Refresh access token           |
| POST   | `/api/users/oauth`               | Google / GitHub OAuth login    |
| POST   | `/api/users/forgot-password`     | Send password reset OTP        |
| POST   | `/api/users/verify-otp`          | Verify reset OTP               |
| POST   | `/api/users/reset-password`      | Set new password                |

### Problems
| Method | Endpoint                          | Description                  |
|--------|-----------------------------------|------------------------------|
| GET    | `/api/problems`                   | List problems (with filters) |
| GET    | `/api/problems/:slug`             | Get single problem           |
| POST   | `/api/problems`                   | Create problem (admin)       |
| PUT    | `/api/problems/:id`               | Update problem (admin)       |
| DELETE | `/api/problems/:id`               | Delete & renumber (admin)    |
| POST   | `/api/problems/bulk`              | Bulk import JSON (admin)     |
| PATCH  | `/api/problems/:id/toggle-premium`| Toggle premium flag (admin)  |

### Submissions
| Method | Endpoint               | Description                       |
|--------|------------------------|-----------------------------------|
| POST   | `/api/submissions/run` | Run code against sample test cases|
| POST   | `/api/submissions`     | Submit for full judgement         |
| GET    | `/api/submissions/me`  | Get user's submission history     |

### AI
| Method | Endpoint           | Description                    |
|--------|--------------------|--------------------------------|
| POST   | `/api/ai/hint`     | Get AI hint / tutor response   |
| POST   | `/api/ai/analyze`  | AI code review (Pro)           |

### Payments
| Method | Endpoint                   | Description                  |
|--------|----------------------------|------------------------------|
| POST   | `/api/payments/order`      | Create Razorpay order        |
| POST   | `/api/payments/verify`     | Verify payment signature     |
| POST   | `/api/payments/webhook`    | Razorpay webhook handler     |
| GET    | `/api/payments/status`     | Get user's subscription status|

---

## 🔮 Planned Improvements

- [ ] Contests with real-time leaderboard updates
- [ ] Discussion forum per problem
- [ ] Editorial / official solution after solve
- [ ] Code execution via self-hosted Judge0 instance
- [ ] Multi-language i18n support
- [ ] PWA with offline support
- [ ] Email digest of recommended problems

---

## 👨‍💻 Author

**Ravi Bhushan**

- 💼 LinkedIn: [https://www.linkedin.com/in/ravibhushan-kumar-55b312344](https://www.linkedin.com/in/ravibhushan-kumar-55b312344/)
-  🌐 Portfolio: [https://ravibhushan-portfolio.vercel.app](https://ravibhushan-portfolio.vercel.app)
- 🐙 GitHub: [@ravibhushan10](https://github.com/ravibhushan10)
- 📧 Email: ravibhushankumar87tp@gmail.com

---

<div align="center">

### ⭐ Star this repository if it helped you!

**Made with ❤️ by Ravi Bhushan**

[Live Demo](https://codeforgeai.in) · [Report Bug](https://github.com/ravibhushan10/CodeforgeAI/issues) · [Request Feature](https://github.com/ravibhushan10/CodeforgeAI/issues)

</div>
