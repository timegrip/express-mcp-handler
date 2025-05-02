/**
 * Express MCP Handler
 * 
 * A utility for integrating Model Context Protocol (MCP) into Express applications
 * with both stateful and stateless modes.
 */

// Export the stateful handler
export { statefulHandlers } from './stateful';

// Export the stateless handler
export { statelessHandler } from './stateless';

// Export the SSE handler
export { sseHandlers } from './sse';

// Export types
export {
  StatefulHandlerOptions,
  StatelessHandlerOptions,
  SSEHandlerOptions,
  ServerFactory
} from './types'; 