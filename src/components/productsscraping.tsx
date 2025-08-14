"use client"

import { scrapeAmazonProduct, scrapeNykaaProduct, scrapeBeMinimalistProduct } from '@/lib/scraper';
import { FormEvent, useState } from 'react'
import { uploadProductData } from '@/lib/server/products.actions';

// Types
interface ProductData {
  url: string;
  title: string;
  currency: string;
  currentPrice: number;
  originalPrice: number;
  discountRate: number;
  category: string;
  reviewsCount: number;
  stars?: number;
  image: string;
  description: string;
}

type SiteType = 'amazon' | 'nykaa' | 'beminimalist' | 'unknown';

// URL validation functions
const detectSiteType = (url: string): SiteType => {
  try {
    const parsedURL = new URL(url);
    const hostname = parsedURL.hostname.toLowerCase();

    if (hostname.includes('amazon.com') || 
        hostname.includes('amazon.') || 
        hostname.endsWith('amazon')) {
      return 'amazon';
    }

    if (hostname.includes('nykaa.com') || 
        hostname.includes('nykaa.')) {
      return 'nykaa';
    }

    if (hostname.includes('beminimalist.com') || 
        hostname.includes('beminimalist.')) {
      return 'beminimalist';
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
};

// Product scraper functions mapping
const scraperFunctions = {
  amazon: scrapeAmazonProduct,
  nykaa: scrapeNykaaProduct,
  beminimalist: scrapeBeMinimalistProduct,
};

const ProductScraper = () => {
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setProduct(null);

    if (!searchPrompt.trim()) {
      setError('Please enter a product URL');
      return;
    }

    const siteType = detectSiteType(searchPrompt);
    
    if (siteType === 'unknown') {
      setError('Please provide a valid Amazon, Nykaa, or BeMinimalist product link');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get the appropriate scraper function
      const scraperFunction = scraperFunctions[siteType];
      
      // Default category - you can modify this or make it dynamic
      const category = 'Product';
      
      // Scrape the product
      const scrapedProduct = await scraperFunction(searchPrompt, category);
      
      if (scrapedProduct) {
        // Ensure currentPrice is a number (not null)
        if (scrapedProduct.currentPrice === null || scrapedProduct.currentPrice === undefined) {
          setError('Product price is unavailable or invalid.');
        } else {
          setProduct({
            ...scrapedProduct,
            currentPrice: Number(scrapedProduct.currentPrice),
          });
        }
      } else {
        setError('Failed to scrape product data. Please check the URL and try again.');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setError('An error occurred while scraping the product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = '₹') => {
    return `${currency}${price.toLocaleString()}`;
  };

  const getSiteDisplayName = (url: string): string => {
    const siteType = detectSiteType(url);
    switch (siteType) {
      case 'amazon': return 'Amazon';
      case 'nykaa': return 'Nykaa';
      case 'beminimalist': return 'BeMinimalist';
      default: return 'Unknown';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Multi-Site Product Scraper
        </h1>
        <p className="text-gray-600">
          Enter a product URL from Amazon, Nykaa, or BeMinimalist to get product details
        </p>
      </div>

      {/* Search Form */}
      <form 
        className="flex flex-col sm:flex-row gap-4 mb-8" 
        onSubmit={handleSubmit}
      >
        <input 
          type="url"
          value={searchPrompt}
          onChange={(e) => setSearchPrompt(e.target.value)}
          placeholder="Enter product URL (Amazon, Nykaa, or BeMinimalist)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading || !searchPrompt.trim()}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scraping...
            </span>
          ) : (
            'Get Product Details'
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Product Display */}
      {product && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Product Details</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                {getSiteDisplayName(product.url)}
              </span>
            </div>
          </div>
          {/* Category Dropdown */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <label htmlFor="category-dropdown" className="text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              id="category-dropdown"
              className="shadcn-dropdown px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={product.category}
              onChange={async (e) => {
                const newCategory = e.target.value;
                setProduct({ ...product, category: newCategory });
              }}
            >
              <option value="Cleanser">Cleanser</option>
              <option value="Facewash">Facewash</option>
              <option value="Sunscream">Sunscream</option>
              <option value="Moisturizer">Moisturizer</option>
            </select>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Image */}
              <div className="space-y-4">
                {product.image && (
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img 
                      src={product.image} 
                      alt={product.title}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = '/api/placeholder/400/400';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {product.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Category: {product.category}
                  </p>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-green-600">
                      {formatPrice(product.currentPrice, product.currency)}
                    </span>
                    {product.originalPrice > product.currentPrice && (
                      <span className="text-lg text-gray-500 line-through">
                        {formatPrice(product.originalPrice, product.currency)}
                      </span>
                    )}
                  </div>
                  {product.discountRate > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-sm font-medium rounded">
                        {product.discountRate}% OFF
                      </span>
                      <span className="text-sm text-gray-600">
                        You save {formatPrice(product.originalPrice - product.currentPrice, product.currency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rating and Reviews */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.stars || 0)
                              ? 'text-yellow-400'
                              : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 ml-2">
                      {(product.stars || 0).toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    ({product.reviewsCount.toLocaleString()} reviews)
                  </span>
                </div>

                {/* Description */}
                {product.description && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {product.description.length > 300 
                        ? `${product.description.substring(0, 300)}...` 
                        : product.description}
                    </p>
                  </div>
                )}

                {/* View Original */}
                <div className="pt-4 border-t border-gray-200">
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View on {getSiteDisplayName(product.url)}
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                    <button
                      onClick={async () => {await uploadProductData(product);}}
                      type="submit"
                      className="ml-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Save the product
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductScraper;