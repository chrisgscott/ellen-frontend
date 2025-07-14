// @ts-check
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * @typedef {Object} SourceData
 * @property {string} title
 * @property {string} url
 * @property {string} [snippet]
 */

/**
 * @typedef {Object} MaterialData
 * @property {string} material
 * @property {string[]} [lists]
 * @property {number} [supply_score]
 * @property {number} [ownership_score]
 */

/**
 * Function to extract sources from response text
 * @param {string} responseText
 * @returns {SourceData[]}
 */
const extractSourcesFromResponse = (responseText) => {
  // Try multiple patterns for sources section
  const patterns = [
    /###(?:\*\*)? Sources(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /###(?:\*\*)? References(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /###(?:\*\*)? References & Resources(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /###(?:\*\*)? Citations(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?Sources(?:\*\*)?:?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?References(?:\*\*)?:?\s*\n([\s\S]*?)(?:\n---|$|###)/i
  ];
  
  let sourcesSection = null;
  for (const pattern of patterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      sourcesSection = match[1];
      break;
    }
  }
  
  if (!sourcesSection) {
    // Try to find inline citations throughout the text
    const inlineSourceRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const sources = [];
    const seenUrls = new Set();
    let match;
    
    while ((match = inlineSourceRegex.exec(responseText)) !== null) {
      const title = match[1].trim();
      const url = match[2].trim();
      
      // Skip if it's not a URL or if we've already seen it
      if (!url.includes('.') || seenUrls.has(url)) continue;
      
      seenUrls.add(url);
      sources.push({
        title,
        url,
        snippet: undefined
      });
    }
    
    console.log('Extracted inline sources:', sources);
    return sources;
  }

  const sources = [];
  const seenUrls = new Set();
  
  // Match markdown links: [title](url) - snippet
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(.*))?/g;
  let match;
  
  while ((match = markdownLinkRegex.exec(sourcesSection)) !== null) {
    const url = match[2].trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      sources.push({
        title: match[1].trim(),
        url,
        snippet: match[3] ? match[3].trim() : undefined
      });
    }
  }
  
  // Also match plain URLs or file references
  const plainUrlRegex = /(?:^|\s)(?:https?:\/\/[^\s]+|\w+\.pdf|\w+\.txt)(?:$|\s)/g;
  while ((match = plainUrlRegex.exec(sourcesSection)) !== null) {
    const url = match[0].trim();
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      sources.push({
        title: url,
        url,
        snippet: undefined
      });
    }
  }

  console.log('Extracted sources:', sources);
  return sources;
};

/**
 * Function to extract suggestions from response text
 * @param {string} responseText
 * @returns {string[]}
 */
const extractSuggestionsFromResponse = (responseText) => {
  // Try multiple patterns for follow-up questions section
  const patterns = [
    /###\s*(?:\*\*)?\s*Follow-up Questions\s*(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /###\s*(?:\*\*)?\s*Follow-Up Questions\s*(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?\s*Follow-up Questions\s*(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?\s*Follow-Up Questions:?\s*(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i
  ];
  
  let suggestionsSection = null;
  for (const pattern of patterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      suggestionsSection = match[1];
      break;
    }
  }
  
  if (!suggestionsSection) {
    return [];
  }

  const suggestions = [];
  // Match numbered questions (1., 2., etc.) or bullet points
  const suggestionRegex = /(?:^|\n)(?:\d+\.\s*|\*\s*|\-\s*)([^\n]+)/g;
  let match;
  while ((match = suggestionRegex.exec(suggestionsSection)) !== null) {
    const question = match[1].trim();
    if (question && !question.includes('---') && question.length > 5) {
      suggestions.push(question);
    }
  }

  console.log('Extracted suggestions:', suggestions);
  return suggestions.slice(0, 3);
};

/**
 * Function to extract materials from response text
 * @param {string} responseText
 * @returns {Promise<MaterialData[]>}
 */
async function extractMaterialsFromResponse(responseText) {
  // Try multiple patterns for extracted materials section
  const patterns = [
    /####(?:\*\*)? Extracted Material Name(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /###(?:\*\*)? Extracted Material(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?Extracted Material(?:\*\*)?:?\s*\n?([\s\S]*?)(?:\n---|$|###)/i,
    /### Extracted Materials Mentioned\s*\n([\s\S]*?)(?:\n---|$|###)/i,
    /(?:\*\*)?Key Materials Highlighted(?:\*\*)?\s*\n([\s\S]*?)(?:\n---|$|###)/i
  ];
  
  let materialsSection = null;
  for (const pattern of patterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      materialsSection = match[1];
      break;
    }
  }
  
  if (!materialsSection) {
    return [];
  }

  const materialNames = [];
  // Match materials in various formats: with asterisks, after hyphens, or on their own lines
  const materialRegexes = [
    /-\s*\*\*(.*?)\*\*/g,          // - **Material**
    /\*\*(.*?)\*\*/g,              // **Material**
    /-\s*([A-Z][a-zA-Z0-9\s]+)/g,  // - Material
    /^\s*([A-Z][a-zA-Z0-9\s]+)$/gm // Material on its own line
  ];
  
  for (const regex of materialRegexes) {
    let match;
    while ((match = regex.exec(materialsSection)) !== null) {
      const material = match[1].trim();
      if (material && !materialNames.includes(material) && material.length > 1 && !/^\d+$/.test(material)) {
        materialNames.push(material);
      }
    }
  }

  if (materialNames.length === 0) {
    return [];
  }

  console.log('Extracted material names:', materialNames);

  const { data: materials, error } = await supabase
    .from('materials')
    .select('*')
    .in('material', materialNames);

  if (error) {
    console.error('Error fetching materials from DB:', error);
    return [];
  }

  return materials || [];
}

// Main migration function
async function migrateMetadata() {
  console.log('Starting metadata migration...');
  
  try {
    // Get all assistant messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, role, related_materials, suggested_questions, sources')
      .eq('role', 'assistant');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${messages.length} assistant messages to process`);
    
    // Process each message
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const message of messages) {
      // Extract all metadata types from message content
      const sources = extractSourcesFromResponse(message.content);
      const suggestions = extractSuggestionsFromResponse(message.content);
      const materials = await extractMaterialsFromResponse(message.content);
      
      // Check if we need to update any metadata
      const needsUpdate = 
        (sources.length > 0 && (!message.sources || message.sources.length === 0)) ||
        (suggestions.length > 0 && (!message.suggested_questions || message.suggested_questions.length === 0)) ||
        (materials.length > 0 && (!message.related_materials || message.related_materials.length === 0));
      
      if (needsUpdate) {
        // Prepare update object with only the fields that need updating
        const updateObj = {};
        
        if (sources.length > 0 && (!message.sources || message.sources.length === 0)) {
          updateObj.sources = sources;
        }
        
        if (suggestions.length > 0 && (!message.suggested_questions || message.suggested_questions.length === 0)) {
          updateObj.suggested_questions = suggestions;
        }
        
        if (materials.length > 0 && (!message.related_materials || message.related_materials.length === 0)) {
          updateObj.related_materials = materials;
        }
        
        // Update the message with extracted metadata
        const { error: updateError } = await supabase
          .from('messages')
          .update(updateObj)
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
          continue;
        }
        
        updatedCount++;
        console.log(`Updated message ${message.id} with metadata:`, {
          sources: sources.length,
          suggestions: suggestions.length,
          materials: materials.length
        });
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
migrateMetadata().catch(console.error);
