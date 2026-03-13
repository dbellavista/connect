import { Command } from 'commander';
import { fetchRssFeed, scrapeArticle } from './fetcher.js';
import { logger } from '../../src/utils/logger.js';
import { CATEGORIES } from './categories.js';

const program = new Command();

program.name('corriere-cli').description('CLI to interact with Corriere della Sera');

program
  .command('categories')
  .description('List available news categories and their RSS URLs')
  .action(() => {
    logger.info(CATEGORIES);
  });

program
  .command('news')
  .description('Get latest news for specific categories or URLs')
  .argument('[inputs...]', 'RSS URLs or Category Names (e.g. "Notizie: Homepage")')
  .option('--gte <date>', 'Filter articles newer than or equal to this date (ISO string)')
  .option('--lte <date>', 'Filter articles older than or equal to this date (ISO string)')
  .action(async (inputs, options) => {
    try {
      if (!inputs || inputs.length === 0) {
        // Default to Homepage if no input provided
        inputs = ['Notizie: Homepage'];
      }

      // Resolve URLs from categories or use directly
      const urls = inputs.map(input => {
        const cat = CATEGORIES.find(c => c.name === input);
        return cat ? cat.url : input;
      });

      // Fetch all feeds in parallel, skipping those that fail
      const feedResults = await Promise.allSettled(urls.map(url => fetchRssFeed(url)));
      
      const merged = [];
      const seen = new Set();
      
      feedResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          for (const item of result.value) {
            const id = item.guid || item.link;
            if (!seen.has(id)) {
              merged.push(item);
              seen.add(id);
            }
          }
        } else {
          logger.warn(`Failed to fetch feed ${urls[index]}: ${result.reason.message}`);
        }
      });

      // Filter by date
      let filtered = merged;
      if (options.gte) {
        const gteDate = new Date(options.gte);
        filtered = filtered.filter(item => new Date(item.pubDate) >= gteDate);
      }
      if (options.lte) {
        const lteDate = new Date(options.lte);
        filtered = filtered.filter(item => new Date(item.pubDate) <= lteDate);
      }

      // Sort by date descending
      filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      logger.info(filtered);
    } catch (err) {
      logger.error({ err }, err.message);
      process.exit(1);
    }
  });

program
  .command('read')
  .description('Read an article using Puppeteer and cookies')
  .argument('<url>', 'The article URL')
  .argument('<cookiesFilePath>', 'Path to the Netscape HTTP Cookie File')
  .action(async (url, cookiesFilePath) => {
    try {
      const article = await scrapeArticle(url, cookiesFilePath);
      logger.info(article);
    } catch (err) {
      logger.error({ err }, err.message);
      process.exit(1);
    }
  });

program.parse();
