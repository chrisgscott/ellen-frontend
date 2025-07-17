# Ellen's Tool System

This directory contains Ellen's modular tool system, which allows you to easily add new capabilities to the AI assistant.

## Architecture

The tool system consists of:

- **`types.ts`** - TypeScript interfaces and types for the tool system
- **`registry.ts`** - Central registry that manages all available tools
- **Individual tool files** - Each tool is implemented in its own file

## Adding a New Tool

To add a new tool to Ellen, follow these simple steps:

### 1. Create a New Tool File

Create a new file in this directory (e.g., `myNewTool.ts`):

```typescript
import { EllenTool, ToolContext, ToolResult } from './types';

const myNewTool: EllenTool = {
  name: 'my_new_tool',
  description: 'Brief description of what this tool does',
  schema: {
    type: 'function' as const,
    function: {
      name: 'my_new_tool',
      description: 'Detailed description for the AI about when to use this tool',
      parameters: {
        type: 'object',
        properties: {
          // Define your tool's parameters here
          query: {
            type: 'string',
            description: 'Example parameter',
          },
        },
        required: ['query'],
      },
    },
  },
  handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
    try {
      // Your tool's logic goes here
      const { query } = args;
      
      // Example: Query a database
      const { data, error } = await context.supabase
        .from('your_table')
        .select('*')
        .ilike('name', `%${query}%`);
      
      if (error) throw error;
      
      return {
        success: true,
        data,
        streamToClient: true,
        clientPayload: {
          type: 'my_tool_results',
          content: data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

export default myNewTool;
```

### 2. Register the Tool

Add your tool to the registry in `registry.ts`:

```typescript
import myNewTool from './myNewTool';

export const toolRegistry: ToolRegistry = {
  [materialExtractorTool.name]: materialExtractorTool,
  [opportunitiesTool.name]: opportunitiesTool,
  [myNewTool.name]: myNewTool, // <- Add this line
};
```

### 3. That's It!

Your tool is now available to Ellen. The AI will automatically:
- See your tool in the available tools list
- Call it when appropriate based on user queries
- Handle the results and stream data to the frontend

## Tool Interface Reference

### EllenTool

```typescript
interface EllenTool {
  name: string;                    // Unique tool identifier
  description: string;             // Brief description for developers
  schema: OpenAI.Chat.Completions.ChatCompletionTool; // OpenAI function schema
  handler: (args: any, context: ToolContext) => Promise<ToolResult>; // Implementation
}
```

### ToolContext

The context object provides access to:

```typescript
interface ToolContext {
  supabase: SupabaseClient;        // Database client
  controller: ReadableStreamDefaultController; // For streaming responses
  encoder: TextEncoder;            // Text encoder for streaming
  session_id: string;              // Current chat session ID
  thread_id: string;               // Current thread ID
  message: string;                 // User's original message
}
```

### ToolResult

Your handler should return:

```typescript
interface ToolResult {
  success: boolean;                // Whether the tool executed successfully
  data?: any;                      // Any data to return
  streamToClient?: boolean;        // Whether to stream data to frontend
  clientPayload?: {                // Data to send to frontend
    type: string;                  // Event type for frontend handling
    content: any;                  // The actual data
  };
  error?: string;                  // Error message if success is false
}
```

## Best Practices

1. **Descriptive Names**: Use clear, descriptive names for your tools
2. **Good Schemas**: Write detailed parameter descriptions to help the AI understand when to use your tool
3. **Error Handling**: Always wrap your logic in try-catch blocks
4. **Logging**: Use console.log with a consistent prefix (e.g., `🔧 TOOL_NAME:`)
5. **Type Safety**: Consider creating specific types for your tool's arguments and return data
6. **Documentation**: Add comments explaining complex logic

## Examples

See the existing tools for examples:
- **`materialExtractor.ts`** - Extracts structured data from AI responses
- **`opportunities.ts`** - Fetches data from an API endpoint
- **`example-new-tool.ts`** - Template showing market data retrieval

## Frontend Integration

When your tool streams data with `streamToClient: true`, the frontend will receive events like:

```javascript
{
  type: 'your_event_type',
  content: { /* your data */ }
}
```

Make sure to handle these events in your frontend chat component.
