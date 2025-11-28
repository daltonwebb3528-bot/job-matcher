import { NextRequest, NextResponse } from 'next/server'

interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  description: string
  salary_min?: number
  salary_max?: number
  created: string
  redirect_url: string
}

export async function POST(request: NextRequest) {
  try {
    const { skills, experience } = await request.json()
    
    // Build search query from skills
    const searchTerms = skills.slice(0, 5).join(' ')
    
    const appId = process.env.ADZUNA_APP_ID
    const appKey = process.env.ADZUNA_APP_KEY
    
    if (!appId || !appKey) {
      // Return mock data if API keys aren't set
      return NextResponse.json({
        jobs: getMockJobs(skills)
      })
    }

    // Search Adzuna API
    const country = 'us' // Could be made configurable
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(searchTerms)}&content-type=application/json`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Adzuna API error:', response.status)
      return NextResponse.json({
        jobs: getMockJobs(skills)
      })
    }

    const data = await response.json()
    
    // Transform and score jobs
    const jobs = data.results.map((job: AdzunaJob) => {
      const matchScore = calculateMatchScore(job, skills)
      return {
        id: job.id,
        title: job.title,
        company: job.company?.display_name || 'Unknown Company',
        location: job.location?.display_name || 'Remote',
        description: job.description,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        created: job.created,
        redirect_url: job.redirect_url,
        matchScore
      }
    })

    // Sort by match score
    jobs.sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore)

    return NextResponse.json({ jobs })

  } catch (error) {
    console.error('Error searching jobs:', error)
    return NextResponse.json({ error: 'Failed to search jobs' }, { status: 500 })
  }
}

function calculateMatchScore(job: AdzunaJob, skills: string[]): number {
  if (!skills || skills.length === 0) return 50
  
  const jobText = `${job.title} ${job.description}`.toLowerCase()
  let matches = 0
  
  for (const skill of skills) {
    if (jobText.includes(skill.toLowerCase())) {
      matches++
    }
  }
  
  const score = Math.round((matches / skills.length) * 100)
  return Math.min(Math.max(score, 20), 98) // Keep between 20-98
}

function getMockJobs(skills: string[]): any[] {
  // Return mock jobs for testing without API keys
  const mockJobs = [
    {
      id: '1',
      title: 'Senior Software Engineer',
      company: 'TechCorp Inc',
      location: 'San Francisco, CA',
      description: 'We are looking for a talented software engineer to join our team. You will work on cutting-edge projects using modern technologies. Requirements include experience with JavaScript, React, Node.js, and cloud platforms like AWS. Strong problem-solving skills and ability to work in an agile environment are essential.',
      salary_min: 150000,
      salary_max: 200000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1',
      matchScore: 85
    },
    {
      id: '2',
      title: 'Full Stack Developer',
      company: 'StartupXYZ',
      location: 'New York, NY',
      description: 'Join our fast-growing startup as a full stack developer. You will build features end-to-end using React on the frontend and Python/Django on the backend. Experience with PostgreSQL, Docker, and CI/CD pipelines is a plus. We value creativity, initiative, and a passion for building great products.',
      salary_min: 120000,
      salary_max: 160000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2',
      matchScore: 78
    },
    {
      id: '3',
      title: 'Data Analyst',
      company: 'Analytics Co',
      location: 'Remote',
      description: 'We are seeking a data analyst to help us make data-driven decisions. You will analyze large datasets, create visualizations, and present insights to stakeholders. Proficiency in SQL, Python, and data visualization tools like Tableau is required. Experience with machine learning is a bonus.',
      salary_min: 90000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3',
      matchScore: 72
    },
    {
      id: '4',
      title: 'Product Manager',
      company: 'BigTech Ltd',
      location: 'Seattle, WA',
      description: 'Lead product development from conception to launch. Work closely with engineering, design, and marketing teams to deliver exceptional products. Strong communication skills, analytical thinking, and experience with agile methodologies required. Technical background is a plus.',
      salary_min: 140000,
      salary_max: 180000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4',
      matchScore: 65
    },
    {
      id: '5',
      title: 'DevOps Engineer',
      company: 'CloudFirst',
      location: 'Austin, TX',
      description: 'Build and maintain our cloud infrastructure on AWS. Experience with Kubernetes, Docker, Terraform, and CI/CD pipelines required. You will work on improving deployment processes, monitoring systems, and ensuring high availability of our services.',
      salary_min: 130000,
      salary_max: 170000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5',
      matchScore: 60
    }
  ]
  
  // Recalculate match scores based on actual skills
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job as unknown as AdzunaJob, skills)
  })).sort((a, b) => b.matchScore - a.matchScore)
}
