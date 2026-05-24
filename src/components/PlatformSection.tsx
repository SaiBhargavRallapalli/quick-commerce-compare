'use client'

import { Clock, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { PlatformResult } from '@/lib/types'
import { PLATFORM_MAP } from '@/lib/platforms'
import { formatPrice, cn } from '@/lib/utils'
import ProductCard from './ProductCard'

interface PlatformSectionProps {
  result: PlatformResult
  maxPrice: number
  globalBestPrice: number
}

export default function PlatformSection({ result, maxPrice, globalBestPrice }: PlatformSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const platform = PLATFORM_MAP[result.platform]

  const sortedProducts = [...result.products].sort((a, b) => a.price - b.price)
  const cheapestProduct = sortedProducts[0]
  const isBestPlatform = cheapestProduct && cheapestProduct.price === globalBestPrice && globalBestPrice > 0
  const visibleProducts = expanded ? sortedProducts : sortedProducts.slice(0, 3)

  if (result.status === 'loading') {
    return <PlatformSkeleton platformColor={platform.color} platformName={platform.name} />
  }

  if (result.status === 'error' || result.status === 'timeout') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-100 dark:border-orange-900/30 p-4 opacity-70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platform.color }} />
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{platform.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>{result.status === 'timeout' ? 'Timed out (platform may be blocking)' : `Error: ${result.error ?? 'Unable to fetch'}`}</span>
            {result.durationMs != null && (
              <span className="ml-2 text-gray-300 dark:text-gray-600">{result.durationMs}ms</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (result.products.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platform.color }} />
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{platform.name}</span>
          </div>
          <span className="text-xs text-gray-400">
            No results — platform may require sign-in or pincode not serviceable
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-xl border overflow-hidden shadow-sm transition-all',
      isBestPlatform
        ? 'border-green-500 shadow-green-100 dark:shadow-green-900/20'
        : 'border-gray-200 dark:border-gray-700'
    )}>
      {/* Platform header */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setExpanded(!expanded)}
        style={{ borderLeft: `4px solid ${platform.color}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 dark:text-white">{platform.name}</span>
            {isBestPlatform && (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-semibold">
                LOWEST
              </span>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
              <Clock className="w-3 h-3" />
              <span>{platform.deliveryTime}</span>
            </div>
          </div>

          {cheapestProduct && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'text-lg font-bold',
                isBestPlatform ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
              )}>
                from {formatPrice(cheapestProduct.price)}
              </span>
              {cheapestProduct.originalPrice && cheapestProduct.originalPrice > cheapestProduct.price && (
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(cheapestProduct.originalPrice)}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {result.products.length} result{result.products.length !== 1 ? 's' : ''}
                {result.durationMs ? ` · ${result.durationMs}ms` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Products grid */}
      <div className="px-4 pb-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleProducts.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={idx + 1}
              maxPrice={maxPrice}
              isBestPrice={product.price === globalBestPrice && globalBestPrice > 0 && idx === 0}
            />
          ))}
        </div>

        {sortedProducts.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
          >
            {expanded
              ? 'Show less'
              : `Show ${sortedProducts.length - 3} more result${sortedProducts.length - 3 > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}

function PlatformSkeleton({ platformColor, platformName }: { platformColor: string; platformName: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderLeft: `4px solid ${platformColor}` }}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 dark:text-white">{platformName}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Fetching prices…</span>
            </div>
          </div>
          <div className="h-4 shimmer rounded mt-1.5 w-32" />
        </div>
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
              <div className="flex gap-3">
                <div className="w-16 h-16 shimmer rounded-lg" />
                <div className="flex-1">
                  <div className="h-3 shimmer rounded w-3/4 mb-2" />
                  <div className="h-3 shimmer rounded w-1/2 mb-2" />
                  <div className="h-3 shimmer rounded w-1/4" />
                </div>
              </div>
              <div className="h-7 shimmer rounded mt-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
