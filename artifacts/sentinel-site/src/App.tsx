import React, { useEffect, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { AnimatePresence, m, useReducedMotion, LazyMotion, domAnimation } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Lazy load pages for bundle splitting
const Home = React.lazy(() => import("@/pages/Home"));
const Features = React.lazy(() => import("@/pages/Features"));
const HowItWorks = React.lazy(() => import("@/pages/HowItWorks"));
const WhatItMonitors = React.lazy(() => import("@/pages/WhatItMonitors"));
const FAQ = React.lazy(() => import("@/pages/FAQ"));
const Waitlist = React.lazy(() => import("@/pages/Waitlist"));
const HealthTest = React.lazy(() => import("@/pages/HealthTest"));
const SampleReport = React.lazy(() => import("@/pages/SampleReport"));
const WhySentinel = React.lazy(() => import("@/pages/WhySentinel"));
const Compare = React.lazy(() => import("@/pages/Compare"));
const Pricing = React.lazy(() => import("@/pages/Pricing"));
const OEMFailures = React.lazy(() => import("@/pages/OEMFailures"));
const HabitAudit = React.lazy(() => import("@/pages/HabitAudit"));
const RiskCalculator = React.lazy(() => import("@/pages/RiskCalculator"));
const Report = React.lazy(() => import("@/pages/Report"));
const MyReports = React.lazy(() => import("@/pages/MyReports"));
const Troubleshoot = React.lazy(() => import("@/pages/Troubleshoot"));
const GetStarted = React.lazy(() => import("@/pages/GetStarted"));
const Pair = React.lazy(() => import("@/pages/Pair"));
const Scoring = React.lazy(() => import("@/pages/Scoring"));
const Changelog = React.lazy(() => import("@/pages/Changelog"));
const SharedReport = React.lazy(() => import("@/pages/SharedReport"));
const BillingSettings = React.lazy(() => import("@/pages/BillingSettings"));
const LiveDashboard = React.lazy(() => import("@/pages/LiveDashboard"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const [location] = useLocation();
  const reducedMotion = useReducedMotion();

  // Navigation should feel intentional: start each page at the top (unless using an anchor).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  /** Smooth ease-out that matches the site's motion language */
  const PAGE_TRANSITION = reducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 18, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -10, filter: "blur(4px)" },
        transition: { duration: 0.34, ease: [0.21, 0.47, 0.32, 0.98] as const },
      };

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={location}
        {...PAGE_TRANSITION}
        // Ensure the motion div doesn't constrain layout
        style={{ willChange: "opacity, transform" }}
      >
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>}>
          <Switch>
            <Route path="/"                component={Home} />
            <Route path="/features"        component={Features} />
            <Route path="/how-it-works"    component={HowItWorks} />
            <Route path="/what-it-monitors"component={WhatItMonitors} />
            <Route path="/faq"             component={FAQ} />
            <Route path="/waitlist"        component={Waitlist} />
            <Route path="/health-test"     component={HealthTest} />
            <Route path="/dashboard">
              <Redirect to="/my-reports" />
            </Route>
            <Route path="/sample-report"   component={SampleReport} />
            <Route path="/why"             component={WhySentinel} />
            <Route path="/compare"         component={Compare} />
            <Route path="/pricing"         component={Pricing} />
            <Route path="/oem-failures"    component={OEMFailures} />
            <Route path="/habit-audit"     component={HabitAudit} />
            <Route path="/risk-calculator" component={RiskCalculator} />
            <Route path="/troubleshoot"    component={Troubleshoot} />
            <Route path="/r/:id"           component={Report} />
            <Route path="/s/:shareToken"   component={SharedReport} />
            <Route path="/my-reports"      component={MyReports} />
            <Route path="/get-started"     component={GetStarted} />
            <Route path="/pair"            component={Pair} />
            <Route path="/scoring"         component={Scoring} />
            <Route path="/changelog"       component={Changelog} />
            <Route path="/billing"         component={BillingSettings} />
            <Route path="/live"            component={LiveDashboard} />
            <Route                         component={NotFound} />
          </Switch>
        </Suspense>
      </m.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <AnimatedRoutes />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </LazyMotion>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
