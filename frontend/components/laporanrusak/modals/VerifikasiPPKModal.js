// components/laporanrusak/modals/VerifikasiPPKModal.js

import React, { useState, useEffect } from 'react';
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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Alert,
  Paper,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Build as BuildIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

// Format Rupiah
const formatRupiah = (value) => {
  if (!value) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const VerifikasiPPKModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const [hasil, setHasil] = useState('disetujui');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (open && laporan) {
      setHasil('disetujui');
      setCatatan('');
    }
  }, [open, laporan]);

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleSubmit = () => {
    const dataToSubmit = {
      hasil_verifikasi: hasil,
      catatan: catatan || (hasil === 'disetujui' 
        ? 'Anggaran disetujui, silakan lakukan perbaikan' 
        : 'Anggaran ditolak, silakan ajukan ulang'),
      estimasi_biaya: laporan?.estimasi_biaya || null,
      next_status: hasil === 'disetujui' ? 'dalam_perbaikan' : 'ditolak',
    };
    
    console.log('📤 Verifikasi PPK:', dataToSubmit);
    console.log('💰 Estimasi biaya dari PIC:', laporan?.estimasi_biaya);
    onConfirm(dataToSubmit);
  };

  const getHasilIcon = (value) => {
    switch(value) {
      case 'disetujui':
        return <CheckCircleIcon sx={{ color: theme.palette.success.main }} />;
      case 'ditolak':
        return <CancelIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return <InfoIcon />;
    }
  };

  if (!laporan) return null;

  const estimasiBiayaDariPIC = laporan.estimasi_biaya;
  
  // Dapatkan nama PIC Ruangan yang benar (dari data pic_ruangan, bukan pelapor)
  // Prioritas: pic_ruangan > pic_ruangan_nama > pic_nama > pelapor_nama
  const picRuanganNama = laporan?.pic_ruangan || 
                         laporan?.pic_ruangan_nama || 
                         laporan?.pic_nama || 
                         laporan?.pelapor_nama || 
                         '-';
  
  const picRuanganId = laporan?.pic_ruangan_id || laporan?.pic_id || null;

  console.log('📋 Data PIC Ruangan:', {
    pic_ruangan: laporan?.pic_ruangan,
    pic_ruangan_nama: laporan?.pic_ruangan_nama,
    pic_ruangan_id: laporan?.pic_ruangan_id,
    pelapor_nama: laporan?.pelapor_nama
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
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
                bgcolor: theme.palette.success.main,
                width: 40,
                height: 40,
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" fontWeight="bold" sx={{ color: 'white' }}>Rp</Typography>
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="700">
                Verifikasi PPK
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Verifikasi anggaran perbaikan aset
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={handleClose} 
            disabled={loading} 
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
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
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
                <AssignmentIcon fontSize="small" color="info" />
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
                  <Typography variant="body2" color="text.secondary">Ruangan:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.ruangan_nama || '-'}</Typography>
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
                    sx={{ height: 24 }} 
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Estimasi Biaya:</Typography>
                  <Typography variant="body2" fontWeight="700" sx={{ color: theme.palette.warning.main, fontSize: '1rem' }}>
                    {estimasiBiayaDariPIC ? formatRupiah(estimasiBiayaDariPIC) : 'Belum diisi'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Informasi PIC Ruangan - MENGGUNAKAN DATA YANG BENAR */}
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: alpha(theme.palette.info.main, 0.04),
                borderRadius: 2,
                borderColor: alpha(theme.palette.info.main, 0.2),
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                  }}
                >
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight="600" color="info.main">
                    PIC Ruangan: {picRuanganNama}
                  </Typography>
                  {picRuanganId && (
                    <Typography variant="caption" color="text.secondary">
                      ID: {picRuanganId}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {hasil === 'disetujui' 
                      ? '✅ Anggaran disetujui, PIC ruangan akan ditugaskan untuk melakukan perbaikan' 
                      : '❌ Jika ditolak, laporan akan ditolak dan tidak dapat diproses lebih lanjut'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Pilihan Verifikasi */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600 }}>
                Hasil Verifikasi
              </FormLabel>
              <RadioGroup value={hasil} onChange={(e) => setHasil(e.target.value)}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    mb: 1.5, 
                    borderColor: hasil === 'disetujui' ? theme.palette.success.main : theme.palette.divider,
                    bgcolor: hasil === 'disetujui' ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: theme.palette.success.main,
                      bgcolor: alpha(theme.palette.success.main, 0.02),
                    }
                  }}
                >
                  <FormControlLabel 
                    value="disetujui" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1.5, px: 1 }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: theme.palette.success.main,
                            }}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              Setujui Anggaran
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Anggaran sebesar {estimasiBiayaDariPIC ? formatRupiah(estimasiBiayaDariPIC) : 'yang diajukan'} disetujui
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    } 
                    sx={{ width: '100%', m: 0 }}
                  />
                </Paper>

                <Paper 
                  variant="outlined" 
                  sx={{ 
                    mb: 1.5, 
                    borderColor: hasil === 'ditolak' ? theme.palette.error.main : theme.palette.divider,
                    bgcolor: hasil === 'ditolak' ? alpha(theme.palette.error.main, 0.04) : 'transparent',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: theme.palette.error.main,
                      bgcolor: alpha(theme.palette.error.main, 0.02),
                    }
                  }}
                >
                  <FormControlLabel 
                    value="ditolak" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1.5, px: 1 }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                              color: theme.palette.error.main,
                            }}
                          >
                            <CancelIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              Tolak Anggaran
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Anggaran ditolak, laporan tidak dapat diproses
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    } 
                    sx={{ width: '100%', m: 0 }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            <TextField
              fullWidth
              label="Catatan Verifikasi"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              multiline
              rows={4}
              placeholder="Masukkan catatan verifikasi..."
              sx={{ mb: 2 }}
              InputProps={{
                sx: { borderRadius: 2 }
              }}
              helperText="Opsional: Tambahkan catatan untuk PIC ruangan"
            />

            <Alert 
              severity={hasil === 'disetujui' ? 'success' : 'error'}
              sx={{ 
                mt: 2,
                borderRadius: 2,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="600" gutterBottom>
                  Ringkasan Verifikasi
                </Typography>
                <Typography variant="caption">
                  {hasil === 'disetujui' 
                    ? `✅ Anggaran sebesar ${estimasiBiayaDariPIC ? formatRupiah(estimasiBiayaDariPIC) : 'yang diajukan'} disetujui. Status akan berubah menjadi "Dalam Perbaikan".`
                    : '❌ Anggaran ditolak. Laporan akan ditolak.'}
                </Typography>
              </Box>
            </Alert>

            <Paper 
              variant="outlined" 
              sx={{ 
                mt: 2,
                p: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.02),
                borderRadius: 2,
                borderColor: alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <Typography variant="subtitle2" fontWeight="600" color="primary.main" gutterBottom>
                Alur Selanjutnya:
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                {hasil === 'disetujui' ? (
                  <>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Status berubah menjadi <strong>"Dalam Perbaikan"</strong>
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        PIC Ruangan (<strong>{picRuanganNama}</strong>) akan melakukan perbaikan
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Setelah selesai, PIC mengubah status menjadi <strong>"Selesai"</strong>
                      </Typography>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Status berubah menjadi <strong>"Ditolak"</strong>
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Laporan tidak dapat diproses lebih lanjut
                      </Typography>
                    </li>
                  </>
                )}
              </Box>
            </Paper>

            {!estimasiBiayaDariPIC && (
              <Alert 
                severity="warning" 
                sx={{ mt: 2, borderRadius: 2 }}
              >
                <Typography variant="caption">
                  ⚠️ Estimasi biaya belum diisi oleh PIC Ruangan.
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
          disabled={loading} 
          variant="outlined"
          sx={{ borderRadius: 2, px: 3 }}
        >
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color={hasil === 'disetujui' ? 'success' : 'error'}
          startIcon={getHasilIcon(hasil)}
          disabled={loading}
          sx={{ 
            borderRadius: 2,
            px: 4,
            background: hasil === 'disetujui' 
              ? `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
              : `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
          }}
        >
          {hasil === 'disetujui' ? 'Setujui Anggaran' : 'Tolak Anggaran'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiPPKModal;