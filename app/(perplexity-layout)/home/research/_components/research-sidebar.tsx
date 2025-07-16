import { createClient } from '@/lib/supabase/server';
import { NavLinks } from './nav-links'; 

async function getMaterials() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('materials')
    .select('id, material')
    .order('material', { ascending: true });

  if (error) {
    console.error('Error fetching materials:', error);
    return [];
  }
  return data;
}

export async function ResearchSidebar() {
  const materials = await getMaterials();

  return (
    <div className="h-full border-r flex flex-col">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Materials Library</h2>
      </div>
      <nav className="flex-grow overflow-y-auto">
        <NavLinks materials={materials} />
      </nav>
    </div>
  );
}
