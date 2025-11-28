import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    let text = ''
    
    if (file.name.endsWith('.pdf')) {
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        text = data.text
      } catch (e) {
        text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ')
      }
    } else if (file.name.endsWith('.docx')) {
      try {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } catch (e) {
        text = buffer.toString('utf-8')
      }
    } else {
      text = buffer.toString('utf-8')
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyze this resume from a law enforcement professional and extract the following information in JSON format:
          
{
  "skills": ["list of skills - both LE-specific and transferable"],
  "experience": ["list of job titles, units, and key responsibilities"],
  "education": ["list of degrees, certifications, academies completed"],
  "rank": "current or most recent rank",
  "yearsOfService": "estimated years in law enforcement",
  "specializations": ["detected specializations like SWAT, Detective, K-9, etc."]
}

Resume text:
${text.slice(0, 10000)}

Respond ONLY with valid JSON, no other text.`
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let parsedData
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      parsedData = {
        skills: extractBasicSkills(text),
        experience: [],
        education: [],
        rank: '',
        yearsOfService: '',
        specializations: []
      }
    }

    return NextResponse.json({
      text: text.slice(0, 5000),
      ...parsedData
    })

  } catch (error) {
    console.error('Error parsing resume:', error)
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 })
  }
}

function extractBasicSkills(text: string): string[] {
  const leSkills = [
    'Investigation', 'Report Writing', 'Interviewing', 'Surveillance',
    'Crisis Management', 'Conflict Resolution', 'Evidence Collection',
    'Case Management', 'Training', 'Leadership', 'Communication',
    'Problem Solving', 'Critical Thinking', 'Decision Making',
    'Public Speaking', 'De-escalation', 'First Aid', 'CPR',
    'Firearms', 'Self Defense', 'Emergency Response'
  ]
  
  const foundSkills: string[] = []
  const lowerText = text.toLowerCase()
  
  for (const skill of leSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill)
    }
  }
  
  return foundSkills.slice(0, 20)
}
