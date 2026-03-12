import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  useTheme,
  alpha,
  LinearProgress,
  Fade,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as asetApi from './api/asetApi';
import AsetTable from './AsetTable';
import FilterSection from './FilterSection';
import AsetModal from './modals/AsetModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';

const AsetContainer = () => {
  const theme = useTheme();
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
  
  // State untuk sorting - TAMBAHAN BARU
  const [sortConfig, setSortConfig] = useState({
    field: 'id',        // default sort by id
    direction: 'desc'   // default descending (terbaru dulu)
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
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle dates
      if (sortConfig.field === 'tanggal_perolehan') {
        const dateA = aValue ? new Date(aValue).getTime() : 0;
        const dateB = bValue ? new Date(bValue).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Handle strings (case-insensitive)
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
      
      // Apply filters
      if (filters.search) {
        result = await asetApi.searchAset(session, filters.search);
      } else if (filters.jenis) {
        result = await asetApi.filterByJenis(session, filters.jenis);
      } else if (filters.kondisi) {
        result = await asetApi.filterByKondisi(session, filters.kondisi);
      } else if (filters.status) {
        result = await asetApi.filterByStatus(session, filters.status);
      } else {
        // Use pagination
        result = await asetApi.fetchPaginatedAset(
          session, 
          pagination.currentPage, 
          pagination.perPage
        );
      }

      console.log('📥 Data aset:', result);

      if (result?.success) {
        // Apply client-side sorting
        const sortedData = sortDataClientSide(result.data || []);
        setAsetList(sortedData);
        
        if (result.pagination) {
          setPagination(prev => ({
            ...prev,
            ...result.pagination
          }));
        }
        
        // Fetch statistics after data load
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
    
    // Re-sort existing data
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
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset ke halaman 1
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

  // ========== HANDLE CREATE ==========
  const handleCreate = () => {
    setSelectedAset(null);
    setModalOpen(true);
  };

  // ========== HANDLE EDIT ==========
  const handleEdit = (aset) => {
    setSelectedAset(aset);
    setModalOpen(true);
  };

  // ========== HANDLE DELETE ==========
  const handleDelete = (aset) => {
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
      setSnackbar({
        open: true,
        message: error?.message || 'Terjadi kesalahan saat menyimpan data',
        severity: 'error',
      });
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedAset) return;

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
      setSnackbar({
        open: true,
        message: error?.message || 'Terjadi kesalahan saat menghapus data',
        severity: 'error',
      });
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

  // ========== STATISTICS CARD COMPONENT ==========
  const StatisticsCards = () => {
    if (!statistics) return null;
    
    const cards = [
      {
        title: 'Total Aset',
        value: statistics.total_aset || 0,
        icon: <InventoryIcon />,
        color: theme.palette.primary.main,
      },
      {
        title: 'Kondisi Baik',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Baik')?.total || 0,
        icon: <InventoryIcon />,
        color: theme.palette.success.main,
      },
      {
        title: 'Rusak Ringan',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Rusak Ringan')?.total || 0,
        icon: <InventoryIcon />,
        color: theme.palette.warning.main,
      },
      {
        title: 'Rusak Berat',
        value: statistics.per_kondisi?.find(k => k.kondisi === 'Rusak Berat')?.total || 0,
        icon: <InventoryIcon />,
        color: theme.palette.error.main,
      },
    ];

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
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
                    <InventoryIcon sx={{ color: card.color, fontSize: 32 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Inventaris Aset BPOM
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Kelola dan pantau Barang Milik Negara dengan mudah
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            disabled={loading}
          >
            Tambah Aset
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <StatisticsCards />

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
      />

      {/* Footer Info */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="body2" color="textSecondary">
          Menampilkan {asetList.length} dari {pagination.total} data
        </Typography>
        <Typography variant="body2" color="textSecondary">
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
    </Box>
  );
};

export default AsetContainer;