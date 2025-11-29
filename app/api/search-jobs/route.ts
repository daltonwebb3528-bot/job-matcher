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
    const body = await request.json()
    const { skills, targetRoles, keywords, searchTerms, govSearchTerms, location } = body
    
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
    for (const term of allTerms.slice(0, 12)) {
      try {
        const jobs = await searchJobs(term, location)
        console.log(`Search for "${term}" returned ${jobs.length} jobs`)
        
        // Add jobs we haven't seen yet
        for (const job of jobs) {
          if (!seenIds.has(job.id)) {
            seenIds.add(job.id)
            job.matchScore = calculateMatchScore(job.title, job.description, skills, targetRoles, keywords, term)
            allJobs.push(job)
          }
        }
      } catch (termError) {
        console.error(`Error searching for term "${term}":`, termError)
        continue
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
    // Return mock jobs instead of an error
    return NextResponse.json({ 
      jobs: getMockJobs([], [], [])
    })
  }
}

async function searchJobs(searchTerm: string, location: string): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  
  if (!appId || !appKey) {
    console.log('Job API: Missing API keys, skipping Adzuna search')
    return []
  }

  try {
    const country = 'us'
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(searchTerm)}&content-type=application/json`
    
    if (location && location.trim() && location.toLowerCase() !== 'remote') {
      url += `&where=${encodeURIComponent(location)}`
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      console.error('Job search API error:', response.status, response.statusText)
      return []
    }

    // Check content type before parsing
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Adzuna returned non-JSON response:', contentType)
      return []
    }

    // Get response as text first to safely handle parsing
    const responseText = await response.text()
    
    if (!responseText || responseText.trim() === '') {
      console.error('Empty response from Adzuna')
      return []
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Adzuna response:', parseError)
      console.error('Response text preview:', responseText.slice(0, 200))
      return []
    }
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results array in Adzuna response')
      return []
    }
    
    return data.results.map((job: AdzunaJob) => ({
      id: String(job.id),
      title: job.title || 'Untitled Position',
      company: job.company?.display_name || 'Company Confidential',
      location: job.location?.display_name || 'Location not specified',
      description: job.description || '',
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
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const jobText = `${titleLower} ${descLower}`
  const matchedTermLower = (matchedTerm || '').toLowerCase()
  let score = 30
  
  // EXACT title match with search term = huge boost
  if (titleLower === matchedTermLower || titleLower.includes(matchedTermLower)) {
    score += 40
  } else {
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
  
  // Target role matches in title
  let roleMatchCount = 0
  for (const role of (targetRoles || [])) {
    const roleLower = (role || '').toLowerCase()
    const roleWords = roleLower.split(/\s+/).filter(w => w.length > 3)
    for (const word of roleWords) {
      if (titleLower.includes(word)) {
        roleMatchCount++
      }
    }
  }
  score += Math.min(roleMatchCount * 5, 20)
  
  // Keyword matches in description
  let keywordMatches = 0
  for (const keyword of (keywords || [])) {
    if (keyword && keyword.length > 3 && jobText.includes(keyword.toLowerCase())) {
      keywordMatches++
    }
  }
  score += Math.min(keywordMatches * 1.5, 15)
  
  // Skill matches
  let skillMatches = 0
  for (const skill of (skills || [])) {
    if (skill && skill.length > 3 && jobText.includes(skill.toLowerCase())) {
      skillMatches++
    }
  }
  score += Math.min(skillMatches, 10)
  
  // Add slight randomness for variety
  score += Math.floor(Math.random() * 7) - 3
  
  return Math.min(Math.max(Math.round(score), 15), 98)
}

function getMockJobs(skills: string[], targetRoles: string[], keywords: string[]): any[] {
  const mockJobs = [
    {
      id: 'mock-1',
      title: 'Security Operations Manager',
      company: 'Enterprise Corporation',
      location: 'Dallas, TX',
      description: 'Oversee security operations, manage team of specialists, develop policies, conduct risk assessments, and coordinate emergency response. Looking for candidates with law enforcement or military background.',
      salary_min: 90000,
      salary_max: 120000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/1'
    },
    {
      id: 'mock-2',
      title: 'Corporate Investigator',
      company: 'Fortune 500 Company',
      location: 'Remote',
      description: 'Conduct internal investigations, fraud detection, and compliance monitoring. Experience in investigations and report writing required.',
      salary_min: 75000,
      salary_max: 95000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/2'
    },
    {
      id: 'mock-3',
      title: 'Risk Management Specialist',
      company: 'Financial Services Inc',
      location: 'Chicago, IL',
      description: 'Assess organizational risks, develop mitigation strategies, and ensure regulatory compliance. Strong analytical and communication skills required.',
      salary_min: 80000,
      salary_max: 110000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/3'
    },
    {
      id: 'mock-4',
      title: 'Training and Development Manager',
      company: 'National Corporation',
      location: 'Phoenix, AZ',
      description: 'Design and deliver training programs, develop curriculum, assess learning outcomes. Experience in instruction and program development preferred.',
      salary_min: 70000,
      salary_max: 90000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/4'
    },
    {
      id: 'mock-5',
      title: 'Compliance Officer',
      company: 'Healthcare Organization',
      location: 'Austin, TX',
      description: 'Ensure organizational compliance with regulations, conduct audits, and develop policies. Detail-oriented with strong documentation skills.',
      salary_min: 85000,
      salary_max: 115000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/5'
    },
    {
      id: 'mock-6',
      title: 'Loss Prevention Director',
      company: 'Retail Corporation',
      location: 'Denver, CO',
      description: 'Lead loss prevention initiatives across multiple locations. Develop strategies to reduce shrinkage and manage investigations team.',
      salary_min: 95000,
      salary_max: 130000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/6'
    },
    {
      id: 'mock-7',
      title: 'Program Manager',
      company: 'Government Contractor',
      location: 'Washington, DC',
      description: 'Lead cross-functional programs, manage stakeholders, and ensure project delivery. Experience with government processes preferred.',
      salary_min: 100000,
      salary_max: 140000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/7'
    },
    {
      id: 'mock-8',
      title: 'Operations Director',
      company: 'Security Services Company',
      location: 'Atlanta, GA',
      description: 'Oversee daily operations, manage personnel, optimize processes. Leadership experience and operational background required.',
      salary_min: 110000,
      salary_max: 150000,
      created: new Date().toISOString(),
      redirect_url: 'https://example.com/job/8'
    }
  ]
  
  return mockJobs.map(job => ({
    ...job,
    matchScore: calculateMatchScore(job.title, job.description, skills || [], targetRoles || [], keywords || [], '')
  })).sort((a, b) => b.matchScore - a.matchScore)
}
