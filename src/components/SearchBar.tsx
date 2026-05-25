'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, MapPin, X, ChevronDown, LocateFixed, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const POPULAR_SEARCHES = [
  'milk', 'bread', 'eggs', 'rice', 'dal', 'sugar', 'salt', 'butter',
  'paneer', 'curd', 'onion', 'tomato', 'potato', 'banana', 'apple',
  'chicken', 'atta', 'oil', 'tea', 'coffee',
]

const MAJOR_PINCODES = [
  { code: '560001', label: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { code: '400001', label: 'Mumbai', lat: 18.9322, lon: 72.8264 },
  { code: '110001', label: 'Delhi', lat: 28.6448, lon: 77.2167 },
  { code: '500001', label: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { code: '600001', label: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { code: '411001', label: 'Pune', lat: 18.5204, lon: 73.8567 },
  { code: '700001', label: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { code: '380001', label: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { code: '122001', label: 'Gurugram', lat: 28.4595, lon: 77.0266 },
  { code: '201301', label: 'Noida', lat: 28.5355, lon: 77.3910 },
]

interface NominatimResult {
  place_id: number
  display_name: string
  address?: {
    postcode?: string
    city?: string
    town?: string
    village?: string
    suburb?: string
    state_district?: string
    state?: string
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<{ pincode: string; label: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&countrycodes=in`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'QuickPrice/1.0 (quickpricecompare.in)' } }
    )
    const data = (await res.json()) as NominatimResult
    const pincode = data.address?.postcode ?? ''
    const city = data.address?.city ?? data.address?.town ?? data.address?.suburb ?? data.address?.state_district ?? ''
    if (pincode.match(/^\d{6}$/)) {
      return { pincode, label: city || pincode }
    }
  } catch { /* fall through */ }

  // Fallback: nearest major city
  let best = MAJOR_PINCODES[0]
  let bestDist = Infinity
  for (const c of MAJOR_PINCODES) {
    const d = Math.hypot(c.lat - lat, c.lon - lon)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return { pincode: best.code, label: best.label }
}

async function geocodeAddress(query: string): Promise<Array<{ pincode: string; label: string }>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=in&limit=5`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'QuickPrice/1.0 (quickpricecompare.in)' } }
    )
    const data = (await res.json()) as NominatimResult[]
    return data
      .filter(r => r.address?.postcode?.match(/^\d{6}$/))
      .map(r => ({
        pincode: r.address!.postcode!,
        label: [r.address?.suburb, r.address?.city ?? r.address?.town ?? r.address?.state_district].filter(Boolean).join(', ') || r.display_name.split(',').slice(0, 2).join(','),
      }))
      .filter((r, i, arr) => arr.findIndex(x => x.pincode === r.pincode) === i) // dedupe
  } catch {
    return []
  }
}

interface SearchBarProps {
  onSearch: (query: string, pincode: string) => void
  isSearching: boolean
}

export default function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [pincode, setPincode] = useState('560001')
  const [locationLabel, setLocationLabel] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ pincode: string; label: string }>>([])
  const [searchingLocation, setSearchingLocation] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-detect location on first load
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const saved = sessionStorage.getItem('qcc_pincode')
    const savedLabel = sessionStorage.getItem('qcc_label')
    if (saved) {
      setPincode(saved)
      if (savedLabel) setLocationLabel(savedLabel)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        setPincode(result.pincode)
        setLocationLabel(result.label)
        sessionStorage.setItem('qcc_pincode', result.pincode)
        sessionStorage.setItem('qcc_label', result.label)
      },
      () => { /* permission denied — keep default */ },
      { timeout: 8000, maximumAge: 300_000 }
    )
  }, [])

  const handleDetect = useCallback(() => {
    if (!navigator.geolocation || detecting) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        setPincode(result.pincode)
        setLocationLabel(result.label)
        sessionStorage.setItem('qcc_pincode', result.pincode)
        sessionStorage.setItem('qcc_label', result.label)
        setDetecting(false)
        setShowPincodeDropdown(false)
        setLocationInput('')
        setLocationSuggestions([])
      },
      () => setDetecting(false),
      { timeout: 10000 }
    )
  }, [detecting])

  // Debounced address / pincode search
  const handleLocationInput = useCallback((val: string) => {
    setLocationInput(val)
    setLocationSuggestions([])

    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current)

    if (!val) return

    // If it's a 6-digit pincode, set directly
    if (/^\d{6}$/.test(val)) {
      setPincode(val)
      setLocationLabel(val)
      sessionStorage.setItem('qcc_pincode', val)
      sessionStorage.setItem('qcc_label', val)
      return
    }

    // Otherwise geocode the address after a short delay
    if (val.length < 3) return
    locationSearchTimer.current = setTimeout(async () => {
      setSearchingLocation(true)
      const results = await geocodeAddress(val)
      setLocationSuggestions(results.slice(0, 5))
      setSearchingLocation(false)
    }, 500)
  }, [])

  const handleLocationSelect = useCallback((item: { pincode: string; label: string }) => {
    setPincode(item.pincode)
    setLocationLabel(item.label)
    sessionStorage.setItem('qcc_pincode', item.pincode)
    sessionStorage.setItem('qcc_label', item.label)
    setShowPincodeDropdown(false)
    setLocationInput('')
    setLocationSuggestions([])
  }, [])

  const handlePincodeSelect = useCallback((code: string, label: string) => {
    setPincode(code)
    setLocationLabel(label)
    sessionStorage.setItem('qcc_pincode', code)
    sessionStorage.setItem('qcc_label', label)
    setShowPincodeDropdown(false)
    setLocationInput('')
    setLocationSuggestions([])
  }, [])

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

  const displayLabel = locationLabel || MAJOR_PINCODES.find(p => p.code === pincode)?.label || pincode

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Location picker */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => { setShowPincodeDropdown(!showPincodeDropdown); setLocationInput(''); setLocationSuggestions([]) }}
              className="flex items-center gap-1.5 px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-green-500 transition-colors whitespace-nowrap shadow-sm max-w-[160px]"
            >
              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">{displayLabel}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0', showPincodeDropdown && 'rotate-180')} />
            </button>

            {showPincodeDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Detect button */}
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={detecting}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 font-medium disabled:opacity-60"
                >
                  {detecting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <LocateFixed className="w-4 h-4" />}
                  {detecting ? 'Detecting…' : 'Use my location'}
                </button>

                {/* Search input — accepts pincode or area name */}
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter pincode or area…"
                      value={locationInput}
                      onChange={e => handleLocationInput(e.target.value)}
                      className="w-full px-3 py-2 pr-8 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none focus:border-green-500"
                    />
                    {searchingLocation && (
                      <Loader2 className="absolute right-2 top-2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>

                  {/* Address search suggestions */}
                  {locationSuggestions.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {locationSuggestions.map(s => (
                        <button
                          key={s.pincode}
                          type="button"
                          onClick={() => handleLocationSelect(s)}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200">{s.label}</span>
                          <span className="ml-2 text-xs text-gray-400">{s.pincode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Major cities */}
                <div className="max-h-52 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Major cities</div>
                  {MAJOR_PINCODES.map(p => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handlePincodeSelect(p.code, p.label)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
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
