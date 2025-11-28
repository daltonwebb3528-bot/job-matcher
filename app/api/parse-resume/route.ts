import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file content
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    let text = ''
    
    // For PDF files, we'll send the raw text to Claude to parse
    // For simplicity in MVP, we'll extract basic text
    if (file.name.endsWith('.pdf')) {
      // Try to extract text from PDF using pdf-parse
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        text = data.text
      } catch (e) {
        // Fallback: convert buffer to string and clean it
        text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ')
      }
    } else if (file.name.endsWith('.docx')) {
      // For DOCX, use mammoth
      try {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } catch (e) {
        text = buffer.toString('utf-8')
      }
    } else {
      // Plain text
      text = buffer.toString('utf-8')
    }

    // Use Claude to extract structured data from the resume
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyze this resume and extract the following information in JSON format:
          
{
  "skills": ["list of technical and soft skills mentioned"],
  "experience": ["list of job titles and brief descriptions"],
  "education": ["list of degrees, certifications, schools"],
  "keywords": ["important keywords for job searching"]
}

Resume text:
${text.slice(0, 10000)}

Respond ONLY with valid JSON, no other text.`
        }
      ]
    })

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let parsedData
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      // Fallback to basic extraction
      parsedData = {
        skills: extractBasicSkills(text),
        experience: [],
        education: [],
        keywords: []
      }
    }

    return NextResponse.json({
      text: text.slice(0, 5000),
      skills: parsedData.skills || [],
      experience: parsedData.experience || [],
      education: parsedData.education || [],
      keywords: parsedData.keywords || []
    })

  } catch (error) {
    console.error('Error parsing resume:', error)
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 })
  }
}

// Basic skill extraction fallback
function extractBasicSkills(text: string): string[] {
  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'Node.js',
    'SQL', 'AWS', 'Docker', 'Kubernetes', 'Git', 'Agile', 'Scrum',
    'Machine Learning', 'Data Analysis', 'Project Management', 'Leadership',
    'Communication', 'Problem Solving', 'Excel', 'PowerPoint', 'Salesforce',
    'Marketing', 'Sales', 'Customer Service', 'Finance', 'Accounting',
    'HTML', 'CSS', 'MongoDB', 'PostgreSQL', 'GraphQL', 'REST API',
    'Vue', 'Angular', 'Django', 'Flask', 'Spring', 'PHP', 'Ruby',
    'Photoshop', 'Figma', 'Sketch', 'UI/UX', 'Design', 'Analytics'
  ]
  
  const foundSkills: string[] = []
  const lowerText = text.toLowerCase()
  
  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.push(skill)
    }
  }
  
  return foundSkills.slice(0, 20)
}
