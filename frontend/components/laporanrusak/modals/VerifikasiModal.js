// components/laporanrusak/modals/VerifikasiModal.js

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
  InputAdornment,
  Divider,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Build as BuildIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

// Enum status sesuai dengan database
const STATUS = {
  DRAFT: 'draft',
  MENUNGGU_VERIFIKASI_PIC: 'menunggu_verifikasi_pic',
  MENUNGGU_DISPOSISI: 'menunggu_disposisi',
  MENUNGGU_VERIFIKASI_PPK: 'menunggu_verifikasi_ppk',
  DIVERIFIKASI_PPK: 'diverifikasi_ppk',
  DALAM_PERBAIKAN: 'dalam_perbaikan',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak'
};

const VerifikasiModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const [keputusan, setKeputusan] = useState('setuju');
  const [catatan, setCatatan] = useState('');
  const [butuhAnggaran, setButuhAnggaran] = useState(false);
  const [estimasiBiaya, setEstimasiBiaya] = useState('');
  const [estimasiBiayaError, setEstimasiBiayaError] = useState('');

  useEffect(() => {
    if (open && laporan) {
      setKeputusan('setuju');
      setCatatan('');
      setButuhAnggaran(false);
      setEstimasiBiaya('');
      setEstimasiBiayaError('');
    }
  }, [open, laporan]);

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const formatRupiah = (value) => {
    if (!value) return '';
    const number = value.toString().replace(/[^,\d]/g, '');
    return new Intl.NumberFormat('id-ID').format(number);
  };

  const handleEstimasiBiayaChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setEstimasiBiaya(rawValue);
    if (rawValue && butuhAnggaran && keputusan === 'setuju') {
      if (parseFloat(rawValue) <= 0) {
        setEstimasiBiayaError('Estimasi biaya harus lebih dari 0');
      } else {
        setEstimasiBiayaError('');
      }
    } else {
      setEstimasiBiayaError('');
    }
  };

  const handleSubmit = () => {
    // Validasi estimasi biaya jika butuh anggaran
    if (butuhAnggaran && keputusan === 'setuju') {
      if (!estimasiBiaya || parseFloat(estimasiBiaya) <= 0) {
        setEstimasiBiayaError('Estimasi biaya wajib diisi dan harus lebih dari 0');
        return;
      }
    }
    
    let nextStatus;
    if (keputusan === 'setuju') {
      if (butuhAnggaran) {
        nextStatus = STATUS.MENUNGGU_DISPOSISI;
      } else {
        nextStatus = STATUS.SELESAI;
      }
    } else {
      nextStatus = STATUS.DITOLAK;
    }
    
    const dataToSubmit = {
      keputusan: keputusan,
      catatan: catatan || (keputusan === 'setuju' 
          ? (butuhAnggaran ? 'Diverifikasi, perlu anggaran' : 'Diverifikasi, perbaikan langsung') 
          : 'Ditolak'),
      alur: butuhAnggaran ? 'dengan_anggaran' : 'langsung',
      next_status: nextStatus,
      // Estimasi biaya hanya dikirim jika butuh anggaran dan keputusan setuju
      estimasi_biaya: butuhAnggaran && keputusan === 'setuju' ? parseFloat(estimasiBiaya) : null
    };
    
    console.log('📤 Verifikasi PIC - Data dikirim:', dataToSubmit);
    console.log('💰 Estimasi Biaya:', dataToSubmit.estimasi_biaya);
    onConfirm(dataToSubmit);
  };

  const getKeputusanIcon = () => {
    return keputusan === 'setuju' 
      ? <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
      : <CancelIcon sx={{ color: theme.palette.error.main }} />;
  };

  if (!laporan) return null;

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
                Verifikasi Laporan
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {laporan.nomor_laporan} - {laporan.aset_nama}
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
                p: 2, 
                mb: 3, 
                bgcolor: alpha(theme.palette.info.main, 0.04),
                borderRadius: 2,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <InfoIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" fontWeight="600" color="info.main">
                  Detail Laporan
                </Typography>
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Pelapor:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.pelapor_nama}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Ruangan:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.ruangan_nama}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Prioritas:</Typography>
                  <Chip 
                    size="small" 
                    label={laporan.prioritas} 
                    color={
                      laporan.prioritas === 'darurat' ? 'error' :
                      laporan.prioritas === 'tinggi' ? 'warning' :
                      laporan.prioritas === 'sedang' ? 'info' : 'success'
                    }
                    sx={{ height: 20, mt: 0.5 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status:</Typography>
                  <Chip 
                    size="small" 
                    label={laporan.status} 
                    color="warning"
                    sx={{ height: 20, mt: 0.5 }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Pilihan Alur Verifikasi */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600 }}>
                Pilih Alur Verifikasi
              </FormLabel>
              
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2,
                  mb: 2,
                  borderColor: !butuhAnggaran ? theme.palette.success.main : theme.palette.divider,
                  bgcolor: !butuhAnggaran ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: theme.palette.success.main,
                    bgcolor: alpha(theme.palette.success.main, 0.02),
                  }
                }}
                onClick={() => setButuhAnggaran(false)}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Radio checked={!butuhAnggaran} onChange={() => setButuhAnggaran(false)} value={false} />
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <BuildIcon color="success" />
                      <Typography variant="subtitle1" fontWeight="600" color="success.main">
                        Perbaikan Langsung (Tanpa Anggaran)
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      • Perbaikan dapat dilakukan langsung oleh tim internal
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Tidak memerlukan anggaran tambahan
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Status akan berubah menjadi <strong>SELESAI</strong> setelah diverifikasi
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2,
                  borderColor: butuhAnggaran ? theme.palette.warning.main : theme.palette.divider,
                  bgcolor: butuhAnggaran ? alpha(theme.palette.warning.main, 0.04) : 'transparent',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: theme.palette.warning.main,
                    bgcolor: alpha(theme.palette.warning.main, 0.02),
                  }
                }}
                onClick={() => setButuhAnggaran(true)}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <Radio checked={butuhAnggaran} onChange={() => setButuhAnggaran(true)} value={true} />
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AttachMoneyIcon color="warning" />
                      <Typography variant="subtitle1" fontWeight="600" color="warning.main">
                        Perbaikan dengan Anggaran
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      • Memerlukan anggaran tambahan
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Akan melalui proses: Verifikasi PIC → <strong>Menunggu Disposisi</strong> → Disposisi Kabag TU → Verifikasi PPK
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Status akan berubah menjadi <strong>MENUNGGU DISPOSISI</strong>
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </FormControl>

            {/* Estimasi Biaya - Hanya muncul jika butuh anggaran */}
            {butuhAnggaran && keputusan === 'setuju' && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>
                  Estimasi Biaya Perbaikan <span style={{ color: theme.palette.error.main }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  label="Estimasi Biaya"
                  value={estimasiBiaya ? formatRupiah(estimasiBiaya) : ''}
                  onChange={handleEstimasiBiayaChange}
                  placeholder="Masukkan estimasi biaya perbaikan"
                  error={!!estimasiBiayaError}
                  helperText={estimasiBiayaError || "Masukkan perkiraan biaya yang diperlukan untuk perbaikan"}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rp</InputAdornment>,
                  }}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  ⚠️ Estimasi biaya akan disimpan dan digunakan sebagai acuan untuk proses selanjutnya
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Pilihan Keputusan */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600 }}>
                Keputusan Verifikasi
              </FormLabel>
              <RadioGroup value={keputusan} onChange={(e) => setKeputusan(e.target.value)}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    mb: 1.5, 
                    borderColor: keputusan === 'setuju' ? theme.palette.success.main : theme.palette.divider,
                    bgcolor: keputusan === 'setuju' ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                    borderRadius: 2,
                  }}
                >
                  <FormControlLabel 
                    value="setuju" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1, px: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CheckCircleIcon color="success" />
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              Setuju
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {butuhAnggaran 
                                ? 'Laporan akan masuk ke antrian disposisi' 
                                : 'Laporan akan langsung selesai'}
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
                    borderColor: keputusan === 'tolak' ? theme.palette.error.main : theme.palette.divider,
                    bgcolor: keputusan === 'tolak' ? alpha(theme.palette.error.main, 0.04) : 'transparent',
                    borderRadius: 2,
                  }}
                >
                  <FormControlLabel 
                    value="tolak" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1, px: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CancelIcon color="error" />
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              Tolak
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Laporan akan ditolak dan tidak diproses lebih lanjut
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
              rows={3}
              placeholder="Masukkan catatan verifikasi (opsional)"
              sx={{ mb: 2 }}
            />

            <Alert 
              severity={keputusan === 'setuju' ? (butuhAnggaran ? 'warning' : 'success') : 'error'}
              sx={{ 
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" fontWeight="600" gutterBottom>
                Ringkasan:
              </Typography>
              <Typography variant="caption">
                {keputusan === 'setuju' 
                  ? (butuhAnggaran 
                    ? `Laporan akan diverifikasi dan masuk ke antrian disposisi Kabag TU.${estimasiBiaya ? ` Estimasi biaya: Rp ${formatRupiah(estimasiBiaya)}` : ''}`
                    : 'Laporan akan langsung selesai. Perbaikan dapat segera dilakukan.')
                  : 'Laporan akan ditolak. Pengaju dapat mengajukan ulang.'}
              </Typography>
            </Alert>
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
          color={keputusan === 'setuju' ? (butuhAnggaran ? 'warning' : 'success') : 'error'}
          startIcon={getKeputusanIcon()}
          disabled={loading || (butuhAnggaran && keputusan === 'setuju' && (!estimasiBiaya || parseFloat(estimasiBiaya) <= 0))}
          sx={{ 
            borderRadius: 2,
            px: 4,
          }}
        >
          {keputusan === 'setuju' 
            ? (butuhAnggaran ? 'Setuju & Menunggu Disposisi' : 'Setuju & Selesai')
            : 'Tolak'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiModal;