"use server"
import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractCurrency, extractDescription, extractPrice, extractIngredientsFromEmbeddedJson } from '../lib/utils';

const username = String(process.env.BRIGHT_DATA_USERNAME);
  const password = String(process.env.BRIGHT_DATA_PASSWORD);
  const port =33335;
  const session_id = (1000000 * Math.random()) | 0;

  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password,
    },
    host: 'brd.superproxy.io',
    port,
    rejectUnauthorized: false,
  }

export async function scrapeAmazonProduct(url: string,category:string) {
  if(!url) return;

  try {

    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    const title = $('#productTitle').text().trim();
    const currentPrice = extractPrice(
      $('.priceToPay span.a-price-whole'),
      $('.a.size.base.a-color-price'),
      $('.a-button-selected .a-color-base'),
    );

    const originalPrice = extractPrice(
      $('#priceblock_ourprice'),
      $('span.basisPrice span.a-offscreen'),
      $('#listPrice'),
      $('#priceblock_dealprice'),
      $('.a-size-base.a-color-price')
    );

    //const outOfStock = $('#availability span').text().trim().toLowerCase() === 'currently unavailable';

    const images = 
      $('#imgBlkFront').attr('data-a-dynamic-image') || 
      $('#landingImage').attr('data-a-dynamic-image') ||
      '{}'

    const imageUrls = Object.keys(JSON.parse(images));

    const currency = extractCurrency($('.a-price-symbol'))
    const discountRate = Number($('span.savingsPercentage').first().text().replace(/[^\d]/g, ''));

    const description = extractDescription($)

    // Construct data object with scraped information
    const data = {
      url,
      currency: currency || '₹',
      image: imageUrls[0],
      title,
      currentPrice: Number(currentPrice) || Number(originalPrice),
      originalPrice: Number(originalPrice) || Number(currentPrice),
      discountRate: Number(discountRate),
      category: category,
      reviewsCount:100,
      stars: 4.5,
      // isOutOfStock: outOfStock,
      description
    }
    //console.log(data);
    return data;
  } catch (error: unknown) {
    console.error(error);
  }
}

export async function scrapeNykaaProduct(url: string, category: string) {
  if (!url) return;

  try {
    const res = await axios.get(url, options);
    const $ = cheerio.load(res.data);

    const title = $('[class*="css-1gc4x7i"]').clone().children().remove().end().text().trim();

    const currentPrice = Number(
      $('[class*="css-1jczs19"]')
        .first()
        .text()
        .replace(/\D/g, "")
    );

    const originalPrice = Number($('.css-u05rr span').first().text().replace(/\D/g, ''));

    const discountRate = Number($('.css-bhhehx').first().text().match(/\d+/)?.[0]);

    const rating = Number(
      $('[class*="css-m6n3ou"]')
        .first()
        .text()
        .match(/\d+(\.\d+)?/)?.[0] || 0
    );

    const reviewsCount = Number($('.css-1hvvm95').last().text().match(/\d+/)?.[0]);

    const image = $('[class*="css-43m2vm"] img')
      .first()
      .attr("src") || "";

    const description = extractIngredientsFromEmbeddedJson($);
    //console.log(description);

    return {
      url,
      title,
      currency: "₹",
      currentPrice: currentPrice || originalPrice,
      originalPrice: originalPrice || currentPrice,
      discountRate: Number(discountRate),
      category:category,
      rating,
      reviewsCount,
      image,
      description,
    };
  } catch (err) {
    console.error("Nykaa scrape error:", err);
  }
}

export async function scrapeBeMinimalistProduct(url: string,category:string) {
  if (!url) return;

  try {
    const res = await axios.get(url, options);
    const $ = cheerio.load(res.data);

    const title = $('[class*="product__title heading-size--page-title"]').text().trim();

    const priceSpans = $("[class*='product-price--original pps ']");
    const cPrice =priceSpans.eq(5).text().trim(); // 0‑based index, so 5 = 6th
    const currentPrice= Number(cPrice.replace(/[^\d.]/g, '')) || 0;

    //const originalPrice = Number($('del[data-js-product-price-compare] span').text().replace(/\D/g, ""));
    const allPrices = $('del[data-js-product-price-compare] span')
    .map((_, el) => {
      const priceText = $(el).text().replace(/\D/g, ""); // Remove ₹ and commas
      return priceText && priceText !== '000' ? Number(priceText) : null;
    })
    .get()
    .filter((price): price is number => price !== null); // Remove nulls
    //console.log(allPrices);

    const originalPrice = allPrices[5] || null;
    //console.log(originalPrice);
    const discountRate = Number(
      $("[class*='product-price--saving pps']").first().text().replace(/\D/g, "")
    );
    const image = $('figure.apply-gallery-animation img').attr('src') || '';
    //console.log(image);

    const description = $("[class*='metafield-multi_line_text_field']").text().trim();

    //const ratingText = $(".spr-summary .spr-summary-starrating").attr("title") || "";
    let reviewsCount=0;
    let rating= 0;

    $('script[type="application/ld+json"]').each((_, el) => {
    const jsonText = $(el).html();
    if (!jsonText) return;

    try {
      const data = JSON.parse(jsonText);

      // If it's an AggregateRating block
      if (data['@type'] === 'AggregateRating') {
        reviewsCount = Number(data.ratingCount) || 0;
        rating= Number(data.ratingValue);
      }
    } catch (err) {
      // Ignore JSON parsing errors silently
    }
  });

    return {
      url,
      title,
      currency: "₹",
      currentPrice: currentPrice || originalPrice,
      originalPrice: originalPrice || currentPrice,
      discountRate: discountRate || 0,
      category:category,
      rating,
      reviewsCount,
      image,
      description,
    };
  } catch (err) {
    console.error("BeMinimalist scrape error:", err);
  }
}