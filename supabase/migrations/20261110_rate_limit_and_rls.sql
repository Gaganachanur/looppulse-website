-- ==============================================================================
-- Migration: Rate Limiting & RLS Security Hardening for research_inquiries
-- Date: 2026-11-10
-- Target: Supabase PostgreSQL
-- Security Hardened: Keyed HMAC IP Privacy, RLS on all tables, Strict Privileges
-- ==============================================================================

-- 1. Ensure pgcrypto extension is enabled for cryptographic keyed HMAC
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create table for persistent IP rate limiting
CREATE TABLE IF NOT EXISTS public.form_rate_limits (
    ip_hash TEXT PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_request TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Index on window_start for efficient opportunistic cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_form_rate_limits_window_start 
    ON public.form_rate_limits (window_start);

-- Enable Row Level Security (RLS) on form_rate_limits
ALTER TABLE public.form_rate_limits ENABLE ROW LEVEL SECURITY;

-- 3. Security Hardening & Privilege Revocation on form_rate_limits table
-- Revoke all access from public, anonymous, and authenticated clients
REVOKE ALL ON TABLE public.form_rate_limits FROM PUBLIC, anon, authenticated;

-- Grant access ONLY to the trusted service_role (used by Edge Functions)
GRANT ALL ON TABLE public.form_rate_limits TO service_role;

-- 4. Create atomic rate limiting function
-- Parameters:
--   p_ip: Client IP address
--   p_max_requests: Max allowed requests per window (default: 5)
--   p_window_seconds: Duration of sliding window in seconds (default: 600 = 10 mins)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip TEXT,
    p_max_requests INT DEFAULT 5,
    p_window_seconds INT DEFAULT 600
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INT,
    reset_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_ip_hash TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window_interval INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
    v_allowed BOOLEAN := FALSE;
    v_res_count INT := 1;
    v_reset_secs INT := p_window_seconds;
BEGIN
    -- Keyed HMAC-SHA256 for IP privacy (prevents rainbow table attacks against IPv4/IPv6 spaces)
    v_ip_hash := encode(
        extensions.hmac(
            p_ip::bytea, 
            'LP_RATE_LIMIT_HMAC_SECRET_KEY_v2026'::bytea, 
            'sha256'
        ), 
        'hex'
    );

    -- Opportunistic cleanup of expired records older than 24 hours (~10% of invocations)
    IF random() < 0.10 THEN
        DELETE FROM public.form_rate_limits 
        WHERE window_start < (v_now - INTERVAL '24 hours');
    END IF;

    -- Atomic Upsert with window rollover in a single SQL statement
    -- Row-level locking (XMAX) prevents concurrent race conditions
    INSERT INTO public.form_rate_limits (ip_hash, request_count, window_start, last_request)
    VALUES (v_ip_hash, 1, v_now, v_now)
    ON CONFLICT (ip_hash) DO UPDATE
    SET 
        request_count = CASE 
            WHEN public.form_rate_limits.window_start + v_window_interval <= v_now THEN 1
            ELSE public.form_rate_limits.request_count + 1
        END,
        window_start = CASE 
            WHEN public.form_rate_limits.window_start + v_window_interval <= v_now THEN v_now
            ELSE public.form_rate_limits.window_start
        END,
        last_request = v_now
    RETURNING 
        (public.form_rate_limits.request_count <= p_max_requests),
        public.form_rate_limits.request_count,
        GREATEST(1, EXTRACT(EPOCH FROM (public.form_rate_limits.window_start + v_window_interval - v_now))::INT)
    INTO 
        v_allowed,
        v_res_count,
        v_reset_secs;

    RETURN QUERY SELECT v_allowed, v_res_count, v_reset_secs;
END;
$$;

-- 5. Revoke execute permissions on rate-limit function from public and anon roles
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;

-- Grant execution privilege ONLY to service_role (Edge Functions)
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO service_role;

-- 6. Row Level Security on research_inquiries
-- Enable RLS to prevent public access via Publishable/Anon key
ALTER TABLE public.research_inquiries ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions from anon and authenticated roles
-- Clients cannot query, insert, or modify directly via Supabase client SDK
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.research_inquiries FROM PUBLIC, anon, authenticated;

-- Grant full access to service_role (service_role writes verified entries)
GRANT ALL ON public.research_inquiries TO service_role;

-- Ensure no permissive legacy policies exist for anon
DROP POLICY IF EXISTS "Public inquiries can be inserted by anyone" ON public.research_inquiries;
DROP POLICY IF EXISTS "Allow anon inserts" ON public.research_inquiries;
DROP POLICY IF EXISTS "Allow anon read" ON public.research_inquiries;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.research_inquiries;
