# Blue to New - Law Enforcement Career Transition

Help law enforcement professionals translate their skills and find meaningful careers in the private sector.

## Features

- **Two Entry Paths**: Answer questions OR upload existing resume
- **Guided Questionnaire**: Built specifically for LE backgrounds - asks about rank, units, certifications
- **AI Skills Translation**: Converts LE jargon into corporate-friendly language
- **Job Matching**: Finds positions that value LE experience (security, investigations, compliance, etc.)
- **AI Resume Tailoring**: Premium feature - specific suggestions for each job application

## Monetization

- **Free tier**: Questionnaire/upload, profile translation, job browsing
- **Premium ($15/month)**: AI-powered resume tailoring for each job

## Quick Setup

### 1. Get Your API Keys

- **Anthropic API Key** (required) - [console.anthropic.com](https://console.anthropic.com/)
- **Adzuna API Keys** (optional) - [developer.adzuna.com](https://developer.adzuna.com/)

### 2. Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `ADZUNA_APP_ID` (optional)
   - `ADZUNA_APP_KEY` (optional)
4. Deploy

### 3. Connect Your Domain

In Vercel project settings → Domains → Add your domain

## Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev
```

## Tech Stack

- Next.js 14
- Tailwind CSS
- Claude AI (Anthropic)
- Adzuna Jobs API

## Project Structure

```
le-transition/
├── app/
│   ├── api/
│   │   ├── parse-resume/        # Resume upload handling
│   │   ├── translate-experience/ # LE → Corporate translation
│   │   ├── search-jobs/         # Job search API
│   │   └── tailor-resume/       # AI tailoring (premium)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Main app with questionnaire
├── .env.example
├── package.json
└── README.md
```

## Target Audience

- Police officers (all ranks)
- Sheriffs / Deputies
- State troopers
- Federal agents
- Corrections officers
- Military police

## Target Jobs

The app focuses on roles that value LE experience:
- Corporate Security
- Fraud Investigation
- Risk Management
- Compliance
- Loss Prevention
- Private Investigation
- Government Contractors
- HR / Workplace Investigations
