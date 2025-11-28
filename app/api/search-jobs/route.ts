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
    const { skills, targetRoles, location } = await request.json()
    
    const allJobs: any[] = []
    
    // Search Adzuna
    const adzunaJobs = await searchAdzuna(skills, targetRoles, location)
    allJobs.push(...adzunaJobs)
    
    // Search USAJobs
    const usaJobs = await searchUSAJobs(skills, targetRoles, location)
    allJobs.push(...usaJobs)
    
    // If no API results, use mock data
    if (allJobs.length === 0) {
      return NextResponse.json({
        jobs: getMockJobs(skills, targetRoles)
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

async function searchAdzuna(skills: string[], targetRoles: string[], location: string): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  
  if (!appId || !appKey) {
    return []
  }

  try {
    const searchTerms = [
      ...(targetRoles || []).slice(0, 3),
      'security', 'investigator', 'compliance'
    ].join(' ')
    
    const country = 'us'
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(searchTerms)}&content-type=application/json`
    
    if (location) {
      url += `&where=${encodeURIComponent(location)}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Adzuna API error:', response.status)
      return []
    }

    const data = await response.json()
    
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
      matchScore: calculateMatchScore(job.title, job.description, skills, targetRoles)
    }))
  } catch (error) {
    console.error('Adzuna search error:', error)
    return []
  }
}

