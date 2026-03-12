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
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const VerifikasiModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const [keputusan, setKeputusan] = useState('selesai');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (open) {
      setKeputusan('selesai');
      setCatatan('');
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleSubmit = () => {
    // Tentukan tipe berdasarkan keputusan
    let tipe = '';
    if (keputusan === 'selesai') {
      tipe = 'selesai';
    } else if (keputusan === 'disposisi') {
      tipe = 'disposisi';
    }
    
    // Kirim data dengan tipe yang sesuai
    const dataToSubmit = {
      tipe: tipe, // Field tipe WAJIB dikirim
      catatan: catatan || (keputusan === 'selesai' 
        ? 'Laporan telah selesai diperbaiki oleh tim internal'
        : 'Diteruskan ke Kabag TU dan PPK untuk proses anggaran')
    };
    
    console.log('📤 Data yang akan dikirim ke API:', dataToSubmit);
    onConfirm(dataToSubmit);
  };

  const getKeputusanIcon = (value) => {
    return value === 'selesai' 
      ? <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
      : <ArrowForwardIcon sx={{ color: theme.palette.warning.main }} />;
  };

  if (!laporan) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <BuildIcon color="primary" />
            <Typography variant="h6" fontWeight="600">
              Tindak Lanjut Laporan
            </Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={loading} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={250}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Informasi Laporan */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                Detail Laporan
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">Nomor Laporan:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.nomor_laporan || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">Pelapor:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.pelapor_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">Aset:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.aset_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">Status Saat Ini:</Typography>
                  <Chip size="small" label={laporan.status || '-'} sx={{ height: 24 }} />
                </Box>
              </Box>
            </Paper>

            {/* Informasi Tindakan */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Pilih tindakan:</strong>
              </Typography>
              <ul style={{ marginTop: 4, marginBottom: 4, paddingLeft: 20 }}>
                <li><strong>Selesai</strong> - Jika sudah diperbaiki oleh tim internal (status: <strong>selesai</strong>)</li>
                <li><strong>Diteruskan</strong> - Jika memerlukan anggaran (status: <strong>diteruskan</strong> ke Kabag TU & PPK)</li>
              </ul>
            </Alert>

            {/* Pilihan Tindakan */}
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                Pilih Tindakan
              </FormLabel>
              <RadioGroup value={keputusan} onChange={(e) => setKeputusan(e.target.value)}>
                <Paper variant="outlined" sx={{ 
                  mb: 1, 
                  borderColor: keputusan === 'selesai' ? theme.palette.success.main : theme.palette.divider,
                  bgcolor: keputusan === 'selesai' ? alpha(theme.palette.success.main, 0.05) : 'transparent',
                }}>
                  <FormControlLabel 
                    value="selesai" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
                          <Typography variant="body1" fontWeight="500">
                            Selesai (Diperbaiki Tim Internal)
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, display: 'block' }}>
                          Status akan diubah menjadi <strong>"selesai"</strong>
                        </Typography>
                      </Box>
                    } 
                    sx={{ width: '100%', m: 0, px: 2, py: 1 }}
                  />
                </Paper>

                <Paper variant="outlined" sx={{ 
                  borderColor: keputusan === 'disposisi' ? theme.palette.warning.main : theme.palette.divider,
                  bgcolor: keputusan === 'disposisi' ? alpha(theme.palette.warning.main, 0.05) : 'transparent',
                }}>
                  <FormControlLabel 
                    value="disposisi" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ py: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ArrowForwardIcon sx={{ color: theme.palette.warning.main }} />
                          <Typography variant="body1" fontWeight="500">
                            Diteruskan untuk Proses Selanjutnya
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, display: 'block' }}>
                          Status akan diubah menjadi <strong>"diteruskan"</strong> ke Kabag TU & PPK
                        </Typography>
                      </Box>
                    } 
                    sx={{ width: '100%', m: 0, px: 2, py: 1 }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            {/* Field Catatan */}
            <TextField
              fullWidth
              label="Catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              multiline
              rows={3}
              placeholder="Masukkan catatan (opsional)"
              size="small"
              helperText="Catatan akan ditambahkan ke deskripsi laporan"
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined">
          Batal
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color={keputusan === 'selesai' ? 'success' : 'warning'}
          startIcon={getKeputusanIcon(keputusan)}
          disabled={loading}
          sx={{ minWidth: 120 }}
        >
          {keputusan === 'selesai' ? 'Selesai' : 'Teruskan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiModal;