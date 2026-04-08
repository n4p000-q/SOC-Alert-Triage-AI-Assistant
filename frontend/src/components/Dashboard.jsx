import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import LiveMode from './LiveMode';
import SingleMode from './SingleMode';
import BatchMode from './BatchMode';
import AnalyticsDashboard from './AnalyticsDashboard';

function Dashboard({ activeTab }) {
  return (
    <div className="animate-fade-in">
      <ErrorBoundary>
        {activeTab === 'live'      && <LiveMode />}
        {activeTab === 'single'    && <SingleMode />}
        {activeTab === 'batch'     && <BatchMode />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </ErrorBoundary>
    </div>
  );
}

export default Dashboard;
