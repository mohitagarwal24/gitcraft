import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GitCraft - Living Engineering Brain',
  description: 'Transform your GitHub repository into a self-updating engineering knowledge base in Craft',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

