-- 1. Function to delete user data older than 7 days
-- Assuming we have a table called 'diary_entries' or similar
CREATE OR REPLACE FUNCTION delete_old_diary_data()
RETURNS void AS $$
BEGIN
    -- Delete entries older than 7 days
    DELETE FROM public.diary_entries
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Note: You can also use this to delete files from storage via HTTP if needed,
    -- but usually, we just delete the database record first.
END;
$$ LANGUAGE plpgsql;

-- 2. Schedule the cleanup using pg_cron (if enabled in Supabase)
-- IMPORTANT: Enable pg_cron in Supabase Dashboard -> Database -> Extensions
SELECT cron.schedule(
    'daily-cleanup',   -- name of the cron job
    '0 0 * * *',       -- once a day at midnight
    'SELECT delete_old_diary_data();'
);

-- 3. RLS Policy Example
-- To allow users to only see their own data
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own entries" 
ON public.diary_entries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own entries" 
ON public.diary_entries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
