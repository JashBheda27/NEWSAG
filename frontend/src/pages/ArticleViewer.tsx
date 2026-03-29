import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SummaryModal } from '../components/news/SummaryModal';
import { userService } from '../services/user.service';

export const ArticleViewer: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const url = params.get('url') || '';
  const title = params.get('title') || undefined;
  const description = params.get('description') || undefined;
  const source = params.get('source') || undefined;
  const articleId = params.get('articleId') || undefined;

  useEffect(() => {
    if (!url) return;
    userService
      .trackReadActivity({
        article_id: articleId,
        article_url: url,
        title,
        source,
      })
      .catch(() => {
        // Intentionally ignore telemetry failures.
      });
  }, [articleId, source, title, url]);

  const handleClose = () => {
    navigate('/profile');
  };

  if (!url) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Article Not Found</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This deep link is missing a valid article URL.</p>
        <button
          onClick={handleClose}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Back to Profile
        </button>
      </div>
    );
  }

  return (
    <SummaryModal
      isOpen={true}
      onClose={handleClose}
      url={url}
      title={title}
      description={description}
      source={source}
      articleId={articleId}
    />
  );
};

export default ArticleViewer;
