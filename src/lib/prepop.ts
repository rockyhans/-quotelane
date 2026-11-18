/**
 * Prepop & Tracking Utilities
 * 
 * Handles URL parameter sanitization, macro rejection, format normalization,
 * and prefill extraction according to requirements:
 * - Macro rejection: {sub5}, [EMAIL], %%email%%, etc.
 * - Format cleanup: URL decode, trim, US phone normalization, ZIP verification
 * - Address bar sanitation: strips PII (name, email, phone) from URL in browser
 */

export interface LeadFormData {
  zip: string;
  vehicleYear: string;
  vehicleMake: string;
  insured: boolean | null;
  ageRange: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface TrackingParams {
  click_id?: string;
  aff_id?: string;
  channel?: string;
  [key: string]: string | undefined;
}

// Regex to detect unreplaced affiliate macros
const MACRO_REGEX = /^(\{[^{}]+\}|%[a-zA-Z0-9_]+%|%%[a-zA-Z0-9_]+%%|\[[a-zA-Z0-9_]+\])$/;

export function isMacro(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    MACRO_REGEX.test(trimmed) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("%%") ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

export function cleanString(val: unknown): string {
  if (typeof val !== "string") return "";
  try {
    const decoded = decodeURIComponent(val.replace(/\+/g, " "));
    return decoded.trim();
  } catch {
    return String(val).trim();
  }
}

// US ZIP validation: 5 digits, not 00000
export function validateZip(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean)) return null;
  const zipDigits = clean.replace(/\D/g, "");
  if (zipDigits.length === 5 && zipDigits !== "00000") {
    return zipDigits;
  }
  return null;
}

// Vehicle year validation: 1980 - (current year + 1)
export function validateVehicleYear(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean)) return null;
  const yearNum = parseInt(clean, 10);
  const currentYear = new Date().getFullYear();
  if (!isNaN(yearNum) && yearNum >= 1980 && yearNum <= currentYear + 1) {
    return String(yearNum);
  }
  return null;
}

// Vehicle make validation
export function validateVehicleMake(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean) || clean.length < 2) return null;
  return clean;
}

// Insured boolean validation
export function validateInsured(val: string): boolean | null {
  const clean = cleanString(val).toLowerCase();
  if (isMacro(clean)) return null;
  if (["yes", "true", "1", "y"].includes(clean)) return true;
  if (["no", "false", "0", "n"].includes(clean)) return false;
  return null;
}

// Age range validation
export const VALID_AGE_RANGES = [
  "18-24",
  "25-34",
  "35-49",
  "50-64",
  "65+",
];

export function validateAgeRange(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean)) return null;
  const found = VALID_AGE_RANGES.find(
    (range) => range.toLowerCase() === clean.toLowerCase()
  );
  return found || null;
}

// Email validation
export function validateEmail(val: string): string | null {
  const clean = cleanString(val).toLowerCase();
  if (isMacro(clean)) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (emailRegex.test(clean)) {
    return clean;
  }
  return null;
}

// US Phone validation: normalizes to 10-digit standard or (XXX) XXX-XXXX
export function validatePhone(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean)) return null;
  let digits = clean.replace(/\D/g, "");
  // Remove leading 1 if 11 digits
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  // Valid US numbers have 10 digits and cannot start area code or prefix with 0 or 1
  if (digits.length === 10 && digits[0] !== "0" && digits[0] !== "1") {
    return digits;
  }
  return null;
}

export function formatPhone(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Name validation
export function validateName(val: string): string | null {
  const clean = cleanString(val);
  if (isMacro(clean) || clean.length < 2) return null;
  // Basic name hygiene: check that it contains valid alphabetic characters
  if (/^[a-zA-Z\s'-]+$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Parses query params into valid initial form data and identifies prefilled fields
 */
export function extractPrepopData(searchParams: URLSearchParams | Record<string, string | undefined>) {
  const getParam = (key: string): string => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) || "";
    }
    return searchParams[key] || "";
  };

  const initialValues: Partial<LeadFormData> = {};
  const prefilledFields: string[] = [];

  // 1. ZIP
  const rawZip = getParam("zip");
  const validZip = validateZip(rawZip);
  if (validZip) {
    initialValues.zip = validZip;
    prefilledFields.push("zip");
  }

  // 2. Vehicle Year
  const rawYear = getParam("year") || getParam("vehicle_year");
  const validYear = validateVehicleYear(rawYear);
  if (validYear) {
    initialValues.vehicleYear = validYear;
    prefilledFields.push("vehicleYear");
  }

  // 3. Vehicle Make
  const rawMake = getParam("make") || getParam("vehicle_make");
  const validMake = validateVehicleMake(rawMake);
  if (validMake) {
    initialValues.vehicleMake = validMake;
    prefilledFields.push("vehicleMake");
  }

  // 4. Insured
  const rawInsured = getParam("insured");
  const validInsured = validateInsured(rawInsured);
  if (validInsured !== null) {
    initialValues.insured = validInsured;
    prefilledFields.push("insured");
  }

  // 5. Age Range
  const rawAge = getParam("age") || getParam("age_range");
  const validAge = validateAgeRange(rawAge);
  if (validAge) {
    initialValues.ageRange = validAge;
    prefilledFields.push("ageRange");
  }

  // 6. First Name
  const rawFirstName = getParam("first_name") || getParam("fname");
  const validFirstName = validateName(rawFirstName);
  if (validFirstName) {
    initialValues.firstName = validFirstName;
    prefilledFields.push("firstName");
  }

  // 7. Last Name
  const rawLastName = getParam("last_name") || getParam("lname");
  const validLastName = validateName(rawLastName);
  if (validLastName) {
    initialValues.lastName = validLastName;
    prefilledFields.push("lastName");
  }

  // 8. Email
  const rawEmail = getParam("email");
  const validEmail = validateEmail(rawEmail);
  if (validEmail) {
    initialValues.email = validEmail;
    prefilledFields.push("email");
  }

  // 9. Phone
  const rawPhone = getParam("phone");
  const validPhone = validatePhone(rawPhone);
  if (validPhone) {
    initialValues.phone = validPhone;
    prefilledFields.push("phone");
  }

  // Extract surviving tracking parameters (excluding PII)
  const tracking: TrackingParams = {};
  const piiKeys = new Set(["first_name", "fname", "last_name", "lname", "email", "phone"]);

  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((val, key) => {
      if (!piiKeys.has(key.toLowerCase()) && !isMacro(val)) {
        tracking[key] = cleanString(val);
      }
    });
  } else {
    for (const [key, val] of Object.entries(searchParams)) {
      if (val && !piiKeys.has(key.toLowerCase()) && !isMacro(val)) {
        tracking[key] = cleanString(val);
      }
    }
  }

  return {
    initialValues,
    prefilledFields,
    tracking,
  };
}

/**
 * Removes PII parameters from the browser URL without a page reload
 */
export function stripPiiFromAddressBar() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const piiKeys = [
      "first_name",
      "fname",
      "last_name",
      "lname",
      "email",
      "phone",
      "name",
    ];
    let changed = false;
    for (const key of piiKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch (err) {
    console.error("Failed to sanitize address bar PII:", err);
  }
}

