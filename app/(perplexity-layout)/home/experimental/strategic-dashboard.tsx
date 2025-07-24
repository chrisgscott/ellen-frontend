'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Newspaper, 
  FlaskConical, 
  Folders, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Shield,
  Zap,
  FileText,
  MessageSquare,
  Upload,
  Plus,
  Activity,
  BarChart3,
  PieChart,
  Target,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { createNewSession } from '../chat/hooks/useSessionManagement';
import { createClient } from '@/lib/supabase/client';
import { getTimeBasedGreeting } from '@/lib/utils/greetings';

// Mock data for market prices
const mockPricingData = [
  { name: 'Lithium Carbonate', price: '13,450.50', change: '+25.50', trend: 'up', unit: 'USD/tonne' },
  { name: 'Cobalt Metal', price: '28,750.00', change: '-150.00', trend: 'down', unit: 'USD/tonne' },
  { name: 'Neodymium', price: '65.20', change: '+0.85', trend: 'up', unit: 'USD/kg' },
  { name: 'Gallium', price: '350.75', change: '+5.25', trend: 'up', unit: 'USD/kg' },
  { name: 'Graphite', price: '850.00', change: '-12.50', trend: 'down', unit: 'USD/tonne' },
];

// Mock data for strategic dashboard
const mockPortfolioSummary = {
  totalValue: '$6.2B',
  dailyChange: '+$45.2M',
  dailyChangePercent: '+0.73%',
  totalReturn: '+12.4%',
  riskScore: 7.2,
  materialsCount: 47
};

const mockAlerts = [
  { id: 1, type: 'critical', title: 'China Gallium Export Restrictions', time: '2h ago', impact: 'High' },
  { id: 2, type: 'warning', title: 'Lithium Price Volatility', time: '4h ago', impact: 'Medium' },
  { id: 3, type: 'info', title: 'EU Critical Materials Act', time: '1d ago', impact: 'Low' }
];

const mockTopHoldings = [
  { name: 'Lithium Carbonate', value: '$1.2B', change: '+2.4%', risk: 'medium' },
  { name: 'Rare Earth Elements', value: '$890M', change: '-1.2%', risk: 'high' },
  { name: 'Cobalt', value: '$650M', change: '+0.8%', risk: 'high' },
  { name: 'Graphite', value: '$420M', change: '+1.5%', risk: 'low' }
];

const mockMarketData = [
  { name: 'Lithium', price: '13,450', change: '+2.4%', trend: 'up', risk: 'medium' },
  { name: 'Cobalt', price: '28,750', change: '-1.2%', trend: 'down', risk: 'high' },
  { name: 'Gallium', price: '351', change: '+5.2%', trend: 'up', risk: 'critical' },
  { name: 'Graphite', price: '850', change: '-0.8%', trend: 'down', risk: 'low' }
];

const mockNews = [
  {
    title: 'China Gallium Export Controls',
    time: '2h ago',
    impact: 'High',
    ellenTake: 'Supply risk increased. Recommend diversification.'
  },
  {
    title: 'EU Critical Materials Act',
    time: '6h ago', 
    impact: 'Medium',
    ellenTake: 'Positive for supply chain diversification.'
  }
];

const mockOpportunities = [
  { title: 'Lithium Arbitrage', potential: '$12.4M', confidence: 'High' },
  { title: 'Gallium Stockpiling', potential: '$8.7M', confidence: 'Medium' },
  { title: 'REE Processing', potential: '$45.2M', confidence: 'High' }
];

