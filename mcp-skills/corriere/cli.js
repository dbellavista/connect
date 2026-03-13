import { Command } from 'commander';
import { fetchRssFeed, scrapeArticle } from './fetcher.js';
import { logger } from '../../src/utils/logger.js';

const program = new Command();

program.name('corriere-cli').description('CLI to interact with Corriere della Sera');

program
  .command('categories')
  .description('List available news categories and their RSS URLs')
  .action(() => {
    // Hardcoded list from https://www.corriere.it/rss/
    const categories = [
      { name: 'Homepage', url: 'https://xml2.corriereobjects.it/rss/homepage.xml' },
      { name: 'Politica', url: 'https://xml2.corriereobjects.it/rss/politica.xml' },
      { name: 'Esteri', url: 'https://xml2.corriereobjects.it/rss/esteri.xml' },
      { name: 'Cronache', url: 'https://xml2.corriereobjects.it/rss/cronache.xml' },
      { name: 'Economia', url: 'https://xml2.corriereobjects.it/rss/economia.xml' },
      { name: 'Sport', url: 'https://xml2.corriereobjects.it/rss/sport.xml' },
      { name: 'Spettacoli', url: 'https://xml2.corriereobjects.it/rss/spettacoli.xml' },
      { name: 'Cultura', url: 'https://xml2.corriereobjects.it/rss/cultura.xml' },
      { name: 'Scienze', url: 'https://xml2.corriereobjects.it/rss/scienze.xml' },
      { name: 'Tecnologia', url: 'https://xml2.corriereobjects.it/rss/tecnologia.xml' },
      { name: 'Salute', url: 'https://xml2.corriereobjects.it/rss/salute.xml' },
    ];
    logger.info(categories);
  });

program
  .command('news')
  .description('Get latest news for a specific RSS URL')
  .argument('<url>', 'The RSS feed URL')
  .action(async (url) => {
    try {
      const news = await fetchRssFeed(url);
      logger.info(news);
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
