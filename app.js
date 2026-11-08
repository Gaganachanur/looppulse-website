/**
 * LoopPulse.in - High-Converting Landing Page & Research Form Engine
 * Designed for early-stage market validation with Indian SMBs.
 */

// ========================================================
// 1. CONFIGURATION
// ========================================================
const CONFIG = {
  // Supabase Edge Function Endpoint
  SUPABASE_EDGE_FUNCTION_URL: 'https://yscspgtyqetuyxikbvbo.supabase.co/functions/v1/research_inquiries',

  // Supabase Publishable Key (safe for public client-side access)
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_K6saD7zHFcRkVDCXLH0nMg_cSxq-F5o',

  // Local storage key for confirmed submissions log
  STORAGE_KEY: 'looppulse_research_submissions',

  // Enable verbose debugging in browser console
  DEBUG_ANALYTICS: true
};

// ========================================================
// 2. ANALYTICS & EVENT TRACKING DISPATCHER
// ========================================================
window.LoopPulseAnalytics = {
  track: function(eventName, properties = {}) {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || 'direct',
      ...properties
    };

    if (CONFIG.DEBUG_ANALYTICS) {
      console.log(`%c[LoopPulse Analytics] ${eventName}`, 'color: #2563EB; font-weight: bold;', payload);
    }

    // Google Tag Manager dataLayer support
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }

    // Google Analytics 4 (gtag) support
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, properties);
    }

    // Meta Pixel (fbq) support (crucial for Instagram Ads traffic)
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', eventName, properties);
    }
  }
};

// ========================================================
// 3. DOM READY INITIALIZATION
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initIndustrySelector();
  initFaqAccordion();
  initPrivacyModal();
  initFormEngine();
  initCtaTracking();
});

// ========================================================
// 4. INDUSTRY SELECTOR SYNC (Section 4 -> Section 5)
// ========================================================
function initIndustrySelector() {
  const industryCards = document.querySelectorAll('.industry-select-card');
  const businessTypeSelect = document.getElementById('businessType');
  const industryBanner = document.getElementById('industry-banner');
  const selectedIndustryLabel = document.getElementById('selected-industry-label');
  const clearIndustryBtn = document.getElementById('clear-industry-btn');

  industryCards.forEach(card => {
    card.addEventListener('click', () => {
      const industry = card.getAttribute('data-industry');

      // Update card UI
      industryCards.forEach(c => {
        c.classList.remove('active-industry');
        const indicator = c.querySelector('.select-indicator');
        if (indicator) indicator.textContent = 'Select';
      });
      card.classList.add('active-industry');
      const activeIndicator = card.querySelector('.select-indicator');
      if (activeIndicator) activeIndicator.textContent = 'Selected ✓';

      // Update Form Dropdown
      if (businessTypeSelect) {
        businessTypeSelect.value = industry;
      }

      // Show Banner
      if (industryBanner && selectedIndustryLabel) {
        selectedIndustryLabel.textContent = industry;
        industryBanner.classList.remove('hidden');
      }

      // Track Event
      window.LoopPulseAnalytics.track('industry_selected', {
        industry: industry,
        source: 'who_is_this_for_grid'
      });

      // Smooth scroll to form
      const formSection = document.getElementById('research-form');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth' });
        // Focus first field after scroll
        setTimeout(() => {
          const fullNameInput = document.getElementById('fullName');
          if (fullNameInput) fullNameInput.focus();
        }, 500);
      }
    });
  });

  // Clear / Reset Industry banner
  if (clearIndustryBtn) {
    clearIndustryBtn.addEventListener('click', () => {
      industryCards.forEach(c => {
        c.classList.remove('active-industry');
        const ind = c.querySelector('.select-indicator');
        if (ind) ind.textContent = 'Select';
      });
      if (businessTypeSelect) businessTypeSelect.value = '';
      if (industryBanner) industryBanner.classList.add('hidden');
      
      const whoSection = document.getElementById('who-is-this-for');
      if (whoSection) whoSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // When user manually selects from the dropdown, reflect back to cards
  if (businessTypeSelect) {
    businessTypeSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      industryCards.forEach(c => {
        if (c.getAttribute('data-industry') === selected) {
          c.classList.add('active-industry');
          const ind = c.querySelector('.select-indicator');
          if (ind) ind.textContent = 'Selected ✓';
        } else {
          c.classList.remove('active-industry');
          const ind = c.querySelector('.select-indicator');
          if (ind) ind.textContent = 'Select';
        }
      });
      if (industryBanner && selectedIndustryLabel) {
        selectedIndustryLabel.textContent = selected;
        industryBanner.classList.remove('hidden');
      }
    });
  }
}

