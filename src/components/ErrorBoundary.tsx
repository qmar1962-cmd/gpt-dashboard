/**
 * ErrorBoundary.tsx
 * 捕获子组件渲染错误，防止整页白屏
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.label || 'ErrorBoundary'}] 捕获到错误:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600">
          <h3 className="text-lg font-bold mb-2">⚠️ 组件渲染出错</h3>
          <p className="text-sm text-zinc-500 mb-4">{this.props.label || '未知组件'}</p>
          <pre className="text-xs bg-zinc-100 p-4 rounded-lg overflow-auto text-left max-w-2xl mx-auto whitespace-pre-wrap break-all">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm"
            onClick={() => this.setState({ hasError: false })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
