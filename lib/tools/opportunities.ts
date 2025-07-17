import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

const opportunitiesTool: EllenTool = {
  name: 'get_high_impact_opportunities',
  description: 'Retrieves high-impact business opportunities from the supply chain database',
  schema: {
    type: 'function' as const,
    function: {
      name: 'get_high_impact_opportunities',
      description: 'Retrieves a list of new business opportunities with a potential financial impact greater than $500 million from the supply chain database.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  handler: async (_args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      console.log('🔧 OPPORTUNITIES: Fetching high-impact opportunities for session:', context.session_id);
      
      // Fetch opportunities from the API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/opportunities`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.status}`);
      }
      
      const opportunities = await response.json();
      console.log('🔧 OPPORTUNITIES: Fetched opportunities:', opportunities.length);
      
      return {
        success: true,
        data: opportunities,
        streamToClient: true,
        clientPayload: {
          type: 'opportunities',
          content: opportunities,
        },
      };
    } catch (error) {
      console.error('🔧 OPPORTUNITIES: Error fetching opportunities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch opportunities',
      };
    }
  },
};

export default opportunitiesTool;
