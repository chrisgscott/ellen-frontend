import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

// Define specific types for this tool
interface MarketDataArgs {
  materials: string[];
  include_trends?: boolean;
}

const marketDataTool: EllenTool = {
  name: 'get_material_market_data',
  description: 'Retrieves current market data and pricing for specific materials',
  schema: {
    type: 'function' as const,
    function: {
      name: 'get_material_market_data',
      description: 'Get current market prices, trends, and trading data for specified materials',
      parameters: {
        type: 'object',
        properties: {
          materials: {
            type: 'array',
            description: 'Array of material names to get market data for',
            items: {
              type: 'string',
            },
          },
          include_trends: {
            type: 'boolean',
            description: 'Whether to include price trend analysis',
            default: true,
          },
        },
        required: ['materials'],
      },
    },
  },
  handler: async (args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      const typedArgs = args as unknown as MarketDataArgs;
      const { materials, include_trends = true } = typedArgs;
      console.log('🔧 MARKET DATA: Fetching data for materials:', materials, 'in session:', context.session_id);
      
      // Example implementation - in reality, this would query your market data API/database
      const marketData = materials.map((material: string) => ({
        material,
        current_price: Math.random() * 1000 + 100, // Mock price
        currency: 'USD',
        unit: 'per ton',
        last_updated: new Date().toISOString(),
        trend: include_trends ? (Math.random() > 0.5 ? 'up' : 'down') : null,
      }));
      
      return {
        success: true,
        data: marketData,
        streamToClient: true,
        clientPayload: {
          type: 'market_data',
          content: marketData,
        },
      };
    } catch (error) {
      console.error('🔧 MARKET DATA: Error fetching market data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch market data',
      };
    }
  },
};

export default marketDataTool;

// To activate this tool, simply add it to the registry in registry.ts:
// import marketDataTool from './example-new-tool';
// 
// export const toolRegistry: ToolRegistry = {
//   [materialExtractorTool.name]: materialExtractorTool,
//   [opportunitiesTool.name]: opportunitiesTool,
//   [marketDataTool.name]: marketDataTool, // <- Add this line
// };
