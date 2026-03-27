import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
    window.addEventListener('error', this.handleGlobalError);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
    window.removeEventListener('error', this.handleGlobalError);
  }

  handleGlobalError = (event: ErrorEvent) => {
    console.error("Global error caught:", event.error || event.message);
    this.setState({
      hasError: true,
      error: event.error || event.message
    });
  };

  handlePromiseRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled promise rejection:", event.reason);
    this.setState({
      hasError: true,
      error: event.reason
    });
  };

  render() {
    if (this.state.hasError) {
      let errorStr = '';
      const err = this.state.error;

      if (err instanceof Error) {
        errorStr = `${err.name}: ${err.message}\n${err.stack || ''}`;
      } else if (typeof err === 'object' && err !== null) {
        try {
          errorStr = JSON.stringify(err, null, 2);
        } catch (e) {
          errorStr = String(err);
        }
      } else {
        errorStr = String(err);
      }

      return (
        <div className="min-h-screen bg-slate-950 text-red-400 p-8 font-mono flex flex-col items-center justify-center">
          <div className="max-w-4xl w-full bg-slate-900 p-6 rounded-xl border border-red-900/50 shadow-2xl">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-3xl">⚠️</span> Critical Error Detected
            </h1>
            <p className="text-slate-400 mb-6 italic">
              The application encountered an unexpected issue. Please check the details below.
            </p>
            <pre className="bg-black/50 p-4 rounded-lg overflow-auto max-h-[60vh] text-sm text-red-300 whitespace-pre-wrap break-all border border-red-900/20">
              {errorStr}
            </pre>
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
              >
                Reload Application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
              >
                Try to Recover
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
