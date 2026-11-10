
/**
 * LoopPulse.in
 * Landing Page, Analytics and Research Inquiry Form
 * Production frontend candidate
 */

// ========================================================
// 1. CONFIGURATION
// ========================================================

const CONFIG = {
  SUPABASE_EDGE_FUNCTION_URL:
    "https://yscspgtyqetuyxikbvbo.supabase.co/functions/v1/research_inquiries",

  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_K6saD7zHFcRkVDCXLH0nMg_cSxq-F5o",

  TURNSTILE_SITE_KEY:
    "0x4AAAAAAF7Tsu8ebg5Nugmm",

  DEBUG_ANALYTICS: false,
};

// ========================================================
// 2. ANALYTICS
// ========================================================

window.LoopPulseAnalytics = {
  track(eventName, properties = {}) {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || "direct",
      ...properties,
    };

    if (CONFIG.DEBUG_ANALYTICS) {
      console.log("[LoopPulse Analytics]", payload);
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, properties);
    }

    if (typeof window.fbq === "function") {
      window.fbq("trackCustom", eventName, properties);
    }
  },
};

// ========================================================
// 3. INITIALIZATION
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  initIndustrySelector();
  initFaqAccordion();
  initPrivacyModal();
  initFormEngine();
  initCtaTracking();
});

// ========================================================
// 4. INDUSTRY SELECTOR
// ========================================================

function initIndustrySelector() {
  const cards = document.querySelectorAll(
    ".industry-select-card"
  );

  const businessTypeSelect =
    document.getElementById("businessType");

  const industryBanner =
    document.getElementById("industry-banner");

  const selectedIndustryLabel =
    document.getElementById("selected-industry-label");

  const clearIndustryBtn =
    document.getElementById("clear-industry-btn");

  function updateCards(selected) {
    cards.forEach((card) => {
      const active =
        card.getAttribute("data-industry") === selected;

      card.classList.toggle(
        "active-industry",
        active
      );

      const indicator =
        card.querySelector(".select-indicator");

      if (indicator) {
        indicator.textContent =
          active ? "Selected ✓" : "Select";
      }
    });
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const industry =
        card.getAttribute("data-industry");

      updateCards(industry);

      if (businessTypeSelect) {
        businessTypeSelect.value = industry;
      }

      if (industryBanner && selectedIndustryLabel) {
        selectedIndustryLabel.textContent = industry;
        industryBanner.classList.remove("hidden");
      }

      window.LoopPulseAnalytics.track(
        "industry_selected",
        {
          industry,
          source: "who_is_this_for_grid",
        }
      );

      const formSection =
        document.getElementById("research-form");

      if (formSection) {
        formSection.scrollIntoView({
          behavior: "smooth",
        });

        setTimeout(() => {
          const fullName =
            document.getElementById("fullName");

          if (fullName) fullName.focus();
        }, 500);
      }
    });
  });

  if (clearIndustryBtn) {
    clearIndustryBtn.addEventListener("click", () => {
      updateCards("");

      if (businessTypeSelect) {
        businessTypeSelect.value = "";
      }

      if (industryBanner) {
        industryBanner.classList.add("hidden");
      }

      const section =
        document.getElementById("who-is-this-for");

      if (section) {
        section.scrollIntoView({
          behavior: "smooth",
        });
      }
    });
  }

  if (businessTypeSelect) {
    businessTypeSelect.addEventListener(
      "change",
      () => {
        const selected = businessTypeSelect.value;

        updateCards(selected);

        if (industryBanner && selectedIndustryLabel) {
          selectedIndustryLabel.textContent = selected;
          industryBanner.classList.remove("hidden");
        }
      }
    );
  }
}

// ========================================================
// 5. FAQ ACCORDION
// ========================================================

function initFaqAccordion() {
  const toggles =
    document.querySelectorAll(".faq-toggle");

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const expanded =
        toggle.getAttribute("aria-expanded") === "true";

      toggles.forEach((other) => {
        const contentId =
          other.getAttribute("aria-controls");

        const content =
          document.getElementById(contentId);

        const icon =
          other.querySelector(".faq-icon");

        other.setAttribute(
          "aria-expanded",
          "false"
        );

        if (content) content.classList.add("hidden");
        if (icon) icon.classList.remove("rotate-180");
      });

      if (!expanded) {
        toggle.setAttribute(
          "aria-expanded",
          "true"
        );

        const content =
          document.getElementById(
            toggle.getAttribute("aria-controls")
          );

        const icon =
          toggle.querySelector(".faq-icon");

        if (content) {
          content.classList.remove("hidden");
        }

        if (icon) {
          icon.classList.add("rotate-180");
        }

        window.LoopPulseAnalytics.track(
          "faq_opened",
          {
            question: toggle.innerText.trim(),
          }
        );
      }
    });
  });
}

