// components/laporanrusak/modals/SelesaiPerbaikanModal.js

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
  Alert,
  Paper,
  Chip,
  Avatar,
  Rating,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Build as BuildIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
  Star as StarIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import idLocale from 'date-fns/locale/id';

const SelesaiPerbaikanModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  
  // State untuk form
  const [hasilPerbaikan, setHasilPerbaikan] = useState('internal');
  const [catatan, setCatatan] = useState('');
  const [rating, setRating] = useState(5);
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date());
  const [biayaAktual, setBiayaAktual] = useState('');
  const [dokumentasi, setDokumentasi] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [namaVendor, setNamaVendor] = useState('');
  const [noKontrak, setNoKontrak] = useState('');

  useEffect(() => {
    if (open && laporan) {
      setHasilPerbaikan('internal');
      setCatatan('');
      setRating(5);
      setTanggalSelesai(new Date());
      setBiayaAktual(laporan.estimasi_biaya || '');
      setDokumentasi('');
      setRekomendasi('');
      setNamaVendor('');
      setNoKontrak('');
    }
  }, [open, laporan]);

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleSubmit = () => {
    const dataToSubmit = {
      hasil_perbaikan: hasilPerbaikan,
      catatan: catatan || getDefaultCatatan(),
      tanggal_selesai: tanggalSelesai.toISOString().split('T')[0],
      rating: (hasilPerbaikan === 'internal' || hasilPerbaikan === 'eksternal') ? rating : null,
      biaya_aktual: biayaAktual ? parseFloat(biayaAktual) : null,
      dokumentasi: dokumentasi || null,
      rekomendasi: rekomendasi || null,
      nama_vendor: hasilPerbaikan === 'eksternal' ? namaVendor : null,
      no_kontrak: hasilPerbaikan === 'eksternal' ? noKontrak : null,
      next_status: (hasilPerbaikan === 'internal' || hasilPerbaikan === 'eksternal') ? 'selesai' : 'dalam_perbaikan',
    };
    
    console.log('📤 Selesai Perbaikan - Data dikirim:', dataToSubmit);
    onConfirm(dataToSubmit);
  };

  const getDefaultCatatan = () => {
    switch(hasilPerbaikan) {
      case 'internal':
        return 'Perbaikan berhasil dilakukan oleh tim internal';
      case 'eksternal':
        return 'Perbaikan berhasil dilakukan oleh vendor eksternal';
      case 'gagal':
        return 'Perbaikan gagal dilakukan, perlu penanganan lebih lanjut';
      default:
        return '';
    }
  };

  const getHasilIcon = () => {
    switch(hasilPerbaikan) {
      case 'internal':
        return <GroupIcon sx={{ color: theme.palette.success.main }} />;
      case 'eksternal':
        return <BusinessIcon sx={{ color: theme.palette.info.main }} />;
      case 'gagal':
        return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return <InfoIcon />;
    }
  };

  const getHasilLabel = () => {
    switch(hasilPerbaikan) {
      case 'internal':
        return 'Berhasil (Tim Internal)';
      case 'eksternal':
        return 'Berhasil (Vendor Eksternal)';
      case 'gagal':
        return 'Gagal';
      default:
        return '';
    }
  };

  if (!laporan) return null;

  // Dapatkan nama PIC Ruangan yang benar
  const picRuanganNama = laporan?.pic_ruangan || 
                         laporan?.pic_ruangan_nama || 
                         laporan?.pic_nama || 
                         laporan?.pelapor_nama || 
                         '-';
  
  const picRuanganId = laporan?.pic_ruangan_id || laporan?.pic_id || null;

  console.log('📋 SelesaiPerbaikanModal - Data PIC Ruangan:', {
    pic_ruangan: laporan?.pic_ruangan,
    pic_ruangan_nama: laporan?.pic_ruangan_nama,
    pic_ruangan_id: laporan?.pic_ruangan_id,
    pelapor_nama: laporan?.pelapor_nama
  });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} locale={idLocale}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
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
          bgcolor: alpha(theme.palette.success.main, 0.02),
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
                <BuildIcon sx={{ fontSize: 24, color: 'white' }} />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="700">
                  Selesaikan Perbaikan
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Laporkan hasil perbaikan aset
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
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
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
                    Detail Laporan yang Diperbaiki
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  {/* Kolom Kiri */}
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" flexDirection="column" gap={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">Nomor Laporan:</Typography>
                        <Typography variant="body2" fontWeight="700" color="text.primary">
                          {laporan.nomor_laporan || '-'}
                        </Typography>
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
                        <Typography variant="body2" color="text.secondary">Estimasi Biaya:</Typography>
                        <Typography variant="body2" fontWeight="700" color="success.main">
                          {laporan.estimasi_biaya 
                            ? `Rp ${laporan.estimasi_biaya.toLocaleString()}` 
                            : '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Kolom Kanan */}
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" flexDirection="column" gap={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">Pelapor:</Typography>
                        <Typography variant="body2" fontWeight="600">{laporan.pelapor_nama || '-'}</Typography>
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
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">Kode Barang:</Typography>
                        <Typography variant="body2" fontWeight="600">
                          {laporan.aset_kode || '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                {laporan.deskripsi && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Deskripsi Kerusakan:
                    </Typography>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">
                        {laporan.deskripsi}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Paper>

              {/* Informasi PIC Ruangan */}
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderRadius: 2,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                }}
              >
                <Box display="flex" alignItems="center" gap={2}>
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
                      PIC Ruangan: {picRuanganNama}
                    </Typography>
                    {picRuanganId && (
                      <Typography variant="caption" color="text.secondary">
                        ID: {picRuanganId}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Anda bertanggung jawab untuk melaporkan hasil perbaikan aset ini
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Tanggal Selesai */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="600" color="text.secondary" gutterBottom>
                  Tanggal Selesai Perbaikan
                </Typography>
                <DatePicker
                  value={tanggalSelesai}
                  onChange={setTanggalSelesai}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'medium',
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarIcon sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 }
                      }
                    }
                  }}
                />
              </Box>

              {/* Hasil Perbaikan */}
              <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Hasil Perbaikan
                </FormLabel>
                <RadioGroup value={hasilPerbaikan} onChange={(e) => setHasilPerbaikan(e.target.value)}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          borderColor: hasilPerbaikan === 'internal' ? theme.palette.success.main : theme.palette.divider,
                          bgcolor: hasilPerbaikan === 'internal' ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: theme.palette.success.main,
                            bgcolor: alpha(theme.palette.success.main, 0.02),
                          }
                        }}
                      >
                        <FormControlLabel 
                          value="internal" 
                          control={<Radio />} 
                          label={
                            <Box sx={{ py: 1.5, px: 1, textAlign: 'center' }}>
                              <GroupIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                              <Typography variant="body1" fontWeight="600">
                                Tim Internal
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Berhasil diperbaiki oleh tim internal
                              </Typography>
                            </Box>
                          } 
                          sx={{ width: '100%', m: 0 }}
                        />
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          borderColor: hasilPerbaikan === 'eksternal' ? theme.palette.info.main : theme.palette.divider,
                          bgcolor: hasilPerbaikan === 'eksternal' ? alpha(theme.palette.info.main, 0.04) : 'transparent',
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: theme.palette.info.main,
                            bgcolor: alpha(theme.palette.info.main, 0.02),
                          }
                        }}
                      >
                        <FormControlLabel 
                          value="eksternal" 
                          control={<Radio />} 
                          label={
                            <Box sx={{ py: 1.5, px: 1, textAlign: 'center' }}>
                              <BusinessIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                              <Typography variant="body1" fontWeight="600">
                                Vendor Eksternal
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Berhasil diperbaiki oleh vendor
                              </Typography>
                            </Box>
                          } 
                          sx={{ width: '100%', m: 0 }}
                        />
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          borderColor: hasilPerbaikan === 'gagal' ? theme.palette.error.main : theme.palette.divider,
                          bgcolor: hasilPerbaikan === 'gagal' ? alpha(theme.palette.error.main, 0.04) : 'transparent',
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: theme.palette.error.main,
                            bgcolor: alpha(theme.palette.error.main, 0.02),
                          }
                        }}
                      >
                        <FormControlLabel 
                          value="gagal" 
                          control={<Radio />} 
                          label={
                            <Box sx={{ py: 1.5, px: 1, textAlign: 'center' }}>
                              <ErrorIcon sx={{ fontSize: 40, color: theme.palette.error.main, mb: 1 }} />
                              <Typography variant="body1" fontWeight="600">
                                Gagal
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Perbaikan gagal, perlu penanganan khusus
                              </Typography>
                            </Box>
                          } 
                          sx={{ width: '100%', m: 0 }}
                        />
                      </Paper>
                    </Grid>
                  </Grid>
                </RadioGroup>
              </FormControl>

              {/* Form untuk Vendor Eksternal */}
              {hasilPerbaikan === 'eksternal' && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nama Vendor"
                      value={namaVendor}
                      onChange={(e) => setNamaVendor(e.target.value)}
                      placeholder="Masukkan nama vendor"
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nomor Kontrak"
                      value={noKontrak}
                      onChange={(e) => setNoKontrak(e.target.value)}
                      placeholder="Masukkan nomor kontrak"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AssignmentIcon sx={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 }
                      }}
                    />
                  </Grid>
                </Grid>
              )}

              {/* Rating (hanya jika berhasil) */}
              {(hasilPerbaikan === 'internal' || hasilPerbaikan === 'eksternal') && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" fontWeight="600" color="text.secondary" gutterBottom>
                    Rating Kualitas Perbaikan
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.warning.main, 0.02),
                      borderColor: alpha(theme.palette.warning.main, 0.2),
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Rating
                        value={rating}
                        onChange={(event, newValue) => setRating(newValue)}
                        size="large"
                        icon={<StarIcon fontSize="inherit" />}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {rating}/5
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Biaya Aktual */}
              <TextField
                fullWidth
                label="Biaya Aktual (Rp)"
                value={biayaAktual}
                onChange={(e) => setBiayaAktual(e.target.value)}
                type="number"
                placeholder="Masukkan biaya aktual yang dikeluarkan"
                sx={{ mb: 3 }}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
                helperText="Biaya aktual yang dikeluarkan untuk perbaikan"
              />

              {/* Dokumentasi */}
              <TextField
                fullWidth
                label="Dokumentasi Perbaikan"
                value={dokumentasi}
                onChange={(e) => setDokumentasi(e.target.value)}
                placeholder="Link foto dokumentasi atau catatan"
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DescriptionIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2 }
                }}
                helperText="Opsional: Upload link foto dokumentasi perbaikan"
              />

              {/* Rekomendasi */}
              <TextField
                fullWidth
                label="Rekomendasi / Catatan"
                value={rekomendasi}
                onChange={(e) => setRekomendasi(e.target.value)}
                multiline
                rows={3}
                placeholder="Masukkan rekomendasi atau catatan tambahan..."
                sx={{ mb: 3 }}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
                helperText="Opsional: Rekomendasi untuk perawatan selanjutnya"
              />

              {/* Catatan Perbaikan */}
              <TextField
                fullWidth
                label="Catatan Perbaikan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                multiline
                rows={2}
                placeholder="Masukkan catatan detail perbaikan..."
                sx={{ mb: 2 }}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
              />

              <Alert 
                severity={hasilPerbaikan === 'internal' || hasilPerbaikan === 'eksternal' ? 'success' : 'error'}
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
                    Ringkasan
                  </Typography>
                  <Typography variant="caption">
                    {hasilPerbaikan === 'internal' 
                      ? '✅ Perbaikan oleh tim internal berhasil. Status laporan akan berubah menjadi "Selesai".'
                      : hasilPerbaikan === 'eksternal'
                        ? '✅ Perbaikan oleh vendor berhasil. Status laporan akan berubah menjadi "Selesai".'
                        : '❌ Perbaikan gagal. Laporan akan tetap dalam status "Dalam Perbaikan" dan perlu evaluasi lebih lanjut.'}
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
            color={hasilPerbaikan === 'internal' ? 'success' : hasilPerbaikan === 'eksternal' ? 'info' : 'error'}
            startIcon={getHasilIcon()}
            disabled={loading || (hasilPerbaikan === 'eksternal' && !namaVendor)}
            sx={{ 
              borderRadius: 2,
              px: 4,
              boxShadow: theme.shadows[4],
              background: hasilPerbaikan === 'internal' 
                ? `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                : hasilPerbaikan === 'eksternal'
                  ? `linear-gradient(45deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`
                  : `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
            }}
          >
            {getHasilLabel()}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default SelesaiPerbaikanModal;