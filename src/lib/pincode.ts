import type { Location } from './types'

// Hardcoded coordinates for popular Indian pincodes / cities
// Covers major metros where quick commerce is active
const PINCODE_DB: Record<string, Location> = {
  // Bengaluru
  '560001': { pincode: '560001', lat: 12.9716, lon: 77.5946, city: 'Bengaluru' },
  '560002': { pincode: '560002', lat: 12.9785, lon: 77.6033, city: 'Bengaluru' },
  '560038': { pincode: '560038', lat: 12.9344, lon: 77.6262, city: 'Bengaluru' },
  // Mumbai
  '400001': { pincode: '400001', lat: 18.9322, lon: 72.8264, city: 'Mumbai' },
  '400051': { pincode: '400051', lat: 19.0596, lon: 72.8295, city: 'Mumbai' },
  '400070': { pincode: '400070', lat: 19.0825, lon: 72.8905, city: 'Mumbai' },
  // Delhi
  '110001': { pincode: '110001', lat: 28.6448, lon: 77.2167, city: 'Delhi' },
  '110017': { pincode: '110017', lat: 28.5355, lon: 77.2050, city: 'Delhi' },
  '110075': { pincode: '110075', lat: 28.5080, lon: 77.1120, city: 'Delhi' },
  // Hyderabad
  '500001': { pincode: '500001', lat: 17.3850, lon: 78.4867, city: 'Hyderabad' },
  '500032': { pincode: '500032', lat: 17.4480, lon: 78.3915, city: 'Hyderabad' },
  // Chennai
  '600001': { pincode: '600001', lat: 13.0827, lon: 80.2707, city: 'Chennai' },
  '600034': { pincode: '600034', lat: 13.0067, lon: 80.2206, city: 'Chennai' },
  // Pune
  '411001': { pincode: '411001', lat: 18.5204, lon: 73.8567, city: 'Pune' },
  '411045': { pincode: '411045', lat: 18.5089, lon: 73.9260, city: 'Pune' },
  // Kolkata
  '700001': { pincode: '700001', lat: 22.5726, lon: 88.3639, city: 'Kolkata' },
  '700019': { pincode: '700019', lat: 22.5378, lon: 88.3622, city: 'Kolkata' },
  // Ahmedabad
  '380001': { pincode: '380001', lat: 23.0225, lon: 72.5714, city: 'Ahmedabad' },
  // Gurugram / NCR
  '122001': { pincode: '122001', lat: 28.4595, lon: 77.0266, city: 'Gurugram' },
  '122002': { pincode: '122002', lat: 28.4717, lon: 77.0311, city: 'Gurugram' },
  // Noida
  '201301': { pincode: '201301', lat: 28.5355, lon: 77.3910, city: 'Noida' },
}

const DEFAULT_LOCATION: Location = {
  pincode: '560001',
  lat: 12.9716,
  lon: 77.5946,
  city: 'Bengaluru',
}

export async function resolveLocation(pincode: string): Promise<Location> {
  const trimmed = pincode.trim()

  // Direct lookup
  if (PINCODE_DB[trimmed]) return PINCODE_DB[trimmed]

  // Try OpenStreetMap Nominatim as fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${trimmed}&country=India&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'QuickCommerceCompare/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    if (data[0]) {
      return {
        pincode: trimmed,
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        city: data[0].display_name.split(',')[0],
      }
    }
  } catch {
    // Nominatim unavailable, fall through
  }

  return DEFAULT_LOCATION
}
