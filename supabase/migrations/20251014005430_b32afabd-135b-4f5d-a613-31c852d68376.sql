-- Fix award_points function to handle missing user_rewards
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _activity_type reward_activity_type, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _points NUMERIC;
  _rule RECORD;
  _current_rewards RECORD;
  _is_early_bird BOOLEAN := false;
BEGIN
  -- Get reward rule
  SELECT * INTO _rule FROM public.reward_rules 
  WHERE activity_type = _activity_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate points
  _points := _rule.points_base;
  
  -- Apply multiplier if in metadata
  IF _metadata ? 'multiplier' THEN
    _points := _points * (_metadata->>'multiplier')::NUMERIC;
  END IF;
  
  -- Check if early bird activity
  IF _activity_type IN ('account_creation', 'kyc_completion', 'contact_sync', 'user_invitation') THEN
    _is_early_bird := true;
  END IF;
  
  -- Get current rewards (or initialize if doesn't exist)
  INSERT INTO public.user_rewards (user_id, early_bird_points, activity_points, total_points)
  VALUES (_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT * INTO _current_rewards FROM public.user_rewards WHERE user_id = _user_id FOR UPDATE;
  
  -- Check max cap for early bird
  IF _is_early_bird AND _rule.max_points_per_period IS NOT NULL THEN
    IF _current_rewards.early_bird_points >= _rule.max_points_per_period THEN
      RETURN 0;
    END IF;
  END IF;
  
  -- Update rewards using UPSERT
  IF _is_early_bird THEN
    INSERT INTO public.user_rewards (user_id, early_bird_points, activity_points, total_points)
    VALUES (_user_id, _points, 0, _points)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      early_bird_points = user_rewards.early_bird_points + _points,
      total_points = user_rewards.total_points + _points,
      updated_at = now();
  ELSE
    INSERT INTO public.user_rewards (user_id, early_bird_points, activity_points, total_points)
    VALUES (_user_id, 0, _points, _points)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      activity_points = user_rewards.activity_points + _points,
      total_points = user_rewards.total_points + _points,
      updated_at = now();
  END IF;
  
  -- Log activity
  INSERT INTO public.reward_activities (user_id, activity_type, points_awarded, metadata)
  VALUES (_user_id, _activity_type, _points, _metadata);
  
  RETURN _points;
END;
$function$;