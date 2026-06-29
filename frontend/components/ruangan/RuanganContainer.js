// components/ruangan/RuanganContainer.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  LinearProgress,
  Fade,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as ruanganApi from './api/ruanganApi';
import RuanganTable from './RuanganTable';
import FilterSection from './FilterSection';
import RuanganModal from './modals/RuanganModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import PolishedPageShell from '../common/PolishedPageShell';

const RuanganContainer = () => {
  const { data: session, status } = useSession();
  
  // State untuk data
  const [ruanganList, setRuanganList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  // State untuk filter
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });
  
  // State untuk sorting
  const [sortConfig, setSortConfig] = useState({
    field: 'kode_ruangan',
    direction: 'asc'
  });
  
  // State untuk modal
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRuangan, setSelectedRuangan] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  
  // State untuk snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // State untuk pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    perPage: 10,
    total: 0,
    totalPages: 0,
  });

  // ========== HELPER FUNCTIONS FOR ROLE CHECK ==========
  const getUserRoles = () => {
    const roles = [];
    
    // 1. Dari realm_access (Keycloak standard)
    if (session?.user?.realm_access?.roles) {
      roles.push(...session.user.realm_access.roles);
    }
    
    // 2. Dari field role langsung (PENTING! untuk role admin yang ada di session.user.role)
    if (session?.user?.role) {
      roles.push(session.user.role);
    }
    
    // 3. Dari session.role
    if (session?.role) {
      roles.push(session.role);
    }
    
    // 4. Dari user metadata
    if (session?.user?.metadata?.role) {
      roles.push(session.user.metadata.role);
    }
    
    // 5. Dari access token (jika ada)
    if (session?.accessToken) {
      try {
        const base64Url = session.accessToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        if (payload.realm_access?.roles) {
          roles.push(...payload.realm_access.roles);
        }
        if (payload.resource_access) {
          Object.values(payload.resource_access).forEach(resource => {
            if (resource.roles) {
              roles.push(...resource.roles);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing access token:', e);
      }
    }
    
    // Remove duplicates
    return [...new Set(roles)];
  };

  const hasRole = (allowedRoles) => {
    const userRoles = getUserRoles();
    return allowedRoles.some(role => userRoles.includes(role));
  };

  const canModifyData = () => {
    return hasRole(['admin_pemeliharaan', 'admin', 'superadmin']);
  };

  const isReadOnly = () => {
    return !canModifyData();
  };

  // ========== FETCH STATISTICS ==========
  const fetchStatistics = useCallback(async () => {
    if (!session) return;
    
    try {
      const result = await ruanganApi.fetchRuanganStatistics(session);
      if (result?.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [session]);

  // ========== SORT FUNCTION ==========
  const sortData = (data) => {
    if (!data || !Array.isArray(data)) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // ========== FETCH DATA RUANGAN ==========
  const fetchDataRuangan = useCallback(async () => {
    if (!session) {
      setError('Session tidak ditemukan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.perPage,
      };
      
      if (filters.search) {
        params.search = filters.search;
      }
      
      if (filters.status !== 'all') {
        params.is_active = filters.status;
      }
      
      const result = await ruanganApi.fetchAllRuangan(session, params);

      console.log('📥 Data ruangan:', result);

      if (result?.success) {
        const sortedData = sortData(result.data || []);
        setRuanganList(sortedData);
        
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            ...result.pagination
          }));
        }
        
        fetchStatistics();
      } else {
        const errorMessage = result?.message || 'Gagal memuat data ruangan';
        setError(errorMessage);
        showSnackbar(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ Error fetching ruangan:', error);
      const errorMessage = error?.message || 'Terjadi kesalahan saat memuat data';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, sortConfig]);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    if (session) {
      fetchDataRuangan();
    } else {
      setInitialLoading(false);
    }
  }, [session]);

  // ========== HANDLE FILTER CHANGE ==========
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  // ========== HANDLE PAGE CHANGE ==========
  const handlePageChange = (page, perPage) => {
    if (perPage) {
      setPagination(prev => ({ ...prev, currentPage: 1, perPage }));
    } else {
      setPagination(prev => ({ ...prev, currentPage: page }));
    }
  };

  // ========== HANDLE SORT ==========
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    
    setRuanganList(prev => sortData(prev));
  };

  // ========== HANDLE REFRESH ==========
  const handleRefresh = () => {
    fetchDataRuangan();
    showSnackbar('Data berhasil diperbarui', 'success');
  };

  // ========== HANDLE CREATE (with role check) ==========
  const handleCreate = () => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah ruangan.', 'error');
      return;
    }
    setSelectedRuangan(null);
    setModalOpen(true);
  };

  // ========== HANDLE VIEW ==========
  const handleView = (ruangan) => {
    setSelectedRuangan(ruangan);
    setViewModalOpen(true);
  };

  // ========== HANDLE EDIT (with role check) ==========
  const handleEdit = (ruangan) => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah ruangan.', 'error');
      return;
    }
    setSelectedRuangan(ruangan);
    setModalOpen(true);
  };

  // ========== HANDLE DELETE (with role check) ==========
  const handleDelete = (ruangan) => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus ruangan.', 'error');
      return;
    }
    setSelectedRuangan(ruangan);
    setDeleteModalOpen(true);
  };

  // ========== HANDLE SUBMIT ==========
  const handleSubmit = async (formData) => {
    if (!session) {
      showSnackbar('Session tidak ditemukan', 'error');
      return;
    }

    // Double-check role before submit
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk menyimpan data.', 'error');
      return;
    }

    setModalLoading(true);

    try {
      let result;
      
      if (selectedRuangan) {
        result = await ruanganApi.updateRuangan(session, selectedRuangan.id, formData);
      } else {
        result = await ruanganApi.createRuangan(session, formData);
      }

      if (result?.success) {
        showSnackbar(
          selectedRuangan 
            ? 'Ruangan berhasil diupdate' 
            : 'Ruangan berhasil ditambahkan', 
          'success'
        );
        setModalOpen(false);
        fetchDataRuangan();
      } else {
        showSnackbar(result?.message || 'Gagal menyimpan data', 'error');
      }
    } catch (error) {
      console.error('❌ Error submitting ruangan:', error);
      
      if (error?.response?.status === 403) {
        showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk melakukan operasi ini.', 'error');
      } else {
        showSnackbar('Terjadi kesalahan saat menyimpan data', 'error');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedRuangan) return;

    // Double-check role before delete
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk menghapus data.', 'error');
      return;
    }

    setModalLoading(true);

    try {
      const result = await ruanganApi.deleteRuangan(session, selectedRuangan.id);

      if (result?.success) {
        showSnackbar('Ruangan berhasil dihapus', 'success');
        setDeleteModalOpen(false);
        fetchDataRuangan();
      } else {
        showSnackbar(result?.message || 'Gagal menghapus ruangan', 'error');
      }
    } catch (error) {
      console.error('❌ Error deleting ruangan:', error);
      
      if (error?.response?.status === 403) {
        showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk menghapus data.', 'error');
      } else {
        showSnackbar('Terjadi kesalahan saat menghapus data', 'error');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== SHOW SNACKBAR ==========
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // ========== BUILD STATISTICS DATA ==========
  const getStatCards = () => {
    if (!statistics) return null;
    return [
      {
        label: 'Total Ruangan',
        value: statistics.total || 0,
        icon: <RoomIcon sx={{ fontSize: 22 }} />,
        color: '#3b82f6',
        maxValue: statistics.total || 100,
      },
      {
        label: 'Ruangan Aktif',
        value: statistics.aktif || 0,
        icon: <CheckCircleIcon sx={{ fontSize: 22 }} />,
        color: '#10b981',
        maxValue: statistics.total || 100,
      },
      {
        label: 'Ruangan Tidak Aktif',
        value: statistics.tidak_aktif || 0,
        icon: <CancelIcon sx={{ fontSize: 22 }} />,
        color: '#ef4444',
        maxValue: statistics.total || 100,
      },
    ];
  };

  // ========== RENDER ==========
  if (status === 'loading' || initialLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Silakan login untuk mengakses data ruangan
        </Alert>
      </Box>
    );
  }

  return (
    <PolishedPageShell
      title="Manajemen Ruangan"
      subtitle="Kelola data ruangan dan lokasi BMN"
      statistics={getStatCards()}
      actions={
        <>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Tooltip title={isReadOnly() ? 'Hanya admin_pemeliharaan dan admin yang dapat menambah ruangan' : 'Tambah ruangan baru'}>
            <span>
              <Button
                variant="contained"
                startIcon={isReadOnly() ? <LockIcon /> : <AddIcon />}
                onClick={handleCreate}
                disabled={loading || isReadOnly()}
                sx={{
                  bgcolor: '#fff',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                }}
              >
                Tambah Ruangan
              </Button>
            </span>
          </Tooltip>
        </>
      }
    >
      {/* Filter Section */}
      <FilterSection
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Loading Progress */}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Error Alert */}
      <Fade in={!!error}>
        <Box sx={{ mb: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </Fade>

      {/* Table */}
      <RuanganTable
        data={ruanganList}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortConfig={sortConfig}
        onSort={handleSort}
        readOnly={isReadOnly()}
      />

      {/* Footer Info */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="body2" color="text.secondary">
          Menampilkan {ruanganList.length} dari {pagination.total} data
        </Typography>
      </Box>

      {/* Modal Create/Edit */}
      <RuanganModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedRuangan}
        title={selectedRuangan ? 'Edit Ruangan' : 'Tambah Ruangan Baru'}
        loading={modalLoading}
        readOnly={isReadOnly()}
      />

      {/* Modal View */}
      <RuanganModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        initialData={selectedRuangan}
        title="Detail Ruangan"
        viewOnly={true}
        loading={false}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        ruanganName={selectedRuangan?.nama_ruangan}
        loading={modalLoading}
      />

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PolishedPageShell>
  );
};

export default RuanganContainer;