async function searchUSAJobs(skills: string[], targetRoles: string[], location: string): Promise<any[]> {
  const apiKey = process.env.USAJOBS_API_KEY
  const email = process.env.USAJOBS_EMAIL
  
  if (!apiKey || !email) {
    return []
  }

  try {
    // Build search query - focus on LE-relevant federal jobs
    const keywords = [
      'security',
      'investigator', 
      'compliance',
      'analyst',
      'specialist'
    ]
    
    // Add target roles if available
    if (targetRoles && targetRoles.length > 0) {
      keywords.unshift(...targetRoles.slice(0, 2))
    }
    
    const searchKeyword = keywords.slice(0, 3).join(' ')
    
    let url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(searchKeyword)}&ResultsPerPage=15`
    
    // Add location if provided
    if (location) {
      url += `&LocationName=${encodeURIComponent(location)}`
    }
    
    const response = await fetch(url, {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': email,
        'Authorization-Key': apiKey
      }
    })
    
    if (!response.ok) {
      console.error('USAJobs API error:', response.status, await response.text())
      return []
    }

    const data = await response.json()
    
    if (!data.SearchResult?.SearchResultItems) {
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
        matchScore: calculateMatchScore(job.PositionTitle, job.UserArea?.Details?.JobSummary || '', skills, targetRoles)
      }
    })
  } catch (error) {
    console.error('USAJobs search error:', error)
    return []
  }
}

function calculateMatchScore(title: string, description: string, skills: string[], targetRoles: string[]): number {
  const jobText = `${title} ${description}`.toLowerCase()
  let score = 50
  
  // Check for target role matches
  for (const role of (targetRoles || [])) {
    if (jobText.includes(role.toLowerCase())) {
      score += 15
    }
  }
  
  // Check for skill matches
  for (const skill of (skills || [])) {
    if (jobText.includes(skill.toLowerCase())) {
      score += 5
    }
  }
  
  // Boost for LE-relevant keywords
  const leKeywords = ['security', 'investigation', 'law enforcement', 'criminal', 'compliance', 'fraud', 'risk', 'protection']
  for (const keyword of leKeywords) {
    if (jobText.includes(keyword)) {
      score += 3
    }
  }
  
  return Math.min(Math.max(score, 25), 98)
}

function getMockJobs(skills: string[], targetRoles: string[]): any[] {
  const mockJobs = [
    {
      id: 'mock-1',
      title: 'Corporate Security Manager',
      company: 'Fortune 500 Financial Services',
      location: 'Dallas, TX',
      description: 'Seeking an experienced security professional to lead our corporate security program. Responsibilities include managing a team of security specialists, conducting risk assessments, developing security policies, and coordinating with law enforcement agencies. The ideal candidate has 10+ years of experience in law enforcement or military with leadership experience. Must have excellent communication skills and ability to work with executive leadership. Experience with investigations, threat assessment, and emergency response required.',
      salary_min: 95000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1',
      source: 'Featured',
      matchScore: 92
    },
    {
      id: 'mock-2',
      title: 'Fraud Investigator',
      company: 'Major Insurance Company',
      location: 'Remote',
      description: 'Join our Special Investigations Unit as a Fraud Investigator. You will investigate suspected fraudulent insurance claims, conduct interviews, gather evidence, prepare detailed reports, and testify when needed. Looking for candidates with law enforcement background, particularly those with detective or investigative experience. Strong analytical skills, attention to detail, and excellent written communication required. We value experience in interviewing techniques and evidence documentation.',
      salary_min: 75000,
      salary_max: 95000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2',
      source: 'Featured',
      matchScore: 88
    },
    {
      id: 'mock-3',
      title: 'Director of Loss Prevention',
      company: 'National Retail Chain',
      location: 'Chicago, IL',
      description: 'Lead loss prevention strategy across 200+ retail locations. Manage regional LP managers, develop training programs, analyze theft patterns, coordinate with law enforcement, and implement prevention technologies. Requires strong leadership background with experience managing teams. Former law enforcement with retail LP experience preferred. Must be able to build relationships with store leadership and present to executive team.',
      salary_min: 110000,
      salary_max: 145000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3',
      source: 'Featured',
      matchScore: 85
    },
    {
      id: 'mock-4',
      title: 'Compliance Investigator',
      company: 'Healthcare Organization',
      location: 'Phoenix, AZ',
      description: 'Investigate compliance concerns, conduct internal investigations, interview employees, document findings, and recommend corrective actions. Work closely with Legal and HR departments. Ideal candidate has background in investigations with strong interview skills. Must maintain confidentiality and handle sensitive situations professionally. Experience in healthcare compliance a plus but not required.',
      salary_min: 70000,
      salary_max: 90000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4',
      source: 'Featured',
      matchScore: 82
    },
    {
      id: 'mock-5',
      title: 'Risk Manager',
      company: 'Tech Startup',
      location: 'Austin, TX',
      description: 'Build and manage enterprise risk management program. Identify potential risks, develop mitigation strategies, create business continuity plans, and manage vendor security assessments. Looking for analytical problem-solvers with security or law enforcement background. Experience with crisis management and emergency response valuable. Must communicate effectively with technical and non-technical stakeholders.',
      salary_min: 85000,
      salary_max: 115000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5',
      source: 'Featured',
      matchScore: 78
    },
    {
      id: 'mock-6',
      title: 'Corporate Investigator',
      company: 'Global Consulting Firm',
      location: 'New York, NY',
      description: 'Conduct complex corporate investigations including fraud, misconduct, and due diligence. Interview witnesses, analyze documents, write detailed reports for clients. Travel required. Former law enforcement investigators with federal or detective experience highly desired. Must have excellent writing skills and professional demeanor for client-facing work.',
      salary_min: 90000,
      salary_max: 140000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/6',
      source: 'Featured',
      matchScore: 90
    },
    {
      id: 'mock-7',
      title: 'Safety & Security Coordinator',
      company: 'University',
      location: 'Denver, CO',
      description: 'Coordinate campus safety programs, conduct security assessments, develop emergency response plans, and train staff on safety procedures. Work with campus police and local agencies. Ideal for former law enforcement looking for stable hours and good benefits. Experience in training or community relations a plus.',
      salary_min: 60000,
      salary_max: 75000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/7',
      source: 'Featured',
      matchScore: 75
    },
    {
      id: 'mock-8',
      title: 'Threat Intelligence Analyst',
      company: 'Defense Contractor',
      location: 'Washington, DC',
      description: 'Analyze threat intelligence, prepare briefings for clients, monitor global security situations, and provide recommendations. Requires security clearance or ability to obtain. Former law enforcement with intelligence or counter-terrorism background preferred. Strong analytical and communication skills required.',
      salary_min: 85000,
      salary_max: 120000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/8',
      source: 'Featured',
      matchScore: 80
    }
  ]
  
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job.title, job.description, skills || [], targetRoles || [])
  })).sort((a, b) => b.matchScore - a.matchScore)
}

function getMockJobs(skills: string[], targetRoles: string[]): any[] {
  const mockJobs = [
    {
      id: '1',
      title: 'Corporate Security Manager',
      company: 'Fortune 500 Financial Services',
      location: 'Dallas, TX',
      description: 'Seeking an experienced security professional to lead our corporate security program. Responsibilities include managing a team of security specialists, conducting risk assessments, developing security policies, and coordinating with law enforcement agencies. The ideal candidate has 10+ years of experience in law enforcement or military with leadership experience. Must have excellent communication skills and ability to work with executive leadership. Experience with investigations, threat assessment, and emergency response required.',
      salary_min: 95000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1',
      matchScore: 92
    },
    {
      id: '2',
      title: 'Fraud Investigator',
      company: 'Major Insurance Company',
      location: 'Remote',
      description: 'Join our Special Investigations Unit as a Fraud Investigator. You will investigate suspected fraudulent insurance claims, conduct interviews, gather evidence, prepare detailed reports, and testify when needed. Looking for candidates with law enforcement background, particularly those with detective or investigative experience. Strong analytical skills, attention to detail, and excellent written communication required. We value experience in interviewing techniques and evidence documentation.',
      salary_min: 75000,
      salary_max: 95000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2',
      matchScore: 88
    },
    {
      id: '3',
      title: 'Director of Loss Prevention',
      company: 'National Retail Chain',
      location: 'Chicago, IL',
      description: 'Lead loss prevention strategy across 200+ retail locations. Manage regional LP managers, develop training programs, analyze theft patterns, coordinate with law enforcement, and implement prevention technologies. Requires strong leadership background with experience managing teams. Former law enforcement with retail LP experience preferred. Must be able to build relationships with store leadership and present to executive team.',
      salary_min: 110000,
      salary_max: 145000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3',
      matchScore: 85
    },
    {
      id: '4',
      title: 'Compliance Investigator',
      company: 'Healthcare Organization',
      location: 'Phoenix, AZ',
      description: 'Investigate compliance concerns, conduct internal investigations, interview employees, document findings, and recommend corrective actions. Work closely with Legal and HR departments. Ideal candidate has background in investigations with strong interview skills. Must maintain confidentiality and handle sensitive situations professionally. Experience in healthcare compliance a plus but not required.',
      salary_min: 70000,
      salary_max: 90000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4',
      matchScore: 82
    },
    {
      id: '5',
      title: 'Risk Manager',
      company: 'Tech Startup',
      location: 'Austin, TX',
      description: 'Build and manage enterprise risk management program. Identify potential risks, develop mitigation strategies, create business continuity plans, and manage vendor security assessments. Looking for analytical problem-solvers with security or law enforcement background. Experience with crisis management and emergency response valuable. Must communicate effectively with technical and non-technical stakeholders.',
      salary_min: 85000,
      salary_max: 115000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5',
      matchScore: 78
    },
    {
      id: '6',
      title: 'Corporate Investigator',
      company: 'Global Consulting Firm',
      location: 'New York, NY',
      description: 'Conduct complex corporate investigations including fraud, misconduct, and due diligence. Interview witnesses, analyze documents, write detailed reports for clients. Travel required. Former law enforcement investigators with federal or detective experience highly desired. Must have excellent writing skills and professional demeanor for client-facing work.',
      salary_min: 90000,
      salary_max: 140000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/6',
      matchScore: 90
    },
    {
      id: '7',
      title: 'Safety & Security Coordinator',
      company: 'University',
      location: 'Denver, CO',
      description: 'Coordinate campus safety programs, conduct security assessments, develop emergency response plans, and train staff on safety procedures. Work with campus police and local agencies. Ideal for former law enforcement looking for stable hours and good benefits. Experience in training or community relations a plus.',
      salary_min: 60000,
      salary_max: 75000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/7',
      matchScore: 75
    },
    {
      id: '8',
      title: 'Threat Intelligence Analyst',
      company: 'Defense Contractor',
      location: 'Washington, DC',
      description: 'Analyze threat intelligence, prepare briefings for clients, monitor global security situations, and provide recommendations. Requires security clearance or ability to obtain. Former law enforcement with intelligence or counter-terrorism background preferred. Strong analytical and communication skills required.',
      salary_min: 85000,
      salary_max: 120000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/8',
      matchScore: 80
    }
  ]
  
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job as unknown as AdzunaJob, skills || [], targetRoles || [])
  })).sort((a, b) => b.matchScore - a.matchScore)
}
