import { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    // Hard reload the page to clear cache
    window.location.reload();
  };

  private handleHardReload = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isModuleError = this.state.error?.message?.includes('dynamically imported module');
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon */}
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <TriangleAlert className="w-8 h-8 text-orange-600" />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {isModuleError ? 'Cache Update Required' : 'Something Went Wrong'}
                </h1>
                <p className="text-slate-600">
                  {isModuleError 
                    ? 'The application has been updated. Please refresh your browser to load the latest version.'
                    : 'An unexpected error occurred. Please try refreshing the page.'}
                </p>
              </div>

              {/* Error details (collapsed) */}
              {this.state.error && (
                <details className="w-full text-left">
                  <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 w-full">
                {isModuleError ? (
                  <>
                    <button
                      onClick={this.handleHardReload}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Hard Refresh (Recommended)
                    </button>
                    <button
                      onClick={this.handleReload}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Normal Refresh
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                      💡 Tip: You can also press <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 text-slate-700 font-mono text-xs">Ctrl+Shift+R</kbd> (Windows/Linux) or <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 text-slate-700 font-mono text-xs">Cmd+Shift+R</kbd> (Mac)
                    </p>
                  </>
                ) : (
                  <button
                    onClick={this.handleReload}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}