// components/laporanrusak/modals/DisposisiModal.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Chip,
  Avatar,
  InputAdornment,
  FormHelperText,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import axios from 'axios';
import { useSession } from 'next-auth/react';

const DisposisiModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const { data: session } = useSession();
  
  // State untuk form
  const [selectedPpk, setSelectedPpk] = useState(null);
  const [catatan, setCatatan] = useState('');
  const [estimasiBiaya, setEstimasiBiaya] = useState('');
  
  // State untuk daftar PPK
  const [ppkList, setPpkList] = useState([]);
  const [loadingPpkList, setLoadingPpkList] = useState(false);
  const [fetchError, setFetchError] = useState('');
  
  // State untuk pencarian
  const [searchText, setSearchText] = useState('');

  // Fetch daftar PPK saat modal dibuka
  useEffect(() => {
    if (open && session?.accessToken) {
      fetchPPKList();
    }
  }, [open, session]);

  // Reset form saat modal dibuka
  useEffect(() => {
    if (open) {
      setSelectedPpk(null);
      setCatatan('');
      setEstimasiBiaya('');
      setSearchText('');
      setFetchError('');
    }
  }, [open]);

  // Fetch daftar PPK dari API
  const fetchPPKList = async () => {
    if (!session?.accessToken) {
      setFetchError('Session tidak ditemukan');
      return;
    }

    try {
      setLoadingPpkList(true);
      setFetchError('');

      console.log('🔍 Fetching PPK list...');
      
      // Menggunakan route di keycloak.js
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/keycloak/ppk/list`,
        {
          headers: { 
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 detik timeout
        }
      );
      
      console.log('📥 Response PPK list:', response.data);
      
      if (response.data.success) {
        const ppkData = Array.isArray(response.data.data) ? response.data.data : [];
        setPpkList(ppkData);
        console.log(`✅ Mendapatkan ${ppkData.length} PPK`);
      } else {
        throw new Error(response.data.message || 'Gagal mengambil daftar PPK');
      }
    } catch (error) {
      console.error('❌ Error fetching PPK list:', error);
      
      // Fallback: coba ambil dari route lama jika ada
      if (error.response?.status === 404 || error.response?.status === 500) {
        try {
          console.log('🔄 Mencoba route alternatif...');
          const fallbackResponse = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/kegiatan/ppk/list`,
            {
              headers: { 
                Authorization: `Bearer ${session.accessToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );
          
          console.log('📥 Response fallback:', fallbackResponse.data);
          
          if (fallbackResponse.data.success) {
            const ppkData = Array.isArray(fallbackResponse.data.data) ? fallbackResponse.data.data : [];
            setPpkList(ppkData);
            console.log(`✅ Mendapatkan ${ppkData.length} PPK dari route alternatif`);
          } else {
            throw new Error('Route alternatif juga gagal');
          }
        } catch (fallbackError) {
          console.error('❌ Fallback juga gagal:', fallbackError);
          setFetchError('Gagal mengambil daftar PPK. Pastikan server berjalan dan Anda memiliki akses.');
        }
      } else {
        setFetchError('Gagal mengambil daftar PPK: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoadingPpkList(false);
    }
  };

  // Filter PPK berdasarkan pencarian
  const filteredPpkOptions = useMemo(() => {
    if (!ppkList.length) return [];
    
    if (searchText && searchText.length >= 2) {
      const searchLower = searchText.toLowerCase();
      return ppkList.filter(ppk => 
        ppk.nama?.toLowerCase().includes(searchLower) ||
        ppk.nip?.toLowerCase().includes(searchLower) ||
        ppk.email?.toLowerCase().includes(searchLower) ||
        ppk.jabatan?.toLowerCase().includes(searchLower) ||
        ppk.unitKerja?.toLowerCase().includes(searchLower)
      );
    }
    
    return ppkList;
  }, [ppkList, searchText]);

  const handleClose = () => {
    if (!loading && !loadingPpkList) {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (!selectedPpk) {
      alert('Silakan pilih PPK tujuan terlebih dahulu');
      return;
    }

    if (!estimasiBiaya) {
      alert('Estimasi biaya harus diisi');
      return;
    }

    // Data disposisi dengan PPK yang dipilih
    const dataToSubmit = {
      tujuan: 'ppk',
      ppk_id: selectedPpk.id,
      ppk_nama: selectedPpk.nama,
      ppk_email: selectedPpk.email || '',
      ppk_nip: selectedPpk.nip || '',
      ppk_jabatan: selectedPpk.jabatan || '',
      ppk_unitKerja: selectedPpk.unitKerja || '',
      catatan: catatan || 'Diteruskan ke PPK untuk verifikasi anggaran',
      estimasi_biaya: parseFloat(estimasiBiaya)
    };
    
    console.log('📤 Data disposisi ke PPK:', dataToSubmit);
    onConfirm(dataToSubmit);
  };

  if (!laporan) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading || loadingPpkList}
      PaperProps={{ 
        sx: { 
          borderRadius: 3,
          boxShadow: theme.shadows[10],
        } 
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: `1px solid ${theme.palette.divider}`, 
        pb: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.02),
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main,
                width: 40,
                height: 40,
                borderRadius: 2,
              }}
            >
              <AssignmentIcon sx={{ fontSize: 24, color: 'white' }} />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="700">
                Disposisi ke PPK
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pilih PPK dan teruskan laporan untuk verifikasi anggaran
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={handleClose} 
            disabled={loading || loadingPpkList} 
            size="small"
            sx={{
              color: theme.palette.grey[500],
              '&:hover': {
                bgcolor: alpha(theme.palette.grey[500], 0.1),
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {(loading || loadingPpkList) ? (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            minHeight={400}
            gap={2}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              {loadingPpkList ? 'Memuat daftar PPK...' : 'Memproses...'}
            </Typography>
          </Box>
        ) : (
          <>
            {/* Informasi Laporan */}
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2.5, 
                mb: 3, 
                bgcolor: alpha(theme.palette.info.main, 0.04),
                borderRadius: 2,
                borderColor: alpha(theme.palette.info.main, 0.2),
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <InfoIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" fontWeight="600" color="info.main">
                  Detail Laporan
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Nomor Laporan:</Typography>
                  <Typography variant="body2" fontWeight="700" color="text.primary">
                    {laporan.nomor_laporan || '-'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Pelapor:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.pelapor_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Aset:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.aset_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Status:</Typography>
                  <Chip 
                    size="small" 
                    label={laporan.status || '-'} 
                    color="warning"
                    sx={{ 
                      height: 24,
                      fontWeight: 600,
                    }} 
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Prioritas:</Typography>
                  <Chip 
                    size="small" 
                    label={laporan.prioritas || '-'} 
                    color={
                      laporan.prioritas === 'darurat' ? 'error' :
                      laporan.prioritas === 'tinggi' ? 'warning' :
                      laporan.prioritas === 'sedang' ? 'info' : 'success'
                    }
                    sx={{ height: 24 }}
                  />
                </Box>
              </Box>
            </Paper>

            {/* Error Message jika fetch gagal */}
            {fetchError && (
              <Alert 
                severity="error" 
                sx={{ mb: 3, borderRadius: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={fetchPPKList}
                    startIcon={<RefreshIcon />}
                  >
                    Coba Lagi
                  </Button>
                }
              >
                {fetchError}
              </Alert>
            )}

            {/* Pilih PPK */}
            <FormControl fullWidth sx={{ mb: 3 }} required>
              <Autocomplete
                options={filteredPpkOptions}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  return `${option.nama || ''}${option.nip ? ` (${option.nip})` : ''}`;
                }}
                value={selectedPpk}
                onChange={(event, newValue) => {
                  setSelectedPpk(newValue);
                }}
                onInputChange={(event, newInputValue) => {
                  setSearchText(newInputValue);
                }}
                inputValue={searchText}
                loading={loadingPpkList}
                filterOptions={(x) => x}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Pilih PPK Tujuan"
                    placeholder="Cari berdasarkan nama, NIP, atau email"
                    required
                    InputProps={{
                      ...params.InputProps,
                      sx: {
                        borderRadius: 2,
                      },
                      endAdornment: (
                        <>
                          <InputAdornment position="end">
                            <IconButton 
                              size="small" 
                              onClick={fetchPPKList}
                              disabled={loadingPpkList}
                              sx={{
                                color: theme.palette.primary.main,
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                }
                              }}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ width: '100%', py: 1 }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          <PersonIcon />
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="body2" fontWeight="600">
                            {option.nama}
                          </Typography>
                          <Box display="flex" flexWrap="wrap" gap={1} mt={0.5}>
                            {option.nip && (
                              <Chip 
                                size="small" 
                                label={`NIP: ${option.nip}`} 
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                            {option.jabatan && (
                              <Chip 
                                size="small" 
                                label={option.jabatan} 
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          {option.email && (
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                              Email: {option.email}
                            </Typography>
                          )}
                          {option.unitKerja && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Unit: {option.unitKerja}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </li>
                )}
                noOptionsText={
                  searchText.length < 2
                    ? 'Ketik minimal 2 karakter untuk mencari'
                    : 'Tidak ada PPK ditemukan'
                }
                loadingText="Memuat daftar PPK..."
                sx={{
                  '& .MuiAutocomplete-inputRoot': {
                    borderRadius: 2,
                  }
                }}
              />
              <FormHelperText>
                Pilih PPK yang akan memverifikasi anggaran perbaikan
              </FormHelperText>
            </FormControl>

            {/* Informasi PPK yang dipilih */}
            {selectedPpk && (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  bgcolor: alpha(theme.palette.success.main, 0.04),
                  borderRadius: 2,
                  borderColor: alpha(theme.palette.success.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                  }}
                >
                  <PersonIcon />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" fontWeight="600" color="success.main">
                    PPK Dipilih: {selectedPpk.nama}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} mt={0.5}>
                    {selectedPpk.nip && (
                      <Typography variant="caption" color="text.secondary">
                        NIP: {selectedPpk.nip}
                      </Typography>
                    )}
                    {selectedPpk.email && (
                      <Typography variant="caption" color="text.secondary">
                        Email: {selectedPpk.email}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Input Estimasi Biaya */}
            <TextField
              fullWidth
              label="Estimasi Biaya (Rp)"
              value={estimasiBiaya}
              onChange={(e) => setEstimasiBiaya(e.target.value)}
              type="number"
              placeholder="Masukkan estimasi biaya yang diperlukan"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AttachMoneyIcon sx={{ color: theme.palette.text.secondary }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2 }
              }}
              helperText="Estimasi biaya untuk verifikasi PPK (wajib diisi)"
              required
              inputProps={{
                min: 0,
                step: 1000
              }}
            />

            <TextField
              fullWidth
              label="Catatan Disposisi"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              multiline
              rows={4}
              placeholder="Masukkan catatan atau instruksi untuk PPK..."
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  borderRadius: 2,
                }
              }}
              helperText="Opsional: Tambahkan catatan untuk PPK"
            />

            <Alert 
              severity="info"
              sx={{ 
                mt: 2,
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  alignItems: 'center',
                }
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="600" gutterBottom>
                  Informasi Disposisi
                </Typography>
                <Typography variant="caption">
                  Laporan akan diteruskan ke <strong>PPK yang dipilih</strong> untuk verifikasi anggaran.
                  PPK akan memeriksa estimasi biaya dan menyetujui atau menolak pengajuan.
                </Typography>
              </Box>
            </Alert>

            {/* Warning jika belum pilih PPK */}
            {!selectedPpk && (
              <Alert 
                severity="warning"
                icon={<WarningIcon />}
                sx={{ 
                  mt: 2,
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption">
                  Silakan pilih PPK tujuan terlebih dahulu sebelum mengirim disposisi
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.5),
      }}>
        <Button 
          onClick={handleClose} 
          disabled={loading || loadingPpkList} 
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            px: 3,
          }}
        >
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          disabled={loading || loadingPpkList || !selectedPpk || !estimasiBiaya}
          sx={{ 
            borderRadius: 2,
            px: 4,
            boxShadow: theme.shadows[4],
          }}
        >
          Kirim ke PPK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DisposisiModal;