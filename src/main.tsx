import { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n'; // <-- Add this import
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async'; // <-- IMPORT THIS

class GlobalErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ff8080', backgroundColor: '#111', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2>Application Crashed!</h2>
          <p>Please share this error message:</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '10px' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', marginTop: '10px' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="light" storageKey="vite-ui-theme">
          <App />
        </ThemeProvider>
      </HelmetProvider>
    </GlobalErrorBoundary>
  </StrictMode>
);
