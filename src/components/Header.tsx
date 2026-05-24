'use client'

import { ShoppingCart, Zap } from 'lucide-react'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-7 h-7 text-yellow-500 fill-yellow-500" />
          </div>
          <div>
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Quick<span className="text-green-600">Price</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">
            Compare prices across 7 platforms instantly
          </span>
        </div>
      </div>
    </header>
  )
}
