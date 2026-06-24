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
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  useTheme,
  alpha,
  LinearProgress,
  Fade,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
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
import SelesaiPerbaikanModal from './modals/SelesaiPerbaikanModal';
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
  const [disposisiModalOpen, setDisposisiModalOpen] = useState(false);
  const [verifikasiPPKModalOpen, setVerifikasiPPKModalOpen] = useState(false);
  const [selesaiPerbaikanModalOpen, setSelesaiPerbaikanModalOpen] = useState(false);
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

  const handleDisposisi = (item) => {
    setSelectedItem(item);
    setDisposisiModalOpen(true);
  };

  const handleVerifikasiPPK = (item) => {
    setSelectedItem(item);
    setVerifikasiPPKModalOpen(true);
  };

  const handleSelesaiPerbaikan = (item) => {
    setSelectedItem(item);
    setSelesaiPerbaikanModalOpen(true);
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

// components/laporanrusak/LaporanRusakContainer.js

const handleConfirmSelesaiPerbaikan = async (data) => {
  if (!session || !selectedItem) return;
  setModalLoading(true);
  try {
    // PASTIKAN MENGGUNAKAN selesaikanPerbaikan, BUKAN selesai
    console.log('🔍 Memanggil fungsi:', laporanApi.selesaikanPerbaikan); // Debug
    const result = await laporanApi.selesaikanPerbaikan(session, selectedItem.id, data);
    
    if (result?.success) {
      showSnackbar('Perbaikan berhasil diselesaikan', 'success');
      setSelesaiPerbaikanModalOpen(false);
      initialFetchDone.current = false;
      fetchData();
    } else {
      showSnackbar(result?.message || 'Gagal menyelesaikan perbaikan', 'error');
    }
  } catch (error) {
    console.error('❌ Error selesaikan perbaikan:', error);
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

  // Statistics Cards Component — lebih informatif
  const StatisticsCards = () => {
    if (!statistics) return null;
    
    const total = statistics.total || 1;
    const cards = [
      { 
        title: 'Total Laporan', 
        value: statistics.total || 0, 
        icon: <AssignmentIcon />, 
        color: theme.palette.primary.main,
        subtitle: 'Semua laporan',
        bg: alpha(theme.palette.primary.main, 0.08)
      },
      { 
        title: 'Menunggu Proses', 
        value: (statistics.menunggu_verifikasi_pic || 0) + (statistics.menunggu_disposisi || 0) + (statistics.menunggu_verifikasi_ppk || 0), 
        icon: <WarningIcon />, 
        color: theme.palette.warning.main,
        subtitle: `${((statistics.menunggu_verifikasi_pic || 0) / total * 100).toFixed(0)}% dari total`,
        bg: alpha(theme.palette.warning.main, 0.08)
      },
      { 
        title: 'Dalam Perbaikan', 
        value: statistics.dalam_perbaikan || 0, 
        icon: <BuildIcon />, 
        color: theme.palette.info.main,
        subtitle: `${((statistics.dalam_perbaikan || 0) / total * 100).toFixed(0)}% dari total`,
        bg: alpha(theme.palette.info.main, 0.08)
      },
      { 
        title: 'Selesai', 
        value: statistics.selesai || 0, 
        icon: <DoneAllIcon />, 
        color: theme.palette.success.main,
        subtitle: `${((statistics.selesai || 0) / total * 100).toFixed(0)}% penyelesaian`,
        bg: alpha(theme.palette.success.main, 0.08)
      },
    ];

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card, i) => (
          <Grid item xs={6} sm={6} md={3} key={i}>
            <Fade in timeout={300 + i * 100}>
              <Card 
                sx={{ 
                  borderRadius: 2, 
                  boxShadow: `0 4px 12px ${alpha(card.color, 0.15)}`,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha(card.color, 0.25)}` }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="caption" color="textSecondary" fontWeight={500}>
                        {card.title}
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ mt: 0.5, lineHeight: 1.2 }}>
                        {card.value.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                        {card.subtitle}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: card.bg, borderRadius: 2, p: 1, color: card.color }}>
                      {card.icon}
                    </Box>
                  </Box>
                  {/* Progress bar untuk selesai */}
                  {i === 3 && (
                    <Box sx={{ mt: 1.5, width: '100%' }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min((statistics.selesai || 0) / total * 100, 100)} 
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.success.main, 0.15),
                          '& .MuiLinearProgress-bar': { bgcolor: theme.palette.success.main }
                        }}
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Quick filter chips berdasarkan status
  const quickFilters = [
    { key: '', label: 'Semua', icon: null },
    { key: 'menunggu_verifikasi_pic', label: 'Verifikasi PIC', icon: <WarningIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_disposisi', label: 'Disposisi', icon: <AssignmentIcon sx={{ fontSize: 14 }} /> },
    { key: 'menunggu_verifikasi_ppk', label: 'Verifikasi PPK', icon: <AttachMoneyIcon sx={{ fontSize: 14 }} /> },
    { key: 'dalam_perbaikan', label: 'Perbaikan', icon: <BuildIcon sx={{ fontSize: 14 }} /> },
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
    <Box>
      {/* HEADER dengan Search Bar inline */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Laporan Kerusakan Aset
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Kelola pelaporan dan perbaikan aset yang rusak
            </Typography>
          </Box>
          <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
            {/* Search bar di header — selalu visible */}
            <TextField
              size="small"
              placeholder="Cari nomor/deskripsi..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleFilterChange({ ...filters, search: e.target.value }); } }}
              sx={{ minWidth: 220 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: filters.search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleFilterChange({ ...filters, search: '' })}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={loading}>
              Refresh
            </Button>
            {!['menunggu_disposisi', 'menunggu_verifikasi_ppk', 'dalam_perbaikan', 'selesai', 'ditolak'].includes(filters.status) && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreate} disabled={loading}>
                + Baru
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <StatisticsCards />

      {/* QUICK FILTER CHIPS */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
            <AssignmentIcon sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Tidak Ada Laporan
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              {['menunggu_disposisi', 'menunggu_verifikasi_ppk', 'dalam_perbaikan', 'selesai', 'ditolak'].includes(filters.status)
                ? `Tidak ada laporan dengan status ini.`
                : 'Belum ada laporan kerusakan yang tercatat.'}
            </Typography>
            {!['menunggu_disposisi', 'menunggu_verifikasi_ppk', 'dalam_perbaikan', 'selesai', 'ditolak'].includes(filters.status) && (
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
              onDisposisi={handleDisposisi}
              onVerifikasiPPK={handleVerifikasiPPK}
              onSelesaiPerbaikan={handleSelesaiPerbaikan}
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

      <SelesaiPerbaikanModal
        open={selesaiPerbaikanModalOpen}
        onClose={() => setSelesaiPerbaikanModalOpen(false)}
        onConfirm={handleConfirmSelesaiPerbaikan}
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