export default function StrategicDashboard() {
  const [query, setQuery] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>('Hello, there!');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) {
          setFirstName(profile.full_name.split(' ')[0]);
        }
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    setGreeting(getTimeBasedGreeting(firstName));
  }, [firstName]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const sessionTitle = `Chat: ${query.trim().substring(0, 50)}${query.trim().length > 50 ? '...' : ''}`;
        const session = await createNewSession(sessionTitle, null, query.trim());
        router.push(`/home/chat?session=${session.id}`);
      } catch (error) {
        console.error('Error creating session:', error);
        alert('Failed to create a chat session. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'info': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Status Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-300">System Operational</span>
            </div>
            <div className="text-sm text-slate-400">
              Last Update: <span className="text-slate-300">2 minutes ago</span>
            </div>
            <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold">
              🧪 STRATEGIC DASHBOARD MOCKUP
            </div>
          </div>
          <Link href="/home">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              ← Back to Original
            </Button>
          </Link>
        </div>
      </div>

      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{mockPortfolioSummary.totalValue}</p>
                <p className="text-sm text-slate-400">Total Portfolio Value</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-semibold">{mockPortfolioSummary.dailyChange}</span>
              <span className="text-slate-400">({mockPortfolioSummary.dailyChangePercent})</span>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{mockPortfolioSummary.riskScore}/10</p>
                <p className="text-sm text-slate-400">Overall Risk Score</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{width: `${mockPortfolioSummary.riskScore * 10}%`}}></div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{mockPortfolioSummary.totalReturn}</p>
                <p className="text-sm text-slate-400">Total Return</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400">{mockPortfolioSummary.materialsCount} Materials</span>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{mockAlerts.length}</p>
                <p className="text-sm text-slate-400">Active Alerts</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-400" />
              <span className="text-red-400 font-semibold">1 Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Portfolio & Risk */}
          <div className="space-y-6">
            {/* Top Holdings */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-400" />
                Top Holdings
              </h3>
              <div className="space-y-4">
                {mockTopHoldings.map((holding, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-semibold text-white">{holding.name}</p>
                      <div className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getRiskColor(holding.risk)}`}>
                        {holding.risk.toUpperCase()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{holding.value}</p>
                      <p className={`text-sm font-semibold ${
                        holding.change.startsWith('+') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {holding.change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Alerts */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Critical Alerts
              </h3>
              <div className="space-y-3">
                {mockAlerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border ${getAlertColor(alert.type)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-white text-sm">{alert.title}</p>
                      <span className="text-xs text-slate-400">{alert.time}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs px-2 py-1 rounded ${getRiskColor(alert.impact.toLowerCase())}`}>
                        {alert.impact} Impact
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column - Market Intelligence */}
          <div className="space-y-6">
            {/* Live Market Data */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-400" />
                Live Market Data
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2"></div>
              </h3>
              <div className="space-y-3">
                {mockMarketData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        item.trend === 'up' ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <div className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getRiskColor(item.risk)}`}>
                          {item.risk.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white font-mono">${item.price}</p>
                      <p className={`text-sm font-semibold flex items-center gap-1 ${
                        item.trend === 'up' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {item.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {item.change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* News Intelligence */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-blue-400" />
                Market Intelligence
              </h3>
              <div className="space-y-4">
                {mockNews.map((news, index) => (
                  <div key={index} className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-white text-sm">{news.title}</h4>
                      <span className="text-xs text-slate-400">{news.time}</span>
                    </div>
                    <div className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-2 ${getRiskColor(news.impact.toLowerCase())}`}>
                      {news.impact} Impact
                    </div>
                    <div className="bg-slate-700/50 p-3 rounded border-l-4 border-cyan-400">
                      <p className="text-xs text-slate-300 mb-1 font-semibold">Ellen's Take:</p>
                      <p className="text-sm text-slate-300">{news.ellenTake}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Actions & Research */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                <form onSubmit={handleChatSubmit} className="relative">
                  <Input
                    type="text"
                    placeholder="Ask Ellen anything..."
                    className="pl-10 pr-4 py-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-cyan-500"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                </form>
                
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom List
                </Button>
                
                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>

            {/* Strategic Opportunities */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-400" />
                Strategic Opportunities
              </h3>
              <div className="space-y-3">
                {mockOpportunities.map((opp, index) => (
                  <div key={index} className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-white text-sm">{opp.title}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        opp.confidence === 'High' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {opp.confidence}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-green-400">{opp.potential}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-400" />
                Quick Access
              </h3>
              <div className="space-y-2">
                <Link href="/home/research" className="block p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <FlaskConical className="h-4 w-4 text-emerald-400" />
                    <span className="text-white">Research Database</span>
                  </div>
                </Link>
                <Link href="/home/news" className="block p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Newspaper className="h-4 w-4 text-blue-400" />
                    <span className="text-white">News Feed</span>
                  </div>
                </Link>
                <Link href="/home/spaces" className="block p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Folders className="h-4 w-4 text-purple-400" />
                    <span className="text-white">Your Workspace</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
