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
  "targetRoles": ["8-12 specific job titles - DIVERSE and SPECIFIC based on their actual duties"],
  "searchTerms": ["5-8 simple 2-word job search terms like 'marketing coordinator', 'program manager', 'security analyst'"],
  "govSearchTerms": ["3-5 government/law enforcement job search terms based on their rank"],
  "keywords": ["20-25 keywords they should include in their resume for ATS systems"]
}

CRITICAL: Look for HIDDEN career paths in their experience. Here are translations many people miss:

PUBLIC INFORMATION OFFICER (PIO) / MEDIA RELATIONS:
→ Marketing Coordinator, Communications Specialist, Social Media Manager, PR Coordinator, Content Creator, Digital Marketing Specialist, Brand Ambassador, Community Manager

COMMUNITY OUTREACH / COMMUNITY POLICING:
→ Community Relations Manager, Outreach Coordinator, Public Relations, Customer Success, Account Manager, Partnership Manager, Engagement Specialist

TRAINING OFFICER / FTO:
→ Training Coordinator, Learning & Development Specialist, Instructional Designer, Corporate Trainer, Onboarding Specialist, Training Manager

DETECTIVE / INVESTIGATIONS:
→ Research Analyst, Intelligence Analyst, Fraud Analyst, Compliance Investigator, Due Diligence Analyst, Background Investigator

REPORT WRITING / DOCUMENTATION:
→ Technical Writer, Documentation Specialist, Content Writer, Compliance Writer, Policy Writer

SUPERVISING OFFICERS:
→ Team Lead, Operations Supervisor, Shift Manager, Department Manager, Operations Manager

BUDGET / RESOURCE MANAGEMENT:
→ Operations Coordinator, Resource Manager, Project Coordinator, Administrative Manager

CRISIS NEGOTIATION:
→ Conflict Resolution Specialist, Mediator, Customer Relations, Client Success Manager

CRIME ANALYSIS / DATA:
→ Data Analyst, Business Intelligence Analyst, Research Analyst, Reporting Analyst

SCHOOL RESOURCE OFFICER:
→ Youth Program Coordinator, Education Liaison, Student Services, Program Coordinator

The "searchTerms" field should contain SIMPLE 2-word phrases that will actually return job results, like:
- "marketing coordinator" (not "Digital Marketing and Communications Specialist")
- "program manager" (not "Senior Program Management Director")
- "training specialist" (not "Learning and Development Training Coordinator")

The "govSearchTerms" field should contain government and law enforcement job searches based on their RANK:
- Chief/Assistant Chief → "police chief", "director public safety", "chief security officer"
- Captain/Commander → "police captain", "security director", "emergency manager"
- Lieutenant → "police lieutenant", "security manager", "operations supervisor"
- Sergeant → "police sergeant", "security supervisor", "team supervisor"
- Detective → "criminal investigator", "fraud investigator", "special agent"
- Officer/Deputy → "police officer", "security officer", "patrol officer"

Also include federal law enforcement if applicable:
- "federal agent", "special agent", "criminal investigator GS", "program analyst"

Respond ONLY with valid JSON.`
    } else {
      // From resume upload
      profilePrompt = `You are an expert career counselor specializing in helping law enforcement professionals transition to the private sector.

Analyze this resume CAREFULLY and identify ALL transferable skills and career paths - especially non-obvious ones.

RESUME DATA:
- Skills detected: ${resumeData.skills?.join(', ') || 'Not specified'}
- Experience: ${resumeData.experience?.join('; ') || 'Not specified'}
- Education: ${resumeData.education?.join('; ') || 'Not specified'}
- Rank: ${resumeData.rank || 'Not specified'}
- Years of Service: ${resumeData.yearsOfService || 'Not specified'}
- Specializations: ${resumeData.specializations?.join(', ') || 'Not specified'}

Resume excerpt:
${resumeData.text?.slice(0, 5000) || 'Not available'}

Create a response in this exact JSON format:
{
  "summary": "A 3-4 sentence professional summary highlighting their STRONGEST transferable skills in corporate language",
  "translatedSkills": [
    {"original": "LE skill from resume", "translated": "Corporate equivalent"},
    ...at least 6 diverse translations
  ],
  "targetRoles": ["8-12 specific job titles - be DIVERSE based on their actual experience"],
  "searchTerms": ["5-8 simple 2-word job search terms that will return real results"],
  "govSearchTerms": ["3-5 government/law enforcement search terms based on their rank"],
  "keywords": ["20-25 ATS-friendly keywords from their experience"]
}

CRITICAL INSTRUCTIONS:

1. READ THE RESUME CAREFULLY. Look for ANY mention of:
   - Media, social media, public information, PIO, press releases → MARKETING/COMMUNICATIONS jobs
   - Community events, outreach, public speaking, presentations → PR/COMMUNITY RELATIONS jobs
   - Training, teaching, mentoring, FTO, academy → TRAINING/L&D jobs
   - Data, statistics, analysis, crime analysis, reports → ANALYST jobs
   - Writing, documentation, reports, policies → WRITING/CONTENT jobs
   - Budgets, resources, scheduling, planning → OPERATIONS/PROJECT MANAGEMENT jobs

2. The "searchTerms" field is CRUCIAL. These must be SIMPLE 2-word phrases that job boards understand:
   GOOD: ["marketing coordinator", "communications specialist", "program manager", "training specialist", "security analyst"]
   BAD: ["Director of Strategic Communications", "Senior Marketing and PR Manager"]

3. Include ENTRY-LEVEL roles if the experience is tangential. Someone who did social media as 5% of their job should see "marketing coordinator" and "social media coordinator" - not just director-level roles.

4. Mix of private sector AND government-friendly titles. Include roles like:
   - "Program Analyst" (common government title)
   - "Management Analyst" (common government title)
   - "Public Affairs Specialist" (government)
   - Plus private sector equivalents

5. If someone was a PIO or did ANY media/community work, their searchTerms MUST include:
   - "marketing coordinator"
   - "communications specialist" 
   - "social media coordinator"
   - "public relations"

6. The "govSearchTerms" field should include law enforcement and government jobs matching their RANK level:
   - For Chiefs/Assistant Chiefs: "police chief", "director public safety", "chief security officer"
   - For Captains/Commanders: "police captain", "security director", "emergency manager"  
   - For Lieutenants: "police lieutenant", "security manager", "operations supervisor"
   - For Sergeants: "police sergeant", "security supervisor", "shift supervisor"
   - For Detectives: "criminal investigator", "fraud investigator", "special agent"
   - For Officers/Deputies: "police officer", "security officer", "correctional officer"
   - Also consider federal roles: "program analyst", "management analyst", "federal investigator"

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
          { original: "Community outreach", translated: "Stakeholder engagement and public relations" },
          { original: "Crisis response", translated: "Emergency management and high-stakes decision-making" }
        ],
        targetRoles: [
          "Operations Manager",
          "Program Manager",
          "Program Analyst",
          "Training Specialist",
          "Security Manager",
          "Compliance Analyst",
          "Communications Coordinator",
          "Public Affairs Specialist"
        ],
        searchTerms: [
          "program manager",
          "operations manager",
          "training specialist",
          "program analyst",
          "communications coordinator"
        ],
        govSearchTerms: [
          "police sergeant",
          "security supervisor",
          "program analyst",
          "management analyst"
        ],
        keywords: [
          "operations management", "program management", "team leadership",
          "stakeholder management", "risk assessment", "compliance",
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
