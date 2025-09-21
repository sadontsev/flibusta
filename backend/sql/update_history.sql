-- Create table for tracking automated update history
CREATE TABLE IF NOT EXISTS update_history (
    id SERIAL PRIMARY KEY,
    update_type VARCHAR(50) NOT NULL, -- 'daily_books', 'sql_files', 'covers', 'mappings', 'full'
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'running'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    files_processed INTEGER DEFAULT 0,
    files_successful INTEGER DEFAULT 0,
    files_failed INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB, -- Store detailed results
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_update_history_type_date ON update_history(update_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_update_history_status ON update_history(status);

-- Create table for automated schedule configuration
CREATE TABLE IF NOT EXISTS update_schedule (
    id SERIAL PRIMARY KEY,
    update_type VARCHAR(50) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT true,
    cron_expression VARCHAR(100) NOT NULL, -- Cron expression for scheduling
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default schedule for daily books update (runs at 2 AM every day)
INSERT INTO update_schedule (update_type, cron_expression) 
VALUES ('daily_books', '0 2 * * *')
ON CONFLICT (update_type) DO UPDATE SET 
    cron_expression = EXCLUDED.cron_expression,
    updated_at = NOW();

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for update_schedule table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_schedule_updated_at') THEN
        CREATE TRIGGER update_schedule_updated_at 
            BEFORE UPDATE ON update_schedule 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
