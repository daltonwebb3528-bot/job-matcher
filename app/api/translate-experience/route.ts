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
    {"original": "Original LE skill/duty", "translated": "Corporate equivalent description"},
    ...at least 6 translations covering different skill areas
  ],
  "targetRoles": ["7-10 specific job titles they should target - include DIVERSE roles beyond just security"],
  "keywords": ["20-25 keywords they should include in their resume for ATS systems"]
}

IMPORTANT: Law enforcement experience translates to MANY different career paths, not just security. Consider ALL of these:

SECURITY PATH: Security Manager, Corporate Investigator, Loss Prevention, Compliance Officer
MANAGEMENT PATH: Operations Manager, Program Manager, Project Manager, General Manager
LEADERSHIP PATH: Team Lead, Department Manager, Director of Operations
ANALYTICAL PATH: Business Analyst, Risk Analyst, Intelligence Analyst, Data Analyst
PEOPLE PATH: HR Manager, Training Manager, Recruiter, Employee Relations
CONSULTING PATH: Management Consultant, Risk Consultant, Safety Consultant
PRODUCT PATH: Product Manager (if they gathered requirements, managed stakeholders, solved problems)
GROWTH PATH: Business Development, Account Manager, Client Relations

Look at their ACTUAL experience and suggest roles that truly fit. Someone who:
- Managed large teams → Operations Manager, Program Manager
- Did extensive training → Training Manager, L&D Specialist, Instructional Designer
- Worked with community/stakeholders → Business Development, Account Manager, Customer Success
- Analyzed data/patterns → Business Analyst, Intelligence Analyst
- Managed budgets/resources → Operations Manager, Program Manager
- Solved complex problems → Product Manager, Consultant
- Wrote extensive documentation → Technical Writer, Compliance Analyst

Respond ONLY with valid JSON.`
    } else {
      // From resume upload
      profilePrompt = `You are an expert career counselor specializing in helping law enforcement professionals transition to the private sector.

Analyze this resume and create a professional profile that identifies ALL transferable skills and suggests the BEST matching career paths.

RESUME DATA:
- Skills detected: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience?.join('; ') || 'Not specified'}
- Education: ${resumeData.education?.join('; ') || 'Not specified'}
- Rank: ${resumeData.rank || 'Not specified'}
- Years of Service: ${resumeData.yearsOfService || 'Not specified'}
- Specializations: ${resumeData.specializations?.join(', ') || 'Not specified'}

Resume excerpt:
${resumeData.text?.slice(0, 4000) || 'Not available'}

Create a response in this exact JSON format:
{
  "summary": "A 3-4 sentence professional summary highlighting their STRONGEST transferable skills in corporate language",
  "translatedSkills": [
    {"original": "LE skill from resume", "translated": "Corporate equivalent"},
    ...at least 6 diverse translations
  ],
  "targetRoles": ["7-10 specific job titles - be DIVERSE based on their actual skills"],
  "keywords": ["20-25 ATS-friendly keywords from their experience"]
}

CRITICAL: Read the resume carefully. Look for evidence of:
- Product/program management (stakeholder management, requirements, roadmaps)
- Operations (process improvement, resource allocation, efficiency)
- Leadership (team size, mentoring, performance management)
- Analysis (data, patterns, investigations, reports)
- Training (curriculum development, instruction, coaching)
- Client/stakeholder management (community relations, partnerships)
- Strategy (planning, budgeting, long-term initiatives)

If the resume shows strong product thinking, stakeholder management, or strategic planning, include roles like:
- Product Manager
- Program Manager  
- Business Operations Manager
- Strategy & Operations
- Chief of Staff

Don't default to just security roles. Match the actual experience to the best opportunities.

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
        summary: "Dedicated professional with extensive experience in high-pressure environments, complex problem-solving, and team leadership. Proven track record of managing critical situations while maintaining composure and delivering results. Skilled in stakeholder communication, detailed documentation, and cross-functional collaboration.",
        translatedSkills: [
          { original: "Law enforcement experience", translated: "Operations and program management" },
          { original: "Report writing", translated: "Technical documentation and business communication" },
          { original: "Investigations", translated: "Research, analysis, and strategic problem-solving" },
          { original: "Team supervision", translated: "Team leadership, coaching, and performance management" },
          { original: "Crisis response", translated: "Emergency management and high-stakes decision-making" },
          { original: "Community relations", translated: "Stakeholder management and client relations" }
        ],
        targetRoles: [
          "Operations Manager",
          "Program Manager",
          "Security Manager",
          "Corporate Investigator", 
          "Compliance Analyst",
          "Risk Manager",
          "Training Manager",
          "Business Analyst"
        ],
        keywords: [
          "operations management", "program management", "team leadership",
          "stakeholder management", "risk assessment", "investigations", "compliance",
          "strategic planning", "process improvement", "documentation", "analysis",
          "crisis management", "conflict resolution", "training", "project management"
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error translating experience:', error)
    return NextResponse.json({ error: 'Failed to translate experience' }, { status: 500 })
  }
}
