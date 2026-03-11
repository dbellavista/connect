import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import * as path from "path";

const execAsync = promisify(exec);

const server = new Server(
  {
    name: "connect-mcp-server",
    version: "1.0.0",
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
          type: "text",
          text: stdout + (stderr ? "\nErrors:\n" + stderr : ""),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
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
        uri: "skill://remarkable",
        name: "reMarkable Skills Documentation",
        description: "Documentation and workflows for reMarkable skills",
        mimeType: "text/markdown"
      },
      {
        uri: "skill://ytmusic",
        name: "YouTube Music Skills Documentation",
        description: "Documentation and workflows for YouTube Music skills",
        mimeType: "text/markdown"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  let filePath = "";
  
  if (uri === "skill://remarkable") {
    filePath = path.join(process.cwd(), "skills/remarkable/README.md");
  } else if (uri === "skill://ytmusic") {
    filePath = path.join(process.cwd(), "skills/ytmusic/README.md");
  } else {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  try {
    const text = await fs.readFile(filePath, "utf-8");
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text
        }
      ]
    };
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`);
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "remarkable_list",
        description: "List files and directories in the reMarkable tablet by path (human readable)",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "The directory path to list (e.g. '/' or '/Notes')",
              default: "/"
            }
          }
        }
      },
      {
        name: "remarkable_ls_json",
        description: "List items in a specific reMarkable directory as JSON. Returns all metadata including IDs and hashes.",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "string",
              description: "The ID of the parent directory (default '' for root)",
              default: ""
            },
            type: {
              type: "string",
              description: "Optional filter: 'DocumentType' or 'CollectionType'"
            }
          }
        }
      },
      {
        name: "remarkable_delete",
        description: "Delete an entry on reMarkable using its current hash.",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "The hash of the entry to delete"
            }
          },
          required: ["hash"]
        }
      },
      {
        name: "remarkable_move",
        description: "Move an entry on reMarkable to a different directory.",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "The hash of the entry to move"
            },
            target_parent_id: {
              type: "string",
              description: "The ID of the destination directory (use '' for root or 'trash' for trash)"
            }
          },
          required: ["hash", "target_parent_id"]
        }
      },
      {
        name: "remarkable_rename",
        description: "Rename an entry on reMarkable.",
        inputSchema: {
          type: "object",
          properties: {
            hash: {
              type: "string",
              description: "The hash of the entry to rename"
            },
            new_name: {
              type: "string",
              description: "The new visible name"
            }
          },
          required: ["hash", "new_name"]
        }
      },
      {
        name: "remarkable_upload",
        description: "Upload a PDF or EPUB file to the reMarkable tablet",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Local path to the PDF or EPUB file"
            },
            directory: {
              type: "string",
              description: "Destination directory on reMarkable (e.g. '/Books')"
            }
          },
          required: ["file_path", "directory"]
        }
      },
      {
        name: "ytmusic_list_playlists",
        description: "List all YouTube Music playlists and their IDs",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "ytmusic_get_duplicates",
        description: "Get a JSON list of duplicate tracks in a playlist to analyze before removing.",
        inputSchema: {
          type: "object",
          properties: {
            playlist_id: { type: "string" }
          },
          required: ["playlist_id"]
        }
      },
      {
        name: "ytmusic_remove_duplicates",
        description: "Remove specific duplicate tracks. Requires the JSON array of tracks obtained from ytmusic_get_duplicates.",
        inputSchema: {
          type: "object",
          properties: {
            playlist_id: { type: "string" },
            tracks_json: { type: "string", description: "JSON string representing an array of track objects" }
          },
          required: ["playlist_id", "tracks_json"]
        }
      },
      {
        name: "ytmusic_get_sync_candidates",
        description: "Get a JSON list of tracks present in the secondary playlist but missing from the primary playlist.",
        inputSchema: {
          type: "object",
          properties: {
            primary: { type: "string", description: "ID of the primary playlist" },
            secondary: { type: "string", description: "ID of a single secondary playlist" }
          },
          required: ["primary", "secondary"]
        }
      },
      {
        name: "ytmusic_sync_add_to_primary",
        description: "Add specific tracks to the primary playlist. Requires the JSON array of tracks obtained from ytmusic_get_sync_candidates.",
        inputSchema: {
          type: "object",
          properties: {
            primary: { type: "string" },
            tracks_json: { type: "string", description: "JSON string representing an array of track objects" }
          },
          required: ["primary", "tracks_json"]
        }
      },
      {
        name: "ytmusic_sync_remove_from_secondary",
        description: "Remove specific tracks from the secondary playlist. Requires the JSON array of tracks obtained from ytmusic_get_sync_candidates.",
        inputSchema: {
          type: "object",
          properties: {
            secondary: { type: "string" },
            tracks_json: { type: "string", description: "JSON string representing an array of track objects" }
          },
          required: ["secondary", "tracks_json"]
        }
      },
      {
        name: "ytmusic_get_distribute_candidates",
        description: "Get a JSON list of tracks present in the primary playlist but missing from the secondary playlist.",
        inputSchema: {
          type: "object",
          properties: {
            primary: { type: "string", description: "ID of the primary playlist" },
            secondary: { type: "string", description: "ID of a single secondary playlist" }
          },
          required: ["primary", "secondary"]
        }
      },
      {
        name: "ytmusic_distribute_add_to_secondary",
        description: "Add specific tracks to the secondary playlist. Requires the JSON array of tracks obtained from ytmusic_get_distribute_candidates.",
        inputSchema: {
          type: "object",
          properties: {
            secondary: { type: "string" },
            tracks_json: { type: "string", description: "JSON string representing an array of track objects" }
          },
          required: ["secondary", "tracks_json"]
        }
      },
      {
        name: "ytmusic_deduplicate_playlist_auto",
        description: "Automatically remove all duplicate tracks from a playlist without manual review.",
        inputSchema: {
          type: "object",
          properties: {
            playlist_id: { type: "string" }
          },
          required: ["playlist_id"]
        }
      },
      {
        name: "ytmusic_sync_playlists_auto",
        description: "Automatically sync secondary playlists to a primary playlist: adds missing tracks to primary and removes them from secondary.",
        inputSchema: {
          type: "object",
          properties: {
            primary: { type: "string" },
            secondary: { type: "string", description: "Comma-separated list of secondary playlist IDs" }
          },
          required: ["primary", "secondary"]
        }
      },
      {
        name: "ytmusic_distribute_primary_auto",
        description: "Automatically distribute tracks from the primary playlist that are missing in the secondary playlists.",
        inputSchema: {
          type: "object",
          properties: {
            primary: { type: "string" },
            secondary: { type: "string", description: "Comma-separated list of secondary playlist IDs" }
          },
          required: ["primary", "secondary"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "remarkable_list": {
      const dir = request.params.arguments?.directory || "/";
      return await runCommand(`node main.js list "${dir}"`);
    }
    case "remarkable_ls_json": {
      const pid = request.params.arguments?.parent_id || "";
      const type = request.params.arguments?.type;
      let cmd = `node main.js ls-json "${pid}"`;
      if (type) cmd += ` --type "${type}"`;
      return await runCommand(cmd);
    }
    case "remarkable_delete": {
      const hash = request.params.arguments?.hash;
      return await runCommand(`node main.js rm "${hash}"`);
    }
    case "remarkable_move": {
      const hash = request.params.arguments?.hash;
      const tpid = request.params.arguments?.target_parent_id;
      return await runCommand(`node main.js mv "${hash}" "${tpid}"`);
    }
    case "remarkable_rename": {
      const hash = request.params.arguments?.hash;
      const name = request.params.arguments?.new_name;
      return await runCommand(`node main.js rename "${hash}" "${name}"`);
    }
    case "remarkable_upload": {
      const file = request.params.arguments?.file_path;
      const dir = request.params.arguments?.directory;
      return await runCommand(`node main.js upload "${file}" "${dir}"`);
    }
    case "ytmusic_list_playlists": {
      return await runCommand(`uv run invoke list-playlists`);
    }
    // Granular JSON tools
    case "ytmusic_get_duplicates": {
      const pid = request.params.arguments?.playlist_id;
      return await runCommand(`uv run invoke mcp-get-duplicates --playlist-id "${pid}"`);
    }
    case "ytmusic_remove_duplicates": {
      const pid = request.params.arguments?.playlist_id;
      const jsonStr = request.params.arguments?.tracks_json;
      // Pass JSON via single quotes to avoid escaping hell
      return await runCommand(`uv run invoke mcp-remove-duplicates --playlist-id "${pid}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`);
    }
    case "ytmusic_get_sync_candidates": {
      const prim = request.params.arguments?.primary;
      const sec = request.params.arguments?.secondary;
      return await runCommand(`uv run invoke mcp-get-sync-candidates --primary "${prim}" --secondary "${sec}"`);
    }
    case "ytmusic_sync_add_to_primary": {
      const prim = request.params.arguments?.primary;
      const jsonStr = request.params.arguments?.tracks_json;
      return await runCommand(`uv run invoke mcp-sync-add --primary "${prim}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`);
    }
    case "ytmusic_sync_remove_from_secondary": {
      const sec = request.params.arguments?.secondary;
      const jsonStr = request.params.arguments?.tracks_json;
      return await runCommand(`uv run invoke mcp-sync-remove --secondary "${sec}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`);
    }
    case "ytmusic_get_distribute_candidates": {
      const prim = request.params.arguments?.primary;
      const sec = request.params.arguments?.secondary;
      return await runCommand(`uv run invoke mcp-get-distribute-candidates --primary "${prim}" --secondary "${sec}"`);
    }
    case "ytmusic_distribute_add_to_secondary": {
      const sec = request.params.arguments?.secondary;
      const jsonStr = request.params.arguments?.tracks_json;
      return await runCommand(`uv run invoke mcp-distribute-add --secondary "${sec}" --tracks-json '${jsonStr.replace(/'/g, "'\\''")}'`);
    }
    // Auto tools
    case "ytmusic_deduplicate_playlist_auto": {
      const pid = request.params.arguments?.playlist_id;
      return await runCommand(`uv run invoke deduplicate-playlist --playlist-id "${pid}" --auto`);
    }
    case "ytmusic_sync_playlists_auto": {
      const prim = request.params.arguments?.primary;
      const sec = request.params.arguments?.secondary;
      return await runCommand(`uv run invoke sync-playlists --primary "${prim}" --secondary "${sec}" --auto`);
    }
    case "ytmusic_distribute_primary_auto": {
      const prim = request.params.arguments?.primary;
      const sec = request.params.arguments?.secondary;
      return await runCommand(`uv run invoke distribute-primary --primary "${prim}" --secondary "${sec}" --auto`);
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Connect MCP Server running on stdio");
}

run().catch(console.error);
