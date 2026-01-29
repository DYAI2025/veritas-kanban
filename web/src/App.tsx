import { KanbanBoard } from './components/board/KanbanBoard';
import { Header } from './components/layout/Header';
import { Toaster } from './components/ui/toaster';
import { KeyboardProvider } from './hooks/useKeyboard';
import { KeyboardShortcutsDialog } from './components/layout/KeyboardShortcutsDialog';
import { BulkActionsProvider } from './hooks/useBulkActions';
import { useTaskSync } from './hooks/useTaskSync';
import { TaskConfigProvider } from './contexts/TaskConfigContext';
import { WebSocketStatusProvider } from './contexts/WebSocketContext';
import { AuthProvider } from './hooks/useAuth';
import { AuthGuard } from './components/auth';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Main app content (only rendered when authenticated)
function AppContent() {
  // Connect to WebSocket for real-time task updates
  const { isConnected } = useTaskSync();

  return (
    <WebSocketStatusProvider isConnected={isConnected}>
      <KeyboardProvider>
        <BulkActionsProvider>
          <TaskConfigProvider>
            <div className="min-h-screen bg-background">
              <Header />
              <main className="container mx-auto px-4 py-6">
                <ErrorBoundary level="section">
                  <KanbanBoard />
                </ErrorBoundary>
              </main>
              <Toaster />
              <KeyboardShortcutsDialog />
            </div>
          </TaskConfigProvider>
        </BulkActionsProvider>
      </KeyboardProvider>
    </WebSocketStatusProvider>
  );
}

function App() {
  return (
    <ErrorBoundary level="page">
      <AuthProvider>
        <AuthGuard>
          <AppContent />
        </AuthGuard>
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
