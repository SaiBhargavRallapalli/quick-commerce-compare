import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuickPrice — Compare prices across Blinkit, Zepto, Swiggy Instamart & more',
  description:
    'Real-time price comparison across all major quick commerce platforms in India — Blinkit, Zepto, Swiggy Instamart, BigBasket, JioMart, DMart Ready, and First Club.',
  keywords: 'quick commerce, price comparison, blinkit, zepto, swiggy instamart, bigbasket, jiomart, dmart, grocery',
  openGraph: {
    title: 'QuickPrice — Compare grocery prices instantly',
    description: 'Find the best price across all quick commerce apps in seconds.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}
