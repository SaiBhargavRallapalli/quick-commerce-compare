import type { MetadataRoute } from 'next'

const BASE_URL = 'https://quickpricecompare.in'

const POPULAR_PRODUCTS = [
  'milk', 'eggs', 'bread', 'rice', 'dal', 'sugar', 'salt', 'butter',
  'paneer', 'curd', 'onion', 'tomato', 'potato', 'banana', 'apple',
  'chicken', 'atta', 'oil', 'tea', 'coffee', 'biscuits', 'chips',
  'shampoo', 'toothpaste', 'soap', 'detergent',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const productUrls: MetadataRoute.Sitemap = POPULAR_PRODUCTS.map(product => ({
    url: `${BASE_URL}/?q=${encodeURIComponent(product)}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.8,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...productUrls,
  ]
}
