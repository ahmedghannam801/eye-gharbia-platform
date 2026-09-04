import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  isRoot?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    // Log error to console for diagnosis
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[EYE Platform ErrorBoundary]:', error, errorInfo);
    }

    // Auto-recover from dynamic import chunk load failures (new deployment asset hashes)
    const isChunkFailure =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError';

    if (isChunkFailure) {
      try {
        const reloadKey = 'eye_chunk_reload_attempt';
        const lastReload = sessionStorage.getItem(reloadKey);
        if (!lastReload || Date.now() - Number(lastReload) > 10000) {
          sessionStorage.setItem(reloadKey, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const isChunkFailure =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk');

      return (
        <div
          className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-950 text-white rounded-3xl border border-red-500/30 my-6 shadow-2xl"
          dir="rtl"
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex p-4 rounded-3xl bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse">
              <AlertTriangle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">
                {isChunkFailure
                  ? 'تم تحديث المنصة بإصدار جديد 🚀'
                  : this.props.fallbackTitle || 'حدث خطأ غير متوقع أثناء تحميل الصفحة'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isChunkFailure
                  ? 'تم رفع تحديث جديد للمنصة. يرجى إعادة تحميل الصفحة لمزامنة الملفات بأحدث إصدار.'
                  : 'بياناتك محفوظة وآمنة تماماً. يمكنك إعادة تحميل الصفحة أو العودة للرئيسية.'}
              </p>
            </div>

            {this.state.error && !isChunkFailure && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-start text-[11px] font-mono text-red-300 max-h-24 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة ⚡</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Home className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
