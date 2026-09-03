import React from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import GlasswareContainer from '../../components/glassware/GlasswareContainer';

export default function GlasswarePage() {
  const { data: session, status } = useSession();

  return (
    <DashboardLayout>
      <GlasswareContainer session={session} status={status} />
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
