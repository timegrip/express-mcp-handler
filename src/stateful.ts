import { Request, Response, NextFunction, RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { ServerFactory, StatefulHandlerOptions } from './types.js';

interface SessionTransportMap {
  [sessionId: string]: StreamableHTTPServerTransport;
}

interface StatefulHandlers {
  postHandler: RequestHandler;
  getHandler: RequestHandler;
  deleteHandler: RequestHandler;
}

/**
 * Creates an Express middleware handler for stateful MCP sessions
 * 
 * @param server - The MCP server instance to handle protocol logic
 * @param options - Configuration options for the handler
 * @returns An Express request handler function
 */
export function statefulHandlers(
  serverFactory: ServerFactory,
  options: StatefulHandlerOptions
): StatefulHandlers {
  // Store active transports by session ID
  const transports: SessionTransportMap = {};

  const postHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: options.sessionIdGenerator,
          onsessioninitialized: (newSessionId: string) => {
            // Store the transport by session ID
            transports[newSessionId] = transport;

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

        // Connect transport to a new MCP server instance
        await serverFactory().connect(transport);
      } else {
        // Invalid request - missing or invalid session
        if (options.onInvalidSession) {
          options.onInvalidSession(req);
        }
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid request: session ID required or initialization expected',
          },
          id: null,
        });
      }

      await transport.handleRequest(req, res, req.body);
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

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest: RequestHandler = async (req, res, next) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        if (options.onInvalidSession) {
          options.onInvalidSession(req);
        }
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (options.onError) {
        options.onError(error as Error, sessionId);
      }
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
      if (next) {
        next(error);
      }
    }
  };

  return {
    postHandler: postHandler,
    getHandler: handleSessionRequest,
    deleteHandler: handleSessionRequest,
  };
}
