import React from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import ReagenContainer from '../../components/reagen/ReagenContainer';

export default function ReagenPage() {
  const { data: session, status } = useSession();

  return (
    <DashboardLayout>
      <ReagenContainer session={session} status={status} />
    </DashboardLayout>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: { session } };
}
