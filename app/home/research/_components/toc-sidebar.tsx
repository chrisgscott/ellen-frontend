'use client';

interface TocSection {
  id: string;
  title: string;
}

interface TocSidebarProps {
  sections: TocSection[];
}

export default function TocSidebar({ sections }: TocSidebarProps) {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <aside className="bg-primary rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-lg text-white">On this page</h3>
        <ul className="space-y-2">
            {sections.map(section => (
                <li key={section.id}>
                    <button 
                      onClick={() => scrollToSection(section.id)}
                      className="text-sm text-white/80 hover:text-white transition-colors text-left w-full"
                    >
                        {section.title}
                    </button>
                </li>
            ))}
        </ul>
    </aside>
  );
}
