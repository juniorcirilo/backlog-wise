import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Backlog from "@/pages/Backlog";
import Matrix from "@/pages/Matrix";
import Roadmap from "@/pages/Roadmap";
import FloatingChat from "@/components/chat/FloatingChat";
import ConnectJira from "@/pages/ConnectJira";
import ImportFromJira from "@/pages/ImportFromJira";
import PendingApproval from "@/pages/PendingApproval";
import SecuritySettings from "@/pages/SecuritySettings";
import TeamManagement from "@/pages/TeamManagement";
import Settings from "@/pages/Settings";
import Historico from "@/pages/Historico";
import NotFound from "./pages/NotFound";
import { useEnsureAuthTrigger } from "@/hooks/useEnsureAuthTrigger";

const queryClient = new QueryClient();

function AppRoot({ children }: { children: React.ReactNode }) {
  useEnsureAuthTrigger();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoProvider>
        <AuthProvider>
          <AppRoot>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={<PendingApproval />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/conectar-jira" element={<ConnectJira />} />
              <Route path="/importar-jira" element={<ImportFromJira />} />
              <Route path="/repository/:repository_id/backlog" element={<Backlog />} />
              <Route path="/repository/:repository_id/matrix" element={<Matrix />} />
              <Route path="/repository/:repository_id/roadmap" element={<Roadmap />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/historico" element={<Historico />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout /></ProtectedRoute>}>
              <Route path="/team" element={<TeamManagement />} />
              <Route path="/settings/security" element={<SecuritySettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingChat />
          </AppRoot>
        </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
