import { Request, Response, NextFunction, RequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StatefulHandlerOptions } from './types';

/**
 * Map to store active transports by session ID
 */
interface TransportMap {
  [sessionId: string]: {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
  };
}

/**
 * Creates an Express middleware handler for stateful MCP sessions
 * 
 * @param server - The MCP server instance to handle protocol logic
 * @param options - Configuration options for the handler
 * @returns An Express request handler function
 */
export function statefulHandler(
  server: McpServer,
  options: StatefulHandlerOptions
): RequestHandler {
  // Store active transports by session ID
  const transports: TransportMap = {};

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;
      let transportServer = server;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId].transport;
        transportServer = transports[sessionId].server;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: options.sessionIdGenerator,
          onsessioninitialized: (newSessionId: string) => {
            // Store the transport by session ID
            transports[newSessionId] = { transport, server: transportServer };
            
            // Call user-provided initialization callback if defined
            if (options.onSessionInitialized) {
              options.onSessionInitialized(newSessionId);
            }
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            // Call user-provided close callback if defined
            if (options.onSessionClosed) {
              options.onSessionClosed(transport.sessionId);
            }
            
            // Remove from transport map
            delete transports[transport.sessionId];
          }
        };

        // Connect transport to the MCP server
        await transportServer.connect(transport);
      } else {
        // Invalid request - missing or invalid session
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid request: session ID required or initialization expected',
          },
          id: null,
        });
      }

      // Handle the request based on method
      if (req.method === 'POST') {
        await transport.handleRequest(req, res, req.body);
      } else {
        await transport.handleRequest(req, res);
      }
    } catch (error) {
      // Handle errors
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      
      if (options.onError) {
        options.onError(error as Error, sessionId);
      }
      
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
      
      // Pass to next error handler if available
      if (next) {
        next(error);
      }
    }
  };
} 