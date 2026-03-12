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
  Tab,
  Tabs,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Inventory as AsetIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  Timeline as TimelineIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as asetRuanganApi from './api/asetRuanganApi';
import AsetRuanganTable from './AsetRuanganTable';
import FilterSection from './FilterSection';
import AsetRuanganModal from './modals/AsetRuanganModal';
import KeluarAsetModal from './modals/KeluarAsetModal';
import PindahAsetModal from './modals/PindahAsetModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';

const AsetRuanganContainer = () => {
  const theme = useTheme();
  const { data: session, status } = useSession();
  
  // State untuk tab
  const [tabValue, setTabValue] = useState(0);
  
  // State untuk data
  const [asetRuanganList, setAsetRuanganList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  // State untuk menyimpan detail aset dan ruangan
  const [asetDetails, setAsetDetails] = useState({});
  const [ruanganDetails, setRuanganDetails] = useState({});
  
  // State untuk filter
  const [filters, setFilters] = useState({
    search: '',
    aset_id: '',
    ruangan_id: '',
    status: 'all',
  });
  
  // State untuk sorting
  const [sortConfig, setSortConfig] = useState({
    field: 'tgl_masuk',
    direction: 'desc'
  });
  
  // State untuk modal
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [keluarModalOpen, setKeluarModalOpen] = useState(false);
  const [pindahModalOpen, setPindahModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
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

  // ========== FETCH ASET DETAILS ==========
  const fetchAsetDetails = useCallback(async () => {
    if (!session) return;
    
    try {
      console.log('📥 Fetching aset details...');
      const result = await asetRuanganApi.fetchAsetOptions(session);
      if (result?.success && result.data) {
        const details = {};
        result.data.forEach(aset => {
          details[aset.id] = aset;
        });
        setAsetDetails(details);
        console.log('✅ Aset details loaded:', Object.keys(details).length);
        return details;
      }
    } catch (error) {
      console.error('Error fetching aset details:', error);
    }
  }, [session]);

  // ========== FETCH RUANGAN DETAILS ==========
  const fetchRuanganDetails = useCallback(async () => {
    if (!session) return;
    
    try {
      console.log('📥 Fetching ruangan details...');
      const result = await asetRuanganApi.fetchRuanganOptions(session);
      if (result?.success && result.data) {
        const details = {};
        result.data.forEach(ruangan => {
          details[ruangan.id] = ruangan;
        });
        setRuanganDetails(details);
        console.log('✅ Ruangan details loaded:', Object.keys(details).length);
        return details;
      }
    } catch (error) {
      console.error('Error fetching ruangan details:', error);
    }
  }, [session]);

  // ========== FETCH STATISTICS ==========
  const fetchStatistics = useCallback(async () => {
    if (!session) return;
    
    try {
      const result = await asetRuanganApi.fetchAsetRuanganStatistics(session);
      if (result?.success) {
        setStatistics(result.data);
      } else {
        setStatistics({
          total: 0,
          aktif: 0,
          dipindah: 0,
          dihapuskan: 0,
          unique_aset: 0
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setStatistics({
        total: 0,
        aktif: 0,
        dipindah: 0,
        dihapuskan: 0,
        unique_aset: 0
      });
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
      
      if (sortConfig.field === 'tgl_masuk' || sortConfig.field === 'tgl_keluar') {
        const dateA = aValue ? new Date(aValue).getTime() : 0;
        const dateB = bValue ? new Date(bValue).getTime() : 0;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
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

  // ========== ENRICH DATA WITH DETAILS ==========
  const enrichDataWithDetails = (data, asetDet, ruanganDet) => {
    if (!data || !Array.isArray(data)) return data;
    
    return data.map(item => ({
      ...item,
      aset_detail: asetDet[item.aset_id] || null,
      ruangan_detail: ruanganDet[item.ruangan_id] || null,
      aset_nama: asetDet[item.aset_id]?.nama_barang || `Aset ID: ${item.aset_id}`,
      aset_kode: asetDet[item.aset_id]?.kode_barang || '',
      ruangan_nama: ruanganDet[item.ruangan_id]?.nama_ruangan || `Ruangan ID: ${item.ruangan_id}`,
      ruangan_kode: ruanganDet[item.ruangan_id]?.kode_ruangan || '',
    }));
  };

  // ========== FETCH DATA ==========
  const fetchData = useCallback(async (asetDet, ruanganDet) => {
    if (!session) {
      setError('Session tidak ditemukan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      
      const params = {
        page: pagination.currentPage,
        limit: pagination.perPage,
      };
      
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      
      if (tabValue === 1 && filters.ruangan_id) {
        result = await asetRuanganApi.fetchAsetByRuangan(session, filters.ruangan_id);
      } else if (tabValue === 2 && filters.aset_id) {
        result = await asetRuanganApi.fetchRiwayatAset(session, filters.aset_id);
      } else {
        result = await asetRuanganApi.fetchAllAsetRuangan(session, params);
      }

      console.log('📥 Data aset ruangan:', result);

      if (result?.success) {
        // Gunakan details yang sudah ada
        const detailsToUse = asetDet || asetDetails;
        const ruanganDetToUse = ruanganDet || ruanganDetails;
        
        const enrichedData = enrichDataWithDetails(result.data || [], detailsToUse, ruanganDetToUse);
        const sortedData = sortData(enrichedData);
        setAsetRuanganList(sortedData);
        
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
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, tabValue, asetDetails, ruanganDetails]);

  // ========== LOAD INITIAL DATA ==========
  useEffect(() => {
    if (!session) {
      setInitialLoading(false);
      return;
    }
    
    const loadInitialData = async () => {
      setInitialLoading(true);
      
      try {
        // Load details first in parallel
        const [asetDet, ruanganDet] = await Promise.all([
          fetchAsetDetails(),
          fetchRuanganDetails()
        ]);
        
        // Then load data with the details
        await fetchData(asetDet, ruanganDet);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Gagal memuat data awal');
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, [session]); // Hanya bergantung pada session

  // ========== HANDLE REFRESH ==========
  const handleRefresh = async () => {
    setLoading(true);
    
    try {
      // Refresh details first
      const [asetDet, ruanganDet] = await Promise.all([
        fetchAsetDetails(),
        fetchRuanganDetails()
      ]);
      
      // Then refresh data
      await fetchData(asetDet, ruanganDet);
      
      showSnackbar('Data berhasil diperbarui', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showSnackbar('Gagal memperbarui data', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    setAsetRuanganList(prev => sortData(prev));
  };

  // ========== HANDLE CREATE ==========
  const handleCreate = () => {
    setSelectedItem(null);
    setModalOpen(true);
  };

  // ========== HANDLE VIEW ==========
  const handleView = (item) => {
    setSelectedItem(item);
    setViewModalOpen(true);
  };

  // ========== HANDLE EDIT ==========
  const handleEdit = (item) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  // ========== HANDLE PINDAH ==========
  const handlePindah = (item) => {
    setSelectedItem(item);
    setPindahModalOpen(true);
  };

  // ========== HANDLE CATAT KELUAR ==========
  const handleCatatKeluar = (item) => {
    setSelectedItem(item);
    setKeluarModalOpen(true);
  };

  // ========== HANDLE DELETE ==========
  const handleDelete = (item) => {
    setSelectedItem(item);
    setDeleteModalOpen(true);
  };

  // ========== HANDLE LIHAT RIWAYAT ==========
  const handleLihatRiwayat = (item) => {
    setTabValue(2);
    setFilters(prev => ({ ...prev, aset_id: item.aset_id }));
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
      
      if (selectedItem) {
        result = await asetRuanganApi.updateAsetRuangan(session, selectedItem.id, formData);
      } else {
        result = await asetRuanganApi.createAsetRuangan(session, formData);
      }

      if (result?.success) {
        showSnackbar(
          selectedItem 
            ? 'Data berhasil diupdate' 
            : 'Data berhasil ditambahkan', 
          'success'
        );
        setModalOpen(false);
        
        // Refresh data with new details
        const [asetDet, ruanganDet] = await Promise.all([
          fetchAsetDetails(),
          fetchRuanganDetails()
        ]);
        await fetchData(asetDet, ruanganDet);
      } else {
        showSnackbar(result?.message || 'Gagal menyimpan data', 'error');
      }
    } catch (error) {
      console.error('❌ Error submitting:', error);
      showSnackbar(error?.message || 'Terjadi kesalahan saat menyimpan data', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM PINDAH ==========
  const handleConfirmPindah = async (data) => {
    if (!session || !selectedItem) return;

    setModalLoading(true);

    try {
      const result = await asetRuanganApi.pindahAset(session, {
        aset_id: selectedItem.aset_id,
        ruangan_baru_id: data.ruangan_baru_id,
        tgl_pindah: data.tgl_pindah,
        keterangan: data.keterangan
      });
      
      if (result?.success) {
        showSnackbar('Aset berhasil dipindahkan', 'success');
        setPindahModalOpen(false);
        
        // Refresh data
        const [asetDet, ruanganDet] = await Promise.all([
          fetchAsetDetails(),
          fetchRuanganDetails()
        ]);
        await fetchData(asetDet, ruanganDet);
      } else {
        showSnackbar(result?.message || 'Gagal memindahkan aset', 'error');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      showSnackbar(error?.message || 'Terjadi kesalahan', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM KELUAR ==========
  const handleConfirmKeluar = async (data) => {
    if (!session || !selectedItem) return;

    setModalLoading(true);

    try {
      const result = await asetRuanganApi.catatKeluarAset(session, selectedItem.id, data);
      
      if (result?.success) {
        showSnackbar('Aset berhasil dicatat keluar', 'success');
        setKeluarModalOpen(false);
        
        // Refresh data
        const [asetDet, ruanganDet] = await Promise.all([
          fetchAsetDetails(),
          fetchRuanganDetails()
        ]);
        await fetchData(asetDet, ruanganDet);
      } else {
        showSnackbar(result?.message || 'Gagal mencatat keluar', 'error');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      showSnackbar(error?.message || 'Terjadi kesalahan', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // ========== HANDLE CONFIRM DELETE ==========
  const handleConfirmDelete = async () => {
    if (!session || !selectedItem) return;

    setModalLoading(true);

    try {
      const result = await asetRuanganApi.deleteAsetRuangan(session, selectedItem.id);
      
      if (result?.success) {
        showSnackbar('Data berhasil dihapus', 'success');
        setDeleteModalOpen(false);
        
        // Refresh data
        const [asetDet, ruanganDet] = await Promise.all([
          fetchAsetDetails(),
          fetchRuanganDetails()
        ]);
        await fetchData(asetDet, ruanganDet);
      } else {
        showSnackbar(result?.message || 'Gagal menghapus data', 'error');
      }
    } catch (error) {
      console.error('❌ Error deleting:', error);
      showSnackbar(error?.message || 'Terjadi kesalahan saat menghapus data', 'error');
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

  const handleCloseKeluarModal = () => {
    setKeluarModalOpen(false);
    setSelectedItem(null);
  };

  const handleClosePindahModal = () => {
    setPindahModalOpen(false);
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
        title: 'Total Posisi',
        value: statistics.total || 0,
        icon: <TimelineIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.primary.main,
      },
      {
        title: 'Aktif',
        value: statistics.aktif || 0,
        icon: <CheckCircleIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.success.main,
      },
      {
        title: 'Dipindah',
        value: statistics.dipindah || 0,
        icon: <WarningIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.warning.main,
      },
      {
        title: 'Dihapuskan',
        value: statistics.dihapuskan || 0,
        icon: <ErrorIcon sx={{ fontSize: 32 }} />,
        color: theme.palette.error.main,
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
          Silakan login untuk mengakses data posisi aset
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
            Posisi Aset di Ruangan
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Lacak lokasi dan riwayat perpindahan aset BMN
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
            Tambah Posisi
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <StatisticsCards />

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Semua Posisi" icon={<TimelineIcon />} iconPosition="start" />
          <Tab label="Aset per Ruangan" icon={<RoomIcon />} iconPosition="start" />
          <Tab label="Riwayat Aset" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Filter Section */}
      <FilterSection
        filters={filters}
        onFilterChange={handleFilterChange}
        showAsetFilter={tabValue !== 2}
        showRuanganFilter={tabValue !== 1}
      />

      {/* Loading Progress */}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <AsetRuanganTable
        data={asetRuanganList}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPindah={handlePindah}
        onCatatKeluar={handleCatatKeluar}
        onLihatRiwayat={handleLihatRiwayat}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortConfig={sortConfig}
        onSort={handleSort}
        showAsetColumn={tabValue !== 2}
        showRuanganColumn={tabValue !== 1}
      />

      {/* Footer Info */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
        <Typography variant="body2" color="textSecondary">
          Menampilkan {asetRuanganList.length} dari {pagination.total} data
        </Typography>
      </Box>

      {/* Modals */}
      <AsetRuanganModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedItem}
        title={selectedItem ? 'Edit Posisi Aset' : 'Tambah Posisi Aset Baru'}
        loading={modalLoading}
      />

      <AsetRuanganModal
        open={viewModalOpen}
        onClose={handleCloseViewModal}
        initialData={selectedItem}
        title="Detail Posisi Aset"
        viewOnly={true}
        loading={false}
      />

      <PindahAsetModal
        open={pindahModalOpen}
        onClose={handleClosePindahModal}
        onConfirm={handleConfirmPindah}
        asetInfo={selectedItem?.aset_detail}
        ruanganInfo={selectedItem?.ruangan_detail}
        loading={modalLoading}
      />

      <KeluarAsetModal
        open={keluarModalOpen}
        onClose={handleCloseKeluarModal}
        onConfirm={handleConfirmKeluar}
        asetInfo={selectedItem?.aset_detail}
        ruanganInfo={selectedItem?.ruangan_detail}
        loading={modalLoading}
      />

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        itemName={selectedItem?.aset_nama || 'Data ini'}
        loading={modalLoading}
      />

      {/* Snackbar */}
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AsetRuanganContainer;