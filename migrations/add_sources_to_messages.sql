-- Add sources column to messages table
ALTER TABLE public.messages
ADD COLUMN sources JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.messages.sources IS 'Array of sources used in the message response';
