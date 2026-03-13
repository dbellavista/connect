import fs from 'fs/promises';
import Parser from 'rss-parser';
import puppeteer from 'puppeteer';

const parser = new Parser();

// Parse Netscape HTTP Cookie File format into Puppeteer cookie objects
export async function parseNetscapeCookies(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const cookies = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split('\t');
      // Format: domain, include_subdomains, path, secure, expires, name, value
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0],
          path: parts[2],
          secure: parts[3] === 'TRUE',
          expires: parseInt(parts[4], 10),
          name: parts[5],
          value: parts[6],
        });
      }
    }
    return cookies;
  } catch (error) {
    throw new Error(`Failed to parse cookies from ${filePath}: ${error.message}`, { cause: error });
  }
}

export async function fetchRssFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet,
      guid: item.guid,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch RSS from ${url}: ${error.message}`, { cause: error });
  }
}

export async function scrapeArticle(url, cookiesFilePath) {
  let browser;
  try {
    const cookies = await parseNetscapeCookies(cookiesFilePath);

    browser = await puppeteer.launch({
      headless: true, // true or "new"
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Inject cookies
    await page.setCookie(...cookies);

    // Navigate to article
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for either the article body or a short timeout to handle different page structures
    // Corriere articles usually have .content-article, or paragraphs inside .chapter-paragraph
    // We'll extract title, subtitle, and paragraph texts.

    const articleData = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText || '';
      const subtitle = document.querySelector('h2')?.innerText || '';

      // Attempt to find the main content body
      // Selectors might change, so we look for common ones
      const paragraphNodes = document.querySelectorAll(
        '.content-article p, .chapter-paragraph, article p, .story__text p'
      );

      const paragraphs = Array.from(paragraphNodes)
        .map((p) => p.innerText.trim())
        .filter((p) => p.length > 0);

      return {
        title,
        subtitle,
        paragraphs,
        fullText: paragraphs.join('\n\n'),
      };
    });

    return articleData;
  } catch (error) {
    throw new Error(`Failed to scrape article from ${url}: ${error.message}`, { cause: error });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
