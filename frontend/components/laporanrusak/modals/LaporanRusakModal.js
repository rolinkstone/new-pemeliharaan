// components/laporanrusak/modals/LaporanRusakModal.js

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
  Alert,
  Chip,
  Avatar,
  Divider,
  Grid,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Room as RoomIcon,
  Inventory as InventoryIcon,
  CalendarToday as CalendarIcon,
  PriorityHigh as PriorityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Build as BuildIcon,
  DoneAll as DoneAllIcon,
  ArrowForward as ArrowForwardIcon,
  SupervisorAccount as SupervisorAccountIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import LaporanRusakForm from '../LaporanRusakForm';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// ============================================
// KONSTANTA STATUS - SAMA DENGAN DATABASE
// ============================================
const STATUS = {
  DRAFT: 'draft',
  MENUNGGU_VERIFIKASI_PIC: 'menunggu_verifikasi_pic',
  DIVERIFIKASI_PIC: 'diverifikasi_pic',
  MENUNGGU_VERIFIKASI_PPK: 'menunggu_verifikasi_ppk',
  DIVERIFIKASI_PPK: 'diverifikasi_ppk',
  MENUNGGU_DISPOSISI: 'menunggu_disposisi',
  DITERUSKAN: 'diteruskan',
  DIDISPOSISI: 'didisposisi',
  DALAM_PERBAIKAN: 'dalam_perbaikan',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak'
};

// ============================================
// KOMPONEN STATUS BADGE
// ============================================
const StatusBadge = ({ status, size = 'medium' }) => {
  const theme = useTheme();
  
  const getStatusConfig = (status) => {
    const configs = {
      [STATUS.DRAFT]: { 
        label: 'Draft', 
        color: theme.palette.grey[600],
        bgColor: alpha(theme.palette.grey[600], 0.1),
        icon: <ScheduleIcon /> 
      },
      [STATUS.MENUNGGU_VERIFIKASI_PIC]: { 
        label: 'Menunggu Verifikasi PIC', 
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1),
        icon: <WarningIcon /> 
      },
      [STATUS.MENUNGGU_VERIFIKASI_PPK]: { 
        label: 'Menunggu Verifikasi PPK', 
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1),
        icon: <WarningIcon /> 
      },
      [STATUS.DIVERIFIKASI_PIC]: { 
        label: 'Diverifikasi PIC', 
        color: theme.palette.info.main,
        bgColor: alpha(theme.palette.info.main, 0.1),
        icon: <CheckCircleIcon /> 
      },
      [STATUS.DIVERIFIKASI_PPK]: { 
        label: 'Diverifikasi PPK', 
        color: theme.palette.info.main,
        bgColor: alpha(theme.palette.info.main, 0.1),
        icon: <CheckCircleIcon /> 
      },
      [STATUS.MENUNGGU_DISPOSISI]: { 
        label: 'Menunggu Disposisi', 
        color: theme.palette.secondary.main,
        bgColor: alpha(theme.palette.secondary.main, 0.1),
        icon: <AssignmentIcon /> 
      },
      [STATUS.DITERUSKAN]: { 
        label: 'Diteruskan', 
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1),
        icon: <ArrowForwardIcon /> 
      },
      [STATUS.DIDISPOSISI]: { 
        label: 'Didisposisi', 
        color: theme.palette.primary.main,
        bgColor: alpha(theme.palette.primary.main, 0.1),
        icon: <PersonIcon /> 
      },
      [STATUS.DALAM_PERBAIKAN]: { 
        label: 'Dalam Perbaikan', 
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1),
        icon: <BuildIcon /> 
      },
      [STATUS.SELESAI]: { 
        label: 'Selesai', 
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.1),
        icon: <DoneAllIcon /> 
      },
      [STATUS.DITOLAK]: { 
        label: 'Ditolak', 
        color: theme.palette.error.main,
        bgColor: alpha(theme.palette.error.main, 0.1),
        icon: <ErrorIcon /> 
      }
    };
    
    return configs[status] || { 
      label: status || 'Unknown', 
      color: theme.palette.grey[600],
      bgColor: alpha(theme.palette.grey[600], 0.1),
      icon: <InfoIcon /> 
    };
  };

  const config = getStatusConfig(status);

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size={size}
      sx={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        border: `1px solid ${alpha(config.color, 0.3)}`,
        '& .MuiChip-icon': {
          color: config.color,
        },
        '& .MuiChip-label': {
          px: size === 'small' ? 1.5 : 2,
          fontWeight: 600,
        }
      }}
    />
  );
};

