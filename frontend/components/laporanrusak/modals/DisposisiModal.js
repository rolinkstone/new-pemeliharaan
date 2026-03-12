// components/laporanrusak/modals/DisposisiModal.js

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
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const DisposisiModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  // Tujuan hanya untuk PPK, tidak perlu state tujuan
  const [catatan, setCatatan] = useState('');
  const [estimasiBiaya, setEstimasiBiaya] = useState('');

  useEffect(() => {
    if (open) {
      setCatatan('');
      setEstimasiBiaya('');
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleSubmit = () => {
    // Data hanya untuk PPK
    const dataToSubmit = {
      tujuan: 'ppk', // Tetap kirim 'ppk' untuk backend
      catatan: catatan || 'Diteruskan ke PPK untuk verifikasi anggaran',
      estimasi_biaya: estimasiBiaya ? parseFloat(estimasiBiaya) : null
    };
    
    console.log('📤 Data disposisi ke PPK:', dataToSubmit);
    onConfirm(dataToSubmit);
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
                Disposisi ke PPK
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Teruskan laporan ke PPK untuk verifikasi anggaran
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

            {/* Informasi Tujuan (hanya PPK) */}
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderRadius: 2,
                borderColor: alpha(theme.palette.primary.main, 0.2),
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                }}
              >
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="600" color="primary.main">
                  Tujuan: PPK (Pejabat Pembuat Komitmen)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Laporan akan diteruskan ke PPK untuk verifikasi anggaran
                </Typography>
              </Box>
            </Paper>

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
              }}
              helperText="Estimasi biaya untuk verifikasi PPK"
              required
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
                  Laporan akan diteruskan ke <strong>PPK (Pejabat Pembuat Komitmen)</strong> untuk verifikasi anggaran.
                  PPK akan memeriksa estimasi biaya dan menyetujui atau menolak pengajuan.
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
          color="primary"
          startIcon={<SendIcon />}
          disabled={loading || !estimasiBiaya} // Estimasi biaya wajib diisi
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