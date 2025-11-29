import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { profile, questionnaire, resume, job } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let candidateContext = ''
    
    if (questionnaire && questionnaire.rank) {
      candidateContext = `
CANDIDATE BACKGROUND (from questionnaire):
- Rank: ${questionnaire.rank}
- Years of Service: ${questionnaire.yearsOfService}
- Department: ${questionnaire.department}
- Specializations: ${questionnaire.specializations?.join(', ') || 'General'}
- Key Duties: ${questionnaire.dailyDuties}
- Certifications: ${questionnaire.certifications?.join(', ') || 'None'}
- Supervised: ${questionnaire.leadershipCount || 'N/A'}
- Education: ${questionnaire.education}`
    } else if (resume) {
      candidateContext = `
CANDIDATE BACKGROUND (from resume):
- Skills: ${resume.skills?.join(', ') || 'Not specified'}
- Experience: ${resume.experience?.join('; ') || 'Not specified'}
- Education: ${resume.education?.join('; ') || 'Not specified'}

Resume excerpt:
${resume.text?.slice(0, 2000) || 'Not available'}`
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are an expert resume consultant specializing in helping law enforcement professionals transition to the private sector. 

Analyze the following candidate against the job posting and provide specific, actionable recommendations to help them tailor their resume. Remember to translate law enforcement language into corporate-friendly terms.

${candidateContext}

TRANSLATED PROFILE:
${profile ? `
- Summary: ${profile.summary}
- Target Roles: ${profile.targetRoles?.join(', ')}
- Keywords: ${profile.keywords?.join(', ')}
` : 'Not available'}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

Description:
${job.description}

Provide your analysis in this exact JSON format:
{
  "suggestions": [
    "Specific, actionable suggestion 1 - be very specific about what to change or add",
    "Specific suggestion 2 - reference their actual LE experience and how to present it",
    "Specific suggestion 3 - include example wording they can use",
    "Specific suggestion 4",
    "Specific suggestion 5"
  ],
  "keywordsToAdd": [
    "keyword from job description they should include",
    "another keyword",
    "industry term they may not know"
  ],
  "experienceToHighlight": [
    "Specific LE experience that translates well to this role - explain how to frame it",
    "Another transferable experience with suggested corporate language"
  ],
  "gaps": [
    "Skill or qualification gap and how to address it in cover letter or interview",
    "Another gap with mitigation strategy"
  ]
}

IMPORTANT: 
- Don't just list generic advice. Be specific to THIS candidate and THIS job.
- Translate any LE terminology into corporate speak in your suggestions.
- Focus on their transferable skills and how to present them.
- If they supervised people, emphasize leadership metrics.
- Investigation experience = research and analytical skills.
- Court testimony = stakeholder presentations.

Respond ONLY with valid JSON.`
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
      result = {
        suggestions: [
          `Lead with a strong summary that positions you for ${job.title} - avoid mentioning "police" or "law enforcement" in the first line. Instead, open with your years of experience in "security operations" or "investigations."`,
          `Quantify your leadership experience. Instead of "supervised officers," write "Led and developed a team of X professionals, conducting performance evaluations and mentoring."`,
          `Reframe your investigation experience as "research and analysis." For example: "Conducted complex investigations requiring analytical thinking, evidence evaluation, and detailed documentation."`,
          `Your report writing translates directly - emphasize "Created detailed documentation for executive review" or "Prepared comprehensive reports for stakeholder decision-making."`,
          `Highlight any training experience as "instructional design" or "program development" - this is highly valued in corporate settings.`
        ],
        keywordsToAdd: extractKeywordsFromJob(job.description),
        experienceToHighlight: [
          'Your interview and interrogation skills translate to "stakeholder engagement" and "information gathering from diverse sources"',
          'Crisis response experience shows you can "make critical decisions under pressure" and "manage high-stakes situations"'
        ],
        gaps: [
          'If you lack direct industry experience, emphasize your "rapid learning ability" and "adaptability to new environments"',
          'Consider obtaining relevant certifications like CFE (fraud), CPP (security), or industry-specific credentials'
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error tailoring resume:', error)
    return NextResponse.json({ error: 'Failed to analyze job' }, { status: 500 })
  }
}

function extractKeywordsFromJob(description: string): string[] {
  const corporateKeywords = [
    'stakeholder management', 'risk assessment', 'compliance', 'due diligence',
    'cross-functional', 'strategic planning', 'team leadership', 'project management',
    'data analysis', 'process improvement', 'client relations', 'vendor management',
    'policy development', 'training and development', 'reporting', 'documentation',
    'investigation', 'security', 'loss prevention', 'fraud detection'
  ]
  
  const found: string[] = []
  const lowerDesc = description.toLowerCase()
  
  for (const keyword of corporateKeywords) {
    if (lowerDesc.includes(keyword) && found.length < 8) {
      found.push(keyword)
    }
  }
  
  return found.length > 0 ? found : ['stakeholder management', 'documentation', 'team leadership', 'analysis']
}
