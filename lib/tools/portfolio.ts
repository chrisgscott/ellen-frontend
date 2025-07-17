import { EllenTool, ToolContext, ToolResult, ToolArgs } from './types';

const portfolioSummaryTool: EllenTool = {
  name: 'get_portfolio_summary',
  description: 'Get comprehensive portfolio summary including total value, top positions, risk analysis, and geographic distribution',
  schema: {
    type: 'function' as const,
    function: {
      name: 'get_portfolio_summary',
      description: 'Retrieves comprehensive portfolio summary including total value, top positions, risk analysis, and geographic distribution of holdings.',
      parameters: {
        type: 'object',
        properties: {
          include_details: {
            type: 'boolean',
            description: 'Include detailed breakdown of individual positions',
          },
          min_value_threshold: {
            type: 'number',
            description: 'Minimum position value in USD to include in detailed view',
          }
        },
        required: [],
      },
    },
  },
  handler: async (args: ToolArgs, context: ToolContext): Promise<ToolResult> => {
    try {
      console.log('🏦 PORTFOLIO: Fetching portfolio summary for session:', context.session_id);
      
      const includeDetails = args.include_details !== false;
      const minValueThreshold = (args.min_value_threshold as number) || 1000000;

      // Get portfolio holdings with material details using context.supabase
      const { data: holdings, error: holdingsError } = await context.supabase
        .from('litore_holdings')
        .select(`
          id,
          quantity_kg,
          quality_grade,
          acquisition_cost_per_kg,
          current_valuation_per_kg,
          acquisition_date,
          storage_location,
          warehouse_facility,
          is_available_for_sale,
          notes,
          materials!material_id (
            material,
            supply_score,
            ownership_score
          )
        `)
        .order('current_valuation_per_kg', { ascending: false });

      if (holdingsError) {
        console.error('🏦 PORTFOLIO: Holdings query error:', holdingsError);
        throw new Error('Failed to fetch portfolio holdings');
      }

      console.log('🏦 PORTFOLIO: Found holdings:', holdings?.length || 0);

      // Calculate portfolio metrics
      let totalValue = 0;
      let totalCost = 0;
      let totalQuantity = 0;
      const locationDistribution: Record<string, number> = {};
      const materialDistribution: Record<string, { value: number, quantity: number }> = {};
      const topPositions: any[] = [];

      holdings?.forEach(holding => {
        const quantity = parseFloat(holding.quantity_kg || '0');
        const currentPrice = parseFloat(holding.current_valuation_per_kg || '0');
        const costPrice = parseFloat(holding.acquisition_cost_per_kg || '0');
        const positionValue = quantity * currentPrice;
        const positionCost = quantity * costPrice;

        totalValue += positionValue;
        totalCost += positionCost;
        totalQuantity += quantity;

        // Location distribution
        const location = holding.storage_location || 'Unknown';
        locationDistribution[location] = (locationDistribution[location] || 0) + positionValue;

        // Material distribution
        const material = (holding.materials as any)?.material || 'Unknown';
        if (!materialDistribution[material]) {
          materialDistribution[material] = { value: 0, quantity: 0 };
        }
        materialDistribution[material].value += positionValue;
        materialDistribution[material].quantity += quantity;

        // Add to top positions if above threshold
        if (positionValue >= minValueThreshold) {
          topPositions.push({
            id: holding.id,
            material: material,
            quantity_kg: quantity,
            quality_grade: holding.quality_grade,
            position_value: positionValue,
            cost_basis: positionCost,
            unrealized_pnl: positionValue - positionCost,
            unrealized_pnl_percent: positionCost > 0 ? ((positionValue - positionCost) / positionCost) * 100 : 0,
            current_price_per_kg: currentPrice,
            acquisition_price_per_kg: costPrice,
            acquisition_date: holding.acquisition_date,
            storage_location: holding.storage_location,
            warehouse_facility: holding.warehouse_facility,
            is_available_for_sale: holding.is_available_for_sale,
            supply_score: (holding.materials as any)?.supply_score,
            ownership_score: (holding.materials as any)?.ownership_score,
            notes: holding.notes
          });
        }
      });

      // Sort top positions by value
      topPositions.sort((a, b) => b.position_value - a.position_value);

      // Calculate risk metrics
      const totalUnrealizedPnL = totalValue - totalCost;
      const totalReturnPercent = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;

      // Geographic concentration risk (Herfindahl index)
      const totalLocationValues = Object.values(locationDistribution);
      const locationHHI = totalLocationValues.reduce((sum, value) => {
        const share = value / totalValue;
        return sum + (share * share);
      }, 0);

      // Material concentration risk
      const materialValues = Object.values(materialDistribution).map(m => m.value);
      const materialHHI = materialValues.reduce((sum, value) => {
        const share = value / totalValue;
        return sum + (share * share);
      }, 0);

      const portfolioSummary = {
        summary: {
          total_value: totalValue,
          total_cost: totalCost,
          total_quantity_kg: totalQuantity,
          unrealized_pnl: totalUnrealizedPnL,
          unrealized_pnl_percent: totalReturnPercent,
          positions_count: holdings?.length || 0,
          high_value_positions_count: topPositions.length,
          last_updated: new Date().toISOString()
        },
        risk_metrics: {
          geographic_concentration_hhi: locationHHI,
          material_concentration_hhi: materialHHI,
          geographic_risk_level: locationHHI > 0.25 ? 'High' : locationHHI > 0.15 ? 'Medium' : 'Low',
          material_risk_level: materialHHI > 0.25 ? 'High' : materialHHI > 0.15 ? 'Medium' : 'Low'
        },
        geographic_distribution: Object.entries(locationDistribution)
          .map(([location, value]) => ({
            location,
            value,
            percentage: (value / totalValue) * 100
          }))
          .sort((a, b) => b.value - a.value),
        material_distribution: Object.entries(materialDistribution)
          .map(([material, data]) => ({
            material,
            value: data.value,
            quantity_kg: data.quantity,
            percentage: (data.value / totalValue) * 100
          }))
          .sort((a, b) => b.value - a.value),
        positions: includeDetails ? topPositions : topPositions.slice(0, 10)
      };

      console.log('🏦 PORTFOLIO: Portfolio summary calculated:', {
        totalValue: portfolioSummary.summary.total_value,
        positionsCount: portfolioSummary.positions.length,
        locationsCount: portfolioSummary.geographic_distribution.length
      });
      
      return {
        success: true,
        data: portfolioSummary,
        streamToClient: true,
        clientPayload: {
          type: 'portfolio_summary',
          content: portfolioSummary
        }
      };
    } catch (error) {
      console.error('❌ PORTFOLIO ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown portfolio error'
      };
    }
  }
};

export default portfolioSummaryTool;
