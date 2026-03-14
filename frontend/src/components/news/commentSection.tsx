import React, { useState, useEffect, useCallback, memo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { CircleAlert } from 'lucide-react';
import type { Comment } from '../../types.ts';
import { userService } from '../../services/user.service.ts';
import { ERROR_MESSAGES } from '../../utils/constants.ts';
import { Skeleton } from '../ui/Skeleton.tsx';
import { Button } from '../ui/Button.tsx';
import { FormErrorMessage } from '../ui/FormErrorMessage.tsx';

interface CommentSectionProps {
  articleId: string;
  articleTitle: string;
}

// Memoized comment item component
const CommentItem = memo<{ comment: Comment }>(({ comment }) => (
  <div className="group flex gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/40 p-3 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700/60 transition-all duration-200 animate-fade-in">
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-400/30 dark:to-violet-400/20 border border-indigo-200/70 dark:border-indigo-500/30 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
      {comment.username && comment.username.length > 0 ? comment.username[0] : 'U'}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-bold text-sm truncate text-slate-900 dark:text-slate-100">{comment.username || 'Anonymous'}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 px-1.5 py-0.5 rounded-md flex-shrink-0">
          {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 break-words">
        {comment.text}
      </p>
    </div>
  </div>
));

CommentItem.displayName = 'CommentItem';

// Optimized CommentSection with memo
export const CommentSection = memo<CommentSectionProps>(({ articleId, articleTitle }) => {
  const { user } = useUser();
  const formErrorId = `comment-form-error-${articleId}`;
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
        setError(err.message || ERROR_MESSAGES.LOAD_COMMENTS);
        setComments([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComments();
  }, [articleId]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const profileUsername =
        user?.fullName
        || user?.username
        || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
        || undefined;

      const comment = await userService.postComment({ 
        article_id: articleId, 
        article_title: articleTitle,
        text: newComment,
        username: profileUsername,
      });
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (err: any) {
      setError(err.message || ERROR_MESSAGES.POST_COMMENT);
    } finally {
      setIsSubmitting(false);
    }
  }, [articleId, articleTitle, newComment, user]);

  const handleCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
  }, []);

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Share your thoughts</h4>
          <span className="text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Community</span>
        </div>
        {error && comments.length > 0 && (
          <div id={formErrorId}>
            <FormErrorMessage message={error} />
          </div>
        )}
        <label htmlFor={`comment-input-${articleId}`} className="sr-only">
          Add your comment
        </label>
        <textarea
          id={`comment-input-${articleId}`}
          value={newComment}
          onChange={handleCommentChange}
          placeholder="What do you think?"
          className="w-full p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-400 dark:focus:border-indigo-500 outline-none resize-none h-24 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-shadow"
          disabled={isSubmitting}
          aria-label="Write a comment"
          aria-describedby={error && comments.length > 0 ? formErrorId : undefined}
        />
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting} disabled={!newComment.trim() || isSubmitting} className="px-6">
            Post
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/30 p-3">
        <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200/80 dark:border-slate-700/70">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent comments</h5>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {isLoading ? '...' : comments.length}
          </span>
        </div>

        <div className="mt-3 space-y-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
        {isLoading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
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
              <CircleAlert size={24} className="text-rose-500" aria-hidden="true" />
            </div>
            <FormErrorMessage message={error} compact className="justify-center" />
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 py-4 text-sm italic">No comments yet. Be the first to post.</p>
        )}
        </div>
      </div>
    </div>
  );
});

CommentSection.displayName = 'CommentSection';