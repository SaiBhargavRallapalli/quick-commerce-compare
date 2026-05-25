'use client'

import { useState, useCallback, useRef } from 'react'
import Script from 'next/script'
import Header from '@/components/Header'
import SearchBar from '@/components/SearchBar'
import PlatformSection from '@/components/PlatformSection'
import BestDealBanner from '@/components/BestDealBanner'
import type { PlatformResult, PlatformId, Product } from '@/lib/types'
import { PLATFORMS } from '@/lib/platforms'
import { Zap, TrendingDown, RefreshCw } from 'lucide-react'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'QuickPrice',
  description: 'Real-time grocery price comparison across all major quick commerce platforms in India.',
  applicationCategory: 'ShoppingApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
}

type ResultMap = Record<string, PlatformResult>

function buildInitialResults(): ResultMap {
  const map: ResultMap = {}
  for (const p of PLATFORMS) {
    map[p.id] = { platform: p.id as PlatformId, products: [], status: 'idle' }
  }
  return map
}

export default function HomePage() {
  const [results, setResults] = useState<ResultMap>(buildInitialResults)
  const [isSearching, setIsSearching] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (query: string, pincode: string) => {
    // Cancel previous search
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setCurrentQuery(query)
    setDoneCount(0)
    setIsSearching(true)

    // Set all platforms to loading
    setResults(() => {
      const map: ResultMap = {}
      for (const p of PLATFORMS) {
        map[p.id] = { platform: p.id as PlatformId, products: [], status: 'loading' }
      }
      return map
    })

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&pincode=${pincode}`,
        { signal: abort.signal }
      )

      if (!res.ok || !res.body) throw new Error('Search request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'location') {
              setLocationCity(event.location.city)
            }

            if (event.type === 'platform_result') {
              const r: PlatformResult = event.data
              setResults(prev => ({ ...prev, [r.platform]: r }))
              setDoneCount(c => c + 1)
            }

            if (event.type === 'done') {
              setIsSearching(false)
            }
          } catch {
            // malformed JSON, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Mark all still-loading as error
        setResults(prev => {
          const updated: ResultMap = {}
          for (const [id, r] of Object.entries(prev)) {
            updated[id] = r.status === 'loading'
              ? { ...r, status: 'error', error: 'Request failed' }
              : r
          }
          return updated
        })
      }
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Compute best price across all platforms
  const allProducts = Object.values(results)
    .flatMap(r => r.products)
    .filter(p => p.inStock && p.price > 0)
    .sort((a, b) => a.price - b.price)

  const bestProduct: Product | null = allProducts[0] ?? null
  const maxPrice = allProducts.length > 0 ? Math.max(...allProducts.map(p => p.price)) : 0

  // Price per platform for comparison bar
  const platformBestPrices = Object.entries(results)
    .filter(([, r]) => r.status === 'success' && r.products.length > 0)
    .map(([id, r]) => ({
      platform: id,
      price: Math.min(...r.products.filter(p => p.inStock && p.price > 0).map(p => p.price).filter(Boolean))
    }))
    .filter(p => isFinite(p.price))

  const hasResults = Object.values(results).some(r => r.status === 'success' && r.products.length > 0)
  const hasStarted = Object.values(results).some(r => r.status !== 'idle')
  const totalPlatforms = PLATFORMS.length

  // Sort platforms: success first (by best price), then loading, then error/empty
  const sortedPlatforms = [...PLATFORMS].sort((a, b) => {
    const ra = results[a.id]
    const rb = results[b.id]
    if (ra.status === 'success' && rb.status !== 'success') return -1
    if (rb.status === 'success' && ra.status !== 'success') return 1
    if (ra.status === 'loading' && rb.status !== 'loading') return -1
    if (rb.status === 'loading' && ra.status !== 'loading') return 1
    // Both success — sort by best price
    const priceA = Math.min(...(ra.products.filter(p => p.inStock && p.price > 0).map(p => p.price)), Infinity)
    const priceB = Math.min(...(rb.products.filter(p => p.inStock && p.price > 0).map(p => p.price)), Infinity)
    return priceA - priceB
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Header />

      <main className="flex-1">
        {/* Hero section */}
        <section className={`transition-all duration-500 ${hasStarted ? 'py-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800' : 'py-20'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {!hasStarted && (
              <div className="text-center mb-10 animate-fade-in">
                <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium px-4 py-2 rounded-full mb-6">
                  <Zap className="w-4 h-4" />
                  Real-time prices across 9 platforms
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-4">
                  Stop switching apps.<br />
                  <span className="text-green-600">Compare instantly.</span>
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
                  Search once, compare prices on Blinkit, Zepto, Swiggy Instamart, BigBasket, JioMart, DMart, Flipkart &amp; Amazon Fresh simultaneously.
                </p>
              </div>
            )}

            <SearchBar onSearch={handleSearch} isSearching={isSearching} />

            {/* Platform pills */}
            {!hasStarted && (
              <div className="mt-8 flex flex-wrap justify-center gap-2 animate-fade-in">
                {PLATFORMS.map(p => (
                  <span
                    key={p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: p.bgLight, color: p.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        {hasStarted && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4 animate-fade-in">
            {/* Status bar */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Fetching prices… ({doneCount}/{totalPlatforms})
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Found prices across {doneCount} platform{doneCount !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {locationCity && (
                  <span className="text-gray-400 dark:text-gray-500">• Showing for {locationCity}</span>
                )}
              </div>
              {currentQuery && (
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  Results for &ldquo;<span className="font-medium text-gray-600 dark:text-gray-300">{currentQuery}</span>&rdquo;
                </span>
              )}
            </div>

            {/* Progress bar */}
            {isSearching && (
              <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(doneCount / totalPlatforms) * 100}%` }}
                />
              </div>
            )}

            {/* Best deal banner */}
            {hasResults && bestProduct && platformBestPrices.length > 1 && (
              <BestDealBanner
                bestProduct={bestProduct}
                allPrices={platformBestPrices}
                query={currentQuery}
              />
            )}

            {/* Platform results */}
            <div className="space-y-4">
              {sortedPlatforms.map(platform => {
                const result = results[platform.id]
                if (!result) return null
                return (
                  <PlatformSection
                    key={platform.id}
                    result={result}
                    maxPrice={maxPrice}
                    globalBestPrice={bestProduct?.price ?? 0}
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasStarted && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              {[
                { icon: '⚡', title: 'Real-time prices', desc: 'Prices fetched live from each platform for accuracy' },
                { icon: '📍', title: 'Location-aware', desc: 'Enter your pincode for prices available in your area' },
                { icon: '🏆', title: 'Best deal highlighted', desc: 'The lowest price is instantly surfaced at the top' },
              ].map(f => (
                <div key={f.title} className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="py-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 dark:text-gray-600">
        <p>
          QuickPrice is an independent price comparison tool. Prices are fetched in real-time and may vary.
          Always verify on the respective platform before purchasing.
        </p>
        <p className="mt-1">
          Supports: Blinkit · Zepto · Swiggy Instamart · BigBasket · JioMart · DMart Ready · First Club · Flipkart Grocery · Amazon Fresh
        </p>
      </footer>
    </div>
  )
}
