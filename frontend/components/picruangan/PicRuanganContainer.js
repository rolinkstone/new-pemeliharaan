// components/picruangan/PicRuanganContainer.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Paper,
  Grid,
  Card,
  CardContent,
  useTheme,
  alpha,
  LinearProgress,
  Fade,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Group as GroupIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as picRuanganApi from './api/picRuanganApi';
import PicRuanganTable from './PicRuanganTable';
import FilterSection from './FilterSection';
import PicRuanganModal from './modals/PicRuanganModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';

const PicRuanganContainer = () => {
  const theme = useTheme();
  const { data: session, status } = useSession();
  
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  const [filters, setFilters] = useState({
    user_id: '',
    ruangan_id: '',
    status: 'all',
  });
  
  const [sortConfig, setSortConfig] = useState({
    field: 'tgl_penugasan',
    direction: 'desc'
  });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    perPage: 10,
    total: 0,
    totalPages: 0,
  });

  // ========== IMPROVED HELPER FUNCTIONS FOR ROLE CHECK ==========
  const getUserRoles = () => {
    const roles = [];
    
    // 1. Dari realm_access (Keycloak standard)
    if (session?.user?.realm_access?.roles) {
      roles.push(...session.user.realm_access.roles);
    }
    
    // 2. Dari field role langsung (PENTING! untuk role admin)
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
    const uniqueRoles = [...new Set(roles)];
    console.log('🔍 PIC Ruangan - Detected user roles:', uniqueRoles);
    
    return uniqueRoles;
  };

  const hasRole = (allowedRoles) => {
    const userRoles = getUserRoles();
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));
    console.log(`🔍 PIC Ruangan - User roles: ${userRoles.join(', ')}, Allowed: ${allowedRoles.join(', ')}, Has access: ${hasAccess}`);
    return hasAccess;
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
      const result = await picRuanganApi.fetchPicStatistics(session);
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
      
      if (sortConfig.field === 'tgl_penugasan' || sortConfig.field === 'tgl_berakhir') {
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
  };

  // ========== FETCH DATA ==========
 // components/picruangan/PicRuanganContainer.js

