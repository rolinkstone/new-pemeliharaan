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
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  LinearProgress,
  Fade,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Assignment as AssignmentIcon,
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
import KatimKirimModal from './modals/KatimKirimModal';
import PPKVerifikasiModal from './modals/PPKVerifikasiModal';
import CatatPerbaikanModal from './modals/CatatPerbaikanModal';
import KonfirmasiKabagModal from './modals/KonfirmasiKabagModal';
import KonfirmasiUserModal from './modals/KonfirmasiUserModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import PolishedPageShell from '../common/PolishedPageShell';

const LaporanRusakContainer = () => {
  const { data: session, status } = useSession();
  
  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);
  
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [picData, setPicData] = useState({}); // State untuk data PIC
  
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
  const [katimModalOpen, setKatimModalOpen] = useState(false);
  const [ppkModalOpen, setPpkModalOpen] = useState(false);
  const [catatPerbaikanModalOpen, setCatatPerbaikanModalOpen] = useState(false);
  const [konfirmasiKabagModalOpen, setKonfirmasiKabagModalOpen] = useState(false);
  const [konfirmasiUserModalOpen, setKonfirmasiUserModalOpen] = useState(false);
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

  // Extract PIC data from the response
  const extractPicData = useCallback((data) => {
    const picDetails = {};
    
    data.forEach(item => {
      if (item.ruangan_id) {
        // Jika data sudah memiliki informasi PIC ruangan
        if (item.pic_ruangan) {
          picDetails[item.ruangan_id] = item.pic_ruangan;
        } 
        // Atau jika ada informasi pelapor yang bisa dijadikan PIC
        else if (item.pelapor_id && item.pelapor_nama) {
          picDetails[item.ruangan_id] = {
            id: item.pelapor_id,
            nama: item.pelapor_nama,
            user_id: item.pelapor_id
          };
        }
      }
    });
    
    setPicData(picDetails);
  }, []);

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
        
        // Extract PIC data from the response
        extractPicData(processedData);
        
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
  }, [session, filters, pagination.currentPage, pagination.perPage, sortData, fetchStatistics, extractPicData]);

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

  const handleKatimKirim = (item) => {
    setSelectedItem(item);
    setKatimModalOpen(true);
  };

  const handlePPK = (item) => {
    setSelectedItem(item);
    setPpkModalOpen(true);
  };

  const handleCatatPerbaikan = (item) => {
    setSelectedItem(item);
    setCatatPerbaikanModalOpen(true);
  };

  const handleKonfirmasiKabag = (item) => {
    setSelectedItem(item);
    setKonfirmasiKabagModalOpen(true);
  };

  const handleKonfirmasiUser = (item) => {
    setSelectedItem(item);
    setKonfirmasiUserModalOpen(true);
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

  const handleConfirmKatim = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.katimVerifikasi(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Laporan diteruskan ke PPK', 'success');
        setKatimModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal kirim ke PPK', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmPPK = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.ppkVerifikasi(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Verifikasi PPK berhasil', 'success');
        setPpkModalOpen(false);
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

  const handleConfirmCatatPerbaikan = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.catatPerbaikan(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Perbaikan dicatat selesai', 'success');
        setCatatPerbaikanModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal mencatat perbaikan', 'error');
      }
    } catch (error) {
      console.error('❌ Error catat perbaikan:', error);
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmKonfirmasiKabag = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.konfirmasiKabag(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Perbaikan dikonfirmasi Kabag TU', 'success');
        setKonfirmasiKabagModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal konfirmasi Kabag TU', 'error');
      }
    } catch (error) {
      showSnackbar(error.message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConfirmKonfirmasiUser = async (data) => {
    if (!session || !selectedItem) return;
    setModalLoading(true);
    try {
      const result = await laporanApi.konfirmasiUser(session, selectedItem.id, data);
      if (result?.success) {
        showSnackbar('Laporan selesai', 'success');
        setKonfirmasiUserModalOpen(false);
        initialFetchDone.current = false;
        fetchData();
      } else {
        showSnackbar(result?.message || 'Gagal konfirmasi', 'error');
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

  // ========== BUILD STATISTICS DATA ==========
  const getStatCards = () => {
    if (!statistics) return null;
    return [
      {
        label: 'Total Laporan',
        value: statistics.total || 0,
        icon: <AssignmentIcon sx={{ fontSize: 22 }} />,
        color: '#3b82f6',
        maxValue: statistics.total || 100,
      },
      {
        label: 'Menunggu Proses',
        value: (statistics.diajukan || 0) + (statistics.menunggu_katim || 0) + (statistics.menunggu_ppk || 0) + (statistics.menunggu_konfirmasi_kabag || 0) + (statistics.menunggu_konfirmasi_user || 0),
        icon: <WarningIcon sx={{ fontSize: 22 }} />,
        color: '#f59e0b',
        maxValue: statistics.total || 100,
      },
      {
        label: 'Dalam Perbaikan',
        value: statistics.dalam_perbaikan || 0,
        icon: <BuildIcon sx={{ fontSize: 22 }} />,
        color: '#06b6d4',
        maxValue: statistics.total || 100,
      },
      {
        label: 'Selesai',
        value: statistics.selesai || 0,
        icon: <DoneAllIcon sx={{ fontSize: 22 }} />,
        color: '#10b981',
        maxValue: statistics.total || 100,
      },
    ];
  };

  // Quick filter chips berdasarkan status
  const quickFilters = [
    { key: '', label: 'Semua', icon: null },
    { key: 'diajukan', label: 'Diajukan', icon: <WarningIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_katim', label: 'Menunggu Katim', icon: <AssignmentIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_ppk', label: 'Menunggu PPK', icon: <AttachMoneyIcon sx={{ fontSize: 14 }} /> },
    { key: 'dalam_perbaikan', label: 'Perbaikan', icon: <BuildIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_konfirmasi_kabag', label: 'Konfirmasi Kabag', icon: <AssignmentIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_konfirmasi_user', label: 'Konfirmasi User', icon: <DoneAllIcon sx={{ fontSize: 14 }} /> },
    { key: 'selesai', label: 'Selesai', icon: <DoneAllIcon sx={{ fontSize: 14 }} /> },
    { key: 'ditolak', label: 'Ditolak', icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
  ];

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
    <PolishedPageShell
      title="Laporan Kerusakan Aset"
      subtitle="Kelola pelaporan dan perbaikan aset yang rusak"
      statistics={getStatCards()}
      actions={
        <>
          {/* Search bar inline */}
          <TextField
            size="small"
            placeholder="Cari nomor/deskripsi..."
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFilterChange({ ...filters, search: e.target.value }); }}
            sx={{
              minWidth: 200,
              bgcolor: 'rgba(255,255,255,0.12)',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
              },
              '& .MuiInputAdornment-root': { color: 'rgba(255,255,255,0.5)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: filters.search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleFilterChange({ ...filters, search: '' })} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.3)', color: '#fff',
              '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            Refresh
          </Button>
          {!['menunggu_katim', 'menunggu_ppk', 'dalam_perbaikan', 'menunggu_konfirmasi_kabag', 'menunggu_konfirmasi_user', 'selesai', 'ditolak'].includes(filters.status) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              disabled={loading}
              sx={{
                bgcolor: '#fff', color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
              }}
            >
              + Baru
            </Button>
          )}
        </>
      }
    >
      {/* QUICK FILTER CHIPS */}
      <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {quickFilters.map((qf) => (
          <Chip
            key={qf.key}
            label={qf.label}
            icon={qf.icon}
            size="small"
            variant={filters.status === qf.key ? 'filled' : 'outlined'}
            color={filters.status === qf.key ? 'primary' : 'default'}
            onClick={() => handleFilterChange({ ...filters, status: qf.key })}
            sx={{
              fontWeight: filters.status === qf.key ? 600 : 400,
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-1px)' }
            }}
          />
        ))}
      </Box>

      <FilterSection filters={filters} onFilterChange={handleFilterChange} />

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

      {/* EMPTY STATE */}
      {!loading && dataList.length === 0 && !error ? (
        <Fade in>
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Tidak Ada Laporan
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              {['menunggu_katim', 'menunggu_ppk', 'dalam_perbaikan', 'menunggu_konfirmasi_kabag', 'menunggu_konfirmasi_user', 'selesai', 'ditolak'].includes(filters.status)
                ? 'Tidak ada laporan dengan status ini.'
                : 'Belum ada laporan kerusakan yang tercatat.'}
            </Typography>
            {!['menunggu_katim', 'menunggu_ppk', 'dalam_perbaikan', 'menunggu_konfirmasi_kabag', 'menunggu_konfirmasi_user', 'selesai', 'ditolak'].includes(filters.status) && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                Buat Laporan Pertama
              </Button>
            )}
          </Paper>
        </Fade>
      ) : (
        <Fade in>
          <Box>
            <LaporanRusakTable
              data={dataList}
              loading={loading}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onVerifikasi={handleVerifikasi}
              onDisposisi={handleKatimKirim}
              onVerifikasiPPK={handlePPK}
              onSelesaiPerbaikan={handleCatatPerbaikan}
              onKatimKirim={handleKatimKirim}
              onPPK={handlePPK}
              onCatatPerbaikan={handleCatatPerbaikan}
              onKonfirmasiKabag={handleKonfirmasiKabag}
              onKonfirmasiUser={handleKonfirmasiUser}
              pagination={pagination}
              onPageChange={handlePageChange}
              sortConfig={sortConfig}
              onSort={handleSort}
              picData={picData}
            />

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="textSecondary">
                Menampilkan {dataList.length} dari {pagination.total} data
              </Typography>
              {loading && <CircularProgress size={16} />}
            </Box>
          </Box>
        </Fade>
      )}

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
        session={session}
      />

      <KatimKirimModal
        open={katimModalOpen}
        onClose={() => setKatimModalOpen(false)}
        onConfirm={handleConfirmKatim}
        laporan={selectedItem}
        loading={modalLoading}
        session={session}
      />

      <PPKVerifikasiModal
        open={ppkModalOpen}
        onClose={() => setPpkModalOpen(false)}
        onConfirm={handleConfirmPPK}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <CatatPerbaikanModal
        open={catatPerbaikanModalOpen}
        onClose={() => setCatatPerbaikanModalOpen(false)}
        onConfirm={handleConfirmCatatPerbaikan}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <KonfirmasiKabagModal
        open={konfirmasiKabagModalOpen}
        onClose={() => setKonfirmasiKabagModalOpen(false)}
        onConfirm={handleConfirmKonfirmasiKabag}
        laporan={selectedItem}
        loading={modalLoading}
      />

      <KonfirmasiUserModal
        open={konfirmasiUserModalOpen}
        onClose={() => setKonfirmasiUserModalOpen(false)}
        onConfirm={handleConfirmKonfirmasiUser}
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
    </PolishedPageShell>
  );
};

export default LaporanRusakContainer;