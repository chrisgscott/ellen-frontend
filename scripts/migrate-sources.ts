import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface SourceData {
  title: string;
  url: string;
  snippet?: string;
}

// Function to extract sources from response text (copied from chat API)
const extractSourcesFromResponse = (responseText: string): SourceData[] => {
  const sourcesSectionMatch = responseText.match(/###(?:\*\*)? Sources(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/);
  if (!sourcesSectionMatch || !sourcesSectionMatch[1]) {
    return [];
  }

  const sourcesSection = sourcesSectionMatch[1];
  const sources: SourceData[] = [];
  const sourceRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.*))?/g;
  let match;
  
  while ((match = sourceRegex.exec(sourcesSection)) !== null) {
    sources.push({
      title: match[1].trim(),
      url: match[2].trim(),
      snippet: match[3] ? match[3].trim() : undefined
    });
  }

  return sources;
};

// Main migration function
async function migrateSources() {
  console.log('Starting sources migration...');
  
  try {
    // Get all assistant messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, role')
      .eq('role', 'assistant');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${messages.length} assistant messages to process`);
    
    // Process each message
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const message of messages) {
      // Extract sources from message content
      const sources = extractSourcesFromResponse(message.content);
      
      if (sources.length > 0) {
        // Update the message with extracted sources
        const { error: updateError } = await supabase
          .from('messages')
          .update({ sources })
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
          continue;
        }
        
        updatedCount++;
        console.log(`Updated message ${message.id} with ${sources.length} sources`);
      } else {
        skippedCount++;
      }
    }
    
    console.log(`Migration complete. Updated ${updatedCount} messages, skipped ${skippedCount} messages.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateSources().catch(console.error);
