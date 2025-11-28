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
    const { skills, targetRoles, keywords, searchTerms, govSearchTerms, location } = await request.json()
    
    console.log('Search request received')
    console.log('Private sector search terms:', searchTerms)
    console.log('Government search terms:', govSearchTerms)
    
    // Combine private sector and government search terms
    const privateTerms = searchTerms && searchTerms.length > 0 
      ? searchTerms 
      : (targetRoles || ['program manager', 'operations manager'])
    
    const govTerms = govSearchTerms && govSearchTerms.length > 0
      ? govSearchTerms
      : []
    
    // Use MORE search terms to get diverse results
    const allTerms = [...privateTerms.slice(0, 10), ...govTerms.slice(0, 5)]
    
    console.log('Combined search terms:', allTerms)
    
    const allJobs: any[] = []
    const seenIds = new Set<string>()
    
    // Search for EACH term separately to get diverse results
    for (const term of allTerms.slice(0, 12)) { // Search up to 12 different terms
      const jobs = await searchJobs(term, location)
      console.log(`Search for "${term}" returned ${jobs.length} jobs`)
      
      // Add jobs we haven't seen yet
      for (const job of jobs) {
        if (!seenIds.has(job.id)) {
          seenIds.add(job.id)
          // Calculate match score based on all criteria
          job.matchScore = calculateMatchScore(job.title, job.description, skills, targetRoles, keywords, term)
          allJobs.push(job)
        }
      }
    }
    
    console.log('Total unique jobs found:', allJobs.length)
    
    // If no results, use mock data
    if (allJobs.length === 0) {
      console.log('No API results, using mock data')
      return NextResponse.json({
        jobs: getMockJobs(skills, targetRoles, keywords)
      })
    }
    
    // Sort by match score
    allJobs.sort((a, b) => b.matchScore - a.matchScore)

    // Return top 75 jobs
    return NextResponse.json({ jobs: allJobs.slice(0, 75) })

  } catch (error) {
    console.error('Error searching jobs:', error)
    return NextResponse.json({ error: 'Failed to search jobs' }, { status: 500 })
  }
}

async function searchJobs(searchTerm: string, location: string): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  
  if (!appId || !appKey) {
    console.log('Job API: Missing API keys')
    return []
  }

  try {
    const country = 'us'
    // Get more results per search (15 instead of 10)
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(searchTerm)}&content-type=application/json`
    
    if (location && location.trim() && location.toLowerCase() !== 'remote') {
      url += `&where=${encodeURIComponent(location)}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Job search API error:', response.status)
      return []
    }

    const data = await response.json()
    
    if (!data.results) {
      return []
    }
    
    return data.results.map((job: AdzunaJob) => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Company Confidential',
      location: job.location?.display_name || 'Location not specified',
      description: job.description,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      created: job.created,
      redirect_url: job.redirect_url,
      matchedTerm: searchTerm
    }))
  } catch (error) {
    console.error('Job search error:', error)
    return []
  }
}

