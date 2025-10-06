-- Create table for virtual card poll responses
CREATE TABLE public.virtual_card_poll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.virtual_card_poll ENABLE ROW LEVEL SECURITY;

-- Users can insert their own poll response
CREATE POLICY "Users can submit poll response"
ON public.virtual_card_poll
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own poll response
CREATE POLICY "Users can view own poll response"
ON public.virtual_card_poll
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all poll responses
CREATE POLICY "Admins can view all poll responses"
ON public.virtual_card_poll
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Block anonymous access
CREATE POLICY "Block anonymous access to virtual_card_poll"
ON public.virtual_card_poll
FOR ALL
USING (false);

-- Add unique constraint to prevent duplicate votes
ALTER TABLE public.virtual_card_poll
ADD CONSTRAINT unique_user_poll_response UNIQUE (user_id);