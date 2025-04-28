# express-mcp-handler

A utility for integrating Model Context Protocol (MCP) into your Express applications.

## Features

- **Stateful Handler**: Maintains long-lived sessions with session IDs and Server-Sent Events (SSE).
- **Stateless Handler**: Handles each request in complete isolation for simple, one-off interactions.
- Flexible and easy-to-use API that plugs directly into Express routes.

## Installation

Install via npm:

```bash
npm install express-mcp-handler
```

Or yarn:

```bash
yarn add express-mcp-handler
```

### Peer Dependencies

- `express` >= 4.x
- `@modelcontextprotocol/sdk`

## Usage

Import the handlers from the package and mount them on your Express app:

```ts
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { statefulHandler, statelessHandler } from 'express-mcp-handler';

const app = express();
app.use(express.json());
```

### Stateful Mode

Use `statefulHandler` to establish reusable sessions between client and server.

```ts
import { randomUUID } from 'node:crypto';

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
});

const handlerOptions = {
  sessionIdGenerator: randomUUID,
  onSessionInitialized: (sessionId: string) => {
    console.log(`Session initialized: ${sessionId}`);
  },
  onSessionClosed: (sessionId: string) => {
    console.log(`Session closed: ${sessionId}`);
    // perform cleanup logic here
  },
  onError: (error: Error, sessionId?: string) => {
    console.error(`Error in session ${sessionId}:`, error);
  }
};

app.post('/mcp', statefulHandler(server, handlerOptions));
app.get('/mcp', statefulHandler(server, handlerOptions));
app.delete('/mcp', statefulHandler(server, handlerOptions));

app.listen(3000, () => {
  console.log('Express MCP server running on port 3000');
});
```

The handler will:

- Initialize a new session on the first request (with no `mcp-session-id` header).
- Return a `mcp-session-id` header that clients must include in subsequent requests.
- Manage Server-Sent Events (SSE) to push messages from the server to the client.
- Automatically clean up sessions when closed.

### Stateless Mode

Use `statelessHandler` for one-off request handling with no session management:

```ts
app.post('/mcp', statelessHandler());

app.listen(3000, () => {
  console.log('Express Stateless MCP server running on port 3000');
});
```

Each request:

- Creates a fresh transport and server instance.
- Ensures isolation and no session tracking.
- Suitable for simple or serverless environments.

## API Reference

### statefulHandler

```ts
function statefulHandler(
  server: McpServer,
  options: {
    sessionIdGenerator: () => string;
    onSessionInitialized?: (sessionId: string) => void;
    onSessionClosed?: (sessionId: string) => void;
    onError?: (error: Error, sessionId?: string) => void;
  }
): express.RequestHandler;
```

- **server**: Instance of `McpServer` to handle protocol logic.
- **options.sessionIdGenerator**: Function that returns a unique session ID.
- **options.onSessionInitialized** _(optional)_: Callback invoked with the new session ID.
- **options.onSessionClosed** _(optional)_: Callback invoked when a session is closed.
- **options.onError** _(optional)_: Callback invoked on errors.

### statelessHandler

```ts
function statelessHandler(
  serverFactory: () => McpServer,
  options?: {
    sessionIdGenerator?: () => string;
    onClose?: (req: express.Request, res: express.Response) => void;
    onError?: (error: Error) => void;
  }
): express.RequestHandler;
```

- **serverFactory**: Function that returns a new server instance.
- **options.sessionIdGenerator** _(optional)_: Override transport session ID generation.
- **options.onClose** _(optional)_: Callback fired when the request/response cycle ends.
- **options.onError** _(optional)_: Callback fired on errors during handling.

## Development

```bash
git clone https://github.com/your-org/express-mcp-handler.git
cd express-mcp-handler
npm install
npm run build
npm test
```

## License

MIT License

## Publishing to npm

Log in to npm if you haven't already:
```bash
npm login
```

Publish the package to npm (will run your prepublishOnly build):
```bash
npm publish
```

To bump, tag, and push a new version:
```bash
npm version patch    # or minor, major
git push origin main --tags
```
