import React from 'react';
import './Loader.css';

export const Loader = ({ message = 'Loading...', size = 'md' }) => {
  return (
    <div className={`loader-container loader-${size}`}>
      <div className="loader-spinner" />
      {message && <span className="loader-text">{message}</span>}
    </div>
  );
};

export const ErrorState = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <div className="state-box state-error">
      <div className="state-icon-circle">⚠️</div>
      <h4 className="state-title">{title}</h4>
      {message && <p className="state-desc">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="state-retry-btn">
          Try Again
        </button>
      )}
    </div>
  );
};

export const EmptyState = ({ title = 'No items found', message, action }) => {
  return (
    <div className="state-box state-empty">
      <div className="state-icon-circle">📦</div>
      <h4 className="state-title">{title}</h4>
      {message && <p className="state-desc">{message}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
};
