-- Add XAUT staking pools with conservative APY rates (gold is stable, lower yields)
INSERT INTO staking_pools (token, apy_rate, min_stake, max_stake, lock_period_days, is_active)
VALUES 
  ('XAUT', 2.0, 0.01, 10, 30, true),
  ('XAUT', 2.5, 0.01, 10, 90, true),
  ('XAUT', 3.0, 0.01, 10, 180, true);