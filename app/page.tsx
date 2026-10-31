import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role === 'INSTRUCTOR') {
    redirect('/instructor');
  } else if (user.role === 'EM') {
    redirect('/em');
  }

  redirect('/login');
}



