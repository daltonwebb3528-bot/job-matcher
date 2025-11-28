import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, questionnaire, resumeData } = body

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
    console.log('Anthropic API key exists:', !!apiKey, 'length:', apiKey?.length || 0)
    
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    let profilePrompt = ''

    if (source === 'questionnaire') {
      profilePrompt = `You are an expert career counselor specializing in helping law enforcement professionals transition to new roles.

Based on the following questionnaire responses, create a professional profile.

QUESTIONNAIRE DATA:
- Rank: ${questionnaire.rank}
- Years of Service: ${questionnaire.yearsOfService}
- Department Type: ${questionnaire.department}
- Specializations: ${questionnaire.specializations?.join(', ') || 'General'}
- Daily Duties: ${questionnaire.dailyDuties}
- Certifications: ${questionnaire.certifications?.join(', ') || 'None specified'}
- People Supervised: ${questionnaire.leadershipCount || 'None'}
- Education: ${questionnaire.education}
- Target Industries: ${questionnaire.desiredIndustry?.join(', ') || 'Open'}
- Location Preference: ${questionnaire.location}
- Salary Expectation: ${questionnaire.salaryExpectation}

Create a response in this exact JSON format:
{
  "summary": "A 3-4 sentence professional summary",
  "translatedSkills": [
    {"original": "Original skill", "translated": "Corporate equivalent"},
    ...at least 6 translations
  ],
  "targetRoles": ["8-12 specific job titles"],
  "searchTerms": ["10-15 SIMPLE 1-3 word job search terms"],
  "govSearchTerms": ["5-8 government/law enforcement search terms"],
  "keywords": ["20-25 ATS keywords"]
}

CRITICAL FOR searchTerms:
- Extract EXACT job titles they've held: "police sergeant", "detective", etc.
- Include their specializations: "SWAT", "K-9", "narcotics"
- Include simple role searches: "security manager", "operations manager"
- Each term should be 1-3 words MAX

Respond ONLY with valid JSON.`
    } else {
      // From resume upload
      profilePrompt = `You are an expert career counselor. Analyze this resume and create search terms that will find EXACTLY matching jobs.

RESUME DATA:
- Skills: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience?.join('; ') || 'Not specified'}
- Education: ${resumeData.education?.join('; ') || 'Not specified'}

FULL RESUME TEXT (READ CAREFULLY):
${resumeData.text?.slice(0, 6000) || 'Not available'}

Create a response in this exact JSON format:
{
  "summary": "A 3-4 sentence professional summary",
  "translatedSkills": [
    {"original": "Resume skill", "translated": "Corporate equivalent"},
    ...at least 6 translations
  ],
  "targetRoles": ["10-15 specific job titles based on their ACTUAL experience"],
  "searchTerms": ["15-20 job search terms - see instructions below"],
  "govSearchTerms": ["5-8 government/law enforcement search terms"],
  "keywords": ["20-25 ATS keywords"]
}

CRITICAL INSTRUCTIONS FOR searchTerms - THIS IS THE MOST IMPORTANT PART:

1. EXTRACT EXACT JOB TITLES from the resume:
   - If they were "Director of RTCC Strategy" → include "RTCC director", "crime center director", "real time crime"
   - If they were "Product Director" → include "product director", "director of product", "product manager"
   - If they were "Deputy Director" → include "deputy director", "assistant director"
   - If they were "Police Sergeant" → include "police sergeant", "sergeant"

2. EXTRACT UNIQUE INDUSTRY TERMS:
   - "Real time crime center" or "RTCC" → include "real time crime", "RTCC", "crime center"
   - "Fusion center" → include "fusion center", "intelligence center"
   - Specific technologies or platforms → include those terms

3. EXTRACT SKILLS THAT MAP TO JOB SEARCHES:
   - "product development" → "product manager", "product director"
   - "go-to-market strategies" → "GTM manager", "marketing director"
   - "podcast host" → "content creator", "media producer", "podcast producer"
   - "public speaking" → "communications director", "public affairs"
   - "sales support" → "sales manager", "business development"

4. INCLUDE BOTH LATERAL AND GROWTH ROLES:
   - If they're a Director, search "director" roles but also "VP" and "senior manager"
   - If they're a Sergeant, search "sergeant" but also "supervisor" and "manager"

5. KEEP EACH TERM SIMPLE (1-3 words):
   GOOD: "product director", "RTCC director", "crime center", "fusion center", "sales director"
   BAD: "Director of Real Time Crime Center Strategy and Operations"

6. For govSearchTerms, include:
   - Their exact LE rank: "police sergeant", "deputy director"
   - Related government roles: "program analyst", "intelligence analyst"
   - Similar LE positions: "crime analyst", "fusion center"

The goal is to find jobs that EXACTLY match their experience, not generic roles.

Respond ONLY with valid JSON.`
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: profilePrompt
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let result
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      // Fallback
      result = {
        summary: "Dedicated professional with extensive experience in leadership, operations, and strategic planning.",
        translatedSkills: [
          { original: "Law enforcement leadership", translated: "Operations and program management" },
          { original: "Team supervision", translated: "Team leadership and development" },
          { original: "Investigations", translated: "Research and analysis" },
          { original: "Report writing", translated: "Documentation and communication" },
          { original: "Community outreach", translated: "Stakeholder engagement" },
          { original: "Crisis response", translated: "Emergency management" }
        ],
        targetRoles: [
          "Operations Director",
          "Program Manager",
          "Security Director",
          "Training Manager"
        ],
        searchTerms: [
          "operations director",
          "program manager",
          "security director",
          "operations manager"
        ],
        govSearchTerms: [
          "police sergeant",
          "program analyst",
          "security specialist"
        ],
        keywords: [
          "operations", "leadership", "management", "strategy", "team building"
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error translating experience:', error)
    return NextResponse.json({ error: 'Failed to translate experience' }, { status: 500 })
  }
}
