import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', direction: 'rtl', background: '#fff5f5', minHeight: '100dvh' }}>
          <h1 style={{ color: '#c00', fontSize: '1.25rem', fontWeight: 700 }}>המערכת נתקלה בשגיאה</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#444', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error}
          </p>
          <button
            style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1rem' }}
            onClick={() => window.location.reload()}
          >
            רענן ונסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
