import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Handle FormData upload
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size)
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    let text = ''
    
    // Handle PDF files
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        // Dynamic import for pdf-parse
        const pdfParse = (await import('pdf-parse')).default
        const data = await pdfParse(buffer)
        text = data.text
        console.log('PDF text extracted, length:', text.length)
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        return NextResponse.json({ 
          error: 'Failed to parse PDF. The file may be scanned or image-based.' 
        }, { status: 500 })
      }
    }
    // Handle Word documents (.docx)
    else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')
    ) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
        console.log('DOCX text extracted, length:', text.length)
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError)
        return NextResponse.json({ error: 'Failed to parse Word document' }, { status: 500 })
      }
    }
    // Handle older Word documents (.doc)
    else if (
      file.type === 'application/msword' ||
      file.name.toLowerCase().endsWith('.doc')
    ) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
        console.log('DOC text extracted, length:', text.length)
      } catch (docError) {
        console.error('DOC parsing error:', docError)
        return NextResponse.json({ 
          error: 'Failed to parse Word document. Try saving as .docx' 
        }, { status: 500 })
      }
    }
    // Handle plain text
    else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      text = buffer.toString('utf-8')
      console.log('Text file read, length:', text.length)
    }
    else {
      return NextResponse.json({ 
        error: `Unsupported file type: ${file.type}. Please upload a PDF or Word document.` 
      }, { status: 400 })
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Could not extract text from file. The file may be empty or scanned.' 
      }, { status: 400 })
    }

    // Extract structured data from the resume text
    const resumeData = extractResumeData(text)
    
    console.log('Resume data extracted:', {
      skills: resumeData.skills.length,
      experience: resumeData.experience.length,
      education: resumeData.education.length,
      textLength: resumeData.text.length
    })

    return NextResponse.json(resumeData)

  } catch (error) {
    console.error('Error parsing resume:', error)
    return NextResponse.json({ 
      error: 'Failed to parse resume. Please try a different file format.' 
    }, { status: 500 })
  }
}

function extractResumeData(text: string): {
  text: string
  skills: string[]
  experience: string[]
  education: string[]
} {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  const skills: string[] = []
  const experience: string[] = []
  const education: string[] = []
  
  let currentSection = ''
  
  // Common section headers
  const skillHeaders = ['skills', 'technical skills', 'core competencies', 'competencies', 'expertise', 'qualifications', 'certifications']
  const experienceHeaders = ['experience', 'work experience', 'professional experience', 'employment', 'work history', 'career history']
  const educationHeaders = ['education', 'academic', 'degrees', 'training', 'certifications and training']
  
  for (const line of lines) {
    const lineLower = line.toLowerCase()
    
    // Detect section headers
    if (skillHeaders.some(h => lineLower.includes(h) && line.length < 50)) {
      currentSection = 'skills'
      continue
    }
    if (experienceHeaders.some(h => lineLower.includes(h) && line.length < 50)) {
      currentSection = 'experience'
      continue
    }
    if (educationHeaders.some(h => lineLower.includes(h) && line.length < 50)) {
      currentSection = 'education'
      continue
    }
    
    // Add content to appropriate section
    if (currentSection === 'skills' && line.length > 2 && line.length < 200) {
      if (line.includes(',')) {
        skills.push(...line.split(',').map(s => s.trim()).filter(s => s.length > 1))
      } else if (line.includes('•') || line.includes('·') || line.includes('-')) {
        skills.push(line.replace(/^[•·\-\*]\s*/, '').trim())
      } else {
        skills.push(line)
      }
    }
    else if (currentSection === 'experience' && line.length > 10) {
      experience.push(line)
    }
    else if (currentSection === 'education' && line.length > 5) {
      education.push(line)
    }
  }
  
  // If no sections were detected, try to extract skills from the full text
  if (skills.length === 0) {
    const commonSkills = [
      'leadership', 'management', 'communication', 'investigation', 'analysis',
      'report writing', 'training', 'supervision', 'crisis management', 'public speaking',
      'project management', 'team building', 'problem solving', 'decision making',
      'conflict resolution', 'negotiation', 'risk assessment', 'compliance',
      'microsoft office', 'excel', 'word', 'powerpoint', 'database', 'research'
    ]
    
    const textLower = text.toLowerCase()
    for (const skill of commonSkills) {
      if (textLower.includes(skill)) {
        skills.push(skill)
      }
    }
  }
  
  // Extract any bullet points as potential experience items
  if (experience.length === 0) {
    const bulletLines = lines.filter(l => 
      (l.startsWith('•') || l.startsWith('-') || l.startsWith('*') || /^\d+[\.\)]/.test(l)) &&
      l.length > 20
    )
    experience.push(...bulletLines.slice(0, 15).map(l => l.replace(/^[•\-\*\d\.\)]+\s*/, '')))
  }
  
  return {
    text: text.slice(0, 10000),
    skills: [...new Set(skills)].slice(0, 30),
    experience: experience.slice(0, 20),
    education: education.slice(0, 10)
  }
}
