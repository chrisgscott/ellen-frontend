'use client';

import { useRouter } from 'next/navigation';
import { createNewSession } from '@/app/(perplexity-layout)/home/chat/hooks/useSessionManagement';

import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { Material } from '@/lib/types';

interface AskEllenButtonProps {
  materialData: Material;
}

export const AskEllenButton = ({ materialData }: AskEllenButtonProps) => {
  const router = useRouter();

  const handleAskEllen = async () => {
    if (!materialData) return;

    const prompt = `Let's discuss the strategic material: "${materialData.material}".

Here is a summary: ${materialData.summary}

Key Applications: ${materialData.applications}
Investment Thesis: ${materialData.investment_thesis}
Strategic Recommendations: ${materialData.mitigation_recommendations}

Based on this, what are the most critical strategic insights I should be aware of?`;

    try {
      // Create a new session with a descriptive title and store the initial query
      const sessionTitle = `Chat about ${materialData.material}`;
      const session = await createNewSession(sessionTitle, null, prompt);
      
      // Redirect to the chat page with only the session ID
      router.push(`/home/chat?session=${session.id}`);
    } catch (error) {
      console.error('Failed to create session from material:', error);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleAskEllen} className="w-full bg-white text-primary hover:bg-white/80">
      <MessageSquare className="w-4 h-4 mr-1" />
      Ask Ellen
    </Button>
  );
};
