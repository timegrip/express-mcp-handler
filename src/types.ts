import { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Options for configuring the stateful MCP handler
 */
export interface StatefulHandlerOptions {
  /**
   * Function to generate unique session IDs
   */
  sessionIdGenerator: () => string;
  
  /**
   * Optional callback triggered when a new session is initialized
   */
  onSessionInitialized?: (sessionId: string) => void;
  
  /**
   * Optional callback triggered when a session is closed
   */
  onSessionClosed?: (sessionId: string) => void;
  
  /**
   * Optional callback triggered when an error occurs during handling
   */
  onError?: (error: Error, sessionId?: string) => void;
}

/**
 * Options for configuring the stateless MCP handler
 */
export interface StatelessHandlerOptions {
  /**
   * Optional function to generate session IDs
   * Not typically needed for stateless operation
   */
  sessionIdGenerator?: () => string;
  
  /**
   * Optional callback triggered when the request/response cycle ends
   */
  onClose?: (req: Request, res: Response) => void;
  
  /**
   * Optional callback triggered when an error occurs during handling
   */
  onError?: (error: Error) => void;
}

/**
 * Factory type for creating McpServer instances
 */
export type ServerFactory = () => McpServer; 