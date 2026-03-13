import https from 'https';
import nodeFetch from 'node-fetch';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs, mkdirSync } from 'fs';
import * as path from 'path';
import { remarkable } from 'rmapi-js';
import { logger } from './utils/logger.js';

const execAsync = promisify(exec);

// Limit concurrent connections to avoid ETIMEDOUT / fetch failed with many files
const agent = new https.Agent({ maxSockets: 5, keepAlive: true });
global.fetch = function (url, options = {}) {
  options.agent = agent;
  return nodeFetch(url, options);
};

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const TOKEN_FILE = path.join(DATA_DIR, '.rmapi-token');
const CACHE_FILE = path.join(DATA_DIR, '.rmapi-cache');

async function getToken() {
  try {
    return await fs.readFile(TOKEN_FILE, 'utf8');
  } catch (err) {
    throw new Error('Not authenticated. Please run "node src/main.js auth <code>" first.', {
      cause: err,
    });
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

const server = new Server(
  {
    name: 'connect-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper to execute local commands
async function runCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
    return {
      content: [
        {
          type: 'text',
          text: stdout + (stderr ? '\nErrors:\n' + stderr : ''),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Command failed: ${error.message}\n${error.stdout}\n${error.stderr}`,
        },
      ],
      isError: true,
    };
  }
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'skill://remarkable',
        name: 'reMarkable Skills Documentation',
        description: 'Documentation and workflows for reMarkable skills',
        mimeType: 'text/markdown',
      },
      {
        uri: 'skill://ytmusic',
        name: 'YouTube Music Skills Documentation',
        description: 'Documentation and workflows for YouTube Music skills',
        mimeType: 'text/markdown',
      },
      {
        uri: 'skill://utility',
        name: 'Utility Skills Documentation',
        description: 'Documentation and workflows for utility skills (PDF reflowing, Markdown conversion)',
        mimeType: 'text/markdown',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  let filePath;

  if (uri === 'skill://remarkable') {
    filePath = path.join(process.cwd(), 'mcp-skills/remarkable/README.md');
  } else if (uri === 'skill://ytmusic') {
    filePath = path.join(process.cwd(), 'mcp-skills/ytmusic/README.md');
  } else if (uri === 'skill://utility') {
    filePath = path.join(process.cwd(), 'mcp-skills/utility/README.md');
  } else {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`, { cause: error });
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'remarkable_list',
        description: 'List files and directories in the reMarkable tablet by path (human readable)',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: "The directory path to list (e.g. '/' or '/Notes')",
              default: '/',
            },
          },
        },
      },
      {
        name: 'remarkable_ls_json',
        description:
          'List items in a specific reMarkable directory as JSON. Returns all metadata including IDs and hashes.',
        inputSchema: {
          type: 'object',
          properties: {
            parent_id: {
              type: 'string',
              description: "The ID of the parent directory (default '' for root)",
              default: '',
            },
            type: {
              type: 'string',
              description: "Optional filter: 'DocumentType' or 'CollectionType'",
            },
          },
        },
      },
      {
        name: 'remarkable_delete',
        description: 'Delete an entry on reMarkable using its current hash.',
        inputSchema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'The hash of the entry to delete',
            },
          },
          required: ['hash'],
        },
      },
      {
        name: 'remarkable_bulk_delete',
        description: 'Delete multiple entries on reMarkable using their hashes.',
        inputSchema: {
          type: 'object',
          properties: {
            hashes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of hashes to delete',
            },
          },
          required: ['hashes'],
        },
      },
      {
        name: 'remarkable_move',
        description: 'Move an entry on reMarkable to a different directory.',
        inputSchema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'The hash of the entry to move',
            },
            target_parent_id: {
              type: 'string',
              description: "The ID of the destination directory (use '' for root or 'trash' for trash)",
            },
          },
          required: ['hash', 'target_parent_id'],
        },
      },
      {
        name: 'remarkable_rename',
        description: 'Rename an entry on reMarkable.',
        inputSchema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'The hash of the entry to rename',
            },
            new_name: {
              type: 'string',
              description: 'The new visible name',
            },
          },
          required: ['hash', 'new_name'],
        },
      },
      {
        name: 'remarkable_bulk_update',
        description:
          'Update multiple entries on reMarkable. Applies sequential updates for properties like rename, move, and stared status.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              description: 'Array of update objects.',
              items: {
                type: 'object',
                properties: {
                  hash: { type: 'string', description: 'The hash of the entry' },
                  newName: { type: 'string', description: 'Optional: New visible name' },
                  parentId: { type: 'string', description: 'Optional: Target parent directory ID' },
                  stared: { type: 'boolean', description: 'Optional: Set stared status' },
                },
                required: ['hash'],
              },
            },
          },
          required: ['updates'],
        },
      },
      {
        name: 'util_reflow_pdf',
        description:
          'Reflow a two-column scientific PDF into a single column with larger font for better readability on devices like reMarkable.',
        inputSchema: {
          type: 'object',
          properties: {
            input_pdf: { type: 'string', description: 'Path to the input PDF file (MUST be within the /app/data/ volume)' },
            output_pdf: { type: 'string', description: 'Path to the output reflowed PDF (MUST be within the /app/data/ volume)' },
            font_size: {
              type: 'number',
              description: 'Font size for the reflowed text',
              default: 16,
            },
          },
          required: ['input_pdf', 'output_pdf'],
        },
      },
      {
        name: 'util_markdown_to_pdf',
        description:
          'Convert a Markdown file into a PDF with increased font size for better readability on devices like reMarkable.',
        inputSchema: {
          type: 'object',
          properties: {
            input_md: { type: 'string', description: 'Path to the input Markdown file (MUST be within the /app/data/ volume)' },
            output_pdf: { type: 'string', description: 'Path to the output PDF file (MUST be within the /app/data/ volume)' },
            font_size: {
              type: 'number',
              description: 'Font size for the text',
              default: 16,
            },
          },
          required: ['input_md', 'output_pdf'],
        },
      },
      {
        name: 'util_bulk_reflow_pdf',
        description: 'Bulk reflow multiple PDF files.',
        inputSchema: {
          type: 'object',
          properties: {
            inputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input_pdf: { type: 'string', description: 'Path to the input PDF file (MUST be within the /app/data/ volume)' },
                  output_pdf: { type: 'string', description: 'Path to the output reflowed PDF (MUST be within the /app/data/ volume)' },
                },
                required: ['input_pdf', 'output_pdf'],
              },
            },
            font_size: {
              type: 'number',
              description: 'Font size for the reflowed text',
              default: 16,
            },
          },
          required: ['inputs'],
        },
      },
      {
        name: 'util_bulk_markdown_to_pdf',
        description: 'Bulk convert multiple Markdown files to PDF.',
        inputSchema: {
          type: 'object',
          properties: {
            inputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input_md: { type: 'string', description: 'Path to the input Markdown file (MUST be within the /app/data/ volume)' },
                  output_pdf: { type: 'string', description: 'Path to the output PDF file (MUST be within the /app/data/ volume)' },
                },
                required: ['input_md', 'output_pdf'],
              },
            },
            font_size: {
              type: 'number',
              description: 'Font size for the text',
              default: 16,
            },
          },
          required: ['inputs'],
        },
      },
      {
        name: 'remarkable_upload',
        description: 'Upload a PDF or EPUB file to the reMarkable tablet',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Local path to the PDF or EPUB file (MUST be within the /app/data/ volume)',
            },
            directory: {
              type: 'string',
              description: "Destination directory on reMarkable (e.g. '/Books')",
            },
          },
          required: ['file_path', 'directory'],
        },
      },
      {
        name: 'remarkable_bulk_upload',
        description: 'Upload multiple PDF or EPUB files to the reMarkable tablet',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Local paths to the PDF or EPUB files (MUST be within the /app/data/ volume)',
            },
            directory: {
              type: 'string',
              description: "Destination directory on reMarkable (e.g. '/Books')",
            },
          },
          required: ['files', 'directory'],
        },
      },
      {
        name: 'ytmusic_list_playlists',
        description: 'List all YouTube Music playlists and their IDs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ytmusic_get_duplicates',
        description: 'Get a JSON list of duplicate tracks in a playlist to analyze before removing.',
        inputSchema: {
          type: 'object',
          properties: {
            playlist_id: { type: 'string' },
          },
          required: ['playlist_id'],
        },
      },
      {
        name: 'ytmusic_remove_duplicates',
        description:
          'Remove specific duplicate tracks. Requires the JSON array of tracks obtained from ytmusic_get_duplicates.',
        inputSchema: {
          type: 'object',
          properties: {
            playlist_id: { type: 'string' },
            tracks_json: {
              type: 'string',
              description: 'JSON string representing an array of track objects',
            },
          },
          required: ['playlist_id', 'tracks_json'],
        },
      },
      {
        name: 'ytmusic_get_sync_candidates',
        description:
          'Get a JSON list of tracks present in the secondary playlist but missing from the primary playlist.',
        inputSchema: {
          type: 'object',
          properties: {
            primary: { type: 'string', description: 'ID of the primary playlist' },
            secondary: { type: 'string', description: 'ID of a single secondary playlist' },
          },
          required: ['primary', 'secondary'],
        },
      },
      {
        name: 'ytmusic_sync_add_to_primary',
        description:
          'Add specific tracks to the primary playlist. Requires the JSON array of tracks obtained from ytmusic_get_sync_candidates.',
        inputSchema: {
          type: 'object',
          properties: {
            primary: { type: 'string' },
            tracks_json: {
              type: 'string',
              description: 'JSON string representing an array of track objects',
            },
          },
          required: ['primary', 'tracks_json'],
        },
      },
      {
        name: 'ytmusic_sync_remove_from_secondary',
        description:
          'Remove specific tracks from the secondary playlist. Requires the JSON array of tracks obtained from ytmusic_get_sync_candidates.',
        inputSchema: {
          type: 'object',
          properties: {
            secondary: { type: 'string' },
            tracks_json: {
              type: 'string',
              description: 'JSON string representing an array of track objects',
            },
          },
          required: ['secondary', 'tracks_json'],
        },
      },
      {
        name: 'ytmusic_get_distribute_candidates',
        description:
          'Get a JSON list of tracks present in the primary playlist but missing from the secondary playlist.',
        inputSchema: {
          type: 'object',
          properties: {
            primary: { type: 'string', description: 'ID of the primary playlist' },
            secondary: { type: 'string', description: 'ID of a single secondary playlist' },
          },
          required: ['primary', 'secondary'],
        },
      },
      {
        name: 'ytmusic_distribute_add_to_secondary',
        description:
          'Add specific tracks to the secondary playlist. Requires the JSON array of tracks obtained from ytmusic_get_distribute_candidates.',
        inputSchema: {
          type: 'object',
          properties: {
            secondary: { type: 'string' },
            tracks_json: {
              type: 'string',
              description: 'JSON string representing an array of track objects',
            },
          },
          required: ['secondary', 'tracks_json'],
        },
      },
      {
        name: 'ytmusic_deduplicate_playlist_auto',
        description: 'Automatically remove all duplicate tracks from a playlist without manual review.',
        inputSchema: {
          type: 'object',
          properties: {
            playlist_id: { type: 'string' },
          },
          required: ['playlist_id'],
        },
      },
      {
        name: 'ytmusic_sync_playlists_auto',
        description:
          'Automatically sync secondary playlists to a primary playlist: adds missing tracks to primary and removes them from secondary.',
        inputSchema: {
          type: 'object',
          properties: {
            primary: { type: 'string' },
            secondary: {
              type: 'string',
              description: 'Comma-separated list of secondary playlist IDs',
            },
          },
          required: ['primary', 'secondary'],
        },
      },
      {
        name: 'ytmusic_distribute_primary_auto',
        description:
          'Automatically distribute tracks from the primary playlist that are missing in the secondary playlists.',
        inputSchema: {
          type: 'object',
          properties: {
            primary: { type: 'string' },
            secondary: {
              type: 'string',
              description: 'Comma-separated list of secondary playlist IDs',
            },
          },
          required: ['primary', 'secondary'],
        },
      },
      {
        name: 'corriere_get_categories',
        description: 'List available news categories and their RSS URLs from Corriere della Sera.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'corriere_get_news',
        description: 'Get the latest news articles for a specific Corriere della Sera RSS URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The RSS feed URL' },
          },
          required: ['url'],
        },
      },
      {
        name: 'corriere_read_article',
        description: 'Read the full text of a Corriere della Sera article, bypassing paywall via existing cookies.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The article URL' },
            cookies_file: {
              type: 'string',
              description: 'Path to the Netscape HTTP Cookie File (defaults to data/corriere-cookies.txt)',
              default: 'data/corriere-cookies.txt',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'remarkable_list': {
        const dir = request.params.arguments?.directory || '/';
        return await runCommand(`node src/main.js list "${dir}"`);
      }
      case 'remarkable_ls_json': {
        const pid = request.params.arguments?.parent_id || '';
        const typeFilter = request.params.arguments?.type;
        const api = await getApi();
        const items = await api.listItems();

        let children = items.filter((item) => (item.parent || '') === pid);
        if (typeFilter) {
          children = children.filter((item) => item.type === typeFilter);
        }

        await saveCache(api);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(children, null, 2),
            },
          ],
        };
      }
      case 'remarkable_delete': {
        const hash = request.params.arguments?.hash;
        if (!hash) throw new Error("Missing 'hash' argument.");

        const api = await getApi();
        await api.delete(hash);
        await saveCache(api);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted entry with hash: ${hash}`,
            },
          ],
        };
      }
      case 'remarkable_bulk_delete': {
        const hashes = request.params.arguments?.hashes;
        if (!hashes || !Array.isArray(hashes)) {
          throw new Error("Missing or invalid 'hashes' array.");
        }

        const api = await getApi();
        const result = await api.bulkDelete(hashes);
        await saveCache(api);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted ${hashes.length} entries.\nResult: ${JSON.stringify(result)}`,
            },
          ],
        };
      }
      case 'remarkable_move': {
        const hash = request.params.arguments?.hash;
        const tpid = request.params.arguments?.target_parent_id;
        if (!hash || typeof tpid === 'undefined') throw new Error("Missing 'hash' or 'target_parent_id' argument.");

        const api = await getApi();
        await api.move(hash, tpid);
        await saveCache(api);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully moved entry with hash: ${hash} to ${tpid}`,
            },
          ],
        };
      }
      case 'remarkable_rename': {
        const hash = request.params.arguments?.hash;
        const name = request.params.arguments?.new_name;
        if (!hash || !name) throw new Error("Missing 'hash' or 'new_name' argument.");

        const api = await getApi();
        await api.rename(hash, name);
        await saveCache(api);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully renamed entry with hash: ${hash} to ${name}`,
            },
          ],
        };
      }
      case 'remarkable_bulk_update': {
        const updates = request.params.arguments?.updates;
        if (!updates || !Array.isArray(updates)) {
          throw new Error("Missing or invalid 'updates' array.");
        }

        const api = await getApi();
        const results = [];

        for (const update of updates) {
          const { hash, newName, parentId, stared } = update;
          if (!hash) {
            results.push({ error: 'Missing hash in update object', update });
            continue;
          }

          try {
            const currentResults = {};
            if (newName !== undefined) {
              await api.rename(hash, newName);
              currentResults.renamed = true;
            }
            if (parentId !== undefined) {
              await api.move(hash, parentId);
              currentResults.moved = true;
            }
            if (stared !== undefined) {
              await api.stared(hash, stared);
              currentResults.stared = true;
            }
            results.push({ hash, success: true, changes: currentResults });
          } catch (err) {
            results.push({ hash, error: err.message || String(err) });
          }
        }

        await saveCache(api);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }
      case 'util_reflow_pdf': {
        const input = request.params.arguments?.input_pdf;
        const output = request.params.arguments?.output_pdf;
        const fontSize = request.params.arguments?.font_size || 16;
        return await runCommand(
          `uv run invoke pdf.reflow-pdf --input-pdf "${input}" --output-pdf "${output}" --font-size ${fontSize}`
        );
      }
      case 'util_markdown_to_pdf': {
        const inputMd = request.params.arguments?.input_md;
        const outputPdf = request.params.arguments?.output_pdf;
        const fontSize = request.params.arguments?.font_size || 16;
        return await runCommand(
          `uv run invoke pdf.markdown-to-pdf --input-md "${inputMd}" --output-pdf "${outputPdf}" --font-size ${fontSize}`
        );
      }
      case 'util_bulk_reflow_pdf': {
        const inputs = request.params.arguments?.inputs || [];
        const fontSize = request.params.arguments?.font_size || 16;
        const jsonStr = JSON.stringify(inputs);
        return await runCommand(
          `uv run invoke pdf.mcp-bulk-reflow --inputs-json '${jsonStr.replace(/'/g, "'\\''")}' --font-size ${fontSize}`
        );
      }
      case 'util_bulk_markdown_to_pdf': {
        const inputs = request.params.arguments?.inputs || [];
        const fontSize = request.params.arguments?.font_size || 16;
        const jsonStr = JSON.stringify(inputs);
        return await runCommand(
          `uv run invoke pdf.mcp-bulk-markdown-to-pdf --inputs-json '${jsonStr.replace(/'/g, "'\\''")}' --font-size ${fontSize}`
        );
      }
      case 'remarkable_upload': {
        const file = request.params.arguments?.file_path;
        const dir = request.params.arguments?.directory;
        return await runCommand(`node src/main.js upload "${file}" "${dir}"`);
      }
      case 'remarkable_bulk_upload': {
        const files = request.params.arguments?.files || [];
        const dir = request.params.arguments?.directory;
        if (files.length === 0) {
           return { content: [{ type: 'text', text: 'No files provided for upload.' }] };
        }
        const filesArgs = files.map(f => `"${f}"`).join(' ');
        return await runCommand(`node src/main.js bulk-upload "${dir}" ${filesArgs}`);
      }
      case 'ytmusic_list_playlists': {
        return await runCommand(`uv run invoke youtube.list-playlists`);
      }
      // Granular JSON tools
      case 'ytmusic_get_duplicates': {
        const pid = request.params.arguments?.playlist_id;
        return await runCommand(`uv run invoke youtube.mcp-get-duplicates --playlist-id "${pid}"`);
      }
      case 'ytmusic_remove_duplicates': {
        const pid = request.params.arguments?.playlist_id;
        const jsonStr = request.params.arguments?.tracks_json;
        // Pass JSON via single quotes to avoid escaping hell
        return await runCommand(
          `uv run invoke youtube.mcp-remove-duplicates --playlist-id "${pid}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`
        );
      }
      case 'ytmusic_get_sync_candidates': {
        const prim = request.params.arguments?.primary;
        const sec = request.params.arguments?.secondary;
        return await runCommand(`uv run invoke youtube.mcp-get-sync-candidates --primary "${prim}" --secondary "${sec}"`);
      }
      case 'ytmusic_sync_add_to_primary': {
        const prim = request.params.arguments?.primary;
        const jsonStr = request.params.arguments?.tracks_json;
        return await runCommand(
          `uv run invoke youtube.mcp-sync-add --primary "${prim}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`
        );
      }
      case 'ytmusic_sync_remove_from_secondary': {
        const sec = request.params.arguments?.secondary;
        const jsonStr = request.params.arguments?.tracks_json;
        return await runCommand(
          `uv run invoke youtube.mcp-sync-remove --secondary "${sec}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`
        );
      }
      case 'ytmusic_get_distribute_candidates': {
        const prim = request.params.arguments?.primary;
        const sec = request.params.arguments?.secondary;
        return await runCommand(
          `uv run invoke youtube.mcp-get-distribute-candidates --primary "${prim}" --secondary "${sec}"`
        );
      }
      case 'ytmusic_distribute_add_to_secondary': {
        const sec = request.params.arguments?.secondary;
        const jsonStr = request.params.arguments?.tracks_json;
        return await runCommand(
          `uv run invoke youtube.mcp-distribute-add --secondary "${sec}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`
        );
      }
      // Auto tools
      case 'ytmusic_deduplicate_playlist_auto': {
        const pid = request.params.arguments?.playlist_id;
        return await runCommand(`uv run invoke youtube.deduplicate-playlist --playlist-id "${pid}" --auto`);
      }
      case 'ytmusic_sync_playlists_auto': {
        const prim = request.params.arguments?.primary;
        const sec = request.params.arguments?.secondary;
        return await runCommand(`uv run invoke youtube.sync-playlists --primary "${prim}" --secondary "${sec}" --auto`);
      }
      case 'ytmusic_distribute_primary_auto': {
        const prim = request.params.arguments?.primary;
        const sec = request.params.arguments?.secondary;
        return await runCommand(
          `uv run invoke youtube.distribute-primary --primary "${prim}" --secondary "${sec}" --auto`
        );
      }
      case 'corriere_get_categories': {
        return await runCommand(`node mcp-skills/corriere/cli.js categories`);
      }
      case 'corriere_get_news': {
        const url = request.params.arguments?.url;
        return await runCommand(`node mcp-skills/corriere/cli.js news "${url}"`);
      }
      case 'corriere_read_article': {
        const url = request.params.arguments?.url;
        const cookiesFile = request.params.arguments?.cookies_file || 'data/corriere-cookies.txt';
        return await runCommand(`node mcp-skills/corriere/cli.js read "${url}" "${cookiesFile}"`);
      }
      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n${error.stack}`,
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Connect MCP Server running on stdio');
}

run().catch((err) => logger.error({ err }));
