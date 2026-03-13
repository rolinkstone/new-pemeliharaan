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
  InputAdornment,
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

const VerifikasiPPKModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const [hasil, setHasil] = useState('disetujui'); // Hanya disetujui atau ditolak
  const [catatan, setCatatan] = useState('');
  const [estimasiBiaya, setEstimasiBiaya] = useState('');

  useEffect(() => {
    if (open && laporan) {
      setHasil('disetujui');
      setCatatan('');
      setEstimasiBiaya(laporan.estimasi_biaya || '');
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
      estimasi_biaya: hasil === 'disetujui' && estimasiBiaya 
        ? parseFloat(estimasiBiaya) 
        : laporan?.estimasi_biaya || null,
      // Ketika disetujui, status akan diubah menjadi 'dalam_perbaikan'
      // dan ditugaskan ke PIC ruangan asal
      next_status: hasil === 'disetujui' ? 'dalam_perbaikan' : 'ditolak',
      assigned_to: hasil === 'disetujui' ? laporan?.pelapor_id : null // PIC ruangan asal
    };
    
    console.log('📤 Verifikasi PPK:', dataToSubmit);
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

  const getHasilColor = (value) => {
    switch(value) {
      case 'disetujui':
        return 'success';
      case 'ditolak':
        return 'error';
      default:
        return 'primary';
    }
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
                bgcolor: theme.palette.success.main,
                width: 40,
                height: 40,
                borderRadius: 2,
              }}
            >
              <AttachMoneyIcon sx={{ fontSize: 24, color: 'white' }} />
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
                  <Typography variant="body2" fontWeight="700" color="success.main">
                    {laporan.estimasi_biaya 
                      ? `Rp ${laporan.estimasi_biaya.toLocaleString()}` 
                      : '-'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Informasi PIC Ruangan */}
            {laporan.pelapor_nama && (
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
                    <BuildIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="600" color="info.main">
                      PIC Ruangan: {laporan.pelapor_nama}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hasil === 'disetujui' 
                        ? 'Anggaran disetujui, PIC ruangan akan ditugaskan untuk melakukan perbaikan' 
                        : 'Jika ditolak, laporan akan dikembalikan ke PIC ruangan'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Pilihan Verifikasi - Hanya Setuju dan Tolak */}
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
                              Anggaran disetujui dan akan diteruskan ke PIC ruangan untuk perbaikan
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
                              Anggaran ditolak, laporan akan dikembalikan dengan status ditolak
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

            {/* Input Estimasi Biaya Final (jika disetujui) */}
            {hasil === 'disetujui' && (
              <TextField
                fullWidth
                label="Estimasi Biaya Final (Rp)"
                value={estimasiBiaya}
                onChange={(e) => setEstimasiBiaya(e.target.value)}
                type="number"
                placeholder="Masukkan estimasi biaya final yang disetujui"
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoneyIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
                helperText="Biaya final yang disetujui untuk pelaksanaan perbaikan"
                required
              />
            )}

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
                '& .MuiAlert-icon': {
                  alignItems: 'center',
                }
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="600" gutterBottom>
                  Ringkasan Verifikasi
                </Typography>
                <Typography variant="caption">
                  {hasil === 'disetujui' 
                    ? '✅ Anggaran disetujui. Laporan akan diteruskan ke PIC ruangan untuk dilakukan perbaikan. Status akan berubah menjadi "Dalam Perbaikan".'
                    : '❌ Anggaran ditolak. Laporan akan dikembalikan dengan status "Ditolak". PIC ruangan dapat mengajukan ulang dengan revisi anggaran.'}
                </Typography>
              </Box>
            </Alert>

            {/* Informasi Alur Selanjutnya */}
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
                        Laporan akan berubah status menjadi <strong>"Dalam Perbaikan"</strong>
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        PIC Ruangan (<strong>{laporan.pelapor_nama}</strong>) akan ditugaskan untuk melakukan perbaikan
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Setelah perbaikan selesai, PIC ruangan akan mengubah status menjadi <strong>"Selesai"</strong>
                      </Typography>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Laporan akan berubah status menjadi <strong>"Ditolak"</strong>
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        PIC ruangan dapat mengajukan ulang dengan revisi anggaran
                      </Typography>
                    </li>
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        Jika perlu, dapat dilakukan disposisi ulang ke PPK
                      </Typography>
                    </li>
                  </>
                )}
              </Box>
            </Paper>
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
          color={hasil === 'disetujui' ? 'success' : 'error'}
          startIcon={getHasilIcon(hasil)}
          disabled={loading || (hasil === 'disetujui' && !estimasiBiaya)}
          sx={{ 
            borderRadius: 2,
            px: 4,
            boxShadow: theme.shadows[4],
            background: hasil === 'disetujui' 
              ? `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
              : `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
          }}
        >
          {hasil === 'disetujui' ? 'Setujui & Teruskan ke PIC' : 'Tolak'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiPPKModal;