-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view roster" ON public.taxi_roster;

-- Create a new policy that requires authentication to view the roster
CREATE POLICY "Authenticated users can view roster" 
ON public.taxi_roster 
FOR SELECT 
USING (auth.uid() IS NOT NULL);