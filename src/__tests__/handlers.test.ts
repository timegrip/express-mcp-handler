import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { statefulHandler, statelessHandler } from '../index';

// Mock the express and MCP SDK dependencies
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');

describe('MCP Handlers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  let mockServer: McpServer;
  
  beforeEach(() => {
    // Reset mock request and response objects
    mockRequest = {
      method: 'POST',
      headers: {},
      body: { jsonrpc: '2.0', method: 'initialize' }
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
          // Simulate immediate close for testing
          callback();
        }
        return mockResponse;
      })
    };
    
    mockNext = jest.fn();
    
    // Mock McpServer implementation
    mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn()
    } as unknown as McpServer;
    
    // Mock StreamableHTTPServerTransport
    (StreamableHTTPServerTransport as jest.Mock).mockImplementation(({ onsessioninitialized, sessionIdGenerator }) => {
      const transport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
        close: jest.fn(),
        sessionId: sessionIdGenerator ? sessionIdGenerator() : undefined,
      };
      
      if (onsessioninitialized && transport.sessionId) {
        onsessioninitialized(transport.sessionId);
      }
      
      return transport;
    });
  });
  
  describe('statefulHandler', () => {
    it('should create a new session when session ID is not provided', async () => {
      // Setup
      const sessionIdGenerator = jest.fn().mockReturnValue('test-session-id');
      const onSessionInitialized = jest.fn();
      
      const handler = statefulHandler(mockServer, {
        sessionIdGenerator,
        onSessionInitialized
      });
      
      // Execute
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify
      expect(sessionIdGenerator).toHaveBeenCalled();
      expect(onSessionInitialized).toHaveBeenCalledWith('test-session-id');
      expect(mockServer.connect).toHaveBeenCalled();
    });
    
    it('should reuse existing session when valid session ID is provided', async () => {
      // Setup
      const sessionIdGenerator = jest.fn().mockReturnValue('test-session-id');
      const handler = statefulHandler(mockServer, { sessionIdGenerator });
      
      // First request to create session
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Update request to include session ID for second request
      mockRequest.headers = { 'mcp-session-id': 'test-session-id' };
      
      // Reset mocks to check new call counts
      (mockServer.connect as jest.Mock).mockClear();
      
      // Execute second request
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify - connect should not be called again for existing session
      expect(mockServer.connect).not.toHaveBeenCalled();
    });
  });
  
  describe('statelessHandler', () => {
    it('should create a new server and transport for each request', async () => {
      // Setup
      const serverFactory = jest.fn().mockReturnValue(mockServer);
      const onClose = jest.fn();
      
      const handler = statelessHandler(serverFactory, { onClose });
      
      // Execute
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify
      expect(serverFactory).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });
    
    it('should return 405 for non-POST requests', async () => {
      // Setup
      mockRequest.method = 'GET';
      const serverFactory = jest.fn().mockReturnValue(mockServer);
      
      const handler = statelessHandler(serverFactory);
      
      // Execute
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify
      expect(mockResponse.status).toHaveBeenCalledWith(405);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(serverFactory).not.toHaveBeenCalled();
    });
  });
}); 