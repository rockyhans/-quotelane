import LeadFunnel from "@/components/LeadFunnel";
import { headers } from "next/headers";
import { Shield, Sparkles, CheckCircle, Award } from "lucide-react";

export default async function HomePage() {
  const headerList = await headers();
  const variantHeader = headerList.get("x-funnel-variant");
  const variant: "A" | "B" = variantHeader === "B" ? "B" : "A";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-gray-50 text-gray-900 selection:bg-blue-100 flex flex-col justify-between">
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
        </div>
      </header>

      <section className="flex-1 max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center w-full">
        <LeadFunnel variant={variant} />
      </section>

      <footer className="w-full border-t border-gray-200/80 bg-white py-5 text-center text-xs text-gray-500">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          <p>
            © {new Date().getFullYear()} QuoteLane. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
