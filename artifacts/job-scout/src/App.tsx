import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { AppLayout } from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import JobsFeed from '@/pages/JobsFeed';
import JobDetail from '@/pages/JobDetail';
import Keywords from '@/pages/Keywords';
import Sources from '@/pages/Sources';
import Settings from '@/pages/Settings';
import History from '@/pages/History';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={JobsFeed} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/keywords" component={Keywords} />
      <Route path="/sources" component={Sources} />
      <Route path="/settings" component={Settings} />
      <Route path="/history" component={History} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppLayout>
          <Router />
        </AppLayout>
      </WouterRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
