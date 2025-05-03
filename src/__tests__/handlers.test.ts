import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { statefulHandlers, statelessHandler } from '../index';

// Mock the express and MCP SDK dependencies
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');

// Mock the isInitializeRequest function
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: jest.fn().mockReturnValue(true)
}));

// Import the mocked module
import * as TypesModule from '@modelcontextprotocol/sdk/types.js';

describe('MCP Handlers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  let mockServer: McpServer;
  let mockIsInitializeRequest: jest.Mock;
  
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
    
    // Mock McpServer implementation with a functioning connect method
    mockServer = {
      connect: jest.fn().mockImplementation(() => Promise.resolve()),
      close: jest.fn()
    } as unknown as McpServer;
    
    // Cast the isInitializeRequest function to jest.Mock
    mockIsInitializeRequest = TypesModule.isInitializeRequest as unknown as jest.Mock;
    mockIsInitializeRequest.mockReturnValue(true);
    
    // Mock StreamableHTTPServerTransport
    (StreamableHTTPServerTransport as jest.Mock).mockImplementation(({ onsessioninitialized, sessionIdGenerator }) => {
      // Explicitly call sessionIdGenerator to generate a session ID
      const sessionId = sessionIdGenerator ? sessionIdGenerator() : undefined;
      
      const transport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
        close: jest.fn(),
        sessionId: sessionId,
      };
      
      if (onsessioninitialized && transport.sessionId) {
        onsessioninitialized(transport.sessionId);
      }
      
      return transport;
    });
  });
  
  describe('statefulHandlers', () => {
    it('should handle initialization requests', async () => {
      // Setup
      const sessionIdGenerator = jest.fn().mockReturnValue('test-session-id');
      const onSessionInitialized = jest.fn();
      
      // Create a test-specific server factory
      const serverFactory = jest.fn().mockReturnValue(mockServer);
      
      const { postHandler } = statefulHandlers(
        serverFactory,
        { sessionIdGenerator, onSessionInitialized }
      );
      
      // Make sure isInitializeRequest returns true
      mockIsInitializeRequest.mockReturnValue(true);
      
      // Execute
      await postHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify the serverFactory was called
      expect(serverFactory).toHaveBeenCalled();
    });
    
    it('should reuse existing session when valid session ID is provided', async () => {
      // Setup
      const sessionIdGenerator = jest.fn().mockReturnValue('test-session-id');
      const serverFactory = jest.fn().mockReturnValue(mockServer);
      
      const { postHandler } = statefulHandlers(
        serverFactory,
        { sessionIdGenerator }
      );
      
      // First request to create session (we don't need to verify)
      await postHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Update request to include session ID for second request
      mockRequest.headers = { 'mcp-session-id': 'test-session-id' };
      
      // Reset mocks to check new call counts
      serverFactory.mockClear();
      
      // Execute second request
      await postHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Verify serverFactory shouldn't be called again for existing session
      expect(serverFactory).not.toHaveBeenCalled();
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