// ============================================
// KOMPONEN INFO CARD
// ============================================
const InfoCard = ({ icon, label, value, color = 'primary' }) => {
  const theme = useTheme();
  
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        bgcolor: alpha(theme.palette[color].main, 0.04),
        borderColor: alpha(theme.palette[color].main, 0.2),
        borderRadius: 2,
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: alpha(theme.palette[color].main, 0.1),
            color: theme.palette[color].main,
          }}
        >
          {icon}
        </Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" fontWeight="600">
            {value || '-'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

const LaporanRusakModal = ({
  open,
  onClose,
  onSubmit,
  initialData,
  title = 'Laporan Kerusakan',
  readOnly = false,
  loading = false,
}) => {
  const theme = useTheme();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && initialData) {
      console.log('='.repeat(50));
      console.log('📥 INITIAL DATA DARI API:', JSON.stringify(initialData, null, 2));
      console.log('='.repeat(50));
      
      // Debug: Lihat status yang diterima
      console.log('🔍 STATUS DARI API:', initialData.status);
      
      // ============================================
      // FORMAT DATA ASET
      // ============================================
      let asetData = {};
      
      if (initialData.aset && typeof initialData.aset === 'object') {
        console.log('✅ Menggunakan data dari initialData.aset');
        asetData = {
          aset_id: initialData.aset.id || '',
          aset_nama: initialData.aset.nama_barang || initialData.aset.nama || '',
          aset_kode: initialData.aset.kode_barang || initialData.aset.kode || '',
          aset_merk: initialData.aset.merk || '',
        };
      } 
      else if (initialData.aset_id) {
        console.log('✅ Menggunakan data dari field terpisah');
        asetData = {
          aset_id: initialData.aset_id || '',
          aset_nama: initialData.aset_nama || initialData.nama_barang || '',
          aset_kode: initialData.aset_kode || initialData.kode_barang || '',
          aset_merk: initialData.aset_merk || '',
        };
      }
      
      if (!asetData.aset_nama && initialData.nama_barang) {
        asetData.aset_nama = initialData.nama_barang;
      }
      if (!asetData.aset_kode && initialData.kode_barang) {
        asetData.aset_kode = initialData.kode_barang;
      }
      
      console.log('📊 Data Aset setelah format:', asetData);
      
      // ============================================
      // FORMAT DATA RUANGAN
      // ============================================
      let ruanganData = {};
      
      if (initialData.ruangan && typeof initialData.ruangan === 'object') {
        ruanganData = {
          ruangan_id: initialData.ruangan.id || '',
          ruangan_nama: initialData.ruangan.nama_ruangan || initialData.ruangan.nama || '',
          ruangan_kode: initialData.ruangan.kode_ruangan || initialData.ruangan.kode || '',
          ruangan_lokasi: initialData.ruangan.lokasi || '',
        };
      } else if (initialData.ruangan_id) {
        ruanganData = {
          ruangan_id: initialData.ruangan_id || '',
          ruangan_nama: initialData.ruangan_nama || '',
          ruangan_kode: initialData.ruangan_kode || '',
          ruangan_lokasi: initialData.ruangan_lokasi || '',
        };
      }
      
      // ============================================
      // FORMAT DATA PELAPOR
      // ============================================
      let pelaporData = {};
      
      if (initialData.pelapor && typeof initialData.pelapor === 'object') {
        pelaporData = {
          pelapor_id: initialData.pelapor.id || '',
          pelapor_nama: initialData.pelapor.nama || '',
        };
      } else {
        pelaporData = {
          pelapor_id: initialData.pelapor_id || '',
          pelapor_nama: initialData.pelapor_nama || '',
        };
      }
      
      // ============================================
      // FORMAT FOTO KERUSAKAN
      // ============================================
      let fotoKerusakan = [];
      
      if (initialData.foto_kerusakan) {
        if (Array.isArray(initialData.foto_kerusakan)) {
          fotoKerusakan = initialData.foto_kerusakan.map((foto, index) => {
            if (typeof foto === 'string') {
              return {
                id: `foto-${index}`,
                url: foto,
                preview: foto,
                name: `foto-${index + 1}.jpg`,
              };
            } else if (foto && typeof foto === 'object') {
              return {
                id: foto.id || `foto-${index}`,
                url: foto.url || foto.path || '',
                preview: foto.url || foto.path || '',
                name: foto.nama || foto.name || `foto-${index + 1}.jpg`,
              };
            }
            return foto;
          });
        } else if (typeof initialData.foto_kerusakan === 'string') {
          try {
            const parsed = JSON.parse(initialData.foto_kerusakan);
            if (Array.isArray(parsed)) {
              fotoKerusakan = parsed.map((foto, index) => ({
                id: `foto-${index}`,
                url: typeof foto === 'string' ? foto : foto.url || '',
                preview: typeof foto === 'string' ? foto : foto.url || '',
                name: `foto-${index + 1}.jpg`,
              }));
            }
          } catch (e) {
            fotoKerusakan = [{
              id: 'foto-0',
              url: initialData.foto_kerusakan,
              preview: initialData.foto_kerusakan,
              name: 'foto-1.jpg',
            }];
          }
        }
      }
      
      // ============================================
      // FORMAT TANGGAL
      // ============================================
      let tglLaporan = new Date();
      if (initialData.tgl_laporan) {
        tglLaporan = new Date(initialData.tgl_laporan);
        if (isNaN(tglLaporan.getTime())) {
          tglLaporan = new Date();
        }
      }
      
      // ============================================
      // PASTIKAN STATUS YANG BENAR
      // ============================================
      // Jika status dari API adalah 'menunggu_verifikasi_pic' tapi seharusnya 'menunggu_disposisi',
      // kita bisa melakukan koreksi di sini berdasarkan logika bisnis
      let correctedStatus = initialData.status;
      
      // Logika koreksi status jika diperlukan
      // Misalnya: jika ada data disposisi, status seharusnya 'menunggu_disposisi'
      if (initialData.status === STATUS.MENUNGGU_VERIFIKASI_PIC && initialData.disposisi_ke) {
        correctedStatus = STATUS.MENUNGGU_DISPOSISI;
        console.log('🔄 Mengkoreksi status dari menunggu_verifikasi_pic -> menunggu_disposisi');
      }
      
      console.log('📊 Status setelah koreksi:', correctedStatus);
      
      // ============================================
      // GABUNGKAN SEMUA DATA
      // ============================================
      const formattedData = {
        id: initialData.id,
        nomor_laporan: initialData.nomor_laporan || '',
        tgl_laporan: tglLaporan,
        deskripsi: initialData.deskripsi || '',
        prioritas: initialData.prioritas || 'sedang',
        status: correctedStatus, // Gunakan status yang sudah dikoreksi
        foto_kerusakan: fotoKerusakan,
        created_at: initialData.created_at,
        updated_at: initialData.updated_at,
        
        // Data tambahan untuk disposisi
        disposisi_ke: initialData.disposisi_ke,
        disposisi_catatan: initialData.disposisi_catatan,
        disposisi_tgl: initialData.disposisi_tgl,
        estimasi_biaya: initialData.estimasi_biaya,
        
        // Data aset
        ...asetData,
        
        // Data ruangan
        ...ruanganData,
        
        // Data pelapor
        ...pelaporData,
      };
      
      console.log('📤 FORMATTED DATA UNTUK FORM:', formattedData);
      console.log('📤 STATUS YANG AKAN DITAMPILKAN:', formattedData.status);
      console.log('='.repeat(50));
      
      setFormData(formattedData);
      
    } else if (open && !initialData) {
      setFormData({});
    }
  }, [open, initialData]);

  const handleClose = () => {
    if (!loading) {
      setFormData({});
      setErrors({});
      onClose();
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!readOnly) {
      if (!formData.aset_id) newErrors.aset_id = 'Aset harus dipilih';
      if (!formData.ruangan_id) newErrors.ruangan_id = 'Ruangan harus dipilih';
      if (!formData.deskripsi) newErrors.deskripsi = 'Deskripsi kerusakan harus diisi';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (readOnly) {
      handleClose();
      return;
    }
    
    if (validateForm()) {
      const dataToSubmit = {
        ...formData,
        foto_kerusakan: formData.foto_kerusakan?.map(foto => foto.url || foto) || [],
        status: formData.id ? formData.status : 'menunggu_verifikasi_pic'
      };
      
      console.log('📤 DATA YANG AKAN DISUBMIT:', dataToSubmit);
      onSubmit(dataToSubmit);
    }
  };

  // ============================================
  // RENDER UNTUK MODE VIEW (READ ONLY)
  // ============================================
  const renderReadOnly = () => {
    if (!formData.id) return null;

    return (
      <Box sx={{ mb: 3 }}>
        {/* Header Status */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            mb: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                }}
              >
                <AssignmentIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="700">
                  {formData.nomor_laporan}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dibuat: {formData.created_at ? format(new Date(formData.created_at), 'dd MMMM yyyy HH:mm', { locale: id }) : '-'}
                </Typography>
              </Box>
            </Box>
            <Box>
              <StatusBadge status={formData.status} size="large" />
            </Box>
          </Box>
        </Paper>

        {/* Info Cards Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<PersonIcon />}
              label="Pelapor"
              value={formData.pelapor_nama}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<RoomIcon />}
              label="Ruangan"
              value={formData.ruangan_nama}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<InventoryIcon />}
              label="Aset"
              value={formData.aset_nama}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<CalendarIcon />}
              label="Tanggal Laporan"
              value={format(formData.tgl_laporan, 'dd MMMM yyyy', { locale: id })}
              color="warning"
            />
          </Grid>
        </Grid>

        {/* Detail Kerusakan */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            Deskripsi Kerusakan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {formData.deskripsi || '-'}
          </Typography>
        </Paper>

        {/* Informasi Disposisi (jika ada) */}
        {formData.disposisi_catatan && (
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <SupervisorAccountIcon color="info" />
              <Typography variant="subtitle1" fontWeight="600" color="info.main">
                Informasi Disposisi
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {formData.disposisi_catatan}
            </Typography>
            {formData.disposisi_tgl && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Tanggal disposisi: {format(new Date(formData.disposisi_tgl), 'dd MMMM yyyy HH:mm', { locale: id })}
              </Typography>
            )}
          </Paper>
        )}

        {/* Estimasi Biaya (jika ada) */}
        {formData.estimasi_biaya && (
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.02) }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <AttachMoneyIcon color="success" />
              <Typography variant="subtitle1" fontWeight="600" color="success.main">
                Estimasi Biaya
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight="600" color="success.main">
              Rp {formData.estimasi_biaya.toLocaleString()}
            </Typography>
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
      scroll="body"
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        m: 0, 
        p: 2.5, 
        bgcolor: 'primary.main', 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              width: 36,
              height: 36,
            }}
          >
            <AssignmentIcon />
          </Avatar>
          <Typography variant="h6" fontWeight="700">
            {title}
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {readOnly && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Mode tampilan: Anda hanya dapat melihat detail laporan
                </Typography>
              </Alert>
            )}

            {/* Tampilkan informasi readOnly jika mode view */}
            {readOnly && renderReadOnly()}

            {/* Tampilkan form untuk mode edit/create */}
            {!readOnly && (
              <LaporanRusakForm
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={readOnly}
                isEdit={!!initialData?.id}
              />
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: 'grey.50' }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          {readOnly ? 'Tutup' : 'Batal'}
        </Button>
        {!readOnly && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            Simpan
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LaporanRusakModal;