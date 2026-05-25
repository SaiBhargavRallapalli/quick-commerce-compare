import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const BASE_URL = 'https://quickpricecompare.in'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'QuickPrice — Compare Grocery Prices Across All Quick Commerce Apps',
    template: '%s | QuickPrice',
  },
  description:
    'Real-time price comparison across all major quick commerce platforms in India — Blinkit, Zepto, Swiggy Instamart, BigBasket, JioMart, DMart Ready, and First Club. Find the cheapest price instantly.',
  keywords: [
    'quick commerce price comparison',
    'blinkit vs zepto',
    'cheapest grocery price india',
    'swiggy instamart price',
    'bigbasket price',
    'jiomart price',
    'dmart price',
    'grocery comparison app india',
  ],
  authors: [{ name: 'QuickPrice' }],
  creator: 'QuickPrice',
  publisher: 'QuickPrice',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'QuickPrice — Compare Grocery Prices Instantly',
    description: 'Search once, compare prices on Blinkit, Zepto, Swiggy Instamart, BigBasket, JioMart, DMart & First Club simultaneously.',
    type: 'website',
    url: BASE_URL,
    siteName: 'QuickPrice',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuickPrice — Compare Grocery Prices Instantly',
    description: 'Find the cheapest grocery price across all quick commerce apps in India.',
  },
  other: {
    'google-adsense-account': 'ca-pub-6450653669194686',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-head" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NBTV4W35');`}
        </Script>
        {/* Google Analytics (GA4) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-V6MSPDCYDK"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-V6MSPDCYDK');
gtag('config', 'G-DN9KYVJHQ2');`}
        </Script>
        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6450653669194686"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NBTV4W35"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
