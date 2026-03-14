import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { newsService } from '../../services/news.service';

interface FeedbackFABProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const FeedbackFAB: React.FC<FeedbackFABProps> = ({ onSuccess, onError }) => {
  const handleFeedbackClick = () => {
    const feedback = prompt("How can we improve NewsAura?");
    if (feedback) {
      newsService
        .submitFeedback(feedback)
        .then(() => onSuccess("Thanks for your feedback!"))
        .catch((err) => onError(err.message));
    }
  };

  return (
    <button 
      aria-label="Give feedback"
      onClick={handleFeedbackClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
    >
      <MessageSquarePlus size={24} aria-hidden="true" />
    </button>
  );
};
