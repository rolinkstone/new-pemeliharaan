// pages/standar_kompetensi/index.js
import React from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import RuanganContainer from '../../components/ruangan/RuanganContainer';

export default function RuanganPage() {
  const { data: session, status } = useSession();

  return (
    <DashboardLayout>
      <RuanganContainer session={session} status={status} />
    </DashboardLayout>
  );
}

// Server-side protection
export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: { session },
  };
}