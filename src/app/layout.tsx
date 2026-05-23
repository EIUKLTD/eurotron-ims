import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eurotron IMS | Instrument Management',
  description: 'Eurotron Instruments (UK) Ltd — Gas Analyser Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