// ========================================================
// 6. PRIVACY MODAL
// ========================================================

function initPrivacyModal() {
  const modal =
    document.getElementById("privacyModal");

  const openBtn =
    document.getElementById("openPrivacyModalBtn");

  const closeBtn =
    document.getElementById("closePrivacyModalBtn");

  const closeBottomBtn =
    document.getElementById(
      "closePrivacyModalBottomBtn"
    );

  function openModal() {
    if (!modal) return;

    modal.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");

    window.LoopPulseAnalytics.track(
      "privacy_modal_opened"
    );
  }

  function closeModal() {
    if (!modal) return;

    modal.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  }

  if (openBtn) {
    openBtn.addEventListener("click", openModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  if (closeBottomBtn) {
    closeBottomBtn.addEventListener(
      "click",
      closeModal
    );
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

// ========================================================
// 7. CLOUDFLARE TURNSTILE
// ========================================================

let turnstileWidgetId = null;
let turnstileRenderAttempts = 0;

function showTurnstileError(show = true) {
  const error =
    document.getElementById("turnstileError");

  if (error) {
    error.classList.toggle("hidden", !show);
  }
}

function renderTurnstile() {
  const container =
    document.getElementById("turnstileWidget");

  if (!container) {
    console.error(
      "[LoopPulse] Turnstile container missing."
    );
    return;
  }

  if (turnstileWidgetId !== null) {
    return;
  }

  if (
    typeof window.turnstile === "undefined"
  ) {
    turnstileRenderAttempts++;

    if (turnstileRenderAttempts <= 30) {
      setTimeout(renderTurnstile, 300);
    } else {
      console.error(
        "[LoopPulse] Turnstile failed to load."
      );

      showTurnstileError(true);
    }

    return;
  }

  try {
    turnstileWidgetId = window.turnstile.render(
      "#turnstileWidget",
      {
        sitekey: CONFIG.TURNSTILE_SITE_KEY,
        theme: "light",

        callback() {
          showTurnstileError(false);
        },

        "error-callback"() {
          showTurnstileError(true);

          console.warn(
            "[LoopPulse] Turnstile verification error."
          );
        },

        "expired-callback"() {
          showTurnstileError(true);
        },

        "timeout-callback"() {
          showTurnstileError(true);
        },
      }
    );
  } catch (error) {
    console.error(
      "[LoopPulse] Turnstile render error:",
      error
    );

    showTurnstileError(true);
  }
}

function getTurnstileToken() {
  if (
    typeof window.turnstile === "undefined" ||
    turnstileWidgetId === null
  ) {
    return "";
  }

  try {
    return (
      window.turnstile.getResponse(
        turnstileWidgetId
      ) || ""
    );
  } catch (error) {
    console.warn(
      "[LoopPulse] Cannot retrieve Turnstile token:",
      error
    );

    return "";
  }
}

function resetTurnstile() {
  if (
    typeof window.turnstile === "undefined" ||
    turnstileWidgetId === null
  ) {
    return;
  }

  try {
    window.turnstile.reset(
      turnstileWidgetId
    );
  } catch (error) {
    console.warn(
      "[LoopPulse] Turnstile reset error:",
      error
    );
  }
}

// ========================================================
// 8. FORM ENGINE
// ========================================================

function initFormEngine() {
  const form =
    document.getElementById("marketResearchForm");

  if (!form) return;

  const submitBtn =
    document.getElementById("submitBtn");

  const submitBtnText =
    document.getElementById("submitBtnText");

  const submitSpinner =
    document.getElementById("submitSpinner");

  const submitArrow =
    document.getElementById("submitArrow");

  const successContainer =
    document.getElementById("submissionSuccess");

  const responseRefId =
    document.getElementById("responseRefId");

  const resetFormBtn =
    document.getElementById("resetFormBtn");

  const submissionError =
    document.getElementById("submissionError");

  const submissionErrorMessage =
    document.getElementById(
      "submissionErrorMessage"
    );

  let isSubmitting = false;
  let formStarted = false;

  // Reuse reference ID after uncertain network errors.
  // The backend must enforce uniqueness/idempotency.
  let pendingReferenceId = null;

  renderTurnstile();

  form.addEventListener("focusin", () => {
    if (!formStarted) {
      formStarted = true;

      window.LoopPulseAnalytics.track(
        "form_interaction_started"
      );
    }
  });

  function validateField(
    input,
    errorElement,
    condition
  ) {
    if (!input) return false;

    input.classList.toggle(
      "input-error",
      !condition
    );

    if (errorElement) {
      errorElement.classList.toggle(
        "hidden",
        condition
      );
    }

    return condition;
  }

  function fieldError(input) {
    return input?.parentElement?.querySelector(
      ".error-msg"
    );
  }

  function showError(message) {
    if (submissionErrorMessage) {
      submissionErrorMessage.textContent = message;
    }

    if (submissionError) {
      submissionError.classList.remove("hidden");

      submissionError.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else {
      alert(message);
    }
  }

  function setSubmitting(value) {
    isSubmitting = value;

    if (submitBtn) {
      submitBtn.disabled = value;
    }

    if (submitBtnText) {
      submitBtnText.textContent = value
        ? "Submitting Responses..."
        : "Submit Research Response";
    }

    if (submitSpinner) {
      submitSpinner.classList.toggle(
        "hidden",
        !value
      );
    }

    if (submitArrow) {
      submitArrow.classList.toggle(
        "hidden",
        value
      );
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Prevent repeated clicks while request is running.
    if (isSubmitting) return;

    let isValid = true;

    // ----------------------------------------------------
    // Field validation
    // ----------------------------------------------------

    const fullName =
      document.getElementById("fullName");

    const businessName =
      document.getElementById("businessName");

    const businessType =
      document.getElementById("businessType");

    const city =
      document.getElementById("city");

    const phone =
      document.getElementById("phone");

    const email =
      document.getElementById("email");

    const biggestChallenge =
      document.getElementById("biggestChallenge");

    const consent =
      document.getElementById("consentCheckbox");

    if (
      !fullName ||
      !businessName ||
      !businessType ||
      !city ||
      !phone ||
      !email ||
      !biggestChallenge ||
      !consent
    ) {
      showError(
        "The form is not configured correctly. Please refresh the page."
      );
      return;
    }

    const nameValue = fullName.value.trim();

    if (
      !validateField(
        fullName,
        fieldError(fullName),
        nameValue.length >= 2 &&
          nameValue.length <= 100
      )
    ) {
      isValid = false;
    }

    const businessValue =
      businessName.value.trim();

    if (
      !validateField(
        businessName,
        fieldError(businessName),
        businessValue.length >= 2 &&
          businessValue.length <= 100
      )
    ) {
      isValid = false;
    }

    if (
      !validateField(
        businessType,
        fieldError(businessType),
        businessType.value !== ""
      )
    ) {
      isValid = false;
    }

    const cityValue = city.value.trim();

    if (
      !validateField(
        city,
        fieldError(city),
        cityValue.length >= 2 &&
          cityValue.length <= 100
      )
    ) {
      isValid = false;
    }

    const rawPhone = phone.value.trim();

    const phonePattern =
      /^(?:(?:\+91|0)[-\s]?)?[6-9]\d{4}[-\s]?\d{5}$/;

    if (
      !validateField(
        phone,
        phone.parentElement?.parentElement?.querySelector(
          ".error-msg"
        ),
        phonePattern.test(rawPhone)
      )
    ) {
      isValid = false;
    }

    const emailValue = email.value.trim();

    if (
      emailValue &&
      (
        emailValue.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          emailValue
        )
      )
    ) {
      isValid = false;
      email.classList.add("input-error");
    } else {
      email.classList.remove("input-error");
    }

    const monthlyEnquiries = form.querySelector(
      'input[name="monthlyEnquiries"]:checked'
    );

    const enquiriesError = form.querySelector(
      ".error-msg-enquiries"
    );

    if (!monthlyEnquiries) {
      isValid = false;
      enquiriesError?.classList.remove("hidden");
    } else {
      enquiriesError?.classList.add("hidden");
    }

    const managementMethod = form.querySelector(
      'input[name="managementMethod"]:checked'
    );

    const methodError = form.querySelector(
      ".error-msg-method"
    );

    if (!managementMethod) {
      isValid = false;
      methodError?.classList.remove("hidden");
    } else {
      methodError?.classList.add("hidden");
    }

    const challengeValue =
      biggestChallenge.value.trim();

    if (
      !validateField(
        biggestChallenge,
        fieldError(biggestChallenge),
        challengeValue.length >= 5 &&
          challengeValue.length <= 1000
      )
    ) {
      isValid = false;
    }

    const considerTesting = form.querySelector(
      'input[name="considerTesting"]:checked'
    );

    const testingError = form.querySelector(
      ".error-msg-testing"
    );

    if (!considerTesting) {
      isValid = false;
      testingError?.classList.remove("hidden");
    } else {
      testingError?.classList.add("hidden");
    }

    const consentError = form.querySelector(
      ".error-msg-consent"
    );

    if (!consent.checked) {
      isValid = false;
      consentError?.classList.remove("hidden");
    } else {
      consentError?.classList.add("hidden");
    }

    // ----------------------------------------------------
    // Mandatory Turnstile validation
    // ----------------------------------------------------

    const turnstileToken = getTurnstileToken();

    if (!turnstileToken) {
      isValid = false;
      showTurnstileError(true);
    } else {
      showTurnstileError(false);
    }

    if (!isValid) {
      const firstError = form.querySelector(
        ".input-error, .text-rose-500:not(.hidden)"
      );

      if (firstError) {
        firstError.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else {
        showError(
          "Please complete all required fields and security verification."
        );
      }

      window.LoopPulseAnalytics.track(
        "form_validation_failed"
      );

      return;
    }

    // ----------------------------------------------------
    // Prepare payload
    // ----------------------------------------------------

    if (!pendingReferenceId) {
      pendingReferenceId =
        "LP-" +
        crypto.randomUUID()
          .replace(/-/g, "")
          .slice(0, 12)
          .toUpperCase();
    }

    const payload = {
      referenceId: pendingReferenceId,
      fullName: nameValue,
      businessName: businessValue,
      businessType: businessType.value,
      city: cityValue,
      phone:
        "+91" +
        rawPhone.replace(/\D/g, "").slice(-10),
      email: emailValue || null,
      monthlyEnquiries: monthlyEnquiries.value,
      managementMethod: managementMethod.value,
      biggestChallenge: challengeValue,
      considerTesting: considerTesting.value,
      preferredContact:
        form.querySelector(
          'input[name="preferredContact"]:checked'
        )?.value || "WhatsApp",
      consent: true,
      cfTurnstileToken: turnstileToken,
    };

    setSubmitting(true);

    if (submissionError) {
      submissionError.classList.add("hidden");
    }

    // ----------------------------------------------------
    // Submit to Supabase
    // ----------------------------------------------------

    try {
      const response = await fetch(
        CONFIG.SUPABASE_EDGE_FUNCTION_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Unable to confirm submission. Please contact us before submitting again."
        );
      }

      if (
        !response.ok ||
        result?.success !== true ||
        typeof result.referenceId !== "string"
      ) {
        let message =
          "Unable to submit your responses. Please try again.";

        if (response.status === 403) {
          message =
            "Security verification failed. Please complete the challenge again.";
        } else if (response.status === 413) {
          message =
            "Your submission is too large. Please shorten your answers.";
        } else if (response.status === 429) {
          message =
            "Too many attempts. Please wait before trying again.";
        } else if (response.status >= 500) {
          message =
            "Server unavailable. Please try again later.";
        } else if (
          typeof result?.error === "string"
        ) {
          message = result.error;
        }

        throw new Error(message);
      }

      // --------------------------------------------------
      // Confirmed success
      // --------------------------------------------------

      const confirmedReferenceId =
        result.referenceId;

      pendingReferenceId = null;

      // No customer PII or CAPTCHA tokens stored locally.

      window.LoopPulseAnalytics.track(
        "research_form_submitted",
        {
          industry: payload.businessType,
          monthly_volume: payload.monthlyEnquiries,
          testing_interest: payload.considerTesting,
          city: payload.city,
          reference_id: confirmedReferenceId,
        }
      );

      form.classList.add("hidden");

      if (responseRefId) {
        responseRefId.textContent =
          confirmedReferenceId;
      }

      if (successContainer) {
        successContainer.classList.remove("hidden");

        successContainer.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    } catch (error) {
      console.error(
        "[LoopPulse] Submission error:",
        error
      );

      resetTurnstile();

      showError(
        error?.message ||
          "Unable to connect to the server. Please try again later."
      );

      window.LoopPulseAnalytics.track(
        "research_form_submission_failed",
        {
          error: error?.message || "Unknown error",
        }
      );
    } finally {
      setSubmitting(false);
    }
  });

  // ======================================================
  // RESET FORM
  // ======================================================

  if (resetFormBtn) {
    resetFormBtn.addEventListener("click", () => {
      form.reset();

      pendingReferenceId = null;
      formStarted = false;

      if (submissionError) {
        submissionError.classList.add("hidden");
      }

      showTurnstileError(false);
      resetTurnstile();

      form.classList.remove("hidden");

      if (successContainer) {
        successContainer.classList.add("hidden");
      }

      form.scrollIntoView({
        behavior: "smooth",
      });
    });
  }
}

// ========================================================
// 9. CTA TRACKING
// ========================================================

function initCtaTracking() {
  const buttons =
    document.querySelectorAll("[data-analytics]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      window.LoopPulseAnalytics.track(
        "cta_clicked",
        {
          action:
            button.getAttribute("data-analytics"),
          label: button.innerText.trim(),
          target:
            button.getAttribute("href") ||
            "button",
        }
      );
    });
  });
}

// ========================================================
// END OF FILE
// ========================================================
