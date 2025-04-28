import { Request, Response, NextFunction, RequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ServerFactory, StatelessHandlerOptions } from './types';

/**
 * Creates an Express middleware handler for stateless MCP interactions
 * 
 * @param serverFactory - Function to create a new McpServer instance for each request
 * @param options - Optional configuration options for the handler
 * @returns An Express request handler function
 */
export function statelessHandler(
  serverFactory: ServerFactory = () => new McpServer({ name: 'stateless-mcp-server', version: '1.0.0' }),
  options: StatelessHandlerOptions = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only accept POST requests for stateless mode
    if (req.method !== 'POST') {
      return res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed',
        },
        id: null,
      });
    }

    let transport: StreamableHTTPServerTransport | undefined;
    let server: McpServer | undefined;
    
    try {
      // Create new server and transport instances for this request
      server = serverFactory();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: options.sessionIdGenerator,
      });
      
      // Connect to the MCP server
      await server.connect(transport);
      
      // Handle the request
      await transport.handleRequest(req, res, req.body);
      
      // Set up clean-up on connection close
      res.on('close', () => {
        if (transport && server) {
          // Call user-provided close handler if defined
          if (options.onClose) {
            options.onClose(req, res);
          }
          
          // Clean up resources
          transport.close();
          server.close();
          transport = undefined;
          server = undefined;
        }
      });
    } catch (error) {
      // Clean up resources on error
      if (transport) {
        transport.close();
      }
      if (server) {
        server.close();
      }
      
      // Call user-provided error handler if defined
      if (options.onError) {
        options.onError(error as Error);
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