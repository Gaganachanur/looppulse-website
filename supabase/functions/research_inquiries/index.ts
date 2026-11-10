// ==============================================================================
// LoopPulse.in - Research Inquiries Supabase Edge Function
// Security Hardened v3: Fail-Closed Turnstile, Strict CORS,
// HTML Escaping, Input Validation, Supabase Service Role Only
// ==============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const MAX_BODY_BYTES = 16 * 1024; // 16 KB request body limit
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;
const TURNSTILE_TIMEOUT_MS = 5000;

// 1. Strict Exact CORS Origins Allowlist (No wildcards or substring matching)
const ALLOWED_ORIGINS = new Set([
  "https://looppulse.in",
  "https://www.looppulse.in",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

// 2. Strict Exact Cloudflare Turnstile Hostnames Allowlist
const ALLOWED_TURNSTILE_HOSTNAMES = new Set([
  "looppulse.in",
  "www.looppulse.in"
]);

// CORS is a browser restriction, not authentication. Turnstile is enforced separately.
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, X-Client-Info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

// Read body stream with strict 16 KB limit before buffering
async function readBodyWithLimit(req: Request, maxBytes: number): Promise<string> {
  const body = req.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const totalBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    totalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder("utf-8").decode(totalBuffer);
}

// Server-side Cloudflare Turnstile token validation (Fail-Closed)
async function verifyTurnstileToken(
  token: string,
  turnstileSecret: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append("secret", turnstileSecret);
    formData.append("response", token);
    // remoteip is intentionally omitted: there is no verified client IP source.
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS)
    });

    if (!verifyRes.ok) {
      return { success: false, error: `Siteverify HTTP ${verifyRes.status}` };
    }

    const data = await verifyRes.json();
    if (data?.success !== true) {
      return { success: false, error: "Cloudflare rejected token" };
    }

    if (typeof data.hostname !== "string" || !ALLOWED_TURNSTILE_HOSTNAMES.has(data.hostname)) {
      return { success: false, error: "Turnstile hostname not authorized" };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Siteverify error" };
  }
}

// Security: HTML Escaping to prevent HTML Injection / Stored XSS in emails
function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Security: Header Sanitizer to prevent CRLF Email Header Injection in email subject
function sanitizeHeader(str: string): string {
  if (!str) return "";
  return String(str).replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
}

// Explicit validation constants
const ALLOWED_BUSINESS_TYPES = [
  "Fitness and wellness",
  "Clinics and appointment-based businesses",
  "Real estate",
  "Education and coaching",
  "Home and professional services",
  "Other small businesses",
  "Other"
];

const ALLOWED_ENQUIRIES = [
  "Fewer than 20",
  "20–50",
  "20-50",
  "51–100",
  "51-100",
  "More than 100",
  "Not sure"
];

const ALLOWED_METHODS = [
  "Paper records",
  "Excel or Google Sheets",
  "Manual phone calls",
  "WhatsApp",
  "CRM or other software",
  "Other"
];

const ALLOWED_TESTING = [
  "Yes, if it solves our problem",
  "Maybe, depending on pricing",
  "Just researching for now"
];

const ALLOWED_CONTACT = ["WhatsApp", "Phone", "Email"];

// Explicit Indian Phone Number validation pattern:
// Supports optional +91 or 0 prefix, followed by 10 digits starting with 6, 7, 8, or 9
const INDIAN_PHONE_REGEX = /^(?:(?:\+91|0)[-\s]?)?[6-9]\d{4}[-\s]?\d{5}$/;

