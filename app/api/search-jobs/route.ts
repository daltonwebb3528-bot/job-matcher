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

interface USAJobsResult {
  MatchedObjectId: string
  MatchedObjectDescriptor: {
    PositionTitle: string
    OrganizationName: string
    PositionLocation: { LocationName: string }[]
    PositionRemuneration: { MinimumRange: string; MaximumRange: string }[]
    UserArea: { Details: { JobSummary: string } }
    PositionStartDate: string
    PositionURI: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const { skills, targetRoles, keywords, location } = await request.json()
    
    console.log('Search request received:', { skills, targetRoles, keywords, location })
    
    const allJobs: any[] = []
    
    // Search Adzuna
    const adzunaJobs = await searchAdzuna(skills, targetRoles, keywords, location)
    console.log('Adzuna returned:', adzunaJobs.length, 'jobs')
    allJobs.push(...adzunaJobs)
    
    // Search USAJobs
    const usaJobs = await searchUSAJobs(skills, targetRoles, keywords, location)
    console.log('USAJobs returned:', usaJobs.length, 'jobs')
    allJobs.push(...usaJobs)
    
    // If no API results, use mock data
    if (allJobs.length === 0) {
      console.log('No API results, using mock data')
      return NextResponse.json({
        jobs: getMockJobs(skills, targetRoles, keywords)
      })
    }
    
    // Sort all jobs by match score
    allJobs.sort((a, b) => b.matchScore - a.matchScore)

    return NextResponse.json({ jobs: allJobs })

  } catch (error) {
    console.error('Error searching jobs:', error)
    return NextResponse.json({ error: 'Failed to search jobs' }, { status: 500 })
  }
}

async function searchAdzuna(skills: string[], targetRoles: string[], keywords: string[], location: string): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  
  if (!appId || !appKey) {
    console.log('Adzuna: Missing API keys')
    return []
  }

  try {
    // Use SIMPLE search terms - just 2-3 words max
    // Pick the first target role and simplify it
    let query = 'security manager' // default fallback
    
    if (targetRoles && targetRoles.length > 0) {
      // Take first role and extract just the key job title (last 1-2 words usually)
      const firstRole = targetRoles[0]
      // Extract simpler version: "Director of Security Operations" -> "Security Operations"
      // or just use a key word from it
      if (firstRole.toLowerCase().includes('security')) {
        query = 'security manager'
      } else if (firstRole.toLowerCase().includes('risk')) {
        query = 'risk manager'
      } else if (firstRole.toLowerCase().includes('operations')) {
        query = 'operations manager'
      } else if (firstRole.toLowerCase().includes('compliance')) {
        query = 'compliance manager'
      } else if (firstRole.toLowerCase().includes('training')) {
        query = 'training manager'
      } else if (firstRole.toLowerCase().includes('program')) {
        query = 'program manager'
      } else if (firstRole.toLowerCase().includes('project')) {
        query = 'project manager'
      } else if (firstRole.toLowerCase().includes('product')) {
        query = 'product manager'
      } else if (firstRole.toLowerCase().includes('investigat')) {
        query = 'investigator'
      } else if (firstRole.toLowerCase().includes('analyst')) {
        query = 'analyst'
      } else {
        // Just take last two words of the role
        const words = firstRole.split(' ')
        query = words.slice(-2).join(' ')
      }
    }
    
    console.log('Adzuna search query:', query)
    
    const country = 'us'
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(query)}&content-type=application/json`
    
    if (location && location.trim()) {
      url += `&where=${encodeURIComponent(location)}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Adzuna API error:', response.status)
      return []
    }

    const data = await response.json()
    
    if (!data.results) {
      console.log('Adzuna: No results in response')
      return []
    }
    
    return data.results.map((job: AdzunaJob) => ({
      id: `adzuna-${job.id}`,
      title: job.title,
      company: job.company?.display_name || 'Unknown Company',
      location: job.location?.display_name || 'Remote',
      description: job.description,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      created: job.created,
      redirect_url: job.redirect_url,
      source: 'Adzuna',
      matchScore: calculateMatchScore(job.title, job.description, skills, targetRoles, keywords)
    }))
  } catch (error) {
    console.error('Adzuna search error:', error)
    return []
  }
}