function calculateMatchScore(
  title: string, 
  description: string, 
  skills: string[], 
  targetRoles: string[], 
  keywords: string[],
  matchedTerm: string
): number {
  const jobText = `${title} ${description}`.toLowerCase()
  const titleLower = title.toLowerCase()
  const matchedTermLower = matchedTerm.toLowerCase()
  let score = 30 // Lower base score for more range
  
  // EXACT title match with search term = huge boost (90%+ match)
  if (titleLower === matchedTermLower || titleLower.includes(matchedTermLower)) {
    score += 40
  } else {
    // Partial match - check if words overlap
    const termWords = matchedTermLower.split(/\s+/)
    const titleWords = titleLower.split(/\s+/)
    let wordMatches = 0
    for (const termWord of termWords) {
      if (termWord.length > 2 && titleWords.some(tw => tw.includes(termWord) || termWord.includes(tw))) {
        wordMatches++
      }
    }
    if (wordMatches > 0) {
      score += wordMatches * 15
    }
  }
  
  // Target role matches in title (strong signal)
  let roleMatchCount = 0
  for (const role of (targetRoles || [])) {
    const roleLower = role.toLowerCase()
    const roleWords = roleLower.split(/\s+/).filter(w => w.length > 3)
    for (const word of roleWords) {
      if (titleLower.includes(word)) {
        roleMatchCount++
      }
    }
  }
  score += Math.min(roleMatchCount * 5, 20) // Cap at 20
  
  // Keyword matches in description (medium signal)
  let keywordMatches = 0
  for (const keyword of (keywords || [])) {
    if (keyword.length > 3 && jobText.includes(keyword.toLowerCase())) {
      keywordMatches++
    }
  }
  score += Math.min(keywordMatches * 1.5, 15) // Cap at 15
  
  // Skill matches (lighter signal)
  let skillMatches = 0
  for (const skill of (skills || [])) {
    if (skill.length > 3 && jobText.includes(skill.toLowerCase())) {
      skillMatches++
    }
  }
  score += Math.min(skillMatches, 10) // Cap at 10
  
  // Add slight randomness for variety (±3 points)
  score += Math.floor(Math.random() * 7) - 3
  
  // Ensure score is within bounds
  return Math.min(Math.max(Math.round(score), 15), 98)
}

function getMockJobs(skills: string[], targetRoles: string[], keywords: string[]): any[] {
  const mockJobs = [
    {
      id: 'mock-1',
      title: 'Program Manager',
      company: 'Fortune 500 Company',
      location: 'Dallas, TX',
      description: 'Seeking an experienced program manager to lead cross-functional initiatives. Responsibilities include stakeholder management, project planning, risk assessment, and team coordination.',
      salary_min: 95000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1'
    },
    {
      id: 'mock-2',
      title: 'Marketing Coordinator',
      company: 'Growing Tech Company',
      location: 'Remote',
      description: 'Join our marketing team to coordinate campaigns, manage social media presence, create content, and engage with our community. Great opportunity for career changers.',
      salary_min: 55000,
      salary_max: 75000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2'
    },
    {
      id: 'mock-3',
      title: 'Operations Manager',
      company: 'National Services Company',
      location: 'Chicago, IL',
      description: 'Lead operations across multiple locations. Manage teams, optimize processes, ensure compliance, and drive continuous improvement initiatives.',
      salary_min: 85000,
      salary_max: 115000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3'
    },
    {
      id: 'mock-4',
      title: 'Communications Specialist',
      company: 'Healthcare Organization',
      location: 'Phoenix, AZ',
      description: 'Develop internal and external communications, manage media relations, create press releases, and coordinate public affairs activities.',
      salary_min: 60000,
      salary_max: 80000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4'
    },
    {
      id: 'mock-5',
      title: 'Training Specialist',
      company: 'Corporate Training Solutions',
      location: 'Austin, TX',
      description: 'Design and deliver training programs, develop curriculum, assess learning outcomes, and coach employees on professional development.',
      salary_min: 65000,
      salary_max: 85000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5'
    },
    {
      id: 'mock-6',
      title: 'Public Affairs Specialist',
      company: 'Government Agency',
      location: 'Washington, DC',
      description: 'Manage public communications, coordinate with media, develop outreach strategies, and represent the organization at community events.',
      salary_min: 70000,
      salary_max: 95000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/6'
    },
    {
      id: 'mock-7',
      title: 'Security Operations Manager',
      company: 'Enterprise Corporation',
      location: 'Denver, CO',
      description: 'Oversee security operations, manage team of specialists, develop policies, conduct risk assessments, and coordinate emergency response.',
      salary_min: 90000,
      salary_max: 120000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/7'
    },
    {
      id: 'mock-8',
      title: 'Business Analyst',
      company: 'Consulting Firm',
      location: 'New York, NY',
      description: 'Analyze business processes, gather requirements, create documentation, and work with stakeholders to implement solutions.',
      salary_min: 75000,
      salary_max: 100000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/8'
    }
  ]
  
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job.title, job.description, skills || [], targetRoles || [], keywords || [], '')
  })).sort((a, b) => b.matchScore - a.matchScore)
}
