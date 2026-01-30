-- Add text_groups column to templates table
-- This column stores information about text compositions and their usage across scenes

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS text_groups JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN templates.text_groups IS 'Array of text composition groups showing which scenes share the same text';

-- Example structure:
-- [
--   {
--     "id": "comp_7",
--     "usedInScenes": ["comp_2"],
--     "firstAppearance": "comp_2"
--   },
--   {
--     "id": "comp_27",
--     "usedInScenes": ["comp_20", "comp_30", "comp_40"],
--     "firstAppearance": "comp_20"
--   }
-- ]
