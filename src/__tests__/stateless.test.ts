import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { statelessHandler } from '../index';

// Mock the express and MCP SDK dependencies
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');

describe('Stateless Handler Coverage', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  let mockServer: McpServer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTransport: any;
  
  beforeEach(() => {
    // Reset mock request and response objects
    mockRequest = {
      method: 'POST',
      headers: {},
      body: { jsonrpc: '2.0', method: 'call' }
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      headersSent: false,
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
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
    
    // Create a mock transport with callbacks
    mockTransport = {
      handleRequest: jest.fn(),
      close: jest.fn(),
      sessionId: 'test-session-id'
    };
    
    // Default successful behavior
    mockTransport.handleRequest.mockResolvedValue(undefined);
    
    // Mock StreamableHTTPServerTransport
    (StreamableHTTPServerTransport as jest.Mock).mockImplementation(({ sessionIdGenerator }) => {
      const sessionId = sessionIdGenerator ? sessionIdGenerator() : 'default-session-id';
      mockTransport.sessionId = sessionId;
      return mockTransport;
    });
    
    // Mock McpServer constructor
    (McpServer as jest.Mock).mockImplementation(() => mockServer);
  });
  
  it('should use default server factory when none is provided', async () => {
    // Setup - use statelessHandler without providing a serverFactory
    const handler = statelessHandler();
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify server was created and connected
    expect(McpServer).toHaveBeenCalledWith({ name: 'stateless-mcp-server', version: '1.0.0' });
    expect(mockServer.connect).toHaveBeenCalled();
  });
  
  it('should use custom sessionIdGenerator when provided', async () => {
    // Setup custom sessionIdGenerator
    const sessionIdGenerator = jest.fn().mockReturnValue('custom-session-id');
    const handler = statelessHandler(() => mockServer, { sessionIdGenerator });
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify sessionIdGenerator was passed to transport
    expect(StreamableHTTPServerTransport).toHaveBeenCalledWith(
      expect.objectContaining({ sessionIdGenerator })
    );
  });
  
  it('should call onClose callback when response is closed', async () => {
    // Setup
    const onClose = jest.fn();
    const handler = statelessHandler(() => mockServer, { onClose });
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify onClose is called when response is closed
    expect(mockResponse.on).toHaveBeenCalledWith('close', expect.any(Function));
    
    // Find the close callback and call it directly
    const closeCallback = (mockResponse.on as jest.Mock).mock.calls[0][1];
    closeCallback();
    
    // Verify onClose, transport.close and server.close were called
    expect(onClose).toHaveBeenCalledWith(mockRequest, mockResponse);
    expect(mockTransport.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });
  
  it('should handle transport.handleRequest errors', async () => {
    // Setup error scenario
    const onError = jest.fn();
    const testError = new Error('Test error');
    
    // Reset the mock and set it to reject with our test error
    mockTransport.handleRequest = jest.fn().mockRejectedValue(testError);
    
    const handler = statelessHandler(() => mockServer, { onError });
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify cleanup and error handling
    expect(mockTransport.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(testError);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      jsonrpc: '2.0',
      error: expect.objectContaining({
        code: -32603
      })
    }));
    expect(mockNext).toHaveBeenCalledWith(testError);
  });
  
  it('should not send error response if headers are already sent', async () => {
    // Setup - headers already sent
    mockResponse.headersSent = true;
    const testError = new Error('Test error');
    
    // Reset the mock and set it to reject
    mockTransport.handleRequest = jest.fn().mockRejectedValue(testError);
    
    const handler = statelessHandler(() => mockServer);
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify status and json were not called
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled(); // Next should still be called
  });
  
  it('should handle server.connect errors', async () => {
    // Setup - server.connect throws error
    const connectError = new Error('Connection error');
    mockServer.connect = jest.fn().mockRejectedValue(connectError);
    
    const onError = jest.fn();
    const handler = statelessHandler(() => mockServer, { onError });
    
    // Execute
    await handler(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify cleanup and error handling
    expect(onError).toHaveBeenCalledWith(connectError);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockNext).toHaveBeenCalledWith(connectError);
  });
}); 