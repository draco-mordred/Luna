import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('A page failed to render:', error, errorInfo);
  }

  private returnToLibrary = () => {
    if (window.location.hash.startsWith('#/')) {
      window.location.hash = '/tracks';
    } else {
      window.history.replaceState(null, '', '/tracks');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className='route-error' role='alert'>
          <span className='material-symbols-outlined' aria-hidden='true'>
            warning
          </span>
          <h2>This page could not be opened</h2>
          <p>
            Luna hit an error while displaying this page. Your music and current playback are
            preserved.
          </p>
          {this.state.message && <pre>{this.state.message}</pre>}
          <button type='button' onClick={this.returnToLibrary}>
            Return to library
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
