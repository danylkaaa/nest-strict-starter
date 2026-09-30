import { createBrowserRouter } from 'react-router';

import { EmailsPage } from '@/features/emails/emails-page';
import { HomePage } from '@/pages/home-page';

import { Layout } from './layout';

export const router = createBrowserRouter([
  {
    children: [
      { element: <HomePage />, index: true },
      { element: <EmailsPage />, path: 'emails' },
    ],
    element: <Layout />,
    path: '/',
  },
]);
