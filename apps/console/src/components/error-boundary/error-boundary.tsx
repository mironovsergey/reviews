import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Message } from '../message/message';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Перехватывает ошибки отрисовки в поддереве. Ошибки загрузки данных
 * обрабатывает React Query; здесь предусмотрены остальные случаи.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <Message>Что-то пошло не так. Попробуйте обновить страницу.</Message>;
    }

    return this.props.children;
  }
}
