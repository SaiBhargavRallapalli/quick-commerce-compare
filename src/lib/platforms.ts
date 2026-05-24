import type { Platform, PlatformId } from './types'

export const PLATFORMS: Platform[] = [
  {
    id: 'blinkit',
    name: 'Blinkit',
    tagline: '10 minute delivery',
    color: '#0C831F',
    bgLight: '#E8F5E9',
    textColor: '#FFFFFF',
    website: 'https://blinkit.com',
    deliveryTime: '10 mins',
    logoEmoji: '🟡',
  },
  {
    id: 'zepto',
    name: 'Zepto',
    tagline: '10 minute delivery',
    color: '#8025FB',
    bgLight: '#F3E8FF',
    textColor: '#FFFFFF',
    website: 'https://www.zepto.com',
    deliveryTime: '10 mins',
    logoEmoji: '🟣',
  },
  {
    id: 'swiggy',
    name: 'Swiggy Instamart',
    tagline: 'Grocery in minutes',
    color: '#FC8019',
    bgLight: '#FFF3E8',
    textColor: '#FFFFFF',
    website: 'https://www.swiggy.com/instamart',
    deliveryTime: '15-20 mins',
    logoEmoji: '🟠',
  },
  {
    id: 'bigbasket',
    name: 'BigBasket',
    tagline: 'India\'s online supermarket',
    color: '#84C225',
    bgLight: '#F0F9E8',
    textColor: '#FFFFFF',
    website: 'https://www.bigbasket.com',
    deliveryTime: '2-4 hours',
    logoEmoji: '🟢',
  },
  {
    id: 'jiomart',
    name: 'JioMart',
    tagline: 'Desh ki Nayi Dukaan',
    color: '#0063AE',
    bgLight: '#E3F2FD',
    textColor: '#FFFFFF',
    website: 'https://www.jiomart.com',
    deliveryTime: 'Same day',
    logoEmoji: '🔵',
  },
  {
    id: 'dmart',
    name: 'DMart Ready',
    tagline: 'Value for money',
    color: '#D71920',
    bgLight: '#FDE8E9',
    textColor: '#FFFFFF',
    website: 'https://www.dmart.in',
    deliveryTime: 'Same day',
    logoEmoji: '🔴',
  },
  {
    id: 'firstclub',
    name: 'First Club',
    tagline: 'Better prices, better life',
    color: '#FF6B00',
    bgLight: '#FFF0E6',
    textColor: '#FFFFFF',
    website: 'https://www.firstclub.io',
    deliveryTime: 'Next day',
    logoEmoji: '🟤',
  },
]

export const PLATFORM_MAP = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
) as Record<PlatformId, Platform>

export function getPlatform(id: PlatformId): Platform {
  return PLATFORM_MAP[id]
}
