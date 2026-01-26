import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const axiosError = error as AxiosError;

  if (!axiosError.response) {
    return 'Unable to reach the server. Please check your internet connection or ensure the backend is running.';
  }

  switch (axiosError.response.status) {
    case 400:
      return 'The request was invalid. Please double-check your input.';
    case 401:
      return 'Your session has expired. Please log in again to continue.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested information could not be found.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Our servers are having trouble right now. Please try again in a few minutes.';
    default:
      return 'Something went wrong on our end. Please try again later.';
  }
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};
