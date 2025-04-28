import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { statefulHandler, statelessHandler } from '../src';

// Create Express app
const app = express();
app.use(express.json());

// Create MCP Server for stateful sessions
const statefulServer = new McpServer({
  name: 'stateful-server',
  version: '1.0.0',
});

// Add a tool to the stateful server
statefulServer.tool(
  'greet',
  { name: z.string() },
  async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}! (from stateful server)` }] })
);

// Create stateful handler with session management
const statefulMcpHandler = statefulHandler(statefulServer, {
  sessionIdGenerator: () => randomUUID(),
  onSessionInitialized: (sessionId) => {
    console.log(`Stateful session initialized: ${sessionId}`);
  },
  onSessionClosed: (sessionId) => {
    console.log(`Stateful session closed: ${sessionId}`);
  }
});

// Factory function for creating stateless servers
const createStatelessServer = () => {
  const server = new McpServer({
    name: 'stateless-server',
    version: '1.0.0',
  });
  
  // Add a tool to the stateless server
  server.tool(
    'calculate',
    { 
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number()
    },
    async ({ operation, a, b }) => {
      let result: number;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            throw new Error('Division by zero');
          }
          result = a / b;
          break;
        default:
          throw new Error('Unknown operation');
      }
      
      return { content: [{ type: 'text', text: `Result: ${result} (from stateless server)` }] };
    }
  );
  
  return server;
};

// Create stateless handler
const statelessMcpHandler = statelessHandler(createStatelessServer);

// Mount handlers on different routes
app.post('/mcp/stateful', statefulMcpHandler);
app.get('/mcp/stateful', statefulMcpHandler);
app.delete('/mcp/stateful', statefulMcpHandler);

app.post('/mcp/stateless', statelessMcpHandler);

// Add a health check endpoint
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Combined Server running on port ${PORT}`);
  console.log(`- Stateful endpoint: http://localhost:${PORT}/mcp/stateful`);
  console.log(`- Stateless endpoint: http://localhost:${PORT}/mcp/stateless`);
}); 