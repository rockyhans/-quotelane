import LeadFunnel from "@/components/LeadFunnel";
import { headers } from "next/headers";
import { Shield, Sparkles, CheckCircle, Award } from "lucide-react";

export default async function HomePage() {
  const headerList = await headers();
  // Read variant set by middleware ('A' or 'B', defaults to 'A')
  const variantHeader = headerList.get("x-funnel-variant");
  const variant: "A" | "B" = variantHeader === "B" ? "B" : "A";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-gray-50 text-gray-900 selection:bg-blue-100 flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="w-full border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
              Q
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-gray-900 leading-none">
                Quote<span className="text-blue-600">Lane</span>
              </span>
              <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                AUTO INSURANCE SAVINGS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-3 py-1.5 rounded-full">
            <Shield className="w-3.5 h-3.5" />
            <span>Official Carrier Network</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Funnel Container */}
      <section className="flex-1 max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center w-full">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100/60 text-blue-700 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Compare top carriers in 2 minutes</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
            Save Up To <span className="text-blue-600">$610/Year</span> On Auto Insurance
          </h1>
          <p className="mt-3 text-base md:text-lg text-gray-600">
            Free, no-hassle comparison from the nation&apos;s leading insurance providers.
          </p>
        </div>

        {/* Lead Funnel Component */}
        <LeadFunnel variant={variant} />

        {/* Social Proof Badges */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full text-center">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <CheckCircle className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
            <div className="font-bold text-gray-900 text-sm">Free Quotes</div>
            <div className="text-xs text-gray-500">100% complimentary</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <Shield className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
            <div className="font-bold text-gray-900 text-sm">Secure & Private</div>
            <div className="text-xs text-gray-500">Bank-level encryption</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <Award className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
            <div className="font-bold text-gray-900 text-sm">Top Rated</div>
            <div className="text-xs text-gray-500">Over 250k matches</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <Sparkles className="w-5 h-5 text-purple-600 mx-auto mb-1.5" />
            <div className="font-bold text-gray-900 text-sm">Instant Savings</div>
            <div className="text-xs text-gray-500">Direct carrier rates</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200/80 bg-white py-8 text-center text-xs text-gray-500 mt-12">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          <p>
            © {new Date().getFullYear()} QuoteLane. All rights reserved. QuoteLane is an independent lead generation service connecting consumers with insurance carriers and licensed agents.
          </p>
          <p className="text-[11px] text-gray-400">
            Privacy Policy | Terms of Service | Contact Us | Do Not Sell My Personal Information
          </p>
        </div>
      </footer>
    </main>
  );
}
