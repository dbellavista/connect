import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';

describe('MCP Server Integration', () => {
  let client;
  let transport;

  beforeAll(async () => {
    // Start the MCP server process
    const serverPath = path.resolve(process.cwd(), 'src/mcp-server.js');
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (transport) {
      await transport.close();
    }
  });

  it('should respond to tools/list successfully and not corrupt stdout with logs', async () => {
    // If stdout is corrupted by logs (e.g. logger.info instead of writing to stderr), 
    // the MCP protocol parser would throw a ZodError about Invalid input during the request.
    const response = await client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    );

    expect(response).toBeDefined();
    expect(response.tools).toBeInstanceOf(Array);
    expect(response.tools.length).toBeGreaterThan(0);
    
    // Ensure the tools are the ones we expect
    const remarkableList = response.tools.find(t => t.name === 'remarkable_list');
    expect(remarkableList).toBeDefined();

    const remarkableBulkUpload = response.tools.find(t => t.name === 'remarkable_bulk_upload');
    expect(remarkableBulkUpload).toBeDefined();
  });
});
