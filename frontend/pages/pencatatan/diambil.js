import React from 'react';
import { useSession } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import PencatatanContainer from '../../components/pencatatan/PencatatanContainer';

export default function PencatatanDiambilPage() {
  const { data: session, status } = useSession();
  return (
    <DashboardLayout>
      <PencatatanContainer session={session} status={status} tipe="diambil" />
    </DashboardLayout>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  // Halaman ini hanya boleh diakses role pic_gudang / admin / superadmin
  const roles = session?.user?.roles || (session?.user?.role ? [session.user.role] : []);
  const allowedRoles = ['pic_gudang', 'admin', 'superadmin'];
  if (!allowedRoles.some((r) => roles.includes(r))) {
    return { redirect: { destination: '/', permanent: false } };
  }
  return { props: { session } };
}
