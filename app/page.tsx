'use client'

import { useState, useCallback } from 'react'
import { 
  Upload, FileText, Briefcase, Sparkles, ArrowRight, ArrowLeft, X, Loader2, 
  ChevronRight, MapPin, Building2, Clock, ExternalLink, Shield, Award,
  Users, ClipboardList, Lock, Check, Star
} from 'lucide-react'

// Types
interface QuestionnaireData {
  rank: string
  yearsOfService: string
  department: string
  specializations: string[]
  dailyDuties: string
  certifications: string[]
  leadershipCount: string
  education: string
  whyLeaving: string
  desiredIndustry: string[]
  location: string
  salaryExpectation: string
}

interface TranslatedProfile {
  summary: string
  translatedSkills: { original: string; translated: string }[]
  targetRoles: string[]
  keywords: string[]
}

interface ResumeData {
  text: string
  skills: string[]
  experience: string[]
  education: string[]
}

interface Job {
  id: string
  title: string
  company: string
  location: string
  description: string
  salary_min?: number
  salary_max?: number
  created: string
  redirect_url: string
  matchScore?: number
  source?: string
}

interface TailoringResult {
  suggestions: string[]
  keywordsToAdd: string[]
  experienceToHighlight: string[]
  gaps: string[]
}

type Step = 'start' | 'questionnaire' | 'upload' | 'processing' | 'profile' | 'jobs' | 'tailor'

const SPECIALIZATIONS = [
  'Patrol / Uniformed',
  'Investigations / Detective',
  'SWAT / Tactical',
  'K-9 Unit',
  'Narcotics / Vice',
  'Cyber Crimes',
  'Traffic / DUI',
  'Community Policing',
  'Internal Affairs',
  'Training / Academy',
  'Crime Scene / Forensics',
  'Gang Unit',
  'Homicide',
  'Juvenile / Youth',
  'School Resource Officer',
  'Administration / Command'
]

const CERTIFICATIONS = [
  'Firearms Instructor',
  'Defensive Tactics Instructor',
  'Field Training Officer (FTO)',
  'Interview & Interrogation',
  'Crisis Intervention (CIT)',
  'Drug Recognition Expert (DRE)',
  'Accident Reconstruction',
  'SWAT/Tactical Certification',
  'K-9 Handler',
  'Crime Scene Investigation',
  'Polygraph Examiner',
  'Hostage Negotiator',
  'Emergency Vehicle Operations',
  'Leadership / Management Training',
  'Other (specify in duties)'
]

const TARGET_INDUSTRIES = [
  'Corporate Security',
  'Private Investigation',
  'Risk Management',
  'Fraud Investigation',
  'Insurance Investigation',
  'Compliance',
  'Government Contractor',
  'Consulting',
  'Human Resources',
  'Loss Prevention',
  'Executive Protection',
  'Cybersecurity',
  'Legal / Paralegal',
  'Training / Education',
  'Open to All'
]

