import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { resume, job } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are an expert resume consultant. Analyze the following resume against a job posting and provide specific, actionable recommendations to improve the resume for this particular job.

RESUME DATA:
Skills: ${resume.skills?.join(', ') || 'Not specified'}
Experience: ${resume.experience?.join('; ') || 'Not specified'}
Education: ${resume.education?.join('; ') || 'Not specified'}

Full Resume Text (excerpt):
${resume.text?.slice(0, 3000) || 'Not available'}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

Description:
${job.description}

Provide your analysis in this exact JSON format:
{
  "suggestions": [
    "Specific suggestion 1 for improving the resume for this job",
    "Specific suggestion 2",
    "Specific suggestion 3",
    "Specific suggestion 4",
    "Specific suggestion 5"
  ],
  "keywordsToAdd": [
    "keyword1",
    "keyword2",
    "keyword3"
  ],
  "experienceToHighlight": [
    "Specific experience or achievement to emphasize",
    "Another relevant experience to highlight"
  ],
  "gaps": [
    "Skill or qualification gap that might need to be addressed",
    "Another potential gap"
  ]
}

Be specific and actionable. Reference actual content from both the resume and job posting. Focus on what would make the biggest impact.

Respond ONLY with valid JSON, no other text.`
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let result
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      // Provide fallback suggestions
      result = {
        suggestions: [
          `Tailor your resume summary to mention ${job.company} and the specific role of ${job.title}`,
          'Quantify your achievements with specific metrics and numbers where possible',
          'Ensure your most relevant experience appears first on your resume',
          'Match the language and terminology used in the job description',
          'Consider adding a skills section that mirrors the job requirements'
        ],
        keywordsToAdd: extractKeywords(job.description),
        experienceToHighlight: [
          'Highlight any leadership or project management experience',
          'Emphasize collaborative work and team achievements'
        ],
        gaps: [
          'Review the job requirements and address any missing skills in your cover letter'
        ]
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error tailoring resume:', error)
    return NextResponse.json({ error: 'Failed to analyze job' }, { status: 500 })
  }
}

function extractKeywords(description: string): string[] {
  // Basic keyword extraction from job description
  const commonKeywords = [
    'leadership', 'communication', 'collaboration', 'problem-solving',
    'analytical', 'strategic', 'innovative', 'agile', 'scrum',
    'stakeholder', 'cross-functional', 'data-driven', 'scalable',
    'customer-focused', 'results-oriented', 'self-starter'
  ]
  
  const found: string[] = []
  const lowerDesc = description.toLowerCase()
  
  for (const keyword of commonKeywords) {
    if (lowerDesc.includes(keyword) && found.length < 5) {
      found.push(keyword)
    }
  }
  
  return found
}
