import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ServerFactory, SSEHandlerOptions } from './types.js';

interface SSESessionTransportMap {
  [sessionId: string]: SSEServerTransport;
}

interface SSEHandlers {
  postHandler: RequestHandler;
  getHandler: RequestHandler;
}

/**
 * Creates an Express middleware handler for stateful MCP sessions
 * 
 * @param server - The MCP server instance to handle protocol logic
 * @param options - Configuration options for the handler
 * @returns An Express request handler function
 */
export function sseHandlers(
  serverFactory: ServerFactory,
  options: SSEHandlerOptions
): SSEHandlers {
  // Store active transports by session ID
  const transports: SSESessionTransportMap = {};

  const postHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      // Handle errors
      const sessionId = req.query.sessionId as string;
      
      if (options.onError) {
        options.onError(error as Error, sessionId);
      }
      
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
      
      // Pass to next error handler if available
      if (next) {
        next(error);
      }
    }
  };

  const getHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create SSE transport for legacy clients
      const transport = new SSEServerTransport('/messages', res);
      
      transport.onerror = (error) => {
        options.onError?.(error as Error, transport.sessionId);
      }
      
      // Store the session ID for use in the close handler
      const sessionId = transport.sessionId;
      
      transport.onclose = () => {
        options.onClose?.(sessionId);
      }
      
      transports[transport.sessionId] = transport;
        
      res.on("close", () => {
        options.onClose?.(sessionId);
        delete transports[transport.sessionId];
      });

      await serverFactory().connect(transport);
    } catch (error) {
      // Handle errors
      if (options.onError) {
        options.onError(error as Error, undefined);
      }

      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }

      // Pass to next error handler if available
      if (next) {
        next(error);
      }
    }
  };

  return {
    postHandler: postHandler,
    getHandler: getHandler,
  };
}





