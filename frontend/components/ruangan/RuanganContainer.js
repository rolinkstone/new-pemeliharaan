// components/ruangan/RuanganContainer.js

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
  Container,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as ruanganApi from './api/ruanganApi';
import RuanganTable from './RuanganTable';
import FilterSection from './FilterSection';
import RuanganModal from './modals/RuanganModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import Ruangan from './models/Ruangan';

const RuanganContainer = () => {
  const theme = useTheme();
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

  // ========== HANDLE CREATE ==========
  const handleCreate = () => {
    setSelectedRuangan(null);
    setModalOpen(true);
  };

  // ========== HANDLE VIEW ==========
  const handleView = (ruangan) => {
    setSelectedRuangan(ruangan);
    setViewModalOpen(true);
  };

  // ========== HANDLE EDIT ==========
  const handleEdit = (ruangan) => {
    setSelectedRuangan(ruangan);
    setModalOpen(true);
  };

  // ========== HANDLE DELETE ==========
  const handleDelete = (ruangan) => {
    setSelectedRuangan(ruangan);
    setDeleteModalOpen(true);
  };

  // ========== HANDLE SUBMIT ==========
  const handleSubmit = async (formData) => {
    if (!session) {
      showSnackbar('Session tidak ditemukan', 'error');
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
      showSnackbar('Terjadi kesalahan saat menyimpan data', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedRuangan) return;

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
      showSnackbar('Terjadi kesalahan saat menghapus data', 'error');
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

  // ========== STATISTICS CARDS ==========
  const StatisticsCards = () => {
    if (!statistics) return null;
    
    const cards = [
      {
        title: 'Total Ruangan',
        value: statistics.total || 0,
        icon: <RoomIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.primary.main,
      },
      {
        title: 'Ruangan Aktif',
        value: statistics.aktif || 0,
        icon: <CheckCircleIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.success.main,
      },
      {
        title: 'Ruangan Tidak Aktif',
        value: statistics.tidak_aktif || 0,
        icon: <CancelIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.error.main,
      },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
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
          Silakan login untuk mengakses data ruangan
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Manajemen Ruangan
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Kelola data ruangan dan lokasi BMN
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            disabled={loading}
          >
            Tambah Ruangan
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <StatisticsCards />

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
      />

      {/* Footer Info */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="body2" color="textSecondary">
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
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RuanganContainer;