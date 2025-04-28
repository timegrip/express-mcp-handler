# express-mcp-handler

A utility for integrating Model Context Protocol (MCP) into your Express applications with both stateful and stateless modes.

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

## Implementation Plan

To build and publish this package, follow these steps:

1. **Project Setup**  
   - **Goal:** Establish the repository, version control, and initial configuration files (`.gitignore`, `package.json`, `tsconfig.json`).  
   - **Reason:** Provides a consistent foundation and development environment, ensures unwanted files are excluded, and configures TypeScript compilation and linting.

2. **Define TypeScript Interfaces**  
   - **Goal:** Create `src/types.ts` defining `StatefulHandlerOptions` and `StatelessHandlerOptions`.  
   - **Reason:** Enforces a strong, self-documenting API contract and compile-time safety for implementers, reducing runtime errors.

3. **Implement `statefulHandler`**  
   - **Goal:** Build the core stateful Express handler in `src/stateful.ts` that manages long-lived MCP sessions, session ID generation, and listener hooks.  
   - **Reason:** Allows clients to maintain persistent MCP sessions over HTTP/SSE, avoid ID collisions, and hook into lifecycle events (`init`, `close`, `error`).

4. **Implement `statelessHandler`**  
   - **Goal:** Create `src/stateless.ts` exporting a handler that spins up a new server and transport per request, with optional hooks.  
   - **Reason:** Ensures complete isolation for one-off MCP interactions, suitable for serverless or simple request-response use cases without session management.

5. **Export API**  
   - **Goal:** In `src/index.ts`, re-export `statefulHandler`, `statelessHandler`, and related types from a single entry point.  
   - **Reason:** Simplifies imports for package consumers, ensures type definitions are published, and clarifies public vs. internal modules.

6. **Testing**  
   - **Goal:** Set up a test framework (Jest or Mocha with `ts-jest`) and write unit and integration tests covering request lifecycle, hook invocation, and error cases.  
   - **Reason:** Verifies correct behavior, prevents regressions, and provides confidence in the package's reliability.

7. **Build and Bundle**  
   - **Goal:** Configure `tsconfig.json` to compile TypeScript into `dist/`, add build scripts (`tsc --build`), and optionally configure bundlers (Rollup/esbuild) for ESM/CJS output.  
   - **Reason:** Produces distributable JavaScript files, supports multiple module formats, and readies the package for publication.

8. **Continuous Integration**  
   - **Goal:** Create a CI workflow (e.g., GitHub Actions) that runs linting (`eslint`), type-checking (`tsc --noEmit`), and tests on every push and pull request.  
   - **Reason:** Automates quality checks, catches errors early, and enforces coding standards across contributions.

9. **Package and Publish**  
   - **Goal:** Update `package.json` with `main`, `types`, `repository`, `keywords`, and other metadata, then publish to npm and tag a release in Git.  
   - **Reason:** Makes the library publicly available, ensures correct entry points and type resolution for consumers, and tracks version history.

10. **Documentation & Examples**  
   - **Goal:** Keep the README in sync, add detailed usage examples in `examples/`, and document advanced scenarios or custom hooks.  
   - **Reason:** Helps adopters understand how to integrate and extend the handlers, reducing onboarding friction and support requests.

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
