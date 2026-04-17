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
  MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useSession } from 'next-auth/react';

// Format Rupiah
const formatRupiah = (value) => {
  if (!value) return 'Rp 0';
  const number = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(number)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID').format(number);
};

const VerifikasiPPKModal = ({
  open,
  onClose,
  onConfirm,
  laporan,
  loading = false,
}) => {
  const theme = useTheme();
  const { data: session } = useSession();
  const [hasil, setHasil] = useState('disetujui');
  const [catatan, setCatatan] = useState('');
  const [picData, setPicData] = useState(null);
  const [loadingPic, setLoadingPic] = useState(false);

  // Fetch data PIC saat modal dibuka
  useEffect(() => {
    const fetchPicData = async () => {
      if (!open || !laporan?.ruangan_id || !session?.accessToken) return;
      
      console.log('🔍 Fetching PIC data for ruangan_id:', laporan.ruangan_id);
      setLoadingPic(true);
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5002';
        const response = await fetch(`${baseUrl}/api/picruangan`, {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          let pics = [];
          
          if (result.data && Array.isArray(result.data)) {
            pics = result.data;
          } else if (Array.isArray(result)) {
            pics = result;
          }
          
          console.log('📋 Semua data PIC:', pics);
          
          // Cari PIC berdasarkan ruangan_id
          const foundPic = pics.find(pic => pic.ruangan_id === laporan.ruangan_id);
          
          if (foundPic) {
            setPicData(foundPic);
            console.log('✅ PIC ditemukan:', foundPic);
          } else {
            console.log('❌ PIC tidak ditemukan untuk ruangan_id:', laporan.ruangan_id);
          }
        }
      } catch (error) {
        console.error('Error fetching PIC data:', error);
      } finally {
        setLoadingPic(false);
      }
    };
    
    fetchPicData();
  }, [open, laporan?.ruangan_id, session?.accessToken]);

  // Reset form saat modal dibuka
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
  
  // Ambil nama PIC dari data yang sudah di-fetch
  let picRuanganNama = '-';
  let picRuanganId = null;
  let picRuanganTglPenugasan = null;
  
  if (picData) {
    // Data dari fetch API
    picRuanganNama = picData.user_name || picData.userName || picData.nama || '-';
    picRuanganId = picData.user_id || picData.id;
    picRuanganTglPenugasan = picData.tgl_penugasan;
    console.log('📋 Menggunakan data PIC dari fetch API:', picRuanganNama);
  } else if (laporan.pic_ruangan) {
    // Fallback ke data dari laporan jika ada
    if (typeof laporan.pic_ruangan === 'object') {
      picRuanganNama = laporan.pic_ruangan.user_name || 
                       laporan.pic_ruangan.userName || 
                       laporan.pic_ruangan.nama || 
                       laporan.pic_ruangan.name || 
                       '-';
      picRuanganId = laporan.pic_ruangan.user_id || laporan.pic_ruangan.id;
      picRuanganTglPenugasan = laporan.pic_ruangan.tgl_penugasan;
    } else if (typeof laporan.pic_ruangan === 'string') {
      picRuanganNama = laporan.pic_ruangan;
    }
  } else if (laporan.pic_ruangan_nama) {
    picRuanganNama = laporan.pic_ruangan_nama;
  } else if (laporan.pic_nama) {
    picRuanganNama = laporan.pic_nama;
  } else if (laporan.pelapor_nama) {
    // Fallback terakhir ke pelapor_nama
    picRuanganNama = laporan.pelapor_nama;
  }

  console.log('📋 Final PIC Ruangan Nama:', picRuanganNama);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
      PaperProps={{ sx: { borderRadius: 3, boxShadow: theme.shadows[10] } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: theme.palette.success.main, width: 40, height: 40, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ color: 'white' }}>Rp</Typography>
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="700">Verifikasi PPK</Typography>
              <Typography variant="caption" color="text.secondary">Verifikasi anggaran perbaikan aset</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} disabled={loading} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {loading || loadingPic ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Informasi Laporan */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: alpha(theme.palette.info.main, 0.04), borderRadius: 2 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <AssignmentIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" fontWeight="600" color="info.main">Detail Laporan</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Nomor Laporan:</Typography>
                  <Typography variant="body2" fontWeight="700">{laporan.nomor_laporan || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Pelapor:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.pelapor_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Ruangan:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.ruangan_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Aset:</Typography>
                  <Typography variant="body2" fontWeight="600">{laporan.aset_nama || '-'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Estimasi Biaya:</Typography>
                  <Typography variant="body2" fontWeight="700" sx={{ color: theme.palette.warning.main, fontSize: '1rem' }}>
                    {estimasiBiayaDariPIC ? `Rp ${formatRupiah(estimasiBiayaDariPIC)}` : 'Belum diisi'}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Informasi PIC Ruangan */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.info.main, 0.04), borderRadius: 2 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ width: 48, height: 48, bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main }}>
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
                  {picRuanganTglPenugasan && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Ditugaskan: {format(new Date(picRuanganTglPenugasan), 'dd MMMM yyyy', { locale: id })}
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
              <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600 }}>Hasil Verifikasi</FormLabel>
              <RadioGroup value={hasil} onChange={(e) => setHasil(e.target.value)}>
                <Paper variant="outlined" sx={{ mb: 1.5, borderColor: hasil === 'disetujui' ? theme.palette.success.main : theme.palette.divider, bgcolor: hasil === 'disetujui' ? alpha(theme.palette.success.main, 0.04) : 'transparent', borderRadius: 2 }}>
                  <FormControlLabel value="disetujui" control={<Radio />} label={
                    <Box sx={{ py: 1.5, px: 1 }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main }}><CheckCircleIcon fontSize="small" /></Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="600">Setujui Anggaran</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Anggaran sebesar {estimasiBiayaDariPIC ? `Rp ${formatRupiah(estimasiBiayaDariPIC)}` : 'yang diajukan'} disetujui
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  } sx={{ width: '100%', m: 0 }} />
                </Paper>

                <Paper variant="outlined" sx={{ borderColor: hasil === 'ditolak' ? theme.palette.error.main : theme.palette.divider, bgcolor: hasil === 'ditolak' ? alpha(theme.palette.error.main, 0.04) : 'transparent', borderRadius: 2 }}>
                  <FormControlLabel value="ditolak" control={<Radio />} label={
                    <Box sx={{ py: 1.5, px: 1 }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main }}><CancelIcon fontSize="small" /></Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="600">Tolak Anggaran</Typography>
                          <Typography variant="caption" color="text.secondary">Anggaran ditolak, laporan tidak dapat diproses</Typography>
                        </Box>
                      </Box>
                    </Box>
                  } sx={{ width: '100%', m: 0 }} />
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
              InputProps={{ sx: { borderRadius: 2 } }}
            />

            <Alert severity={hasil === 'disetujui' ? 'success' : 'error'} sx={{ mt: 2, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>Ringkasan Verifikasi</Typography>
              <Typography variant="caption">
                {hasil === 'disetujui' 
                  ? `✅ Anggaran sebesar ${estimasiBiayaDariPIC ? `Rp ${formatRupiah(estimasiBiayaDariPIC)}` : 'yang diajukan'} disetujui. Status akan berubah menjadi "Dalam Perbaikan".`
                  : '❌ Anggaran ditolak. Laporan akan ditolak.'}
              </Typography>
            </Alert>

            {!estimasiBiayaDariPIC && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                ⚠️ Estimasi biaya belum diisi oleh PIC Ruangan.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2, px: 3 }}>Batal</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color={hasil === 'disetujui' ? 'success' : 'error'}
          startIcon={getHasilIcon(hasil)}
          disabled={loading}
          sx={{ borderRadius: 2, px: 4 }}
        >
          {hasil === 'disetujui' ? 'Setujui Anggaran' : 'Tolak Anggaran'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VerifikasiPPKModal;