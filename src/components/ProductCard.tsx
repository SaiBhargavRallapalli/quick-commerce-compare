'use client'

import { ExternalLink, ShoppingBag, CheckCircle, XCircle, Tag } from 'lucide-react'
import Image from 'next/image'
import type { Product } from '@/lib/types'
import { PLATFORM_MAP } from '@/lib/platforms'
import { formatPrice, truncate, cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  rank: number
  maxPrice: number
  isBestPrice: boolean
}

export default function ProductCard({ product, rank, maxPrice, isBestPrice }: ProductCardProps) {
  const platform = PLATFORM_MAP[product.platform]
  const barWidth = maxPrice > 0 ? Math.max(10, (product.price / maxPrice) * 100) : 100

  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'product-card group block bg-white dark:bg-gray-800 rounded-xl border overflow-hidden shadow-sm hover:shadow-md',
        isBestPrice
          ? 'border-green-500 ring-1 ring-green-500/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {/* Best price banner */}
      {isBestPrice && (
        <div className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-1.5">
          <Tag className="w-3 h-3" />
          BEST PRICE
        </div>
      )}

      <div className="p-3">
        {/* Top row: image + info */}
        <div className="flex gap-3">
          {/* Product image */}
          <div className="flex-shrink-0 w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-contain"
                unoptimized
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-gray-300 dark:text-gray-600" />
              </div>
            )}
          </div>

          {/* Product details */}
          <div className="flex-1 min-w-0">
            {/* Rank badge + platform */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn(
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold',
                rank === 1
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              )}>
                {rank}
              </span>
              <span
                className="inline-block px-2 py-0.5 rounded-md text-xs font-medium text-white"
                style={{ backgroundColor: platform.color }}
              >
                {platform.name}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
              {truncate(product.name, 60)}
            </p>

            {product.quantity && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{product.quantity}</p>
            )}
          </div>
        </div>

        {/* Price row */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xl font-bold',
                isBestPrice ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
              )}>
                {formatPrice(product.price)}
              </span>

              {product.discountPercent && product.discountPercent > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-md">
                  -{product.discountPercent}%
                </span>
              )}
            </div>

            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Stock + delivery */}
          <div className="text-right">
            <div className={cn(
              'flex items-center gap-1 text-xs',
              product.inStock ? 'text-green-600 dark:text-green-400' : 'text-red-500'
            )}>
              {product.inStock
                ? <CheckCircle className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />}
              <span>{product.inStock ? 'In stock' : 'Out of stock'}</span>
            </div>
            {product.deliveryTime && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{product.deliveryTime}</span>
            )}
          </div>
        </div>

        {/* Price bar */}
        <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full price-bar', isBestPrice ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500')}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Footer: Open on platform */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-blue-500 transition-colors">
          <span>View on {platform.name}</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </a>
  )
}
