import { User } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function loginUser(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password: password.trim() }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { user: null, error: data.error || 'Login failed' };
    }

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: 'An error occurred during login' };
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

export function isTeacher(user: User | null): boolean {
  return user?.role === 'teacher';
}
