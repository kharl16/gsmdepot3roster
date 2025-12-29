-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin');

-- Create taxi_roster table
CREATE TABLE public.taxi_roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_number TEXT NOT NULL UNIQUE,
  driver_name TEXT NOT NULL,
  captain TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  license_expiry DATE,
  vehicle_number TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create roster_uploads table for upload history
CREATE TABLE public.roster_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('upsert', 'replace')),
  records_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.taxi_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_uploads ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- taxi_roster policies: Public read, Admin write
CREATE POLICY "Anyone can view roster"
ON public.taxi_roster
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert roster"
ON public.taxi_roster
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roster"
ON public.taxi_roster
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roster"
ON public.taxi_roster
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- user_roles policies: Only admins can manage roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- roster_uploads policies: Admin only
CREATE POLICY "Admins can view uploads"
ON public.roster_uploads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert uploads"
ON public.roster_uploads
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_taxi_roster_updated_at
BEFORE UPDATE ON public.taxi_roster
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_taxi_roster_captain ON public.taxi_roster(captain);
CREATE INDEX idx_taxi_roster_badge_number ON public.taxi_roster(badge_number);
CREATE INDEX idx_taxi_roster_driver_name ON public.taxi_roster(driver_name);