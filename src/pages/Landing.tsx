import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Brain, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get personalized spending analysis, budget recommendations, and anomaly detection powered by AI.",
  },
  {
    icon: BarChart3,
    title: "Visual Analytics",
    description: "Interactive charts showing spending patterns, monthly trends, and savings projections.",
  },
  {
    icon: Shield,
    title: "GDPR Compliant",
    description: "Your financial data stays private with enterprise-grade security and European data protection.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First Design",
    description: "Track expenses on any device with a responsive, modern interface built for speed.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="font-display text-xl font-bold text-primary">FinCopilot</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth?tab=register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <div className="animate-fade-in">
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            🇪🇺 Europe-focused AI Finance
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your AI-Powered
            <br />
            <span className="text-primary">Finance Copilot</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Track expenses, categorize spending automatically, and get AI-driven budget recommendations.
            Built for privacy-conscious Europeans.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/auth?tab=register">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-12 text-center font-display text-3xl font-bold">
          Everything you need to master your finances
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} FinCopilot. Built with ❤️ for Europe.
      </footer>
    </div>
  );
}
