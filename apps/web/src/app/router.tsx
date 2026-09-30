import { createBrowserRouter } from 'react-router';

import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { EmailsPage } from '@/features/emails/emails-page';
import { JobDetailPage } from '@/features/jobs/job-detail-page';
import { JobsPage } from '@/features/jobs/jobs-page';
import { SubmitJobPage } from '@/features/submit/submit-job-page';

import { Layout } from './layout';

export const router = createBrowserRouter([
  {
    children: [
      { element: <DashboardPage />, index: true },
      { element: <JobsPage />, path: 'jobs' },
      { element: <JobDetailPage />, path: 'jobs/:id' },
      { element: <SubmitJobPage />, path: 'submit' },
      { element: <EmailsPage />, path: 'emails' },
    ],
    element: <Layout />,
    path: '/',
  },
]);
