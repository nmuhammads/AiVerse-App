import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary компонент для перехвата JavaScript ошибок
 * в дереве дочерних компонентов и отображения fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Обновляем состояние для отображения fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Логирование ошибки
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);

        this.setState({ errorInfo });

        // TODO: Отправка в Sentry или другую систему мониторинга
        // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Если передан кастомный fallback, используем его
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Дефолтный fallback UI
            return (
                <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-zinc-700/50 p-8 text-center">
                        {/* Иконка ошибки */}
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        {/* Заголовок */}
                        <h2 className="text-xl font-semibold text-white mb-2">
                            Что-то пошло не так
                        </h2>

                        {/* Описание */}
                        <p className="text-zinc-400 text-sm mb-6">
                            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу или вернуться на главную.
                        </p>

                        {/* Кнопки действий */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Перезагрузить
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                На главную
                            </button>

                            <button
                                onClick={this.handleRetry}
                                className="w-full px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
                            >
                                Попробовать снова
                            </button>
                        </div>

                        {/* Детали ошибки (только в dev режиме) */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                                    Техническая информация
                                </summary>
                                <div className="mt-2 p-3 bg-zinc-900/50 rounded-lg overflow-auto max-h-40">
                                    <p className="text-xs text-red-400 font-mono break-all">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo?.componentStack && (
                                        <pre className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Компактный fallback для отдельных секций/компонентов
 */
interface SectionErrorFallbackProps {
    onRetry?: () => void;
    title?: string;
    message?: string;
}

export function SectionErrorFallback({
    onRetry,
    title = "Ошибка загрузки",
    message = "Не удалось загрузить этот раздел"
}: SectionErrorFallbackProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
            <p className="text-sm text-zinc-400 mb-4">{message}</p>
            <div className="flex gap-2">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Повторить
                    </button>
                )}
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Обновить
                </button>
            </div>
        </div>
    );
}

/**
 * Обёртка для быстрого создания Error Boundary с компактным fallback
 */
interface PageErrorBoundaryProps {
    children: ReactNode;
    pageName?: string;
}

export function PageErrorBoundary({ children, pageName }: PageErrorBoundaryProps) {
    return (
        <ErrorBoundary
            fallback={
                <div className="min-h-[60vh] flex items-center justify-center">
                    <SectionErrorFallback
                        title={pageName ? `Ошибка в ${pageName}` : "Ошибка загрузки страницы"}
                        message="Попробуйте обновить страницу или вернуться позже"
                    />
                </div>
            }
        >
            {children}
        </ErrorBoundary>
    );
}

export default ErrorBoundary;
