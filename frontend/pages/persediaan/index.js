import React from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import PersediaanContainer from '../../components/persediaan/PersediaanContainer';

export default function PersediaanPage() {
  const { data: session, status } = useSession();

  return (
    <DashboardLayout>
      <PersediaanContainer session={session} status={status} />
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
