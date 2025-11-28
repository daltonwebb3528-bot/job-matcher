import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, questionnaire, resumeData } = body

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let profilePrompt = ''

    if (source === 'questionnaire') {
      profilePrompt = `You are an expert career counselor specializing in helping law enforcement professionals transition to the private sector.

Based on the following questionnaire responses, create a professional profile that translates their law enforcement experience into corporate-friendly language.

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
  "summary": "A 3-4 sentence professional summary suitable for a resume, written in third person, highlighting their transferable skills without using law enforcement jargon",
  "translatedSkills": [
    {"original": "Conducted investigations", "translated": "Led complex research initiatives requiring analytical thinking and attention to detail"},
    {"original": "Interviewed suspects", "translated": "Conducted high-stakes interviews and negotiations with diverse stakeholders"},
    {"original": "Wrote incident reports", "translated": "Created detailed documentation and reports under tight deadlines"},
    {"original": "Supervised officers", "translated": "Managed and developed team members, conducted performance evaluations"},
    {"original": "Testified in court", "translated": "Delivered presentations to executive stakeholders and decision-makers"}
  ],
  "targetRoles": ["5-7 specific job titles they should target based on their experience"],
  "keywords": ["15-20 keywords they should include in their resume for ATS systems"]
}

Make the translations specific to their actual experience. Be creative but accurate. Focus on transferable skills like:
- Leadership and team management
- Investigation = research and analysis
- Report writing = documentation and communication
- Crisis management = high-pressure decision making
- Training = instructional design and development
- Interviewing = stakeholder engagement and negotiation

Respond ONLY with valid JSON.`
    } else {
      // From resume upload
      profilePrompt = `You are an expert career counselor specializing in helping law enforcement professionals transition to the private sector.

Based on the following resume data, create a professional profile that translates their law enforcement experience into corporate-friendly language.

RESUME DATA:
- Skills detected: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience?.join('; ') || 'Not specified'}
- Education: ${resumeData.education?.join('; ') || 'Not specified'}
- Rank: ${resumeData.rank || 'Not specified'}
- Years of Service: ${resumeData.yearsOfService || 'Not specified'}
- Specializations: ${resumeData.specializations?.join(', ') || 'Not specified'}

Resume excerpt:
${resumeData.text?.slice(0, 3000) || 'Not available'}

Create a response in this exact JSON format:
{
  "summary": "A 3-4 sentence professional summary suitable for a resume, written in third person, highlighting their transferable skills without using law enforcement jargon",
  "translatedSkills": [
    {"original": "Law enforcement skill/duty", "translated": "Corporate equivalent description"},
    ...at least 5 translations
  ],
  "targetRoles": ["5-7 specific job titles they should target based on their experience"],
  "keywords": ["15-20 keywords they should include in their resume for ATS systems"]
}

Focus on translating LE jargon into business language. For example:
- "Patrol" → "Field operations and client-facing responsibilities"
- "Arrest" → "Conflict resolution and de-escalation"
- "Badge" → Don't mention
- "Suspect" → "Individual" or "stakeholder"

Respond ONLY with valid JSON.`
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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
        summary: "Dedicated professional with extensive experience in high-pressure environments, complex investigations, and team leadership. Proven track record of managing critical situations while maintaining composure and delivering results. Skilled in stakeholder communication, detailed documentation, and cross-functional collaboration.",
        translatedSkills: [
          { original: "Law enforcement experience", translated: "Operations and security management" },
          { original: "Report writing", translated: "Technical documentation and communication" },
          { original: "Investigations", translated: "Research, analysis, and problem-solving" },
          { original: "Team supervision", translated: "Team leadership and development" },
          { original: "Crisis response", translated: "Emergency management and decision-making" }
        ],
        targetRoles: [
          "Security Manager",
          "Corporate Investigator", 
          "Compliance Analyst",
          "Risk Manager",
          "Fraud Investigator",
          "Loss Prevention Manager"
        ],
        keywords: [
          "security management", "risk assessment", "investigations", "compliance",
          "team leadership", "stakeholder management", "documentation", "analysis",
          "crisis management", "conflict resolution", "training", "operations"
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error translating experience:', error)
    return NextResponse.json({ error: 'Failed to translate experience' }, { status: 500 })
  }
}
