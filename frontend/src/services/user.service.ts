import { api, getErrorMessage } from './api';
import type { Bookmark, ReadLaterItem, Comment } from '../types';

export const userService = {
  // Bookmarks
  getBookmarks: async (): Promise<Bookmark[]> => {
    try {
      const response = await api.get<{ bookmarks: any[]; count: number }>('/api/bookmarks/');
      return response.data.bookmarks.map(b => ({
        ...b,
        id: b._id || b.id
      }));
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  addBookmark: async (article: Partial<Bookmark>): Promise<Bookmark> => {
    try {
      const response = await api.post<{ message: string; bookmark_id: string }>('/api/bookmarks/', article);
      return { ...article, id: response.data.bookmark_id } as Bookmark;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  removeBookmark: async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/bookmarks/${id}/`);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // Read Later
  getReadLater: async (): Promise<ReadLaterItem[]> => {
    try {
      const response = await api.get<{ items: any[]; count: number }>('/api/read-later/');
      return response.data.items.map(i => ({
        ...i,
        id: i._id || i.id
      }));
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  addToReadLater: async (item: Partial<ReadLaterItem>): Promise<ReadLaterItem> => {
    try {
      const response = await api.post<{ message: string; id: string }>('/api/read-later/', item);
      return { ...item, id: response.data.id } as ReadLaterItem;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  removeFromReadLater: async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/read-later/${id}/`);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },

  // Comments
  getComments: async (articleId: string): Promise<Comment[]> => {
    try {
      const response = await api.get<{ comments: any[]; count: number }>(`/api/comments/${articleId}`);
      return response.data.comments.map(c => ({
        id: c.id || c._id,
        article_id: c.article_id,
        article_title: c.article_title,
        text: c.text,
        user_id: c.user_id,
        username: c.username,
        created_at: c.created_at,
      }));
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  postComment: async (comment: Partial<Comment>): Promise<Comment> => {
    try {
      const response = await api.post<any>('/api/comments/', comment);
      return {
        id: response.data.id || response.data._id,
        article_id: response.data.article_id,
        article_title: response.data.article_title,
        text: response.data.text,
        user_id: response.data.user_id,
        username: response.data.username,
        created_at: response.data.created_at,
      } as Comment;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
  deleteComment: async (commentId: string): Promise<void> => {
    try {
      await api.delete(`/api/comments/${commentId}/`);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  },
};
