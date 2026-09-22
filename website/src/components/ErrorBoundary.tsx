import { Component } from "react";
import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Lưới an toàn cho cả trang — nếu 1 màn hình bất kỳ crash do lỗi JS không
 * lường trước, hiện thông báo + nút "Thử lại" thay vì màn hình trắng không
 * rõ nguyên nhân (nhất là lúc demo cho khách xem).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error("Lỗi không mong muốn:", error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 max-w-sm text-center">
            <h1 className="text-lg font-bold text-red-600 mb-2">Đã có lỗi xảy ra</h1>
            <p className="text-sm text-gray-500 mb-6">
              Vui lòng thử lại. Nếu vẫn còn lỗi, hãy tải lại trang.
            </p>
            <button
              onClick={this.handleRetry}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
