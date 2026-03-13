import https from 'https';
import nodeFetch from 'node-fetch';
import { logger } from './utils/logger.js';

// Limit concurrent connections to avoid ETIMEDOUT / fetch failed with many files
const agent = new https.Agent({ maxSockets: 5, keepAlive: true });
global.fetch = function (url, options = {}) {
  options.agent = agent;
  return nodeFetch(url, options);
};

import { Command } from 'commander';
import { register, remarkable } from 'rmapi-js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { mkdirSync } from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const TOKEN_FILE = path.join(DATA_DIR, '.rmapi-token');
const CACHE_FILE = path.join(DATA_DIR, '.rmapi-cache');

async function getToken() {
  try {
    return await fs.readFile(TOKEN_FILE, 'utf8');
  } catch (err) {
    throw new Error('Not authenticated. Please run "auth <code>" first.', { cause: err });
  }
}

async function getApi() {
  const token = await getToken();
  let cacheData = undefined;
  try {
    cacheData = await fs.readFile(CACHE_FILE, 'utf8');
  } catch {
    // Ignore cache read errors (e.g., file not found)
  }
  return await remarkable(token, { cache: cacheData });
}

async function saveCache(api) {
  try {
    const cacheStr = api.dumpCache();
    await fs.writeFile(CACHE_FILE, cacheStr, 'utf8');
  } catch (err) {
    logger.error({ err }, `Warning: Failed to save cache: ${err.message}`);
  }
}

// Helper to resolve a directory path to an ID
async function resolveDirectory(api, targetPath) {
  if (!targetPath || targetPath === '/' || targetPath === '') {
    return ''; // Root
  }

  const items = await api.listItems();
  const parts = targetPath.split('/').filter((p) => p.trim() !== '');

  let currentParentId = ''; // Start at root
  for (const part of parts) {
    const folder = items.find(
      (item) =>
        item.visibleName === part &&
        item.type === 'CollectionType' &&
        (item.parent || '') === currentParentId
    );

    if (!folder) {
      throw new Error(`Directory not found: ${part} in path ${targetPath}`);
    }
    currentParentId = folder.id;
  }

  return currentParentId;
}

const program = new Command();

program.name('rmapi-cli').description('CLI to interact with reMarkable via rmapi-js');

program
  .command('auth')
  .description(
    'Authenticate device with an 8-letter code from https://my.remarkable.com/device/desktop/connect'
  )
  .argument('<code>', '8-letter authentication code')
  .action(async (code) => {
    try {
      logger.info('Authenticating...');
      const token = await register(code);
      await fs.writeFile(TOKEN_FILE, token, 'utf8');
      logger.info('Authentication successful. Token saved.');
    } catch (err) {
      logger.error({ err }, `Authentication failed: ${err.message}`);
      if (err.cause) logger.error({ cause: err.cause }, 'Cause');
      logger.error({ stack: err.stack }, 'Stack trace');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List files in a specific directory (human readable)')
  .argument('[directory]', 'Directory path to list (e.g. /Notes/Meetings)', '/')
  .action(async (directory) => {
    try {
      const api = await getApi();
      const items = await api.listItems();

      const parentId = await resolveDirectory(api, directory);

      const children = items.filter((item) => (item.parent || '') === parentId);

      if (children.length === 0) {
        logger.info(`No files found in directory: ${directory}`);
        await saveCache(api);
        return;
      }

      logger.info(`Contents of ${directory}:`);
      for (const child of children) {
        const typeStr = child.type === 'CollectionType' ? '[DIR]' : '[FILE]';
        logger.info(`${typeStr} ${child.visibleName}`);
      }

      await saveCache(api);
    } catch (err) {
      logger.error({ err }, `Failed to list files: ${err.message}`);
      if (err.cause) logger.error({ cause: err.cause }, 'Cause');
      logger.error({ stack: err.stack }, 'Stack trace');
      process.exit(1);
    }
  });

program
  .command('ls-json')
  .description('List files in a specific directory as JSON for MCP')
  .argument('[parentId]', 'The ID of the parent directory (default "" for root)', '')
  .option('--type <type>', 'Filter by type: DocumentType or CollectionType')
  .action(async (parentId, options) => {
    try {
      const api = await getApi();
      const items = await api.listItems();

      let children = items.filter((item) => (item.parent || '') === parentId);

      if (options.type) {
        children = children.filter((item) => item.type === options.type);
      }

      process.stdout.write(JSON.stringify(children) + '\n');
      await saveCache(api);
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(1);
    }
  });

program
  .command('rm')
  .description('Delete an entry by its hash')
  .argument('<hash>', 'The hash of the entry to delete')
  .action(async (hash) => {
    try {
      const api = await getApi();
      logger.info(`Deleting entry with hash ${hash}...`);
      await api.delete(hash);
      logger.info('Delete successful.');
      await saveCache(api);
    } catch (err) {
      logger.error({ err }, `Failed to delete: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('mv')
  .description('Move an entry by its hash to a new parent directory ID')
  .argument('<hash>', 'The hash of the entry to move')
  .argument('<parentId>', 'The ID of the destination parent directory')
  .action(async (hash, parentId) => {
    try {
      const api = await getApi();
      logger.info(`Moving entry ${hash} to ${parentId}...`);
      await api.move(hash, parentId);
      logger.info('Move successful.');
      await saveCache(api);
    } catch (err) {
      logger.error({ err }, `Failed to move: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('rename')
  .description('Rename an entry by its hash')
  .argument('<hash>', 'The hash of the entry to rename')
  .argument('<newName>', 'The new visible name')
  .action(async (hash, newName) => {
    try {
      const api = await getApi();
      logger.info(`Renaming entry ${hash} to ${newName}...`);
      await api.rename(hash, newName);
      logger.info('Rename successful.');
      await saveCache(api);
    } catch (err) {
      logger.error({ err }, `Failed to rename: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('upload')
  .description('Upload a PDF or EPUB file to a specific directory')
  .argument('<file>', 'Path to local file (.pdf or .epub)')
  .argument('<directory>', 'Destination directory on reMarkable')
  .action(async (file, directory) => {
    try {
      const api = await getApi();
      const parentId = await resolveDirectory(api, directory);

      const fileBuffer = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const visibleName = path.basename(file, ext);

      logger.info(`Uploading ${file} to ${directory}...`);
      if (ext === '.pdf') {
        await api.putPdf(visibleName, fileBuffer, { parent: parentId });
      } else if (ext === '.epub') {
        await api.putEpub(visibleName, fileBuffer, { parent: parentId });
      } else {
        throw new Error('Unsupported file type. Only .pdf and .epub are supported.');
      }

      logger.info('Upload complete!');
      await saveCache(api);
    } catch (err) {
      logger.error({ err }, `Failed to upload file: ${err.message}`);
      if (err.cause) logger.error({ cause: err.cause }, 'Cause');
      logger.error({ stack: err.stack }, 'Stack trace');
      process.exit(1);
    }
  });

program.parse();
