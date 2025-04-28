import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { statefulHandler } from '../src';

// Create Express app
const app = express();
app.use(express.json());

// Create MCP Server
const server = new McpServer({
  name: 'stateful-example-server',
  version: '1.0.0',
});

// Add a simple echo tool
server.tool(
  'echo',
  { message: z.string() },
  async ({ message }) => ({ content: [{ type: 'text', text: `Echo: ${message}` }] })
);

// Configure the stateful handler
const handler = statefulHandler(server, {
  sessionIdGenerator: () => randomUUID(),
  onSessionInitialized: (sessionId) => {
    console.log(`Session initialized: ${sessionId}`);
  },
  onSessionClosed: (sessionId) => {
    console.log(`Session closed: ${sessionId}`);
  },
  onError: (error, sessionId) => {
    console.error(`Error in session ${sessionId || 'unknown'}:`, error);
  }
});

// Mount the handler on multiple HTTP methods
app.post('/mcp', handler);
app.get('/mcp', handler);
app.delete('/mcp', handler);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stateful MCP server running on port ${PORT}`);
}); 