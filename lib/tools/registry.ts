import { ToolRegistry } from './types';
import materialExtractorTool from './materialExtractor';
import opportunitiesTool from './opportunities';
import monitorGeopoliticalRisksTool from './monitor-geopolitical-risks';
import portfolioSummaryTool from './portfolio';

// Tool registry - add new tools here
export const toolRegistry: ToolRegistry = {
  [materialExtractorTool.name]: materialExtractorTool,
  [opportunitiesTool.name]: opportunitiesTool,
  [monitorGeopoliticalRisksTool.name]: monitorGeopoliticalRisksTool,
  [portfolioSummaryTool.name]: portfolioSummaryTool,
};

// Helper functions for the chat API
export const getAllTools = () => Object.values(toolRegistry);
export const getAllToolSchemas = () => getAllTools().map(tool => tool.schema);
export const getToolByName = (name: string) => toolRegistry[name];

// Get all tool names for debugging
export const getToolNames = () => Object.keys(toolRegistry);

console.log('🔧 TOOL REGISTRY: Loaded tools:', getToolNames());
