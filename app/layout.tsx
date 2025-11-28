import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Blue to New | Law Enforcement Career Transition',
  description: 'Helping law enforcement professionals translate their skills and find meaningful careers in the private sector.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased text-white">
        {children}
      </body>
    </html>
  )
}
