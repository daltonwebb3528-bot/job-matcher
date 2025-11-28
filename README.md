# JobMatch AI

Upload your resume, find matching jobs, and get AI-powered suggestions to tailor your resume for each opportunity.

## Features

- **Resume Parsing** - Upload PDF or Word documents, AI extracts your skills and experience
- **Job Matching** - Searches job boards and ranks results by relevance to your background  
- **AI Tailoring** - Get specific recommendations on how to improve your resume for each job

## Quick Setup

### 1. Get Your API Keys

You'll need:
- **Anthropic API Key** (required) - [Get one here](https://console.anthropic.com/)
- **Adzuna API Keys** (optional) - [Get them here](https://developer.adzuna.com/)

The app works with mock job data if you don't have Adzuna keys yet.

### 2. Deploy to Vercel

The easiest way to deploy:

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import your repository
4. Add your environment variables:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `ADZUNA_APP_ID` = your Adzuna app ID (optional)
   - `ADZUNA_APP_KEY` = your Adzuna app key (optional)
5. Click "Deploy"

### 3. Connect Your Domain

After deploying:
1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Follow Vercel's instructions to update your DNS settings

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local file with your API keys
cp .env.example .env.local
# Edit .env.local and add your keys

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **Claude AI** - Resume parsing and tailoring recommendations
- **Adzuna API** - Job listings

## Project Structure

```
job-matcher/
├── app/
│   ├── api/
│   │   ├── parse-resume/    # Handles resume upload and parsing
│   │   ├── search-jobs/     # Searches job APIs
│   │   └── tailor-resume/   # AI analysis and recommendations
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main app component
├── .env.example             # Environment variables template
├── package.json
└── README.md
```

## Need Help?

If something isn't working:
1. Make sure your API keys are set correctly in Vercel
2. Check the Vercel deployment logs for errors
3. The app will use mock job data if Adzuna keys aren't set - this is normal for testing
