'use client';

import { Building, BarChart3, PieChart, ShieldCheck, Network, Lightbulb, Users, BookCopy } from 'lucide-react';

const reportSections = [
  { id: 'market-overview', title: 'Market Overview', icon: Building },
  { id: 'trading-intelligence', title: 'Trading Intelligence', icon: BarChart3 },
  { id: 'investment-analysis', title: 'Investment Analysis', icon: PieChart },
  { id: 'national-security-assessment', title: 'National Security Assessment', icon: ShieldCheck },
  { id: 'supply-chain-intelligence', title: 'Supply Chain Intelligence', icon: Network },
  { id: 'strategic-recommendations', title: 'Strategic Recommendations', icon: Lightbulb },
  { id: 'key-stakeholders', title: 'Key Stakeholders', icon: Users },
  { id: 'sources-data-quality', title: 'Sources & Data Quality', icon: BookCopy },
];

export const TocSidebar = () => {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <aside className="sticky top-24 bg-primary text-primary-foreground p-4 rounded-lg">
      <h3 className="font-semibold mb-2 text-lg">On this page</h3>
      <ul className="space-y-2">
        {reportSections.map(section => (
          <li key={section.id}>
            <a 
              href={`#${section.id}`} 
              onClick={(e) => handleScroll(e, section.id)}
              className="text-sm text-primary-foreground hover:text-primary-foreground/80 transition-colors cursor-pointer"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
