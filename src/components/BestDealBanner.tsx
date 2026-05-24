'use client'

import { Trophy, TrendingDown, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import type { Product } from '@/lib/types'
import { PLATFORM_MAP } from '@/lib/platforms'
import { formatPrice } from '@/lib/utils'

interface BestDealBannerProps {
  bestProduct: Product
  allPrices: { platform: string; price: number }[]
  query: string
}

export default function BestDealBanner({ bestProduct, allPrices, query }: BestDealBannerProps) {
  const platform = PLATFORM_MAP[bestProduct.platform]
  const maxPrice = Math.max(...allPrices.map(p => p.price))
  const savings = maxPrice - bestProduct.price
  const savingsPct = maxPrice > 0 ? Math.round((savings / maxPrice) * 100) : 0

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 rounded-2xl p-5 text-white shadow-lg shadow-green-900/20 animate-slide-up">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-4 border-white" />
        <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full border-4 border-white" />
      </div>

      <div className="relative">
        <div className="flex items-start gap-4">
          {/* Trophy + image */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                {bestProduct.imageUrl ? (
                  <Image
                    src={bestProduct.imageUrl}
                    alt={bestProduct.name}
                    width={64}
                    height={64}
                    className="object-contain"
                    unoptimized
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <Trophy className="w-8 h-8 text-yellow-300" />
                )}
              </div>
              <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1">
                <Trophy className="w-3.5 h-3.5 text-yellow-900" />
              </div>
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-green-200 uppercase tracking-wider">Best Price Found</span>
              {savingsPct > 0 && (
                <span className="flex items-center gap-0.5 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  <TrendingDown className="w-3 h-3" />
                  Save {savingsPct}% vs highest
                </span>
              )}
            </div>

            <p className="text-base font-bold text-white leading-tight mb-1 truncate">
              {bestProduct.name}
            </p>

            {bestProduct.quantity && (
              <p className="text-xs text-green-200">{bestProduct.quantity}</p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <div>
                <span className="text-2xl font-black">{formatPrice(bestProduct.price)}</span>
                {bestProduct.originalPrice && bestProduct.originalPrice > bestProduct.price && (
                  <span className="ml-2 text-sm text-green-200 line-through">
                    {formatPrice(bestProduct.originalPrice)}
                  </span>
                )}
              </div>

              <span
                className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                {platform.name}
              </span>

              {savings > 0 && (
                <span className="text-sm text-green-200">
                  Save {formatPrice(savings)}
                </span>
              )}
            </div>
          </div>

          {/* CTA button */}
          <a
            href={bestProduct.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 self-center hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-white text-green-700 text-sm font-bold rounded-xl hover:bg-green-50 transition-colors shadow"
          >
            Buy now
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Price comparison mini-bars */}
        {allPrices.length > 1 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs text-green-200 mb-2">Price comparison</p>
            {allPrices.sort((a, b) => a.price - b.price).map(({ platform: pid, price }) => {
              const p = PLATFORM_MAP[pid as keyof typeof PLATFORM_MAP]
              const pct = maxPrice > 0 ? (price / maxPrice) * 100 : 100
              const isLowest = price === bestProduct.price
              return (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-xs w-28 text-green-100 truncate">{p?.name ?? pid}</span>
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full price-bar ${isLowest ? 'bg-yellow-300' : 'bg-white/50'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-16 text-right ${isLowest ? 'text-yellow-300' : 'text-green-100'}`}>
                    {formatPrice(price)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
