import React, { useState, useEffect } from 'react';
import type { Comment } from '../../types.ts';
import { userService } from '../../services/user.service.ts';
import { Skeleton } from '../ui/Skeleton.tsx';
import { Button } from '../ui/Button.tsx';

interface CommentSectionProps {
  articleId: string;
  articleTitle: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ articleId, articleTitle }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await userService.getComments(articleId);
        setComments(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load comments');
        setComments([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComments();
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const comment = await userService.postComment({ 
        article_id: articleId, 
        article_title: articleTitle,
        text: newComment 
      });
      setComments([comment, ...comments]);
      setNewComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        )}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="What do you think?"
          className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 text-sm"
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting} disabled={!newComment.trim() || isSubmitting}>
            Post
          </Button>
        </div>
      </form>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2 no-scrollbar">
        {isLoading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
        ) : error && comments.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-4 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600">
                {comment.username && comment.username.length > 0 ? comment.username[0] : 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{comment.username || 'Anonymous'}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {comment.text}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-slate-400 py-4 text-sm italic">No comments yet.</p>
        )}
      </div>
    </div>
  );
};