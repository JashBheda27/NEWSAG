import React from 'react';
import ModelTuning from './ModelTuning.tsx';

interface ModelTuningProps {
  showNotification: (msg: string, type?: 'error' | 'success' | 'warning' | 'info') => void;
}

export const ModelTuningEnhanced: React.FC<ModelTuningProps> = ({ showNotification }) => {
  return <ModelTuning showNotification={showNotification} />;
};

export default ModelTuningEnhanced;
