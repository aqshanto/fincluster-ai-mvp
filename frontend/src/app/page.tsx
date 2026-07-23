import EvidenceSection from "@/components/landing/EvidenceSection";
import FinalCtaSection from "@/components/landing/FinalCtaSection";
import GapAnalysisSection from "@/components/landing/GapAnalysisSection";
import HeroSection from "@/components/landing/HeroSection";
import HumanReviewSection from "@/components/landing/HumanReviewSection";
import JudgeDemoSection from "@/components/landing/JudgeDemoSection";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingNav from "@/components/landing/LandingNav";
import LimitationsSection from "@/components/landing/LimitationsSection";
import ModelStrategySection from "@/components/landing/ModelStrategySection";
import RetrainingSection from "@/components/landing/RetrainingSection";
import SolutionSection from "@/components/landing/SolutionSection";
import WorkflowSection from "@/components/landing/WorkflowSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050b18] text-slate-100 selection:bg-blue-500/30 selection:text-white">
      <LandingNav />
      <main>
        <HeroSection />
        <GapAnalysisSection />
        <SolutionSection />
        <WorkflowSection />
        <ModelStrategySection />
        <HumanReviewSection />
        <RetrainingSection />
        <EvidenceSection />
        <JudgeDemoSection />
        <LimitationsSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
