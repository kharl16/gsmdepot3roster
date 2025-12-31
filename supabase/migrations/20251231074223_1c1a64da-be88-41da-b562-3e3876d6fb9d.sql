-- Drop old table and create new one with correct schema
-- First backup any existing data if needed, then recreate

-- Drop existing table (will cascade)
DROP TABLE IF EXISTS public.taxi_roster CASCADE;

-- Create new taxi_roster table with correct schema
CREATE TABLE public.taxi_roster (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plate text NOT NULL UNIQUE,
    employee_id text NOT NULL,
    name text NOT NULL,
    phone text,
    telegram_phone text,
    captain text NOT NULL,
    schedule text,
    rest_day text,
    status text DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_taxi_roster_plate ON public.taxi_roster(plate);
CREATE INDEX idx_taxi_roster_employee_id ON public.taxi_roster(employee_id);
CREATE INDEX idx_taxi_roster_name ON public.taxi_roster(name);
CREATE INDEX idx_taxi_roster_captain ON public.taxi_roster(captain);
CREATE INDEX idx_taxi_roster_schedule ON public.taxi_roster(schedule);
CREATE INDEX idx_taxi_roster_rest_day ON public.taxi_roster(rest_day);
CREATE INDEX idx_taxi_roster_status ON public.taxi_roster(status);

-- Enable Row Level Security
ALTER TABLE public.taxi_roster ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view roster" 
ON public.taxi_roster 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert roster" 
ON public.taxi_roster 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roster" 
ON public.taxi_roster 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roster" 
ON public.taxi_roster 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_taxi_roster_updated_at
BEFORE UPDATE ON public.taxi_roster
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();