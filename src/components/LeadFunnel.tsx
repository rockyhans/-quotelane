"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LeadFormData,
  extractPrepopData,
  stripPiiFromAddressBar,
  validateZip,
  validateVehicleYear,
  validateVehicleMake,
  validateInsured,
  validateAgeRange,
  validateEmail,
  validatePhone,
  validateName,
  formatPhone,
  VALID_AGE_RANGES,
} from "@/lib/prepop";
import { MANDATORY_CONSENT_TEXT } from "@/lib/constants";
import {
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Car,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface FunnelProps {
  variant: "A" | "B";
}

const POPULAR_MAKES = [
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "Nissan",
  "Hyundai",
  "Jeep",
  "Subaru",
  "BMW",
  "Mercedes-Benz",
  "Other",
];

export default function LeadFunnel({ variant }: FunnelProps) {
  const stepsOrder = useMemo(() => {
    if (variant === "B") {
      return ["zip", "insured", "contact"];
    }
    return ["zip", "year", "make", "insured", "age", "contact"];
  }, [variant]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<LeadFormData>({
    zip: "",
    vehicleYear: "",
    vehicleMake: "",
    insured: null,
    ageRange: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [prefilledFields, setPrefilledFields] = useState<string[]>([]);
  const [trackingParams, setTrackingParams] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [customMakeInput, setCustomMakeInput] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const { initialValues, prefilledFields: prepopFields, tracking } = extractPrepopData(urlParams);

    setPrefilledFields(prepopFields);
    setTrackingParams(tracking as Record<string, string>);

    setFormData((prev) => ({
      ...prev,
      ...initialValues,
    }));

    stripPiiFromAddressBar();

    const stepsToCheck = stepsOrder.slice(0, stepsOrder.length - 1);
    const isStepAnswered = (step: string): boolean => {
      switch (step) {
        case "zip":
          return !!initialValues.zip;
        case "year":
          return !!initialValues.vehicleYear;
        case "make":
          return !!initialValues.vehicleMake;
        case "insured":
          return initialValues.insured !== undefined && initialValues.insured !== null;
        case "age":
          return !!initialValues.ageRange;
        default:
          return false;
      }
    };

    let firstUnansweredIndex = stepsToCheck.findIndex((step) => !isStepAnswered(step));
    if (firstUnansweredIndex === -1) {
      setCurrentStepIndex(stepsOrder.indexOf("contact"));
    } else {
      setCurrentStepIndex(firstUnansweredIndex);
    }
  }, [stepsOrder]);

  const currentStep = stepsOrder[currentStepIndex] || "zip";

  const handleNext = () => {
    setErrors({});
    setSubmitError(null);

    let stepError: string | null = null;

    if (currentStep === "zip") {
      if (!validateZip(formData.zip)) {
        stepError = "Please enter a valid 5-digit US ZIP code.";
      }
    } else if (currentStep === "year") {
      if (!validateVehicleYear(formData.vehicleYear)) {
        stepError = "Please enter or select a valid vehicle year (1980 - present).";
      }
    } else if (currentStep === "make") {
      if (!validateVehicleMake(formData.vehicleMake)) {
        stepError = "Please select or type your vehicle make.";
      }
    } else if (currentStep === "insured") {
      if (formData.insured === null || formData.insured === undefined) {
        stepError = "Please select whether you currently have auto insurance.";
      }
    } else if (currentStep === "age") {
      if (!validateAgeRange(formData.ageRange)) {
        stepError = "Please select your age range.";
      }
    }

    if (stepError) {
      setErrors({ [currentStep]: stepError });
      return;
    }

    if (currentStepIndex < stepsOrder.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Submission handler
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const stepErrors: Record<string, string> = {};
    if (!validateName(formData.firstName)) {
      stepErrors.firstName = "Please enter your first name.";
    }
    if (!validateName(formData.lastName)) {
      stepErrors.lastName = "Please enter your last name.";
    }
    if (!validateEmail(formData.email)) {
      stepErrors.email = "Please enter a valid email address.";
    }
    if (!validatePhone(formData.phone)) {
      stepErrors.phone = "Please enter a valid 10-digit US phone number.";
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variant,
          zip: formData.zip,
          vehicleYear: formData.vehicleYear,
          vehicleMake: formData.vehicleMake,
          insured: formData.insured,
          ageRange: formData.ageRange,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          prefilledFields,
          consentText: MANDATORY_CONSENT_TEXT,
          tracking: trackingParams,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setSubmitError(
            "It looks like you've already requested a quote with this email or phone number in the last 24 hours. Our specialists are already processing your match!"
          );
        } else {
          setSubmitError(
            data.error || "There was an issue processing your request. Please check your information and try again."
          );
        }
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
    } catch {
      setSubmitError("Network error. Please verify your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = Math.round(
    ((currentStepIndex + 1) / stepsOrder.length) * 100
  );

  if (isSubmitted) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-12 text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
          Quotes Are On The Way!
        </h2>
        <p className="text-lg text-gray-600 mb-6 leading-relaxed">
          Thank you, <span className="font-semibold text-gray-900">{formData.firstName}</span>. We matched your profile with top auto insurance carriers in{" "}
          <span className="font-semibold text-blue-600">{formData.zip}</span>.
        </p>
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-6 text-left mb-8 shadow-sm">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            What happens next?
          </h3>
          <ul className="space-y-2.5 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">•</span>
              A licensed partner will contact you shortly at{" "}
              <span className="font-semibold">{formatPhone(formData.phone)}</span>.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">•</span>
              Your confirmation details were dispatched to{" "}
              <span className="font-semibold">{formData.email}</span>.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">•</span>
              Compare your rate options with zero obligation to buy.
            </li>
          </ul>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 underline underline-offset-4"
        >
          Start a new search
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300">
      <div className="bg-gray-50/80 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <span>
            Step {currentStepIndex + 1} of {stepsOrder.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="p-6 md:p-8">
        {currentStepIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        {currentStep === "zip" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Enter your ZIP Code
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Rates vary by location. Enter your ZIP to view localized savings.
              </p>
            </div>

            <div>
              <label htmlFor="zipInput" className="block text-sm font-semibold text-gray-700 mb-2">
                5-Digit ZIP Code
              </label>
              <input
                id="zipInput"
                type="text"
                maxLength={5}
                placeholder="e.g. 90210"
                value={formData.zip}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, zip: val });
                }}
                className={`w-full px-4 py-3.5 text-lg font-medium tracking-widest text-center border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${errors.zip ? "border-red-500 bg-red-50/30" : "border-gray-200"
                  }`}
                autoFocus
              />
              {errors.zip && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.zip}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              Continue <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {currentStep === "year" && (
          <div className="space-y-6 animate-fade-in">
            <div>

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                What year is your primary vehicle?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Newer models may qualify for built-in safety discounts.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[2025, 2024, 2023, 2022, 2021, 2020].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, vehicleYear: String(yr) });
                    setCurrentStepIndex((prev) => prev + 1);
                  }}
                  className={`py-3 px-3 text-base font-semibold rounded-xl border transition-all cursor-pointer ${formData.vehicleYear === String(yr)
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-blue-300 text-gray-800 bg-gray-50/50"
                    }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="otherYearInput" className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Or enter another year (1980 - present)
              </label>
              <input
                id="otherYearInput"
                type="text"
                maxLength={4}
                placeholder="e.g. 2018"
                value={formData.vehicleYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, vehicleYear: val });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
              />
              {errors.year && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.year}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              Next <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {currentStep === "make" && (
          <div className="space-y-6 animate-fade-in">
            <div>

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Select your vehicle make
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose from the popular makes or type yours below.
              </p>
            </div>

            {!customMakeInput ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {POPULAR_MAKES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m === "Other") {
                        setCustomMakeInput(true);
                      } else {
                        setFormData({ ...formData, vehicleMake: m });
                        setCurrentStepIndex((prev) => prev + 1);
                      }
                    }}
                    className={`py-3 px-3 text-sm font-semibold rounded-xl border transition-all text-center cursor-pointer ${formData.vehicleMake === m
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-gray-200 hover:border-blue-300 text-gray-800 bg-gray-50/50"
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="customMakeInput" className="block text-sm font-semibold text-gray-700">
                  Type your Vehicle Make
                </label>
                <input
                  id="customMakeInput"
                  type="text"
                  placeholder="e.g. Audi, Kia, Mazda"
                  value={formData.vehicleMake}
                  onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setCustomMakeInput(false)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ← Select from popular makes list
                </button>
              </div>
            )}

            {errors.make && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.make}
              </p>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              Next <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {currentStep === "insured" && (
          <div className="space-y-6 animate-fade-in">
            <div>

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Are you currently insured?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Drivers with continuous coverage often unlock preferred rates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, insured: true });
                  setCurrentStepIndex((prev) => prev + 1);
                }}
                className={`py-6 px-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${formData.insured === true
                  ? "border-blue-600 bg-blue-50/70 text-blue-800 shadow-md"
                  : "border-gray-200 hover:border-blue-300 text-gray-800 bg-gray-50/50"
                  }`}
              >
                <span className="block text-xl font-bold mb-1">Yes</span>
                <span className="text-xs text-gray-500">I have current auto insurance</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, insured: false });
                  setCurrentStepIndex((prev) => prev + 1);
                }}
                className={`py-6 px-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${formData.insured === false
                  ? "border-blue-600 bg-blue-50/70 text-blue-800 shadow-md"
                  : "border-gray-200 hover:border-blue-300 text-gray-800 bg-gray-50/50"
                  }`}
              >
                <span className="block text-xl font-bold mb-1">No</span>
                <span className="text-xs text-gray-500">Not insured at this time</span>
              </button>
            </div>

            {errors.insured && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.insured}
              </p>
            )}
          </div>
        )}

        {currentStep === "age" && (
          <div className="space-y-6 animate-fade-in">
            <div>

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Select your age range
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Helps determine qualified state-approved tier discounts.
              </p>
            </div>

            <div className="space-y-2.5">
              {VALID_AGE_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, ageRange: range });
                    setCurrentStepIndex((prev) => prev + 1);
                  }}
                  className={`w-full py-3.5 px-5 rounded-xl border text-left font-semibold transition-all flex items-center justify-between cursor-pointer ${formData.ageRange === range
                    ? "border-blue-600 bg-blue-50 text-blue-800 shadow-sm"
                    : "border-gray-200 hover:border-blue-300 text-gray-800 bg-gray-50/40"
                    }`}
                >
                  <span>{range} years old</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>

            {errors.age && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.age}
              </p>
            )}
          </div>
        )}

        {currentStep === "contact" && (
          <form onSubmit={handleSubmitLead} className="space-y-5 animate-fade-in">
            <div>

              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Where should we send your quotes?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter your details to receive matching rates instantly.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstNameInput" className="block text-xs font-semibold text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  id="firstNameInput"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.firstName ? "border-red-500 bg-red-50/30" : "border-gray-200"
                    }`}
                />
                {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="lastNameInput" className="block text-xs font-semibold text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  id="lastNameInput"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.lastName ? "border-red-500 bg-red-50/30" : "border-gray-200"
                    }`}
                />
                {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="emailInput" className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="emailInput"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.email ? "border-red-500 bg-red-50/30" : "border-gray-200"
                    }`}
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="phoneInput" className="block text-xs font-semibold text-gray-700 mb-1">
                US Phone Number
              </label>
              <div className="relative">
                <input
                  id="phoneInput"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, phone: raw });
                  }}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.phone ? "border-red-500 bg-red-50/30" : "border-gray-200"
                    }`}
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>

            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 text-xs text-gray-600 leading-relaxed">
              <p>{MANDATORY_CONSENT_TEXT}</p>
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-75 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Finding Quotes...
                </>
              ) : (
                <>Get My Quotes</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

