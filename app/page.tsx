'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, Briefcase, Sparkles, ArrowRight, X, Loader2, ChevronRight, MapPin, Building2, Clock, ExternalLink } from 'lucide-react'

// Types
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
}

interface TailoringResult {
  suggestions: string[]
  keywordsToAdd: string[]
  experienceToHighlight: string[]
  gaps: string[]
}

// Steps
type Step = 'upload' | 'jobs' | 'tailor'

export default function Home() {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [fileName, setFileName] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [tailoringResult, setTailoringResult] = useState<TailoringResult | null>(null)
  const [error, setError] = useState('')

  // Handle file drop
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

      setLoadingMessage('Searching for matching jobs...')
      
      const jobsResponse = await fetch('/api/search-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: data.skills, experience: data.experience }),
      })

      if (!jobsResponse.ok) throw new Error('Failed to search jobs')

      const jobsData = await jobsResponse.json()
      setJobs(jobsData.jobs)
      setStep('jobs')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
      setLoadingMessage('')
    }
  }

  const handleJobSelect = async (job: Job) => {
    setSelectedJob(job)
    setIsLoading(true)
    setLoadingMessage('Analyzing job requirements...')
    setError('')

    try {
      const response = await fetch('/api/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    setStep('upload')
    setResumeData(null)
    setFileName('')
    setJobs([])
    setSelectedJob(null)
    setTailoringResult(null)
    setError('')
  }

  return (
    <main className="min-h-screen text-white">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-semibold text-xl">JobMatch AI</span>
          </div>
          
          {step !== 'upload' && (
            <button
              onClick={startOver}
              className="text-sm text-surface-300 hover:text-white transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              New Resume
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-surface-800 bg-surface-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <StepIndicator 
              number={1} 
              label="Upload Resume" 
              active={step === 'upload'} 
              completed={step !== 'upload'} 
            />
            <ChevronRight className="w-5 h-5 text-surface-600" />
            <StepIndicator 
              number={2} 
              label="Browse Jobs" 
              active={step === 'jobs'} 
              completed={step === 'tailor'} 
            />
            <ChevronRight className="w-5 h-5 text-surface-600" />
            <StepIndicator 
              number={3} 
              label="Tailor Resume" 
              active={step === 'tailor'} 
              completed={false} 
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-surface-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 text-center animate-fade-in">
              <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-center gap-3 animate-fade-in">
            <X className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-surface-200 to-surface-400 bg-clip-text text-transparent">
                Find Your Perfect Job Match
              </h1>
              <p className="text-surface-400 text-lg max-w-2xl mx-auto">
                Upload your resume and we'll find relevant jobs, then help you tailor your resume for each opportunity.
              </p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                max-w-2xl mx-auto border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
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

            <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
              <FeatureCard
                icon={<FileText className="w-6 h-6" />}
                title="Smart Parsing"
                description="AI extracts your skills, experience, and education automatically"
              />
              <FeatureCard
                icon={<Briefcase className="w-6 h-6" />}
                title="Job Matching"
                description="Find jobs that align with your background from top job boards"
              />
              <FeatureCard
                icon={<Sparkles className="w-6 h-6" />}
                title="AI Tailoring"
                description="Get specific suggestions to optimize your resume for each job"
              />
            </div>
          </div>
        )}

        {/* Step 2: Jobs */}
        {step === 'jobs' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold mb-2">Jobs For You</h2>
              <p className="text-surface-400">
                Based on <span className="text-brand-400">{fileName}</span> — Found {jobs.length} matching positions
              </p>
            </div>

            {resumeData && resumeData.skills.length > 0 && (
              <div className="mb-8 p-4 bg-surface-900/50 border border-surface-800 rounded-xl">
                <p className="text-sm text-surface-400 mb-2">Skills detected:</p>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.slice(0, 10).map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-brand-500/20 text-brand-300 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                  {resumeData.skills.length > 10 && (
                    <span className="px-3 py-1 bg-surface-800 text-surface-400 rounded-full text-sm">
                      +{resumeData.skills.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {jobs.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  onSelect={() => handleJobSelect(job)}
                />
              ))}
            </div>

            {jobs.length === 0 && (
              <div className="text-center py-16">
                <Briefcase className="w-16 h-16 text-surface-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
                <p className="text-surface-400 mb-6">We couldn't find matching jobs. Try uploading a different resume.</p>
                <button onClick={startOver} className="px-6 py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition-colors">
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Tailor */}
        {step === 'tailor' && selectedJob && tailoringResult && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('jobs')}
              className="text-surface-400 hover:text-white transition-colors flex items-center gap-2 mb-8"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
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
                    <span className="flex items-center gap-1">
                      ${selectedJob.salary_min.toLocaleString()} - ${selectedJob.salary_max.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="prose prose-invert prose-sm max-w-none">
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
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Keywords to Add
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tailoringResult.keywordsToAdd.map((keyword, i) => (
                        <span key={i} className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
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
      </div>
    </main>
  )
}

// Components
function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
        ${completed ? 'bg-brand-500 text-white' : active ? 'bg-brand-500/20 text-brand-400 border border-brand-500' : 'bg-surface-800 text-surface-500'}
      `}>
        {completed ? '✓' : number}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-surface-500'}`}>
        {label}
      </span>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-surface-900/50 border border-surface-800 rounded-2xl hover:border-surface-700 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-surface-400 text-sm">{description}</p>
    </div>
  )
}

function JobCard({ job, index, onSelect }: { job: Job; index: number; onSelect: () => void }) {
  return (
    <div 
      className="p-6 bg-surface-900/50 border border-surface-800 rounded-2xl hover:border-surface-600 transition-all cursor-pointer group animate-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onSelect}
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
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(job.created).toLocaleDateString()}
            </span>
          </div>
          <p className="text-surface-400 text-sm line-clamp-2">{job.description.slice(0, 200)}...</p>
        </div>
        <ArrowRight className="w-5 h-5 text-surface-600 group-hover:text-brand-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
      </div>
    </div>
  )
}
