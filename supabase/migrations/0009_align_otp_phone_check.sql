-- ============================================================================
-- Migration 0009 — Alignement CHECK `otp_attempts.phone_e164` avec PHONE_RE Edge
-- ============================================================================
-- Story 2.3 (P8 code review 2026-05-17)
--
-- La migration 0007 a livré un CHECK `^\+[1-9]\d{1,14}$` (1-14 digits après le
-- premier digit) trop permissif vs le PHONE_RE des Edge Functions `otp-send` /
-- `otp-verify` (`^\+[1-9]\d{8,14}$`, soit 9-15 digits total — un E.164 réel a
-- au minimum 9 chiffres significatifs).
--
-- Aligne le CHECK DB sur 8-14 digits après le premier digit (= 9-15 digits
-- au total, plage E.164 standard et cohérente avec les régulateurs CIV/UEMOA).
-- ============================================================================

ALTER TABLE public.otp_attempts
  DROP CONSTRAINT IF EXISTS otp_attempts_phone_e164_check;

ALTER TABLE public.otp_attempts
  ADD CONSTRAINT otp_attempts_phone_e164_check
    CHECK (phone_e164 ~ '^\+[1-9]\d{8,14}$');
