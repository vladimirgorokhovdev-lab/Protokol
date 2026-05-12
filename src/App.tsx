import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { TranscriptionQueueProvider } from "@/contexts/TranscriptionQueueContext";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import History from "./pages/History.tsx";
import NotFound from "./pages/NotFound.tsx";
import Install from "./pages/Install.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import FeedbackButton from "./components/FeedbackButton.tsx";
import ConsentBanner from "./components/ConsentBanner.tsx";
import { SiteFooter } from "./components/SiteFooter.tsx";
import Feedback from "./pages/Feedback.tsx";
import Contact from "./pages/Contact.tsx";
import Guide from "./pages/Guide.tsx";
import Pricing from "./pages/Pricing.tsx";
import Advantages from "./pages/Advantages.tsx";
import Demo from "./pages/Demo.tsx";
import AdminRequests from "./pages/AdminRequests.tsx";
import AdminContact from "./pages/AdminContact.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AdminTeams from "./pages/AdminTeams.tsx";
import Account from "./pages/Account.tsx";
import Profile from "./pages/Profile.tsx";
import Team from "./pages/Team.tsx";
import TeamJoin from "./pages/TeamJoin.tsx";
import ApprovalGate from "./components/ApprovalGate.tsx";
import { useStaleSessionRecovery } from "./hooks/useStaleSessionRecovery";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

const SessionRecovery = () => {
  useStaleSessionRecovery();
  return null;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SessionRecovery />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="theme"
      >
        <AuthProvider>
          <TranscriptionQueueProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ApprovalGate>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/feedback" element={<Feedback />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/guide" element={<Guide />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/advantages" element={<Advantages />} />
                    <Route path="/demo" element={<Demo />} />
                    <Route path="/admin/requests" element={<AdminRequests />} />
                    <Route path="/admin/contact" element={<AdminContact />} />
                    <Route
                      path="/admin/analytics"
                      element={<AdminAnalytics />}
                    />
                    <Route path="/admin/teams" element={<AdminTeams />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/account/profile" element={<Profile />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/team/join" element={<TeamJoin />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <SiteFooter />
                  <FeedbackButton />
                  <ConsentBanner />
                </ApprovalGate>
              </BrowserRouter>
            </TooltipProvider>
          </TranscriptionQueueProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
