import { chromium, Browser, BrowserContext } from 'playwright'

let browser: Browser | null = null
let launchPromise: Promise<Browser> | null = null

const DEV_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--window-size=1280,800',
]

async function getLaunchOptions(): Promise<Parameters<typeof chromium.launch>[0]> {
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV
  )

  if (isServerless) {
    const chromiumBinary = (await import('@sparticuz/chromium')).default
    return {
      executablePath: await chromiumBinary.executablePath(),
      args: [...chromiumBinary.args, '--disable-blink-features=AutomationControlled'],
      headless: true,
    }
  }

  // Local development — use playwright's installed browser
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0'
  return { headless: true, args: DEV_ARGS }
}

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser
  if (launchPromise) return launchPromise

  launchPromise = getLaunchOptions()
    .then(opts => chromium.launch(opts))
    .then(b => {
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