// Main Deno Request Handler
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Reject requests declaring a browser Origin that is not explicitly allowed.
  // Requests without Origin still require a valid, single-use Turnstile token.
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // 1. Handle CORS Preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Reject unsupported HTTP methods
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    // 2. Read Request Body with 16 KB Limit (Streaming)
    let rawBody: string;
    try {
      rawBody = await readBodyWithLimit(req, MAX_BODY_BYTES);
    } catch (err: any) {
      if (err.message === "PAYLOAD_TOO_LARGE") {
        return new Response(
          JSON.stringify({ error: "Request payload exceeds maximum allowed size (16 KB)." }),
          { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw err;
    }

    if (!rawBody.trim()) {
      return new Response(
        JSON.stringify({ error: "Request body cannot be empty." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON format." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return new Response(JSON.stringify({ error: "Request body must be a JSON object." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Supabase Client Initialization using SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[research_inquiries] Server configuration error: missing SUPABASE_URL or SERVICE_ROLE_KEY.");
      return new Response(
        JSON.stringify({ error: "Server security configuration error. Please contact administrator." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 4. Cloudflare Turnstile Token Verification (Strictly Fail-Closed)
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      console.error("[research_inquiries] Server configuration error: missing TURNSTILE_SECRET_KEY.");
      return new Response(
        JSON.stringify({ error: "Server security configuration error. Please contact administrator." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const turnstileToken = payload.cfTurnstileToken;
    if (!turnstileToken || typeof turnstileToken !== "string" || turnstileToken.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Security verification token is missing. Please complete the captcha." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
      return new Response(JSON.stringify({ error: "Security verification token is invalid." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const turnstileResult = await verifyTurnstileToken(turnstileToken, turnstileSecret);
    if (!turnstileResult.success) {
      console.warn("[research_inquiries] Turnstile rejection:", turnstileResult.error);
      return new Response(
        JSON.stringify({ error: "Security check failed. Please refresh and try again." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 5. Strict Input Validation & Sanitization
    const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
    const businessName = typeof payload.businessName === "string" ? payload.businessName.trim() : "";
    const businessType = typeof payload.businessType === "string" ? payload.businessType.trim() : "";
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    const rawPhone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const rawEmail = typeof payload.email === "string" ? payload.email.trim() : "";
    const monthlyEnquiries = typeof payload.monthlyEnquiries === "string" ? payload.monthlyEnquiries.trim() : "";
    const managementMethod = typeof payload.managementMethod === "string" ? payload.managementMethod.trim() : "";
    const biggestChallenge = typeof payload.biggestChallenge === "string" ? payload.biggestChallenge.trim() : "";
    const considerTesting = typeof payload.considerTesting === "string" ? payload.considerTesting.trim() : "";
    const preferredContact = typeof payload.preferredContact === "string" ? payload.preferredContact.trim() : "WhatsApp";
    const consent = payload.consent === true;
    const referenceId = "LP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

    // Validation checks
    if (fullName.length < 2 || fullName.length > 100) {
      return new Response(JSON.stringify({ error: "Full name must be between 2 and 100 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (businessName.length < 2 || businessName.length > 100) {
      return new Response(JSON.stringify({ error: "Business name must be between 2 and 100 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!ALLOWED_BUSINESS_TYPES.includes(businessType)) {
      return new Response(JSON.stringify({ error: "Please select a valid business type." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (city.length < 2 || city.length > 100) {
      return new Response(JSON.stringify({ error: "City must be between 2 and 100 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Strict Phone Number Validation (Rejects invalid formats)
    if (!rawPhone || !INDIAN_PHONE_REGEX.test(rawPhone)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid 10-digit Indian phone or WhatsApp number (e.g. 9876543210 or +91 98765 43210)." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const tenDigitMatch = rawPhone.replace(/\D/g, "").slice(-10);
    const sanitizedPhone = "+91" + tenDigitMatch;

    // Optional Email validation
    let sanitizedEmail: string | null = null;
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail) || rawEmail.length > 100) {
        return new Response(JSON.stringify({ error: "Please provide a valid email address." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      sanitizedEmail = rawEmail.toLowerCase();
    }

    if (monthlyEnquiries && !ALLOWED_ENQUIRIES.includes(monthlyEnquiries)) {
      return new Response(JSON.stringify({ error: "Invalid enquiry volume selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (managementMethod && !ALLOWED_METHODS.includes(managementMethod)) {
      return new Response(JSON.stringify({ error: "Invalid management method selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (biggestChallenge.length < 5 || biggestChallenge.length > 1000) {
      return new Response(JSON.stringify({ error: "Challenge description must be between 5 and 1000 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (considerTesting && !ALLOWED_TESTING.includes(considerTesting)) {
      return new Response(JSON.stringify({ error: "Invalid testing preference selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (preferredContact && !ALLOWED_CONTACT.includes(preferredContact)) {
      return new Response(JSON.stringify({ error: "Invalid contact preference selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!consent) {
      return new Response(JSON.stringify({ error: "Consent is required to submit research feedback." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 6. Insert Verified Record into Supabase PostgreSQL
    const dbRecord = {
      reference_id: referenceId,
      full_name: fullName,
      business_name: businessName,
      business_type: businessType,
      city: city,
      phone: sanitizedPhone,
      email: sanitizedEmail,
      monthly_enquiries: monthlyEnquiries || null,
      management_method: managementMethod || null,
      biggest_challenge: biggestChallenge,
      consider_testing: considerTesting || null,
      preferred_contact: preferredContact,
      consent: true,
      submitted_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from("research_inquiries")
      .insert(dbRecord);

    if (insertError) {
      console.error("[research_inquiries] DB insertion failed:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to record your inquiry. Please try again later." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[research_inquiries] Successfully recorded inquiry: ${referenceId}`);

    // 7. Zoho ZeptoMail Email Notification (Escaped HTML & Sanitized Subject Header)
    const zeptoToken = Deno.env.get("ZEPTOMAIL_API_TOKEN");
    if (zeptoToken) {
      try {
        const cleanSubjectBusiness = sanitizeHeader(businessName);
        const cleanSubjectCity = sanitizeHeader(city);
        const cleanSubjectRef = sanitizeHeader(referenceId);

        const emailPayload = {
          bounce_address: "bounce@looppulse.in",
          from: {
            address: "notifications@looppulse.in",
            name: "LoopPulse Inquiries"
          },
          to: [
            {
              email_address: {
                address: "hello@looppulse.in",
                name: "LoopPulse Founding Team"
              }
            }
          ],
          subject: `[New Research Lead] ${cleanSubjectBusiness} (${cleanSubjectCity}) - Ref ${cleanSubjectRef}`,
          htmlbody: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="color: #2563eb; margin: 0 0 6px 0; font-size: 20px;">LoopPulse.in Research Response</h2>
                <span style="font-size: 13px; color: #64748b;">Reference ID: <strong>${escapeHtml(referenceId)}</strong></span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.6;">
                <tr><td style="padding: 8px 0; color: #64748b; width: 40%;"><strong>Full Name:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(fullName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Business Name:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(businessName)}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Business Type:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(businessType)}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>City:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(city)}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 8px 0; color: #0f172a;"><a href="https://wa.me/${sanitizedPhone.replace(/\D/g, '')}">${escapeHtml(sanitizedPhone)}</a></td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(sanitizedEmail || 'Not provided')}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Monthly Enquiries:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(monthlyEnquiries || 'Not specified')}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Current Method:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(managementMethod || 'Not specified')}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Would Test Solution:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(considerTesting || 'Not specified')}</td></tr>
                <tr><td style="padding: 8px 0; color: #64748b;"><strong>Preferred Contact:</strong></td><td style="padding: 8px 0; color: #0f172a;">${escapeHtml(preferredContact)}</td></tr>
              </table>
              <div style="margin-top: 20px; padding: 14px; background-color: #f8fafc; border-left: 4px solid #7c3aed; border-radius: 6px;">
                <strong style="color: #475569; display: block; margin-bottom: 6px;">Biggest Challenge:</strong>
                <p style="margin: 0; color: #1e293b; font-style: italic;">"${escapeHtml(biggestChallenge)}"</p>
              </div>
              <p style="margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center;">Sent securely via LoopPulse Supabase Edge Function</p>
            </div>
          `
        };

        const zeptoRes = await fetch("https://cpaas.zoho.in/v1.1/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Zoho-enczapikey ${zeptoToken}`
          },
          body: JSON.stringify(emailPayload)
        });

        if (!zeptoRes.ok) {
          console.error("[research_inquiries] ZeptoMail dispatch failed. Status:", zeptoRes.status, "Ref:", cleanSubjectRef);
        } else {
          console.log(`[research_inquiries] ZeptoMail notification sent successfully for ${referenceId}`);
        }
      } catch (mailErr: any) {
        console.error("[research_inquiries] ZeptoMail exception for ref " + referenceId + ":", mailErr.message || mailErr);
      }
    } else {
      console.error("[research_inquiries] ZEPTOMAIL_API_TOKEN is not configured; email notification skipped.");
    }

    // 8. Successful Response
    return new Response(
      JSON.stringify({
        success: true,
        referenceId: referenceId,
        message: "Your research submission has been successfully received."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (err: any) {
    console.error("[research_inquiries] Unhandled error:", err.message || err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred while processing your submission." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});