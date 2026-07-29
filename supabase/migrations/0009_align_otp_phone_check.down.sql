-- Down 0009 — restaure le CHECK permissif de 0007.

ALTER TABLE public.otp_attempts
  DROP CONSTRAINT IF EXISTS otp_attempts_phone_e164_check;

ALTER TABLE public.otp_attempts
  ADD CONSTRAINT otp_attempts_phone_e164_check
    CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$');