const fetchData = useCallback(async () => {
    if (!session) {
      setError('Session tidak ditemukan');
      setInitialLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pagination.currentPage,
        limit: pagination.perPage,
      };
      
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.ruangan_id) params.ruangan_id = filters.ruangan_id;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      
      const result = await picRuanganApi.fetchAllPicRuangan(session, params);

      if (result?.success) {
        // Pastikan setiap item memiliki user_nama
        const dataWithNames = (result.data || []).map(item => ({
          ...item,
          user_nama: item.user_nama || item.user_detail?.nama || `User ID: ${item.user_id}`,
          user_nip: item.user_nip || item.user_detail?.nip || '',
          user_jabatan: item.user_jabatan || item.user_detail?.jabatan || '-',
          user_email: item.user_email || item.user_detail?.email || '',
          ruangan_nama: item.ruangan_nama || item.ruangan_detail?.nama_ruangan || `Ruangan ID: ${item.ruangan_id}`,
          ruangan_kode: item.ruangan_kode || item.ruangan_detail?.kode_ruangan || '',
          ruangan_lokasi: item.ruangan_lokasi || item.ruangan_detail?.lokasi || '',
        }));
        
        const sortedData = sortData(dataWithNames);
        setDataList(sortedData);
        
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            ...result.pagination
          }));
        }
        
        fetchStatistics();
      } else {
        const errorMessage = result?.message || 'Gagal memuat data';
        setError(errorMessage);
        showSnackbar(errorMessage, 'error');
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      const errorMessage = error?.message || 'Terjadi kesalahan saat memuat data';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage]);
  // ========== INITIAL LOAD ==========
  useEffect(() => {
    if (session) {
      // Log user roles for debugging
      console.log('📋 PIC Ruangan - User session:', session);
      console.log('📋 PIC Ruangan - User object:', session.user);
      console.log('📋 PIC Ruangan - User roles:', getUserRoles());
      console.log('🔒 PIC Ruangan - Can modify data:', canModifyData());
      console.log('📖 PIC Ruangan - Read-only mode:', isReadOnly());
      
      fetchData();
    } else {
      setInitialLoading(false);
    }
  }, [session, fetchData]);

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
    setDataList(prev => sortData(prev));
  };

  // ========== HANDLE REFRESH ==========
  const handleRefresh = () => {
    fetchData();
    showSnackbar('Data berhasil diperbarui', 'success');
  };

  // ========== HANDLE CREATE (with role check) ==========
  const handleCreate = () => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menambah PIC ruangan.', 'error');
      return;
    }
    setSelectedItem(null);
    setModalOpen(true);
  };

  // ========== HANDLE VIEW ==========
  const handleView = (item) => {
    setSelectedItem(item);
    setViewModalOpen(true);
  };

  // ========== HANDLE EDIT (with role check) ==========
  const handleEdit = (item) => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat mengubah PIC ruangan.', 'error');
      return;
    }
    setSelectedItem(item);
    setModalOpen(true);
  };

  // ========== HANDLE DELETE (with role check) ==========
  const handleDelete = (item) => {
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Hanya admin_pemeliharaan dan admin yang dapat menghapus PIC ruangan.', 'error');
      return;
    }
    setSelectedItem(item);
    setDeleteModalOpen(true);
  };

  // ========== HANDLE SUBMIT (with role check) ==========
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
      
      if (selectedItem) {
        result = await picRuanganApi.updatePicRuangan(session, selectedItem.id, formData);
      } else {
        result = await picRuanganApi.createPicRuangan(session, formData);
      }

      if (result?.success) {
        showSnackbar(
          selectedItem 
            ? 'Data berhasil diupdate' 
            : 'Data berhasil ditambahkan', 
          'success'
        );
        setModalOpen(false);
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal menyimpan data', 'error');
      }
    } catch (error) {
      console.error('❌ Error submitting:', error);
      
      if (error?.response?.status === 403) {
        showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk melakukan operasi ini.', 'error');
      } else {
        showSnackbar(error?.message || 'Terjadi kesalahan saat menyimpan data', 'error');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE (with role check) ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedItem) return;

    // Double-check role before delete
    if (isReadOnly()) {
      showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk menghapus data.', 'error');
      return;
    }

    setModalLoading(true);

    try {
      const result = await picRuanganApi.deletePicRuangan(session, selectedItem.id);

      if (result?.success) {
        showSnackbar('Data berhasil dihapus', 'success');
        setDeleteModalOpen(false);
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal menghapus data', 'error');
      }
    } catch (error) {
      console.error('❌ Error deleting:', error);
      
      if (error?.response?.status === 403) {
        showSnackbar('Akses ditolak. Anda tidak memiliki izin untuk menghapus data.', 'error');
      } else {
        showSnackbar(error?.message || 'Terjadi kesalahan saat menghapus data', 'error');
      }
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CLOSE MODAL ==========
  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedItem(null);
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedItem(null);
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

  // ========== STATISTICS CARDS ==========
  const StatisticsCards = () => {
    if (!statistics) return null;
    
    const cards = [
      {
        title: 'Total Penugasan',
        value: statistics.total || 0,
        icon: <GroupIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.primary.main,
      },
      {
        title: 'Aktif',
        value: statistics.aktif || 0,
        icon: <CheckCircleIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.success.main,
      },
      {
        title: 'Nonaktif',
        value: statistics.nonaktif || 0,
        icon: <CancelIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.error.main,
      },
      {
        title: 'PIC Unik',
        value: statistics.unique_users || 0,
        icon: <PersonIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.info.main,
      },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              borderRadius: 2,
              boxShadow: `0 4px 12px ${alpha(card.color, 0.15)}`,
              border: `1px solid ${alpha(card.color, 0.2)}`,
            }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div" fontWeight="bold">
                      {card.value.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{
                    bgcolor: alpha(card.color, 0.1),
                    borderRadius: 2,
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
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
          Silakan login untuk mengakses data PIC ruangan
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Penanggung Jawab Ruangan
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Kelola personil yang bertanggung jawab atas setiap ruangan
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Tooltip title={isReadOnly() ? 'Hanya admin_pemeliharaan dan admin yang dapat menambah PIC ruangan' : 'Tambah penugasan PIC baru'}>
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={isReadOnly() ? <LockIcon /> : <AddIcon />}
                onClick={handleCreate}
                disabled={loading || isReadOnly()}
              >
                Tambah PIC
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <StatisticsCards />

      <FilterSection
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {error && (
        <Fade in={!!error}>
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        </Fade>
      )}

      <PicRuanganTable
        data={dataList}
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

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="body2" color="textSecondary">
          Menampilkan {dataList.length} dari {pagination.total} data
        </Typography>
      </Box>

      <PicRuanganModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedItem}
        title={selectedItem ? 'Edit PIC Ruangan' : 'Tambah PIC Ruangan Baru'}
        loading={modalLoading}
        readOnly={isReadOnly()}
      />

      <PicRuanganModal
        open={viewModalOpen}
        onClose={handleCloseViewModal}
        initialData={selectedItem}
        title="Detail PIC Ruangan"
        viewOnly={true}
        loading={false}
      />

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        itemName={`Penugasan ${selectedItem?.user_nama || ''} di ${selectedItem?.ruangan_nama || ''}`}
        loading={modalLoading}
      />

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
    </Box>
  );
};

export default PicRuanganContainer;