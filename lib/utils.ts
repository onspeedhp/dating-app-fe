import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fake user utilities for testing
export const FAKE_USER_KEY = 'dating-app-fake-user';

export const getFakeUser = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(FAKE_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const setFakeUser = (user: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAKE_USER_KEY, JSON.stringify(user));
};

export const removeFakeUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(FAKE_USER_KEY);
};

export const hasFakeUser = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(FAKE_USER_KEY) !== null;
};
