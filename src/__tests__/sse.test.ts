import { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { sseHandlers } from '../index';
import { SSEHandlerOptions, ServerFactory } from '../types';

// Mock the SSE transport class
jest.mock('@modelcontextprotocol/sdk/server/sse.js');

describe('sseHandlers', () => {
  let mockServer: McpServer;
  let serverFactory: ServerFactory;
  let options: SSEHandlerOptions;
  let mockTransport: {
    sessionId: string;
    handlePostMessage: jest.Mock;
    onerror: null;
    onclose: null;
  };

  beforeEach(() => {
    // Reset the transport mock
    (SSEServerTransport as jest.Mock).mockClear();

    // Create a fake transport instance
    mockTransport = {
      sessionId: 'test-session-id',
      handlePostMessage: jest.fn().mockResolvedValue(undefined),
      onerror: null,
      onclose: null,
    };

    // Stub the SSEServerTransport constructor to return our mockTransport
    (SSEServerTransport as jest.Mock).mockImplementation(
      (_path: string, _res: Response) => mockTransport
    );

    // Mock MCP server and factory
    mockServer = { connect: jest.fn().mockResolvedValue(undefined) } as unknown as McpServer;
    serverFactory = () => mockServer;

    // Default handler options
    options = {
      onError: jest.fn(),
      onClose: jest.fn(),
    };
  });

  it('should create a new SSE transport and call server.connect on getHandler', async () => {
    const { getHandler } = sseHandlers(serverFactory, options);
    const closeCallbacks: Record<string, () => void> = {};
    const req = {} as Request;
    const res = {
      on: (event: string, cb: () => void) => { closeCallbacks[event] = cb; },
      headersSent: false,
    } as unknown as Response;
    const next: NextFunction = jest.fn();

    await getHandler(req, res, next);

    // SSEServerTransport should be instantiated with '/messages'
    expect((SSEServerTransport as jest.Mock).mock.calls[0][0]).toBe('/messages');
    // server.connect should be called with our transport
    expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);

    // Simulate transport close event
    closeCallbacks['close']();
    expect(options.onClose).toHaveBeenCalledWith('test-session-id');
  });

  it('should handle post messages for an existing session', async () => {
    const { getHandler, postHandler } = sseHandlers(serverFactory, options);
    const reqGet = {} as Request;
    const resGet = { on: () => {}, headersSent: false } as unknown as Response;
    const next: NextFunction = jest.fn();

    // Establish session
    await getHandler(reqGet, resGet, next);

    // Send a post message
    const reqPost = { query: { sessionId: 'test-session-id' }, body: { foo: 'bar' } } as unknown as Request;
    const resPost = { headersSent: false, status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
    await postHandler(reqPost, resPost, next);

    expect(mockTransport.handlePostMessage).toHaveBeenCalledWith(reqPost, resPost, reqPost.body);
  });

  it('should return 400 if postHandler is called with unknown sessionId', async () => {
    const { postHandler } = sseHandlers(serverFactory, options);
    const req = { query: { sessionId: 'unknown-session' } } as unknown as Request;
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
    const next: NextFunction = jest.fn();

    await postHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('No transport found for sessionId');
  });

  it('should call onError and return 500 when transport handlePostMessage fails', async () => {
    // Simulate error in handlePostMessage
    mockTransport.handlePostMessage = jest.fn().mockRejectedValue(new Error('fail'));
    const { getHandler, postHandler } = sseHandlers(serverFactory, options);

    const reqGet = {} as Request;
    const resGet = { on: () => {}, headersSent: false } as unknown as Response;
    const next: NextFunction = jest.fn();
    // Establish session
    await getHandler(reqGet, resGet, next);

    const reqPost = { query: { sessionId: 'test-session-id' } } as unknown as Request;
    const resPost = { headersSent: false, status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as Response;
    await postHandler(reqPost, resPost, next);

    expect(options.onError).toHaveBeenCalledWith(expect.any(Error), 'test-session-id');
    expect(resPost.status).toHaveBeenCalledWith(500);
    expect(resPost.send).toHaveBeenCalledWith('Internal server error');
  });
}); 