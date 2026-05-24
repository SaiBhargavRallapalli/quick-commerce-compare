'use client'

import { useState, useRef, useCallback } from 'react'
import { Search, MapPin, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const POPULAR_SEARCHES = [
  'milk', 'bread', 'eggs', 'rice', 'dal', 'sugar', 'salt', 'butter',
  'paneer', 'curd', 'onion', 'tomato', 'potato', 'banana', 'apple',
  'chicken', 'atta', 'oil', 'tea', 'coffee',
]

const MAJOR_PINCODES = [
  { code: '560001', label: 'Bengaluru' },
  { code: '400001', label: 'Mumbai' },
  { code: '110001', label: 'Delhi' },
  { code: '500001', label: 'Hyderabad' },
  { code: '600001', label: 'Chennai' },
  { code: '411001', label: 'Pune' },
  { code: '700001', label: 'Kolkata' },
  { code: '380001', label: 'Ahmedabad' },
  { code: '122001', label: 'Gurugram' },
]

interface SearchBarProps {
  onSearch: (query: string, pincode: string) => void
  isSearching: boolean
}

export default function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [pincode, setPincode] = useState('560001')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = query.length >= 1
    ? POPULAR_SEARCHES.filter(s => s.startsWith(query.toLowerCase())).slice(0, 6)
    : POPULAR_SEARCHES.slice(0, 8)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2 || isSearching) return
    setShowSuggestions(false)
    onSearch(q, pincode)
  }, [query, pincode, isSearching, onSearch])

  const handleSuggestionClick = useCallback((s: string) => {
    setQuery(s)
    setShowSuggestions(false)
    onSearch(s, pincode)
  }, [pincode, onSearch])

  const handlePincodeSelect = useCallback((code: string) => {
    setPincode(code)
    setShowPincodeDropdown(false)
  }, [])

  const selectedCity = MAJOR_PINCODES.find(p => p.code === pincode)

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Pincode picker */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPincodeDropdown(!showPincodeDropdown)}
              className="flex items-center gap-1.5 px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-green-500 transition-colors whitespace-nowrap shadow-sm"
            >
              <MapPin className="w-4 h-4 text-green-600" />
              <span>{selectedCity?.label ?? pincode}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', showPincodeDropdown && 'rotate-180')} />
            </button>

            {showPincodeDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Enter pincode…"
                    value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none focus:border-green-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {MAJOR_PINCODES.map(p => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handlePincodeSelect(p.code)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                        p.code === pincode && 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium'
                      )}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="ml-2 text-xs text-gray-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search input */}
          <div className="relative flex-1">
            <div className={cn(
              'flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden transition-all',
              'focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20'
            )}>
              <Search className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search for milk, bread, eggs, rice…"
                className="flex-1 px-3 py-3.5 text-sm bg-transparent focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }}
                  className="mr-2 p-1 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2 grid grid-cols-2 gap-1">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => handleSuggestionClick(s)}
                      className="text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors capitalize"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search button */}
          <button
            type="submit"
            disabled={query.length < 2 || isSearching}
            className={cn(
              'px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all',
              'bg-green-600 hover:bg-green-700 active:scale-95 shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
              isSearching && 'animate-pulse'
            )}
          >
            {isSearching ? 'Searching…' : 'Compare'}
          </button>
        </div>
      </form>

      {/* Popular tags */}
      {!query && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <span className="text-xs text-gray-400 self-center">Popular:</span>
          {['milk', 'eggs', 'bread', 'rice', 'onion', 'tomato', 'paneer', 'butter'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => handleSuggestionClick(tag)}
              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400 hover:border-green-500 hover:text-green-600 transition-colors capitalize"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
