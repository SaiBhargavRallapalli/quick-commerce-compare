// Must be set before playwright resolves the browser executable path.
// PLAYWRIGHT_BROWSERS_PATH=0 → browser installed alongside playwright package in
// node_modules/playwright-core/.local-browsers/ which is bundled into the Lambda.
// Without this, the build container installs to ~/.cache/ms-playwright/ (a different
// home directory than the Lambda sandbox /home/sbx_user1051/).
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

import { chromium, Browser, BrowserContext } from 'playwright'

let browser: Browser | null = null
let launchPromise: Promise<Browser> | null = null

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process', // Required for Lambda — no /dev/shm
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--window-size=1280,800',
]

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser

  if (launchPromise) return launchPromise

  launchPromise = chromium.launch({ headless: true, args: LAUNCH_ARGS }).then((b) => {
    browser = b
    launchPromise = null
    b.on('disconnected', () => { browser = null })
    return b
  })

  return launchPromise
}

export async function createContext(lat: number, lon: number): Promise<BrowserContext> {
  const b = await getBrowser()
  const ctx = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-IN',
    geolocation: { latitude: lat, longitude: lon },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
    },
    javaScriptEnabled: true,
  })

  // Hide webdriver footprint
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] })
    // @ts-ignore
    window.chrome = { runtime: {} }
  })

  return ctx
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
