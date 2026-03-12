// components/laporanrusak/LaporanRusakContainer.js

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  DoneAll as DoneAllIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import * as laporanApi from './api/laporanRusakApi';
import LaporanRusakTable from './LaporanRusakTable';
import FilterSection from './FilterSection';
import LaporanRusakModal from './modals/LaporanRusakModal';
import VerifikasiModal from './modals/VerifikasiModal';
import DisposisiModal from './modals/DisposisiModal';
import VerifikasiPPKModal from './modals/VerifikasiPPKModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';

const LaporanRusakContainer = () => {
  const theme = useTheme();
  const { data: session, status } = useSession();
  
  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);
  
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  const [filters, setFilters] = useState({
    status: '',
    prioritas: '',
    aset_id: '',
    ruangan_id: '',
    pelapor_id: '',
    search: ''
  });
  
  const [sortConfig, setSortConfig] = useState({
    field: 'tgl_laporan',
    direction: 'desc'
  });
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [verifikasiModalOpen, setVerifikasiModalOpen] = useState(false);
  const [disposisiModalOpen, setDisposisiModalOpen] = useState(false);
  const [verifikasiPPKModalOpen, setVerifikasiPPKModalOpen] = useState(false);
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

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    if (!session) return;
    try {
      const result = await laporanApi.getStats(session);
      if (result?.success) setStatistics(result.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [session]);

  // Sort function
  const sortData = useCallback((data) => {
    if (!data || !sortConfig.field) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];
      
      if (sortConfig.field === 'tgl_laporan') {
        aVal = aVal ? new Date(aVal) : new Date(0);
        bVal = bVal ? new Date(bVal) : new Date(0);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortConfig.field, sortConfig.direction]);

  // Process data to ensure foto_kerusakan is in correct format
  const processData = (data) => {
    if (!data) return [];
    
    return data.map(item => {
      console.log('🔄 Processing item:', item.id, 'Original foto_kerusakan:', item.foto_kerusakan);
      
      let fotoKerusakan = [];
      
      if (item.foto_kerusakan) {
        // Case 1: Already an array
        if (Array.isArray(item.foto_kerusakan)) {
          fotoKerusakan = item.foto_kerusakan.map(foto => {
            if (typeof foto === 'string') {
              return foto;
            }
            if (typeof foto === 'object' && foto !== null) {
              return foto.url || foto.preview || '';
            }
            return foto;
          });
        }
        // Case 2: It's a string (maybe JSON or single URL)
        else if (typeof item.foto_kerusakan === 'string') {
          if (item.foto_kerusakan.startsWith('[') || item.foto_kerusakan.startsWith('{')) {
            try {
              const parsed = JSON.parse(item.foto_kerusakan);
              if (Array.isArray(parsed)) {
                fotoKerusakan = parsed.map(foto => {
                  if (typeof foto === 'string') return foto;
                  return foto.url || foto.preview || '';
                });
              } else if (typeof parsed === 'object') {
                fotoKerusakan = [parsed.url || parsed.preview || ''];
              }
            } catch {
              fotoKerusakan = [item.foto_kerusakan];
            }
          } else {
            fotoKerusakan = [item.foto_kerusakan];
          }
        }
        // Case 3: It's an object
        else if (typeof item.foto_kerusakan === 'object' && item.foto_kerusakan !== null) {
          fotoKerusakan = [item.foto_kerusakan.url || item.foto_kerusakan.preview || ''];
        }
      }
      
      // Filter out empty strings
      fotoKerusakan = fotoKerusakan.filter(url => url && url.trim() !== '');
      
      console.log('✅ Processed item:', item.id, 'Processed foto_kerusakan:', fotoKerusakan);
      
      return {
        ...item,
        foto_kerusakan: fotoKerusakan
      };
    });
  };

  // Fetch data
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
        ...filters
      };
      
      const result = await laporanApi.getAll(session, params);

      if (result?.success) {
        const processedData = processData(result.data || []);
        const sortedData = sortData(processedData);
        setDataList(sortedData);
        
        if (result.pagination) {
          setPagination(prev => ({ ...prev, ...result.pagination }));
        }
        
        fetchStatistics();
      } else {
        const errorMessage = result?.message || 'Gagal memuat data';
        setError(errorMessage);
        showSnackbar(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar(error.message, 'error');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [session, filters, pagination.currentPage, pagination.perPage, sortData, fetchStatistics]);

  // Initial fetch
  useEffect(() => {
    if (session && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchData();
    } else if (!session) {
      setInitialLoading(false);
    }
    
    return () => {
      initialFetchDone.current = false;
    };
  }, [session, fetchData]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    initialFetchDone.current = false;
  };

  const handlePageChange = (page, perPage) => {
    if (perPage) {
      setPagination(prev => ({ ...prev, currentPage: 1, perPage }));
    } else {
      setPagination(prev => ({ ...prev, currentPage: page }));
    }
    initialFetchDone.current = false;
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleRefresh = () => {
    initialFetchDone.current = false;
    fetchData();
    showSnackbar('Data berhasil diperbarui', 'success');
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setModalOpen(true);
  };

  const handleView = (item) => {
    setSelectedItem(item);
    setViewModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleVerifikasi = (item) => {
    setSelectedItem(item);
    setVerifikasiModalOpen(true);
  };

  const handleDisposisi = (item) => {
    setSelectedItem(item);
    setDisposisiModalOpen(true);
  };

  const handleVerifikasiPPK = (item) => {
    setSelectedItem(item);
    setVerifikasiPPKModalOpen(true);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async (formData) => {
    if (!session) {
      showSnackbar('Session tidak ditemukan', 'error');
      return;
    }

    setModalLoading(true);

    try {
      let fotoUrls = [];
      
      // Upload foto terlebih dahulu jika ada
      if (formData.foto_kerusakan && formData.foto_kerusakan.length > 0) {
        const files = formData.foto_kerusakan
          .filter(foto => foto.file)
          .map(foto => foto.file);
        
        if (files.length > 0) {
          console.log('📤 Uploading files:', files.length);
          const uploadResult = await laporanApi.uploadFoto(session, files);
          
          console.log('📥 Upload result:', uploadResult);
          
          if (uploadResult?.success) {
            fotoUrls = uploadResult.data.map(f => f.url);
            console.log('✅ Foto URLs:', fotoUrls);
          } else {
            showSnackbar(uploadResult?.message || 'Gagal upload foto', 'error');
            setModalLoading(false);
            return;
          }
        }
      }
      
      // Siapkan data untuk dikirim ke backend
      const dataToSend = {
        aset_id: formData.aset_id,
        ruangan_id: formData.ruangan_id,
        tgl_laporan: formData.tgl_laporan instanceof Date 
          ? formData.tgl_laporan.toISOString().split('T')[0] 
          : formData.tgl_laporan,
        deskripsi: formData.deskripsi,
        prioritas: formData.prioritas,
        foto_kerusakan: fotoUrls,
      };
      
      console.log('📤 Data to send:', dataToSend);
      
      let result;
      if (selectedItem) {
        result = await laporanApi.update(session, selectedItem.id, dataToSend);
      } else {
        dataToSend.pelapor_id = session.user?.id || session.user?.sub || 'unknown';
        result = await laporanApi.create(session, dataToSend);
      }

      if (result?.success) {
        showSnackbar(
          selectedItem ? 'Laporan berhasil diupdate' : 'Laporan berhasil dibuat',
          'success'
        );
        setModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal menyimpan data', 'error');
      }
    } catch (error) {
      console.error('❌ Submit error:', error);
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmVerifikasi = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.verifikasi(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Verifikasi berhasil', 'success');
        setVerifikasiModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal verifikasi', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDisposisi = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.disposisi(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Disposisi berhasil', 'success');
        setDisposisiModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal disposisi', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmVerifikasiPPK = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.verifikasiPPK(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Verifikasi PPK berhasil', 'success');
        setVerifikasiPPKModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal verifikasi PPK', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.remove(session, selectedItem.id);
      if (result?.success) {
        showSnackbar('Laporan berhasil dihapus', 'success');
        setDeleteModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal hapus', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  // Statistics Cards Component
  const StatisticsCards = () => {
    if (!statistics) return null;
    
    const cards = [
      { 
        title: 'Total Laporan', 
        value: statistics.total || 0, 
        icon: <AssignmentIcon />, 
        color: theme.palette.primary.main 
      },
      { 
        title: 'Menunggu Verifikasi', 
        value: statistics.menunggu_verifikasi || 0, 
        icon: <WarningIcon />, 
        color: theme.palette.warning.main 
      },
      { 
        title: 'Dalam Perbaikan', 
        value: statistics.dalam_perbaikan || 0, 
        icon: <BuildIcon />, 
        color: theme.palette.info.main 
      },
      { 
        title: 'Selesai', 
        value: statistics.selesai || 0, 
        icon: <DoneAllIcon />, 
        color: theme.palette.success.main 
      },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card sx={{ borderRadius: 2, boxShadow: `0 4px 12px ${alpha(card.color, 0.15)}` }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="textSecondary">{card.title}</Typography>
                    <Typography variant="h4" fontWeight="bold">{card.value.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: alpha(card.color, 0.1), borderRadius: 2, p: 1 }}>
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

  if (status === 'loading' || initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box p={3}>
        <Alert severity="warning">Silakan login untuk mengakses laporan kerusakan</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Laporan Kerusakan Aset
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Kelola pelaporan dan perbaikan aset yang rusak
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} disabled={loading}>
            Buat Laporan
          </Button>
        </Box>
      </Box>

      <StatisticsCards />

      <FilterSection filters={filters} onFilterChange={handleFilterChange} />

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Fade in={!!error}>
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        </Fade>
      )}

      <LaporanRusakTable
        data={dataList}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onVerifikasi={handleVerifikasi}
        onDisposisi={handleDisposisi}
        onVerifikasiPPK={handleVerifikasiPPK}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          Menampilkan {dataList.length} dari {pagination.total} data
        </Typography>
      </Box>

      {/* Modals */}
      <LaporanRusakModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedItem}
        title={selectedItem ? 'Edit Laporan' : 'Buat Laporan Baru'}
        loading={modalLoading}
      />

      <LaporanRusakModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        initialData={selectedItem}
        title="Detail Laporan"
        readOnly={true}
        loading={modalLoading}
      />

      <VerifikasiModal
        open={verifikasiModalOpen}
        onClose={() => setVerifikasiModalOpen(false)}
        onConfirm={handleConfirmVerifikasi}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <DisposisiModal
        open={disposisiModalOpen}
        onClose={() => setDisposisiModalOpen(false)}
        onConfirm={handleConfirmDisposisi}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <VerifikasiPPKModal
        open={verifikasiPPKModalOpen}
        onClose={() => setVerifikasiPPKModalOpen(false)}
        onConfirm={handleConfirmVerifikasiPPK}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={`Laporan ${selectedItem?.nomor_laporan || ''}`}
        loading={modalLoading}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LaporanRusakContainer;