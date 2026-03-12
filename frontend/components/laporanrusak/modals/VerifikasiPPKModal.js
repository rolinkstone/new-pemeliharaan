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
  const [hasil, setHasil] = useState('disetujui');
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
        ? 'Anggaran disetujui' 
        : hasil === 'ditolak' 
          ? 'Anggaran ditolak' 
          : 'Perlu revisi anggaran'),
      estimasi_biaya: hasil === 'disetujui' && estimasiBiaya 
        ? parseFloat(estimasiBiaya) 
        : laporan?.estimasi_biaya || null
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
      case 'revisi':
        return <BuildIcon sx={{ color: theme.palette.warning.main }} />;
      default:
        return <InfoIcon />;
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
                              Anggaran disetujui dan dapat diproses lebih lanjut
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
                              Anggaran ditolak, perlu pengajuan ulang
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
                    borderColor: hasil === 'revisi' ? theme.palette.warning.main : theme.palette.divider,
                    bgcolor: hasil === 'revisi' ? alpha(theme.palette.warning.main, 0.04) : 'transparent',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: theme.palette.warning.main,
                      bgcolor: alpha(theme.palette.warning.main, 0.02),
                    }
                  }}
                >
                  <FormControlLabel 
                    value="revisi" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1.5, px: 1 }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              color: theme.palette.warning.main,
                            }}
                          >
                            <BuildIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="600">
                              Revisi
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Perlu dilakukan revisi/perbaikan anggaran
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

            {/* Input Estimasi Biaya (jika disetujui) */}
            {hasil === 'disetujui' && (
              <TextField
                fullWidth
                label="Estimasi Biaya Final (Rp)"
                value={estimasiBiaya}
                onChange={(e) => setEstimasiBiaya(e.target.value)}
                type="number"
                placeholder="Masukkan estimasi biaya final"
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoneyIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
                helperText="Biaya final yang disetujui untuk perbaikan"
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
            />

            <Alert 
              severity={hasil === 'disetujui' ? 'success' : hasil === 'ditolak' ? 'error' : 'warning'}
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
                  {hasil === 'disetujui' && 'Anggaran akan disetujui dan laporan akan masuk ke tahap perbaikan.'}
                  {hasil === 'ditolak' && 'Anggaran ditolak. Laporan akan dikembalikan dengan status ditolak.'}
                  {hasil === 'revisi' && 'Perlu dilakukan revisi anggaran sebelum dapat diproses lebih lanjut.'}
                </Typography>
              </Box>
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
          color={hasil === 'disetujui' ? 'success' : hasil === 'ditolak' ? 'error' : 'warning'}
          startIcon={getHasilIcon(hasil)}
          disabled={loading}
          sx={{ 
            borderRadius: 2,
            px: 4,
            boxShadow: theme.shadows[4],
          }}
        >
          {hasil === 'disetujui' ? 'Setujui' : hasil === 'ditolak' ? 'Tolak' : 'Revisi'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiPPKModal;