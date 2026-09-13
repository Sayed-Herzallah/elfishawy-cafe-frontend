import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private notificationContext: { showError: (err: any) => void; showToast: (msg: string, type?: string) => void } | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (this.notificationContext) {
      this.notificationContext.showError(error);
    }
  }

  setNotificationContext = (context: { showError: (err: any) => void; showToast: (msg: string, type?: string) => void }) => {
    this.notificationContext = context;
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6 text-right">
          <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 p-8 shadow-lg text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-gray-500 text-sm mb-6">
              تعذر عرض هذا الجزء من الصفحة. يرجى المحاولة مرة أخرى أو تحديث الصفحة.
            </p>

            {this.state.error && import.meta.env.DEV && (
              <details className="text-right mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs">
                <summary className="font-bold text-rose-700 cursor-pointer mb-2">تفاصيل الخطأ (للمطورين)</summary>
                <pre className="text-rose-600 font-mono text-[10px] overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="primary"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="bg-rose-600 hover:bg-rose-700"
              >
                إعادة المحاولة
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                leftIcon={<Home className="w-4 h-4" />}
              >
                تحديث الصفحة
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = <T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  return (props: T) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};
