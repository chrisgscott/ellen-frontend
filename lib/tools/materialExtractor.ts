import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

// Define specific types for this tool
interface MaterialExtractorArgs {
  materials: string[];
  sources: Array<{ title: string; url?: string }>;
  suggested_questions: string[];
}

const materialExtractorTool: EllenTool = {
  name: 'extract_materials_and_suggestions',
  description: 'Extract materials mentioned in the response and suggest follow-up questions',
  schema: {
    type: 'function' as const,
    function: {
      name: 'extract_materials_and_suggestions',
      description: 'Extract materials mentioned in the response and suggest follow-up questions',
      parameters: {
        type: 'object',
        properties: {
          materials: {
            type: 'array',
            description: 'Array of material names mentioned in the response',
            items: {
              type: 'string',
            },
          },
          sources: {
            type: 'array',
            description: 'Array of sources referenced in the response',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['title'],
            },
          },
          suggested_questions: {
            type: 'array',
            description: 'Array of suggested follow-up questions',
            items: {
              type: 'string',
            },
          },
        },
        required: ['materials', 'sources', 'suggested_questions'],
      },
    },
  },
  handler: async (args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      console.log('🔧 MATERIAL EXTRACTOR: Processing extracted data:', args);
      
      // Type-cast args to our specific interface
      const typedArgs = args as unknown as MaterialExtractorArgs;
      const { materials, sources, suggested_questions } = typedArgs;
      
      // Use context for logging the session
      console.log('🔧 MATERIAL EXTRACTOR: Session ID:', context.session_id);
      
      // Process materials if any were found
      if (materials && materials.length > 0) {
        console.log('🔧 MATERIAL EXTRACTOR: Found materials:', materials);
        
        // Here you could add logic to fetch additional material data from the database
        // For now, we'll just return the extracted materials
        
        return {
          success: true,
          data: { materials, sources, suggested_questions },
          streamToClient: true,
          clientPayload: {
            type: 'materials',
            content: materials,
          },
        };
      }
      
      return {
        success: true,
        data: { materials: [], sources, suggested_questions },
      };
    } catch (error) {
      console.error('🔧 MATERIAL EXTRACTOR: Error processing materials:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

export default materialExtractorTool;