export default function Home() {
  const [step, setStep] = useState<Step>('start')
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [questionStep, setQuestionStep] = useState(0)
  const [isPremium, setIsPremium] = useState(false) // Will be replaced with real auth
  
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData>({
    rank: '',
    yearsOfService: '',
    department: '',
    specializations: [],
    dailyDuties: '',
    certifications: [],
    leadershipCount: '',
    education: '',
    whyLeaving: '',
    desiredIndustry: [],
    location: '',
    salaryExpectation: ''
  })
  
  const [translatedProfile, setTranslatedProfile] = useState<TranslatedProfile | null>(null)
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [fileName, setFileName] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [tailoringResult, setTailoringResult] = useState<TailoringResult | null>(null)
  const [error, setError] = useState('')

  // Question sections for the multi-step form
  const questionSections = [
    { title: 'Your Background', fields: ['rank', 'yearsOfService', 'department'] },
    { title: 'Specializations', fields: ['specializations'] },
    { title: 'Daily Duties', fields: ['dailyDuties'] },
    { title: 'Certifications', fields: ['certifications'] },
    { title: 'Leadership', fields: ['leadershipCount', 'education'] },
    { title: 'Your Goals', fields: ['whyLeaving', 'desiredIndustry'] },
    { title: 'Preferences', fields: ['location', 'salaryExpectation'] }
  ]

  const handleQuestionnaireChange = (field: keyof QuestionnaireData, value: string | string[]) => {
    setQuestionnaire(prev => ({ ...prev, [field]: value }))
  }

  const toggleArrayField = (field: 'specializations' | 'certifications' | 'desiredIndustry', value: string) => {
    setQuestionnaire(prev => {
      const current = prev[field]
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) }
      } else {
        return { ...prev, [field]: [...current, value] }
      }
    })
  }

  // Handle file upload
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processFile(file)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
  }

  const processFile = async (file: File) => {
    setError('')
    setIsLoading(true)
    setStep('processing')
    setLoadingMessage('Reading your resume...')
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to parse resume')

      const data = await response.json()
      setResumeData(data)
      
      // Create a translated profile from resume
      setLoadingMessage('Translating your experience...')
      
      const translateResponse = await fetch('/api/translate-experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source: 'resume',
          resumeData: data 
        }),
      })

      if (translateResponse.ok) {
        const profileData = await translateResponse.json()
        setTranslatedProfile(profileData)
      }

      setLoadingMessage('Finding matching opportunities...')
      
      const jobsResponse = await fetch('/api/search-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          skills: data.skills, 
          keywords: translatedProfile?.keywords || [],
          targetRoles: translatedProfile?.targetRoles || [],
          searchTerms: translatedProfile?.searchTerms || translatedProfile?.targetRoles || [],
          govSearchTerms: translatedProfile?.govSearchTerms || [],
          location: ''
        }),
      })

      if (!jobsResponse.ok) throw new Error('Failed to search jobs')

      const jobsData = await jobsResponse.json()
      setJobs(jobsData.jobs)
      setStep('profile')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setStep('upload')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  const submitQuestionnaire = async () => {
    setError('')
    setIsLoading(true)
    setStep('processing')
    setLoadingMessage('Analyzing your experience...')

    try {
      // Translate LE experience to corporate language
      const translateResponse = await fetch('/api/translate-experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source: 'questionnaire',
          questionnaire 
        }),
      })

      if (!translateResponse.ok) throw new Error('Failed to translate experience')

      const profileData = await translateResponse.json()
      setTranslatedProfile(profileData)

      setLoadingMessage('Finding matching opportunities...')

      const jobsResponse = await fetch('/api/search-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          skills: profileData.keywords,
          targetRoles: profileData.targetRoles,
          keywords: profileData.keywords,
          searchTerms: profileData.searchTerms || profileData.targetRoles,
          govSearchTerms: profileData.govSearchTerms || [],
          location: questionnaire.location
        }),
      })

      if (!jobsResponse.ok) throw new Error('Failed to search jobs')

      const jobsData = await jobsResponse.json()
      setJobs(jobsData.jobs)
      setStep('profile')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setStep('questionnaire')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  const handleJobSelect = async (job: Job) => {
    if (!isPremium) {
      // Show premium prompt
      setSelectedJob(job)
      return
    }
    
    setSelectedJob(job)
    setIsLoading(true)
    setLoadingMessage('Analyzing job requirements...')
    setError('')

    try {
      const response = await fetch('/api/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: translatedProfile,
          questionnaire: questionnaire,
          resume: resumeData,
          job: job,
        }),
      })

      if (!response.ok) throw new Error('Failed to analyze job')

      const data = await response.json()
      setTailoringResult(data)
      setStep('tailor')
    } catch (err) {
      setError('Failed to analyze this job. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  const startOver = () => {
    setStep('start')
    setQuestionStep(0)
    setQuestionnaire({
      rank: '',
      yearsOfService: '',
      department: '',
      specializations: [],
      dailyDuties: '',
      certifications: [],
      leadershipCount: '',
      education: '',
      whyLeaving: '',
      desiredIndustry: [],
      location: '',
      salaryExpectation: ''
    })
    setTranslatedProfile(null)
    setResumeData(null)
    setFileName('')
    setJobs([])
    setSelectedJob(null)
    setTailoringResult(null)
    setError('')
  }

  const progressPercent = (questionStep / (questionSections.length - 1)) * 100

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={startOver}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-xl">Blue to New</span>
              <span className="hidden sm:inline text-surface-400 text-sm ml-2">Career Transition</span>
            </div>
          </div>
          
          {step !== 'start' && (
            <button
              onClick={startOver}
              className="text-sm text-surface-400 hover:text-white transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 text-center animate-fade-in max-w-sm">
            <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">{loadingMessage}</p>
            <p className="text-surface-400 text-sm">This may take a moment...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-center gap-3 animate-fade-in">
            <X className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        
        {/* START SCREEN */}
        {step === 'start' && (
          <div className="animate-fade-in">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/30 rounded-full text-brand-400 text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Built for Law Enforcement Professionals
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-surface-200 to-surface-400 bg-clip-text text-transparent leading-tight">
                Your Service Prepared You<br />For What's Next
              </h1>
              <p className="text-surface-400 text-xl max-w-2xl mx-auto">
                Translate your law enforcement experience into corporate language and find meaningful careers in the private sector.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
              {/* Option 1: Questionnaire */}
              <button
                onClick={() => setStep('questionnaire')}
                className="group p-8 bg-surface-900/50 border border-surface-700 rounded-2xl hover:border-brand-500/50 hover:bg-surface-800/50 transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 mb-6 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">Answer Questions</h3>
                <p className="text-surface-400 mb-4">
                  No resume? No problem. Tell us about your service and we'll translate it for you.
                </p>
                <span className="inline-flex items-center gap-2 text-brand-400 font-medium">
                  Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              {/* Option 2: Upload Resume */}
              <button
                onClick={() => setStep('upload')}
                className="group p-8 bg-surface-900/50 border border-surface-700 rounded-2xl hover:border-brand-500/50 hover:bg-surface-800/50 transition-all text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">Upload Resume</h3>
                <p className="text-surface-400 mb-4">
                  Already have a resume? Upload it and we'll analyze and enhance it.
                </p>
                <span className="inline-flex items-center gap-2 text-brand-400 font-medium">
                  Upload PDF/Word <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>

            {/* How it works */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4 text-xl font-bold text-brand-400">1</div>
                <h4 className="font-semibold mb-2">Share Your Experience</h4>
                <p className="text-surface-400 text-sm">Answer questions about your service or upload your current resume</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4 text-xl font-bold text-brand-400">2</div>
                <h4 className="font-semibold mb-2">Get Translated</h4>
                <p className="text-surface-400 text-sm">AI converts your LE skills into corporate-friendly language</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4 text-xl font-bold text-brand-400">3</div>
                <h4 className="font-semibold mb-2">Find Opportunities</h4>
                <p className="text-surface-400 text-sm">Browse matched jobs and get tailored resume suggestions</p>
              </div>
            </div>
          </div>
        )}

        {/* QUESTIONNAIRE */}
        {step === 'questionnaire' && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-surface-400 mb-2">
                <span>{questionSections[questionStep].title}</span>
                <span>{questionStep + 1} of {questionSections.length}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Question Content */}
            <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-8">
              
              {/* Step 0: Background */}
              {questionStep === 0 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-6">Tell us about your background</h2>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Current or Most Recent Rank</label>
                    <input
                      type="text"
                      value={questionnaire.rank}
                      onChange={(e) => handleQuestionnaireChange('rank', e.target.value)}
                      placeholder="e.g., Sergeant, Detective, Officer"
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Years of Service</label>
                    <select
                      value={questionnaire.yearsOfService}
                      onChange={(e) => handleQuestionnaireChange('yearsOfService', e.target.value)}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="1-5">1-5 years</option>
                      <option value="6-10">6-10 years</option>
                      <option value="11-15">11-15 years</option>
                      <option value="16-20">16-20 years</option>
                      <option value="20+">20+ years</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Department/Agency Type</label>
                    <select
                      value={questionnaire.department}
                      onChange={(e) => handleQuestionnaireChange('department', e.target.value)}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="Municipal Police">Municipal Police</option>
                      <option value="County Sheriff">County Sheriff</option>
                      <option value="State Police/Trooper">State Police/Trooper</option>
                      <option value="Federal Agency">Federal Agency (FBI, DEA, ATF, etc.)</option>
                      <option value="Campus Police">Campus Police</option>
                      <option value="Transit Police">Transit Police</option>
                      <option value="Corrections">Corrections</option>
                      <option value="Military Police">Military Police</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 1: Specializations */}
              {questionStep === 1 && (
                <div className="animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-2">What units or specializations?</h2>
                  <p className="text-surface-400 mb-6">Select all that apply</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {SPECIALIZATIONS.map((spec) => (
                      <label key={spec} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={questionnaire.specializations.includes(spec)}
                          onChange={() => toggleArrayField('specializations', spec)}
                          className="sr-only"
                        />
                        <div className={`checkbox-card-content p-3 border rounded-xl cursor-pointer transition-all ${
                          questionnaire.specializations.includes(spec)
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-surface-700 hover:border-surface-600'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              questionnaire.specializations.includes(spec)
                                ? 'border-brand-500 bg-brand-500'
                                : 'border-surface-600'
                            }`}>
                              {questionnaire.specializations.includes(spec) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm">{spec}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Daily Duties */}
              {questionStep === 2 && (
                <div className="animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-2">Describe your daily duties</h2>
                  <p className="text-surface-400 mb-6">Be specific - this helps us translate your experience accurately</p>
                  
                  <textarea
                    value={questionnaire.dailyDuties}
                    onChange={(e) => handleQuestionnaireChange('dailyDuties', e.target.value)}
                    placeholder="Example: Responded to calls for service, conducted preliminary investigations, interviewed witnesses and suspects, wrote detailed incident reports, testified in court, trained new officers..."
                    rows={8}
                    className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors resize-none"
                  />
                  
                  <p className="text-surface-500 text-sm mt-3">
                    Tip: Include things like report writing, investigations, interviews, team supervision, training, community programs, etc.
                  </p>
                </div>
              )}

              {/* Step 3: Certifications */}
              {questionStep === 3 && (
                <div className="animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-2">Certifications & Training</h2>
                  <p className="text-surface-400 mb-6">Select any specialized training you've completed</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {CERTIFICATIONS.map((cert) => (
                      <label key={cert} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={questionnaire.certifications.includes(cert)}
                          onChange={() => toggleArrayField('certifications', cert)}
                          className="sr-only"
                        />
                        <div className={`checkbox-card-content p-3 border rounded-xl cursor-pointer transition-all ${
                          questionnaire.certifications.includes(cert)
                            ? 'border-brand-500 bg-brand-500/10'
                            : 'border-surface-700 hover:border-surface-600'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              questionnaire.certifications.includes(cert)
                                ? 'border-brand-500 bg-brand-500'
                                : 'border-surface-600'
                            }`}>
                              {questionnaire.certifications.includes(cert) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm">{cert}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Leadership & Education */}
              {questionStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-6">Leadership & Education</h2>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">How many people have you supervised?</label>
                    <select
                      value={questionnaire.leadershipCount}
                      onChange={(e) => handleQuestionnaireChange('leadershipCount', e.target.value)}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="0">None - individual contributor</option>
                      <option value="1-5">1-5 direct reports</option>
                      <option value="6-10">6-10 direct reports</option>
                      <option value="11-20">11-20 direct reports</option>
                      <option value="20+">20+ direct reports</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Highest Education Level</label>
                    <select
                      value={questionnaire.education}
                      onChange={(e) => handleQuestionnaireChange('education', e.target.value)}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="High School">High School / GED</option>
                      <option value="Some College">Some College</option>
                      <option value="Associates">Associate's Degree</option>
                      <option value="Bachelors">Bachelor's Degree</option>
                      <option value="Masters">Master's Degree</option>
                      <option value="Doctorate">Doctorate / JD</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 5: Goals */}
              {questionStep === 5 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-6">Your Career Goals</h2>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Why are you looking to transition?</label>
                    <textarea
                      value={questionnaire.whyLeaving}
                      onChange={(e) => handleQuestionnaireChange('whyLeaving', e.target.value)}
                      placeholder="Optional - helps us understand what you're looking for"
                      rows={3}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">What industries interest you?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {TARGET_INDUSTRIES.map((industry) => (
                        <label key={industry} className="checkbox-card">
                          <input
                            type="checkbox"
                            checked={questionnaire.desiredIndustry.includes(industry)}
                            onChange={() => toggleArrayField('desiredIndustry', industry)}
                            className="sr-only"
                          />
                          <div className={`checkbox-card-content p-3 border rounded-xl cursor-pointer transition-all ${
                            questionnaire.desiredIndustry.includes(industry)
                              ? 'border-brand-500 bg-brand-500/10'
                              : 'border-surface-700 hover:border-surface-600'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                questionnaire.desiredIndustry.includes(industry)
                                  ? 'border-brand-500 bg-brand-500'
                                  : 'border-surface-600'
                              }`}>
                                {questionnaire.desiredIndustry.includes(industry) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <span className="text-sm">{industry}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Preferences */}
              {questionStep === 6 && (
                <div className="space-y-6 animate-fade-in">
                  <h2 className="font-display text-2xl font-bold mb-6">Final Details</h2>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Preferred Location</label>
                    <input
                      type="text"
                      value={questionnaire.location}
                      onChange={(e) => handleQuestionnaireChange('location', e.target.value)}
                      placeholder="e.g., Dallas, TX or Remote"
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Salary Expectation</label>
                    <select
                      value={questionnaire.salaryExpectation}
                      onChange={(e) => handleQuestionnaireChange('salaryExpectation', e.target.value)}
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Select...</option>
                      <option value="50-70k">$50,000 - $70,000</option>
                      <option value="70-90k">$70,000 - $90,000</option>
                      <option value="90-110k">$90,000 - $110,000</option>
                      <option value="110-130k">$110,000 - $130,000</option>
                      <option value="130k+">$130,000+</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-surface-800">
                {questionStep > 0 ? (
                  <button
                    onClick={() => setQuestionStep(prev => prev - 1)}
                    className="flex items-center gap-2 px-4 py-2 text-surface-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('start')}
                    className="flex items-center gap-2 px-4 py-2 text-surface-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel
                  </button>
                )}

                {questionStep < questionSections.length - 1 ? (
                  <button
                    onClick={() => setQuestionStep(prev => prev + 1)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition-colors"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={submitQuestionnaire}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Translate My Experience
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* UPLOAD RESUME */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <button
              onClick={() => setStep('start')}
              className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold mb-3">Upload Your Resume</h1>
              <p className="text-surface-400">We'll analyze it and translate your LE experience into corporate language</p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
                ${isDragging 
                  ? 'border-brand-400 bg-brand-400/10' 
                  : 'border-surface-700 hover:border-surface-500 bg-surface-900/50'
                }
              `}
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-surface-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Drop your resume here</h3>
              <p className="text-surface-400 mb-6">or click to browse</p>
              
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5" />
                Choose File
              </label>
              
              <p className="text-surface-500 text-sm mt-6">Supports PDF and Word documents</p>
            </div>

            <div className="mt-8 p-4 bg-surface-900/50 border border-surface-800 rounded-xl">
              <p className="text-surface-400 text-sm">
                <strong className="text-white">Don't have a resume?</strong> No problem — {' '}
                <button onClick={() => setStep('questionnaire')} className="text-brand-400 hover:underline">
                  answer a few questions instead
                </button>
              </p>
            </div>
          </div>
        )}

        {/* PROFILE - Translated Experience */}
        {step === 'profile' && translatedProfile && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold mb-2">Your Translated Profile</h2>
              <p className="text-surface-400">Here's how your experience translates to the private sector</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mb-12">
              {/* Summary */}
              <div className="lg:col-span-2 bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-400" />
                  Professional Summary
                </h3>
                <p className="text-surface-300 leading-relaxed">{translatedProfile.summary}</p>
              </div>

              {/* Target Roles */}
              <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-brand-400" />
                  Target Roles
                </h3>
                <ul className="space-y-2">
                  {translatedProfile.targetRoles.map((role, i) => (
                    <li key={i} className="flex items-center gap-2 text-surface-300">
                      <ChevronRight className="w-4 h-4 text-brand-400" />
                      {role}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Skills Translation */}
            <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6 mb-12">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" />
                Skills Translation
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {translatedProfile.translatedSkills.map((skill, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-surface-800/50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-surface-500 text-sm mb-1">Law Enforcement</p>
                      <p className="text-surface-300">{skill.original}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-brand-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-brand-400 text-sm mb-1">Corporate</p>
                      <p className="text-white">{skill.translated}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="mb-12">
              <h3 className="font-semibold text-lg mb-4">Keywords for Your Resume</h3>
              <div className="flex flex-wrap gap-2">
                {translatedProfile.keywords.map((keyword, i) => (
                  <span key={i} className="px-3 py-1.5 bg-brand-500/20 text-brand-300 rounded-full text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Continue to Jobs */}
            <div className="flex justify-center">
              <button
                onClick={() => setStep('jobs')}
                className="flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-600 rounded-xl font-semibold transition-colors"
              >
                View Matching Jobs
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* JOBS LIST */}
        {step === 'jobs' && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('profile')}
              className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Profile
            </button>

            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold mb-2">Matching Opportunities</h2>
              <p className="text-surface-400">Found {jobs.length} positions that match your experience</p>
            </div>

            {/* Premium Banner */}
            {!isPremium && (
              <div className="mb-8 p-6 bg-gradient-to-r from-brand-500/20 to-gold-500/20 border border-brand-500/30 rounded-2xl">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Unlock AI Resume Tailoring</h3>
                    <p className="text-surface-400">Get personalized suggestions for each job application</p>
                  </div>
                  <button
                    onClick={() => setIsPremium(true)}
                    className="px-6 py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition-colors"
                  >
                    Upgrade - $15/month
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {jobs.map((job, index) => (
                <div
                  key={job.id}
                  className="p-6 bg-surface-900/50 border border-surface-800 rounded-2xl hover:border-surface-600 transition-all cursor-pointer group animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleJobSelect(job)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg group-hover:text-brand-400 transition-colors">{job.title}</h3>
                        {job.matchScore && (
                          <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 text-xs font-medium rounded-full">
                            {job.matchScore}% match
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-surface-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                        {job.salary_min && job.salary_max && (
                          <span>${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}</span>
                        )}
                      </div>
                      <p className="text-surface-400 text-sm line-clamp-2">{job.description.slice(0, 200)}...</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!isPremium && (
                        <Lock className="w-4 h-4 text-surface-600" />
                      )}
                      <ArrowRight className="w-5 h-5 text-surface-600 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAILOR - Premium Feature */}
        {step === 'tailor' && selectedJob && tailoringResult && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('jobs')}
              className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to jobs
            </button>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Job Details */}
              <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold mb-1">{selectedJob.title}</h2>
                    <p className="text-brand-400 font-medium">{selectedJob.company}</p>
                  </div>
                  <a
                    href={selectedJob.redirect_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-5 h-5 text-surface-400" />
                  </a>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-surface-400 mb-6">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {selectedJob.location}
                  </span>
                  {selectedJob.salary_min && selectedJob.salary_max && (
                    <span>
                      ${selectedJob.salary_min.toLocaleString()} - ${selectedJob.salary_max.toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-surface-300 font-medium mb-2">Job Description</h4>
                  <p className="text-surface-400 whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedJob.description.slice(0, 1000)}
                    {selectedJob.description.length > 1000 && '...'}
                  </p>
                </div>
              </div>

              {/* AI Suggestions */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/30 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-brand-400" />
                    </div>
                    <h3 className="font-display text-xl font-semibold">AI Recommendations</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {tailoringResult.suggestions.map((suggestion, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs text-brand-400 font-medium">{i + 1}</span>
                        </div>
                        <p className="text-surface-200">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {tailoringResult.keywordsToAdd.length > 0 && (
                  <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gold-400"></span>
                      Keywords to Add
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tailoringResult.keywordsToAdd.map((keyword, i) => (
                        <span key={i} className="px-3 py-1 bg-gold-500/20 text-gold-400 rounded-full text-sm">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tailoringResult.experienceToHighlight.length > 0 && (
                  <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                      Experience to Highlight
                    </h3>
                    <ul className="space-y-2">
                      {tailoringResult.experienceToHighlight.map((exp, i) => (
                        <li key={i} className="text-surface-300 text-sm flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                          {exp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tailoringResult.gaps.length > 0 && (
                  <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      Gaps to Address
                    </h3>
                    <ul className="space-y-2">
                      {tailoringResult.gaps.map((gap, i) => (
                        <li key={i} className="text-surface-300 text-sm flex items-start gap-2">
                          <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <a
                  href={selectedJob.redirect_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-brand-500 hover:bg-brand-600 text-center font-semibold rounded-xl transition-colors"
                >
                  Apply to This Job
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Premium Modal - when non-premium user clicks job */}
        {!isPremium && selectedJob && step === 'jobs' && (
          <div className="fixed inset-0 bg-surface-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 max-w-md animate-fade-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-brand-400" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-2">Unlock AI Tailoring</h3>
                <p className="text-surface-400">Get personalized resume suggestions for "{selectedJob.title}"</p>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-surface-300">
                  <Check className="w-5 h-5 text-brand-400" />
                  AI-powered resume recommendations
                </li>
                <li className="flex items-center gap-3 text-surface-300">
                  <Check className="w-5 h-5 text-brand-400" />
                  Keyword optimization for each job
                </li>
                <li className="flex items-center gap-3 text-surface-300">
                  <Check className="w-5 h-5 text-brand-400" />
                  Gap analysis and suggestions
                </li>
                <li className="flex items-center gap-3 text-surface-300">
                  <Check className="w-5 h-5 text-brand-400" />
                  Unlimited job applications
                </li>
              </ul>

              <button
                onClick={() => {
                  setIsPremium(true)
                  handleJobSelect(selectedJob)
                }}
                className="w-full py-4 bg-brand-500 hover:bg-brand-600 rounded-xl font-semibold transition-colors mb-3"
              >
                Upgrade - $15/month
              </button>
              <button
                onClick={() => setSelectedJob(null)}
                className="w-full py-3 text-surface-400 hover:text-white transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