// ========================================================
// 5. FAQ ACCORDION ENGINE
// ========================================================
function initFaqAccordion() {
  const faqToggles = document.querySelectorAll('.faq-toggle');

  faqToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      const contentId = toggle.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      const icon = toggle.querySelector('.faq-icon');

      // Close all others
      faqToggles.forEach(otherToggle => {
        if (otherToggle !== toggle) {
          otherToggle.setAttribute('aria-expanded', 'false');
          const otherContentId = otherToggle.getAttribute('aria-controls');
          const otherContent = document.getElementById(otherContentId);
          const otherIcon = otherToggle.querySelector('.faq-icon');
          if (otherContent) otherContent.classList.add('hidden');
          if (otherIcon) otherIcon.classList.remove('rotate-180');
        }
      });

      // Toggle current
      if (isExpanded) {
        toggle.setAttribute('aria-expanded', 'false');
        if (content) content.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
      } else {
        toggle.setAttribute('aria-expanded', 'true');
        if (content) content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');

        window.LoopPulseAnalytics.track('faq_opened', {
          question: toggle.innerText.trim()
        });
      }
    });
  });
}

// ========================================================
// 6. PRIVACY MODAL ENGINE
// ========================================================
function initPrivacyModal() {
  const modal = document.getElementById('privacyModal');
  const openBtn = document.getElementById('openPrivacyModalBtn');
  const closeBtn = document.getElementById('closePrivacyModalBtn');
  const closeBottomBtn = document.getElementById('closePrivacyModalBottomBtn');

  function openModal() {
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      window.LoopPulseAnalytics.track('privacy_modal_opened');
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);

  // Close on outside click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// ========================================================
// 7. FORM SUBMISSION & VALIDATION ENGINE
// ========================================================
function initFormEngine() {
  const form = document.getElementById('marketResearchForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitArrow = document.getElementById('submitArrow');
  const successContainer = document.getElementById('submissionSuccess');
  const responseRefId = document.getElementById('responseRefId');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const submissionError = document.getElementById('submissionError');
  const submissionErrorMessage = document.getElementById('submissionErrorMessage');

  if (!form) return;

  // Submission in-flight lock to prevent double-submits
  let isSubmitting = false;

  // Track first interaction with the form
  let formStarted = false;
  form.addEventListener('focusin', () => {
    if (!formStarted) {
      formStarted = true;
      window.LoopPulseAnalytics.track('form_interaction_started');
    }
  });

  // Validation helper
  function validateField(input, errorElement, condition) {
    if (!condition) {
      input.classList.add('input-error');
      if (errorElement) errorElement.classList.remove('hidden');
      return false;
    } else {
      input.classList.remove('input-error');
      if (errorElement) errorElement.classList.add('hidden');
      return true;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let isValid = true;

    // 1. Full name
    const fullName = document.getElementById('fullName');
    const nameValid = validateField(
      fullName, 
      fullName.parentElement.querySelector('.error-msg'), 
      fullName.value.trim().length >= 2
    );
    if (!nameValid) isValid = false;

    // 2. Business name
    const businessName = document.getElementById('businessName');
    const bizValid = validateField(
      businessName, 
      businessName.parentElement.querySelector('.error-msg'), 
      businessName.value.trim().length >= 2
    );
    if (!bizValid) isValid = false;

    // 3. Business type
    const businessType = document.getElementById('businessType');
    const typeValid = validateField(
      businessType, 
      businessType.parentElement.querySelector('.error-msg'), 
      businessType.value !== ''
    );
    if (!typeValid) isValid = false;

    // 4. City
    const city = document.getElementById('city');
    const cityValid = validateField(
      city, 
      city.parentElement.querySelector('.error-msg'), 
      city.value.trim().length >= 2
    );
    if (!cityValid) isValid = false;

    // 5. Phone (10 digits)
    const phone = document.getElementById('phone');
    const cleanPhone = phone.value.replace(/[^0-9]/g, '');
    const phoneValid = validateField(
      phone, 
      phone.parentElement.parentElement.querySelector('.error-msg'), 
      cleanPhone.length === 10
    );
    if (!phoneValid) isValid = false;

    // 7. Monthly enquiries (Radio)
    const monthlyEnquiries = form.querySelector('input[name="monthlyEnquiries"]:checked');
    const enquiriesError = form.querySelector('.error-msg-enquiries');
    if (!monthlyEnquiries) {
      if (enquiriesError) enquiriesError.classList.remove('hidden');
      isValid = false;
    } else {
      if (enquiriesError) enquiriesError.classList.add('hidden');
    }

    // 8. Management Method (Radio)
    const managementMethod = form.querySelector('input[name="managementMethod"]:checked');
    const methodError = form.querySelector('.error-msg-method');
    if (!managementMethod) {
      if (methodError) methodError.classList.remove('hidden');
      isValid = false;
    } else {
      if (methodError) methodError.classList.add('hidden');
    }

    // 9. Biggest challenge (Textarea)
    const biggestChallenge = document.getElementById('biggestChallenge');
    const challengeValid = validateField(
      biggestChallenge, 
      biggestChallenge.parentElement.querySelector('.error-msg'), 
      biggestChallenge.value.trim().length >= 5
    );
    if (!challengeValid) isValid = false;

    // 10. Consider testing (Radio)
    const considerTesting = form.querySelector('input[name="considerTesting"]:checked');
    const testingError = form.querySelector('.error-msg-testing');
    if (!considerTesting) {
      if (testingError) testingError.classList.remove('hidden');
      isValid = false;
    } else {
      if (testingError) testingError.classList.add('hidden');
    }

    // Consent Checkbox (UNCHECKED by default, must be checked to proceed)
    const consent = document.getElementById('consentCheckbox');
    const consentError = form.querySelector('.error-msg-consent');
    if (!consent.checked) {
      if (consentError) consentError.classList.remove('hidden');
      isValid = false;
    } else {
      if (consentError) consentError.classList.add('hidden');
    }

    // If invalid, scroll to the first invalid field
    if (!isValid) {
      const firstError = form.querySelector('.input-error, .text-rose-500:not(.hidden)');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.LoopPulseAnalytics.track('form_validation_failed');
      return;
    }

    // ========================================================
    // BUILD SUBMISSION DATA OBJECT (CAMELCASE PROPERTIES)
    // ========================================================
    const payload = {
      referenceId: 'LP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      fullName: fullName.value.trim(),
      businessName: businessName.value.trim(),
      businessType: businessType.value,
      city: city.value.trim(),
      phone: '+91' + cleanPhone,
      email: document.getElementById('email').value.trim() || null,
      monthlyEnquiries: monthlyEnquiries.value,
      managementMethod: managementMethod.value,
      biggestChallenge: biggestChallenge.value.trim(),
      considerTesting: considerTesting.value,
      preferredContact: (form.querySelector('input[name="preferredContact"]:checked') || {}).value || 'WhatsApp',
      consent: true,
      submittedAt: new Date().toISOString()
    };

    // Prevent duplicate submissions and trigger UI loading state
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Submitting Responses...';
    submitSpinner.classList.remove('hidden');
    submitArrow.classList.add('hidden');
    if (submissionError) submissionError.classList.add('hidden');

    try {
      // POST to Supabase Edge Function
      const response = await fetch(CONFIG.SUPABASE_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify(payload)
      });

      let result;
      const responseText = await response.text();
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        result = { message: responseText };
      }

      if (!response.ok || (result && result.success === false)) {
        const errorMsg = (result && (result.error || result.message)) 
          ? (result.error || result.message) 
          : `Submission failed with status ${response.status}.`;
        throw new Error(errorMsg);
      }

      // Insertion confirmed by Supabase!
      const confirmedReferenceId = (result && result.referenceId) || payload.referenceId;

      // Persist confirmed submission to local client history
      try {
        const existing = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        existing.push({ 
          ...payload, 
          referenceId: confirmedReferenceId, 
          syncedAt: new Date().toISOString() 
        });
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(existing));
      } catch (storageErr) {
        console.warn('[LoopPulse] Local history save error:', storageErr);
      }

      // Trigger Analytics Conversion Event
      window.LoopPulseAnalytics.track('research_form_submitted', {
        industry: payload.businessType,
        monthly_volume: payload.monthlyEnquiries,
        testing_interest: payload.considerTesting,
        city: payload.city,
        reference_id: confirmedReferenceId
      });

      // Display Success State
      form.classList.add('hidden');
      if (responseRefId) responseRefId.textContent = confirmedReferenceId;
      if (successContainer) {
        successContainer.classList.remove('hidden');
        successContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

    } catch (error) {
      console.error('[LoopPulse] Supabase submission error:', error);
      
      // Display clear error notification and keep form interactive
      if (submissionError) {
        if (submissionErrorMessage) {
          submissionErrorMessage.textContent = error.message || 'Unable to connect to our server. Please check your connection and try again.';
        }
        submissionError.classList.remove('hidden');
        submissionError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(`Submission Error: ${error.message || 'Unable to submit your responses. Please try again.'}`);
      }

      window.LoopPulseAnalytics.track('research_form_submission_failed', {
        error: error.message
      });

    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtnText.textContent = 'Submit Research Response';
      submitSpinner.classList.add('hidden');
      submitArrow.classList.remove('hidden');
    }
  });

  // Reset Form for Testing
  if (resetFormBtn) {
    resetFormBtn.addEventListener('click', () => {
      form.reset();
      if (submissionError) submissionError.classList.add('hidden');
      form.classList.remove('hidden');
      successContainer.classList.add('hidden');
      form.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

// ========================================================
// 8. CTA EVENT TRACKING
// ========================================================
function initCtaTracking() {
  const trackedButtons = document.querySelectorAll('[data-analytics]');
  trackedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const actionName = btn.getAttribute('data-analytics');
      window.LoopPulseAnalytics.track('cta_clicked', {
        action: actionName,
        label: btn.innerText.trim(),
        target: btn.getAttribute('href') || 'button'
      });
    });
  });
}

// Global debug helper to inspect stored validation responses in browser console
window.getLoopPulseSubmissions = function() {
  const data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
  console.table(data);
  return data;
};
