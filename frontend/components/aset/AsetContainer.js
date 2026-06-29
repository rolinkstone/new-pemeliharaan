import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  LinearProgress,
  Fade,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as asetApi from './api/asetApi';
import AsetTable from './AsetTable';
import FilterSection from './FilterSection';
import AsetModal from './modals/AsetModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import PolishedPageShell from '../common/PolishedPageShell';

const AsetContainer = () => {
  const { data: session, status } = useSession();
  
  // State untuk data
  const [asetList, setAsetList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  // State untuk filter
  const [filters, setFilters] = useState({
    jenis: '',
    kondisi: '',
    status: '',
    search: '',
  });
  
  // State untuk sorting
  const [sortConfig, setSortConfig] = useState({
    field: 'id',
    direction: 'desc'
  });
  
  // State untuk modal
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAset, setSelectedAset] = useState(null);
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
    perPage: 20,
    total: 0,
    totalPages: 0,
  });

  // ========== HELPER FUNCTIONS FOR ROLE CHECK ==========
  const getUserRoles = () => {
    const roles = [];
    
    // Cek dari struktur realm_access (Keycloak standard)
    if (session?.user?.realm_access?.roles) {
      roles.push(...session.user.realm_access.roles);
    }
    
    // Cek dari field role langsung (custom structure)
    if (session?.user?.role) {
      roles.push(session.user.role);
    }
    
    // Cek dari session?.role
    if (session?.role) {
      roles.push(session.role);
    }
    
    // Cek dari user metadata
    if (session?.user?.metadata?.role) {
      roles.push(session.user.metadata.role);
    }
    
    // Remove duplicates
    return [...new Set(roles)];
  };

  const hasRole = (allowedRoles) => {
    const userRoles = getUserRoles();
    console.log('📋 User roles detected:', userRoles);
    console.log('🔍 Allowed roles:', allowedRoles);
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));
    console.log('✅ Has access:', hasAccess);
    return hasAccess;
  };

  // Yang bisa modify data: admin_pemeliharaan, admin, superadmin
  const canModifyData = () => {
    const allowedRoles = ['admin_pemeliharaan', 'admin', 'superadmin'];
    return hasRole(allowedRoles);
  };

  const isReadOnly = () => {
    return !canModifyData();
  };

  // ========== CEK SESSION ==========
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      setError('Silakan login terlebih dahulu');
      setSnackbar({
        open: true,
        message: 'Session expired. Silakan login kembali.',
        severity: 'warning',
      });
    } else {
      // Log session data untuk debugging
      console.log('🔐 Full session data:', session);
      console.log('👤 User object:', session.user);
      console.log('📋 User roles from helper:', getUserRoles());
      console.log('🔒 Can modify data:', canModifyData());
      console.log('📖 Read-only mode:', isReadOnly());
    }
  }, [session, status]);

  // ========== FETCH STATISTICS ==========
  const fetchStatistics = useCallback(async () => {
    if (!session) return;
    
    try {
      const result = await asetApi.fetchStatistics(session);
      if (result?.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [session]);

  // ========== FUNCTION TO SORT DATA CLIENT-SIDE ==========
  const sortDataClientSide = (data) => {
    if (!data || !Array.isArray(data)) return data;
    
    const sorted = [...data].sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];
      
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (sortConfig.field === 'tanggal_perolehan') {
        const dateA = aValue ? new Date(aValue).getTime() : 0;
        const dateB = bValue ? new Date(bValue).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  // ========== FETCH DATA ASET ==========
  const fetchDataAset = useCallback(async () => {
    if (!session) {
      setError('Session tidak ditemukan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      
      if (filters.search) {
        result = await asetApi.searchAset(session, filters.search);
      } else if (filters.jenis) {
        result = await asetApi.filterByJenis(session, filters.jenis);
      } else if (filters.kondisi) {
        result = await asetApi.filterByKondisi(session, filters.kondisi);
      } else if (filters.status) {
        result = await asetApi.filterByStatus(session, filters.status);
      } else {
        result = await asetApi.fetchPaginatedAset(
          session, 
          pagination.currentPage, 
          pagination.perPage
        );
      }

      console.log('📥 Data aset:', result);

      if (result?.success) {
        const sortedData = sortDataClientSide(result.data || []);
        setAsetList(sortedData);
        
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            ...result.pagination
          }));
        }
        
        fetchStatistics();
      } else {
        const errorMessage = result?.message || 'Gagal memuat data aset';
        setError(errorMessage);
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('❌ Error fetching aset:', error);
      const errorMessage = error?.message || 'Terjadi kesalahan saat memuat data';
      setError(errorMessage);
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, sortConfig, fetchStatistics]);

  // ========== HANDLE SORT CHANGE ==========
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    
    setAsetList(prev => sortDataClientSide(prev));
  };

  // ========== LOAD DATA ON MOUNT & FILTER CHANGE ==========
  useEffect(() => {
    if (session) {
      fetchDataAset();
    }
  }, [session, fetchDataAset]);

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

  // ========== HANDLE REFRESH ==========
  const handleRefresh = () => {
    fetchDataAset();
    setSnackbar({
      open: true,
      message: 'Data berhasil diperbarui',
      severity: 'success',
    });
  };

  // ========== HANDLE CREATE (with role check) ==========
  const handleCreate = () => {
    if (isReadOnly()) {
      setSnackbar({
        open: true,
        message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah barang.',
        severity: 'error',
      });
      return;
    }
    setSelectedAset(null);
    setModalOpen(true);
  };

  // ========== HANDLE EDIT (with role check) ==========
  const handleEdit = (aset) => {
    if (isReadOnly()) {
      setSnackbar({
        open: true,
        message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah barang.',
        severity: 'error',
      });
      return;
    }
    setSelectedAset(aset);
    setModalOpen(true);
  };

  // ========== HANDLE DELETE (with role check) ==========
  const handleDelete = (aset) => {
    if (isReadOnly()) {
      setSnackbar({
        open: true,
        message: 'Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus barang.',
        severity: 'error',
      });
      return;
    }
    setSelectedAset(aset);
    setDeleteModalOpen(true);
  };

  // ========== HANDLE SUBMIT (CREATE/UPDATE) ==========
  const handleSubmit = async (formData) => {
    if (!session) {
      setSnackbar({
        open: true,
        message: 'Session tidak ditemukan',
        severity: 'error',
      });
      return;
    }

    // Double-check role before submit
    if (isReadOnly()) {
      setSnackbar({
        open: true,
        message: 'Akses ditolak. Anda tidak memiliki izin untuk menyimpan data.',
        severity: 'error',
      });
      return;
    }

    setModalLoading(true);

    try {
      let result;
      
      if (selectedAset) {
        result = await asetApi.updateAset(session, selectedAset.id, formData);
      } else {
        result = await asetApi.createAset(session, formData);
      }

      if (result?.success) {
        setSnackbar({
          open: true,
          message: selectedAset 
            ? 'Aset berhasil diupdate' 
            : 'Aset berhasil ditambahkan',
          severity: 'success',
        });
        setModalOpen(false);
        fetchDataAset();
      } else {
        const errorMessage = result?.message || 'Gagal menyimpan data';
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('❌ Error submitting aset:', error);
      
      if (error?.response?.status === 403) {
        setSnackbar({
          open: true,
          message: 'Akses ditolak. Anda tidak memiliki izin untuk melakukan operasi ini.',
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: error?.message || 'Terjadi kesalahan saat menyimpan data',
          severity: 'error',
        });
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedAset) return;

    // Double-check role before delete
    if (isReadOnly()) {
      setSnackbar({
        open: true,
        message: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus data.',
        severity: 'error',
      });
      return;
    }

    setModalLoading(true);

    try {
      const result = await asetApi.deleteAset(session, selectedAset.id);

      if (result?.success) {
        setSnackbar({
          open: true,
          message: 'Aset berhasil dihapus',
          severity: 'success',
        });
        setDeleteModalOpen(false);
        fetchDataAset();
      } else {
        const errorMessage = result?.message || 'Gagal menghapus aset';
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('❌ Error deleting aset:', error);
      
      if (error?.response?.status === 403) {
        setSnackbar({
          open: true,
          message: 'Akses ditolak. Anda tidak memiliki izin untuk menghapus data.',
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: error?.message || 'Terjadi kesalahan saat menghapus data',
          severity: 'error',
        });
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE EXPORT ==========
  const handleExport = () => {
    setSnackbar({
      open: true,
      message: 'Fitur export sedang dalam pengembangan',
      severity: 'info',
    });
  };

  // ========== HANDLE PRINT ==========
  const handlePrint = () => {
    setSnackbar({
      open: true,
      message: 'Fitur print sedang dalam pengembangan',
      severity: 'info',
    });
  };

  // ========== HANDLE CLOSE MODAL ==========
  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAset(null);
  };

  // ========== HANDLE CLOSE DELETE MODAL ==========
  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedAset(null);
  };

  // ========== HANDLE CLOSE SNACKBAR ==========
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // ========== ROLE BADGE COMPONENT ==========
  // ========== ROLE BADGE COMPONENT ==========
  const RoleBadge = () => {
    const roles = getUserRoles();
    if (!roles.length) return null;
    
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {roles.map((role, index) => (
          <Chip
            key={index}
            label={role}
            size="small"
            sx={{
              fontSize: '0.65rem', height: 22,
              bgcolor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
              fontWeight: 500, '& .MuiChip-label': { px: 1 },
            }}
          />
        ))}
        {isReadOnly() && (
          <Chip
            label="Read Only" size="small"
            icon={<LockIcon sx={{ fontSize: 12 }} />}
            sx={{
              fontSize: '0.65rem', height: 22,
              bgcolor: 'rgba(255,152,0,0.25)', color: 'rgba(255,255,255,0.9)',
              '& .MuiChip-label': { px: 1 }, '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
            }}
          />
        )}
      </Box>
    );
  };

  // ========== BUILD STATISTICS DATA ==========
  const getStatCards = () => {
    if (!statistics) return null;
    return [
      {
        label: 'Total Aset',
        value: statistics.total_aset || 0,
        icon: <InventoryIcon sx={{ fontSize: 22 }} />,
        color: '#3b82f6',
        maxValue: statistics.total_aset || 100,
      },
      {
        label: 'Kondisi Baik',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Baik')?.total || 0,
        icon: <InventoryIcon sx={{ fontSize: 22 }} />,
        color: '#10b981',
        maxValue: statistics.total_aset || 100,
      },
      {
        label: 'Rusak Ringan',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Rusak Ringan')?.total || 0,
        icon: <InventoryIcon sx={{ fontSize: 22 }} />,
        color: '#f59e0b',
        maxValue: statistics.total_aset || 100,
      },
      {
        label: 'Rusak Berat',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Rusak Berat')?.total || 0,
        icon: <InventoryIcon sx={{ fontSize: 22 }} />,
        color: '#ef4444',
        maxValue: statistics.total_aset || 100,
      },
    ];
  };

  // ========== RENDER LOADING STATE ==========
  if (status === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // ========== RENDER ERROR STATE ==========
  if (!session) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Silakan login untuk mengakses data aset
        </Alert>
      </Box>
    );
  }

  return (
    <PolishedPageShell
      title="Inventaris Aset BPOM"
      subtitle="Kelola dan pantau Barang Milik Negara dengan mudah"
      statistics={getStatCards()}
      roleBadge={<RoleBadge />}
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
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={loading}
          >
            Print
          </Button>
          <Tooltip title={isReadOnly() ? 'Hanya admin_pemeliharaan dan admin yang dapat menambah barang' : 'Tambah aset baru'}>
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={isReadOnly() ? <LockIcon /> : <AddIcon />}
                onClick={handleCreate}
                disabled={loading || isReadOnly()}
                sx={{
                  bgcolor: '#fff',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                }}
              >
                {isReadOnly() ? 'Tambah Aset' : 'Tambah Aset'}
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
        session={session}
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

      {/* Table with Sorting */}
      <AsetTable
        data={asetList}
        loading={loading}
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
          Menampilkan {asetList.length} dari {pagination.total} data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sorting: {sortConfig.field} ({sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'})
        </Typography>
      </Box>

      {/* Modal Create/Edit */}
      <AsetModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedAset}
        title={selectedAset ? 'Edit Aset' : 'Tambah Aset Baru'}
        loading={modalLoading}
        session={session}
        readOnly={isReadOnly()}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        asetName={selectedAset?.nama_barang}
        loading={modalLoading}
      />

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PolishedPageShell>
  );
};

export default AsetContainer;