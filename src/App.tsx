import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NewProject from "./pages/NewProject";
import EditProject from "./pages/EditProject";
import BriefPage from "./pages/BriefPage";
import QuestionsPage from "./pages/QuestionsPage";
import ConceptBoard from "./pages/ConceptBoard";
import StyleNarrowingPage from "./pages/StyleNarrowingPage";
import ExportPage from "./pages/ExportPage";
import DesignerProfilePage from "./pages/DesignerProfilePage";
import ClientTastePage from "./pages/ClientTastePage";
import AgreedStylePage from "./pages/AgreedStylePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/profile" element={<DesignerProfilePage />} />
          <Route path="/project/:projectId/brief" element={<BriefPage />} />
          <Route path="/project/:projectId/edit" element={<EditProject />} />
          <Route path="/project/:projectId/style" element={<StyleNarrowingPage />} />
          <Route path="/project/:projectId/client-taste" element={<ClientTastePage />} />
          <Route path="/project/:projectId/questions" element={<QuestionsPage />} />
          <Route path="/project/:projectId/agreed-style" element={<AgreedStylePage />} />
          <Route path="/project/:projectId/board" element={<ConceptBoard />} />
          <Route path="/project/:projectId/export" element={<ExportPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
