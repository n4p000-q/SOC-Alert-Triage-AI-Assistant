import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-64 flex items-center justify-center p-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-lg text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <h2 className="text-lg font-bold text-red-300 mb-2">Something went wrong</h2>
            <p className="text-red-400 text-sm mb-4 font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