async function searchUSAJobs(skills: string[], targetRoles: string[], keywords: string[], location: string): Promise<any[]> {
  const apiKey = process.env.USAJOBS_API_KEY?.trim()
  const email = process.env.USAJOBS_EMAIL?.trim()
  
  // Log all env vars that start with USA to help debug
  const envKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('USA'))
  console.log('USAJobs env vars found:', envKeys)
  console.log('USAJobs API key exists:', !!apiKey, 'length:', apiKey?.length || 0)
  console.log('USAJobs email exists:', !!email)
  
  if (!apiKey || apiKey === '' || apiKey === 'undefined') {
    console.log('USAJobs: Missing or invalid API key')
    return []
  }
  
  if (!email || email === '' || email === 'undefined') {
    console.log('USAJobs: Missing or invalid email')
    return []
  }

  try {
    // Use SIMPLE search - just 1-2 words
    let query = 'program manager' // good default with lots of results
    
    if (targetRoles && targetRoles.length > 0) {
      const firstRole = targetRoles[0].toLowerCase()
      if (firstRole.includes('security')) {
        query = 'security specialist'
      } else if (firstRole.includes('risk')) {
        query = 'risk management'
      } else if (firstRole.includes('compliance')) {
        query = 'compliance'
      } else if (firstRole.includes('training')) {
        query = 'training specialist'
      } else if (firstRole.includes('operations')) {
        query = 'operations'
      } else if (firstRole.includes('investigat')) {
        query = 'investigator'
      } else if (firstRole.includes('analyst')) {
        query = 'analyst'
      } else if (firstRole.includes('program')) {
        query = 'program manager'
      } else if (firstRole.includes('project')) {
        query = 'project manager'
      }
    }
    
    console.log('USAJobs search query:', query)
    
    let url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(query)}&ResultsPerPage=15`
    
    if (location && location.trim()) {
      url += `&LocationName=${encodeURIComponent(location)}`
    }
    
    console.log('USAJobs URL:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': email,
        'Authorization-Key': apiKey
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('USAJobs API error:', response.status, errorText)
      return []
    }

    const data = await response.json()
    
    console.log('USAJobs response received, items:', data.SearchResult?.SearchResultCount || 0)
    
    if (!data.SearchResult?.SearchResultItems || data.SearchResult.SearchResultItems.length === 0) {
      console.log('USAJobs: No results found')
      return []
    }

    return data.SearchResult.SearchResultItems.map((item: USAJobsResult) => {
      const job = item.MatchedObjectDescriptor
      const salaryInfo = job.PositionRemuneration?.[0]
      const locationInfo = job.PositionLocation?.[0]
      
      return {
        id: `usajobs-${item.MatchedObjectId}`,
        title: job.PositionTitle,
        company: job.OrganizationName,
        location: locationInfo?.LocationName || 'Various Locations',
        description: job.UserArea?.Details?.JobSummary || 'See full posting for details.',
        salary_min: salaryInfo ? parseInt(salaryInfo.MinimumRange) : undefined,
        salary_max: salaryInfo ? parseInt(salaryInfo.MaximumRange) : undefined,
        created: job.PositionStartDate,
        redirect_url: job.PositionURI,
        source: 'USAJobs',
        matchScore: calculateMatchScore(job.PositionTitle, job.UserArea?.Details?.JobSummary || '', skills, targetRoles, keywords)
      }
    })
  } catch (error) {
    console.error('USAJobs search error:', error)
    return []
  }
}

function calculateMatchScore(title: string, description: string, skills: string[], targetRoles: string[], keywords: string[]): number {
  const jobText = `${title} ${description}`.toLowerCase()
  let score = 40 // Base score
  
  // Target role match is most important (up to +30)
  for (const role of (targetRoles || [])) {
    const roleLower = role.toLowerCase()
    if (title.toLowerCase().includes(roleLower)) {
      score += 20 // Title match is huge
    } else if (jobText.includes(roleLower)) {
      score += 10
    }
  }
  
  // Keyword matches (up to +20)
  for (const keyword of (keywords || [])) {
    if (jobText.includes(keyword.toLowerCase())) {
      score += 3
    }
  }
  
  // Skill matches (up to +15)
  for (const skill of (skills || [])) {
    if (jobText.includes(skill.toLowerCase())) {
      score += 2
    }
  }
  
  // Boost for LE-relevant terms
  const leKeywords = ['security', 'investigation', 'law enforcement', 'criminal', 'compliance', 'fraud', 'risk', 'protection', 'analyst', 'specialist']
  for (const keyword of leKeywords) {
    if (jobText.includes(keyword)) {
      score += 2
    }
  }
  
  return Math.min(Math.max(score, 25), 98)
}

function getMockJobs(skills: string[], targetRoles: string[], keywords: string[]): any[] {
  const mockJobs = [
    {
      id: 'mock-1',
      title: 'Corporate Security Manager',
      company: 'Fortune 500 Financial Services',
      location: 'Dallas, TX',
      description: 'Seeking an experienced security professional to lead our corporate security program. Responsibilities include managing a team of security specialists, conducting risk assessments, developing security policies, and coordinating with law enforcement agencies.',
      salary_min: 95000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1',
      source: 'Featured'
    },
    {
      id: 'mock-2',
      title: 'Fraud Investigator',
      company: 'Major Insurance Company',
      location: 'Remote',
      description: 'Join our Special Investigations Unit as a Fraud Investigator. You will investigate suspected fraudulent insurance claims, conduct interviews, gather evidence, prepare detailed reports, and testify when needed.',
      salary_min: 75000,
      salary_max: 95000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2',
      source: 'Featured'
    },
    {
      id: 'mock-3',
      title: 'Director of Loss Prevention',
      company: 'National Retail Chain',
      location: 'Chicago, IL',
      description: 'Lead loss prevention strategy across 200+ retail locations. Manage regional LP managers, develop training programs, analyze theft patterns, coordinate with law enforcement.',
      salary_min: 110000,
      salary_max: 145000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3',
      source: 'Featured'
    },
    {
      id: 'mock-4',
      title: 'Compliance Investigator',
      company: 'Healthcare Organization',
      location: 'Phoenix, AZ',
      description: 'Investigate compliance concerns, conduct internal investigations, interview employees, document findings, and recommend corrective actions. Work closely with Legal and HR departments.',
      salary_min: 70000,
      salary_max: 90000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4',
      source: 'Featured'
    },
    {
      id: 'mock-5',
      title: 'Risk Manager',
      company: 'Tech Startup',
      location: 'Austin, TX',
      description: 'Build and manage enterprise risk management program. Identify potential risks, develop mitigation strategies, create business continuity plans.',
      salary_min: 85000,
      salary_max: 115000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5',
      source: 'Featured'
    },
    {
      id: 'mock-6',
      title: 'Corporate Investigator',
      company: 'Global Consulting Firm',
      location: 'New York, NY',
      description: 'Conduct complex corporate investigations including fraud, misconduct, and due diligence. Interview witnesses, analyze documents, write detailed reports for clients.',
      salary_min: 90000,
      salary_max: 140000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/6',
      source: 'Featured'
    },
    {
      id: 'mock-7',
      title: 'Safety & Security Coordinator',
      company: 'University',
      location: 'Denver, CO',
      description: 'Coordinate campus safety programs, conduct security assessments, develop emergency response plans, and train staff on safety procedures.',
      salary_min: 60000,
      salary_max: 75000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/7',
      source: 'Featured'
    },
    {
      id: 'mock-8',
      title: 'Threat Intelligence Analyst',
      company: 'Defense Contractor',
      location: 'Washington, DC',
      description: 'Analyze threat intelligence, prepare briefings for clients, monitor global security situations, and provide recommendations. Requires security clearance.',
      salary_min: 85000,
      salary_max: 120000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/8',
      source: 'Featured'
    }
  ]
  
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job.title, job.description, skills || [], targetRoles || [], keywords || [])
  })).sort((a, b) => b.matchScore - a.matchScore)
}
