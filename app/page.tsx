'use client';

import { useState, useEffect } from 'react';
import { Search, Newspaper, FlaskConical, Folders, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { createNewSession } from '@/app/home/chat/hooks/useSessionManagement';
import { createClient } from '@/lib/supabase/client';
import { getTimeBasedGreeting } from '@/lib/utils/greetings';

const mockPricingData = [
  { name: 'Lithium Carbonate', price: '13,450.50', change: '+25.50', trend: 'up', unit: 'USD/tonne' },
  { name: 'Cobalt Metal', price: '28,750.00', change: '-150.00', trend: 'down', unit: 'USD/tonne' },
  { name: 'Neodymium', price: '65.20', change: '+0.85', trend: 'up', unit: 'USD/kg' },
  { name: 'Gallium', price: '350.75', change: '+5.25', trend: 'up', unit: 'USD/kg' },
  { name: 'Graphite', price: '850.00', change: '-12.50', trend: 'down', unit: 'USD/tonne' },
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>('Hello, there!');
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  console.log(' HOME PAGE: Component rendered with query:', query);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      // If no user, redirect to login (backup for middleware)
      if (!user) {
        router.push('/auth/login');
        return;
      }

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
    checkAuthAndFetchData();
  }, [router]);

  // Update greeting when firstName changes or on mount (client-side only)
  useEffect(() => {
    setGreeting(getTimeBasedGreeting(firstName));
  }, [firstName]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(' HOME PAGE: Form submitted with query:', query.trim());
    
    if (query.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        // Create a new session with a descriptive title and store the initial query
        const sessionTitle = `Chat about: ${query.trim().substring(0, 50)}${query.trim().length > 50 ? '...' : ''}`;
        console.log(' HOME PAGE: Creating session with title:', sessionTitle);
        console.log(' HOME PAGE: Storing initial query in session metadata');
        
        const session = await createNewSession(sessionTitle, null, query.trim());
        console.log(' HOME PAGE: Session created with initial query:', session);
        
        // Redirect to the chat page with only the session ID
        const chatUrl = `/home/chat?session=${session.id}`;
        console.log(' HOME PAGE: Redirecting to:', chatUrl);
        
        router.push(chatUrl);
      } catch (error) {
        console.error(' HOME PAGE: Error creating session:', error);
        // Show an error message instead of falling back to the old behavior
        alert('Failed to create a chat session. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-blue-50 overflow-hidden">
      {/* CSS Waves Background */}
      <div className="absolute inset-0 z-0">
        {/* Wave 1 - Bottom layer */}
        <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0,400 C300,300 600,500 1200,400 L1200,800 L0,800 Z" fill="#dbeafe" opacity="0.5" />
        </svg>
        {/* Wave 2 - Middle layer */}
        <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0,500 C400,350 800,650 1200,500 L1200,800 L0,800 Z" fill="#bfdbfe" opacity="0.4" />
        </svg>
        {/* Wave 3 - Top layer */}
        <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0,600 C350,450 850,750 1200,600 L1200,800 L0,800 Z" fill="#93c5fd" opacity="0.3" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-3xl bg-white/70 backdrop-blur-md border border-white/40 p-12 rounded-xl text-center shadow-2xl">
        {/* Logo and Title */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">{greeting}</h1>
          <p className="text-lg text-gray-700">I&apos;m ELLEN, your critical materials AI analyst.</p>
        </div>

        {/* Search Form */}
        <div className="w-full max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <Input
                type="text"
                placeholder="How can I help you today?"
                className="pl-10 pr-16 py-6 text-base rounded-full border border-input/50 bg-background transition-shadow duration-300 focus:shadow-[0_0_25px_rgba(29,99,139,0.15)] focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <Button 
                  type="submit" 
                  size="sm" 
                  className="h-8 rounded-full"
                  disabled={!query.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="relative z-10 mt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/home/news" className="block">
          <Card className="hover:bg-muted transition-colors h-full">
            <div className="p-3 flex items-center gap-3">
              <Newspaper className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Recent News</p>
                <p className="text-xs text-muted-foreground">Latest market updates.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/home/research" className="block">
          <Card className="hover:bg-muted transition-colors h-full">
            <div className="p-3 flex items-center gap-3">
              <FlaskConical className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Research Materials</p>
                <p className="text-xs text-muted-foreground">Explore intel reports.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/home/spaces" className="block">
          <Card className="hover:bg-muted transition-colors h-full">
            <div className="p-3 flex items-center gap-3">
              <Folders className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Your Spaces</p>
                <p className="text-xs text-muted-foreground">Access your collections.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Live Market Prices */}
      <div className="relative z-10 mt-8 w-full max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {mockPricingData.map((item, index) => (
            <Card key={index} className="p-3 flex flex-col justify-between bg-muted/80 hover:bg-muted/80 transition-colors">
              <div>
                <p className="font-medium text-xs text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.unit}</p>
              </div>
              <div className="mt-3 text-right">
                <p className="text-xl font-bold font-mono">{item.price}</p>
                <div className={`flex items-center justify-end gap-1 text-xs font-mono ${item.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {item.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{item.change}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
