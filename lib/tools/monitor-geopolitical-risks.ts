import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

// Define specific types for this tool
interface GeopoliticalRisksArgs {
  material?: string;
  country?: string;
  timeframe?: '24h' | '7d' | '30d' | '90d';
  risk_threshold?: 'low' | 'medium' | 'high' | 'critical';
}

interface RiskAlert {
  material: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  country_exposure: string;
  supply_disruption_probability: number;
  impact_assessment: string;
  recommended_actions: string[];
  related_materials: string[];
}

interface GeopoliticalRiskData {
  alerts: RiskAlert[];
  portfolio_exposure: {
    chinese_exposure_percentage: number;
    high_risk_materials: string[];
    total_value_at_risk: string;
  };
  monitoring_summary: {
    data_sources: number;
    risk_factors_tracked: number;
    last_updated: string;
  };
}

const monitorGeopoliticalRisksTool: EllenTool = {
  name: 'monitor_geopolitical_risks',
  description: 'Monitor real-time geopolitical risks affecting strategic materials supply chains',
  schema: {
    type: 'function' as const,
    function: {
      name: 'monitor_geopolitical_risks',
      description: 'Analyzes real-time geopolitical risks affecting strategic materials, including export controls, sanctions, and supply chain disruptions. Provides risk scores, probability assessments, and recommended actions.',
      parameters: {
        type: 'object',
        properties: {
          material: {
            type: 'string',
            description: 'Specific material to analyze (e.g., "gallium", "rare_earths", "lithium")',
          },
          country: {
            type: 'string',
            description: 'Specific country to analyze (e.g., "China", "Russia", "EU")',
          },
          timeframe: {
            type: 'string',
            description: 'Analysis timeframe for risk assessment',
            enum: ['24h', '7d', '30d', '90d'],
          },
          risk_threshold: {
            type: 'string',
            description: 'Minimum risk level to include in results',
            enum: ['low', 'medium', 'high', 'critical'],
          },
        },
        required: [],
      },
    },
  },
  handler: async (args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      const typedArgs = args as unknown as GeopoliticalRisksArgs;
      const { material, country, timeframe = '7d', risk_threshold = 'medium' } = typedArgs;
      
      console.log('🚨 GEOPOLITICAL RISKS: Analyzing risks for session:', context.session_id);
      console.log('🚨 Parameters:', { material, country, timeframe, risk_threshold });
      
      // Mock data that matches the demo storyline exactly
      const riskData: GeopoliticalRiskData = {
        alerts: [
          {
            material: 'gallium',
            risk_score: 5,
            risk_level: 'critical',
            country_exposure: 'China',
            supply_disruption_probability: 73,
            impact_assessment: 'China has implemented stricter export licensing for gallium effective this week, creating supply disruption concerns.',
            recommended_actions: [
              'Contact German supplier for additional 20,000kg capacity',
              'Consider 15-20% price increase to government customers',
              'Expedite negotiations with DoD procurement division'
            ],
            related_materials: ['germanium', 'rare_earth_elements', 'silicon']
          },
          {
            material: 'rare_earth_elements',
            risk_score: 4,
            risk_level: 'high',
            country_exposure: 'China',
            supply_disruption_probability: 65,
            impact_assessment: 'China controls 85% of rare earth processing capacity. Export restrictions likely to expand.',
            recommended_actions: [
              'Diversify to Australian Mountain Pass facility',
              'Increase strategic stockpiling by 40%',
              'Negotiate long-term contracts with EU processors'
            ],
            related_materials: ['gallium', 'germanium', 'lithium']
          },
          {
            material: 'germanium',
            risk_score: 4,
            risk_level: 'high',
            country_exposure: 'China',
            supply_disruption_probability: 58,
            impact_assessment: 'Germanium export controls expected to follow gallium restrictions pattern.',
            recommended_actions: [
              'Secure alternative sourcing from Belgium',
              'Increase inventory buffer to 8-month supply',
              'Review customer contract force majeure clauses'
            ],
            related_materials: ['gallium', 'silicon', 'indium']
          }
        ],
        portfolio_exposure: {
          chinese_exposure_percentage: 67,
          high_risk_materials: ['gallium', 'rare_earth_elements', 'germanium', 'tungsten', 'antimony'],
          total_value_at_risk: '$4.2B'
        },
        monitoring_summary: {
          data_sources: 847,
          risk_factors_tracked: 47,
          last_updated: new Date().toISOString()
        }
      };

      // Filter based on parameters if provided
      let filteredAlerts = riskData.alerts;
      
      if (material) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.material.toLowerCase().includes(material.toLowerCase())
        );
      }
      
      if (country) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.country_exposure.toLowerCase().includes(country.toLowerCase())
        );
      }
      
      if (risk_threshold) {
        const thresholdMap = { low: 1, medium: 2, high: 3, critical: 4 };
        const minScore = thresholdMap[risk_threshold] || 2;
        filteredAlerts = filteredAlerts.filter(alert => alert.risk_score >= minScore);
      }

      const responseData = {
        ...riskData,
        alerts: filteredAlerts
      };

      return {
        success: true,
        data: responseData,
        streamToClient: true,
        clientPayload: {
          type: 'geopolitical_risks',
          content: responseData,
        },
      };
    } catch (error) {
      console.error('🚨 GEOPOLITICAL RISKS: Error analyzing risks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze geopolitical risks',
      };
    }
  },
};

export default monitorGeopoliticalRisksTool;
