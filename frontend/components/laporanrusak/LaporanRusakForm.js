// components/laporanrusak/LaporanRusakForm.js

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Box,
  Typography,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Skeleton,
  Stack,
  InputAdornment,
  IconButton,
  Autocomplete,
  Button,
  ImageList,
  ImageListItem,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ErrorOutline as ErrorIcon,
  InfoOutlined as InfoIcon,
  Home as HomeIcon,
  Inventory as InventoryIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  PriorityHigh as PriorityIcon,
  Assignment as AssignmentIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Build as BuildIcon,
  DoneAll as DoneAllIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  PhotoCamera as PhotoCameraIcon,
  Flag as FlagIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import idLocale from 'date-fns/locale/id';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as laporanApi from './api/laporanRusakApi';
import { useSession } from 'next-auth/react';

// ============================================
// KONSTANTA
// ============================================
const STATUS = {
  DRAFT: 'draft',
  MENUNGGU_VERIFIKASI_PIC: 'menunggu_verifikasi_pic',
  DIVERIFIKASI_PIC: 'diverifikasi_pic',
  MENUNGGU_VERIFIKASI_PPK: 'menunggu_verifikasi_ppk',
  DIVERIFIKASI_PPK: 'diverifikasi_ppk',
  MENUNGGU_DISPOSISI: 'menunggu_disposisi',
  DIDISPOSISI: 'didisposisi',
  DALAM_PERBAIKAN: 'dalam_perbaikan',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak'
};

const STATUS_OPTIONS = [
  { value: STATUS.DRAFT, label: 'Draft', color: 'default' },
  { value: STATUS.MENUNGGU_VERIFIKASI_PIC, label: 'Menunggu Verifikasi PIC', color: 'warning' },
  { value: STATUS.MENUNGGU_VERIFIKASI_PPK, label: 'Menunggu Verifikasi PPK', color: 'warning' },
  { value: STATUS.DIVERIFIKASI_PIC, label: 'Diverifikasi PIC', color: 'success' },
  { value: STATUS.DIVERIFIKASI_PPK, label: 'Diverifikasi PPK', color: 'success' },
  { value: STATUS.MENUNGGU_DISPOSISI, label: 'Menunggu Disposisi', color: 'info' },
  { value: STATUS.DIDISPOSISI, label: 'Didisposisi', color: 'secondary' },
  { value: STATUS.DALAM_PERBAIKAN, label: 'Dalam Perbaikan', color: 'info' },
  { value: STATUS.SELESAI, label: 'Selesai', color: 'success' },
  { value: STATUS.DITOLAK, label: 'Ditolak', color: 'error' },
];

const PRIORITY_OPTIONS = [
  { value: 'rendah', label: 'Rendah', color: 'success' },
  { value: 'sedang', label: 'Sedang', color: 'info' },
  { value: 'tinggi', label: 'Tinggi', color: 'warning' },
  { value: 'darurat', label: 'Darurat', color: 'error' },
];

// ============================================
// KOMPONEN SEDERHANA
// ============================================

// Status Badge
const StatusBadge = ({ status }) => {
  const theme = useTheme();
  const option = STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
  
  return (
    <Chip
      label={option.label}
      size="small"
      sx={{
        backgroundColor: alpha(theme.palette[option.color]?.main || theme.palette.grey[500], 0.1),
        color: theme.palette[option.color]?.main || theme.palette.grey[700],
        fontWeight: 500,
        borderRadius: 1.5,
      }}
    />
  );
};

// Priority Badge
const PriorityBadge = ({ priority }) => {
  const theme = useTheme();
  const option = PRIORITY_OPTIONS.find(opt => opt.value === priority) || PRIORITY_OPTIONS[1];
  
  return (
    <Chip
      label={option.label}
      size="small"
      sx={{
        backgroundColor: alpha(theme.palette[option.color].main, 0.1),
        color: theme.palette[option.color].main,
        fontWeight: 500,
        borderRadius: 1.5,
      }}
    />
  );
};

// Info Card Sederhana
const InfoCard = ({ icon, label, value }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
      <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(theme?.palette?.primary?.main || '#1976d2', 0.1), color: theme?.palette?.primary?.main || '#1976d2' }}>
        {icon}
      </Avatar>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{value}</Typography>
      </Box>
    </Box>
  );
};

// Upload Foto Sederhana
const SimpleFotoUploader = ({ photos = [], onPhotosChange, readOnly = false }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    setUploading(true);

    try {
      const newPhotos = await Promise.all(
        files.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              file,
              preview: reader.result,
              name: file.name,
              size: file.size,
            });
            reader.readAsDataURL(file);
          });
        })
      );

      onPhotosChange([...photos, ...newPhotos]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  if (readOnly && photos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        Tidak ada foto
      </Typography>
    );
  }

  return (
    <Box>
      {!readOnly && (
        <Box sx={{ mb: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            fullWidth
            sx={{ py: 1.5, borderRadius: 2 }}
          >
            {uploading ? 'Uploading...' : 'Upload Foto'}
          </Button>
        </Box>
      )}

      {photos.length > 0 && (
        <ImageList cols={4} gap={8} sx={{ m: 0 }}>
          {photos.map((photo, index) => (
            <ImageListItem key={index} sx={{ aspectRatio: '1/1', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
              <img src={photo.preview || photo.url} alt={`Foto ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {!readOnly && (
                <IconButton
                  size="small"
                  onClick={() => handleRemove(index)}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </ImageListItem>
          ))}
        </ImageList>
      )}
    </Box>
  );
};

// ============================================
// FORM UTAMA
// ============================================
const LaporanRusakForm = ({
  formData: initialFormData = {},
  setFormData,
  errors = {},
  readOnly = false,
  isEdit = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const { data: session } = useSession();
  const theme = useTheme();
  
  // State sederhana
  const [loading, setLoading] = useState({ ruangan: false, aset: false });
  const [ruanganList, setRuanganList] = useState([]);
  const [asetList, setAsetList] = useState([]);
  const [selectedRuangan, setSelectedRuangan] = useState(null);
  const [selectedAset, setSelectedAset] = useState(null);
  
  // State untuk menyimpan data PIC ruangan
  const [picRuangan, setPicRuangan] = useState(null);

  // Form data - Hanya field yang ada di database
  const [formData, setLocalFormData] = useState({
    id: initialFormData.id || null,
    nomor_laporan: initialFormData.nomor_laporan || '',
    aset_id: initialFormData.aset_id || '',
    ruangan_id: initialFormData.ruangan_id || '',
    pelapor_id: initialFormData.pelapor_id || session?.user?.id || '',
    tgl_laporan: initialFormData.tgl_laporan ? new Date(initialFormData.tgl_laporan) : new Date(),
    deskripsi: initialFormData.deskripsi || '',
    foto_kerusakan: initialFormData.foto_kerusakan || [],
    prioritas: initialFormData.prioritas || 'sedang',
    status: initialFormData.status || (isEdit ? initialFormData.status : STATUS.MENUNGGU_VERIFIKASI_PIC),
    // Field untuk display saja (tidak disimpan ke database)
    aset_nama: initialFormData.aset_nama || '',
    aset_kode: initialFormData.aset_kode || '',
    ruangan_nama: initialFormData.ruangan_nama || '',
    ruangan_kode: initialFormData.ruangan_kode || '',
    pelapor_nama: initialFormData.pelapor_nama || session?.user?.name || '',
  });

  // Update parent dengan data yang akan disimpan (tanpa field display)
  useEffect(() => {
    if (setFormData) {
      // Hanya kirim field yang diperlukan untuk disimpan ke database
      const dataToSave = {
        id: formData.id,
        nomor_laporan: formData.nomor_laporan,
        aset_id: formData.aset_id,
        ruangan_id: formData.ruangan_id,
        pelapor_id: formData.pelapor_id,
        tgl_laporan: formData.tgl_laporan,
        deskripsi: formData.deskripsi,
        foto_kerusakan: formData.foto_kerusakan,
        prioritas: formData.prioritas,
        status: formData.status,
      };
      setFormData(dataToSave);
    }
  }, [formData, setFormData]);

  // Fungsi untuk mengambil data PIC ruangan berdasarkan ruangan_id
  const fetchPicRuangan = async (ruanganId) => {
    if (!ruanganId || !session) return null;
    
    try {
      const result = await laporanApi.fetchPicByRuangan(session, ruanganId);
      console.log('Fetch PIC result:', result);
      
      if (result?.success && result?.data) {
        // Data PIC bisa berupa object atau array
        const picData = Array.isArray(result.data) ? result.data[0] : result.data;
        return picData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching PIC ruangan:', error);
      return null;
    }
  };

  // Load ruangan
  useEffect(() => {
    const loadRuangan = async () => {
      if (!session) return;
      setLoading(prev => ({ ...prev, ruangan: true }));
      try {
        const result = await laporanApi.fetchRuanganOptions(session);
        if (result?.success) {
          const data = Array.isArray(result.data) ? result.data : [];
          setRuanganList(data.filter(r => r.is_active));
          
          // Set selected jika ada
          if (formData.ruangan_id) {
            const ruangan = data.find(r => r.id === formData.ruangan_id);
            setSelectedRuangan(ruangan || null);
            if (ruangan) {
              setLocalFormData(prev => ({
                ...prev,
                ruangan_nama: ruangan.nama_ruangan || '',
                ruangan_kode: ruangan.kode_ruangan || '',
              }));
              
              // Ambil data PIC ruangan
              const pic = await fetchPicRuangan(formData.ruangan_id);
              setPicRuangan(pic);
            }
          }
        }
      } catch (error) {
        console.error('Error loading ruangan:', error);
      } finally {
        setLoading(prev => ({ ...prev, ruangan: false }));
      }
    };
    loadRuangan();
  }, [session, formData.ruangan_id]);

  // Load aset saat ruangan berubah
  useEffect(() => {
    const loadAset = async () => {
      if (!session || !formData.ruangan_id) {
        setAsetList([]);
        setSelectedAset(null);
        return;
      }
      
      setLoading(prev => ({ ...prev, aset: true }));
      try {
        const result = await laporanApi.fetchAsetByRuangan(session, formData.ruangan_id);
        if (result?.success) {
          const data = Array.isArray(result.data) ? result.data : [];
          setAsetList(data);
          
          // Set selected jika ada
          if (formData.aset_id) {
            const aset = data.find(a => a.id === formData.aset_id);
            setSelectedAset(aset || null);
            if (aset) {
              setLocalFormData(prev => ({
                ...prev,
                aset_nama: aset.nama_barang || '',
                aset_kode: aset.kode_barang || '',
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading aset:', error);
      } finally {
        setLoading(prev => ({ ...prev, aset: false }));
      }
    };
    loadAset();
  }, [session, formData.ruangan_id, formData.aset_id]);

  // Handlers
  const handleChange = (field, value) => {
    setLocalFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRuanganChange = async (event, newValue) => {
    setSelectedRuangan(newValue);
    handleChange('ruangan_id', newValue?.id || '');
    handleChange('ruangan_nama', newValue?.nama_ruangan || '');
    handleChange('ruangan_kode', newValue?.kode_ruangan || '');
    
    // Reset PIC ruangan
    setPicRuangan(null);
    
    // Ambil data PIC ruangan yang dipilih
    if (newValue?.id) {
      const pic = await fetchPicRuangan(newValue.id);
      setPicRuangan(pic);
      console.log('PIC untuk ruangan', newValue.nama_ruangan, ':', pic);
    }
    
    // Reset aset saat ruangan berubah
    handleChange('aset_id', '');
    handleChange('aset_nama', '');
    handleChange('aset_kode', '');
    setSelectedAset(null);
  };

  const handleAsetChange = (event, newValue) => {
    setSelectedAset(newValue);
    handleChange('aset_id', newValue?.id || '');
    handleChange('aset_nama', newValue?.nama_barang || '');
    handleChange('aset_kode', newValue?.kode_barang || '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(formData);
  };

  // Mendapatkan nama PIC untuk ditampilkan
  const getPicDisplayName = () => {
    if (!picRuangan) return '-';
    return picRuangan.user_name || picRuangan.nama || picRuangan.name || 'PIC';
  };

  // Mendapatkan informasi tambahan PIC
  const getPicDetail = () => {
    if (!picRuangan) return null;
    const details = [];
    if (picRuangan.tgl_penugasan) {
      details.push(`Ditugaskan: ${format(new Date(picRuangan.tgl_penugasan), 'dd MMM yyyy')}`);
    }
    if (picRuangan.status === 'aktif') {
      details.push('Status: Aktif');
    }
    return details.join(' • ');
  };

  // Loading
  if (loading.ruangan && ruanganList.length === 0 && !readOnly) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      </Paper>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} locale={idLocale}>
      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          
          {/* Header */}
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {readOnly ? 'Detail Laporan Kerusakan' : isEdit ? 'Edit Laporan Kerusakan' : 'Laporan Kerusakan Baru'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {readOnly ? 'Informasi lengkap laporan kerusakan' : 'Lengkapi form di bawah ini dengan data yang valid'}
          </Typography>

          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }}>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {Object.values(errors).map((err, i) => (
                  <li key={i}><Typography variant="body2">{err}</Typography></li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Info Cards untuk view mode */}
          {(readOnly || isEdit) && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {formData.nomor_laporan && (
                <Grid item xs={12} sm={6} md={3}>
                  <InfoCard icon={<AssignmentIcon />} label="Nomor Laporan" value={formData.nomor_laporan} />
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={3}>
                <InfoCard icon={<CalendarIcon />} label="Tanggal Laporan" value={format(formData.tgl_laporan, 'dd MMMM yyyy', { locale: id })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoCard icon={<PersonIcon />} label="Pelapor" value={formData.pelapor_nama || '-'} />
              </Grid>
              {picRuangan && getPicDisplayName() !== '-' && (
                <Grid item xs={12} sm={6} md={3}>
                  <InfoCard icon={<PersonIcon />} label="PIC Ruangan" value={getPicDisplayName()} />
                </Grid>
              )}
              {formData.status && (
                <Grid item xs={12} sm={6} md={3}>
                  <InfoCard icon={<InfoIcon />} label="Status" value={<StatusBadge status={formData.status} />} />
                </Grid>
              )}
              {formData.prioritas && (
                <Grid item xs={12} sm={6} md={3}>
                  <InfoCard icon={<FlagIcon />} label="Prioritas" value={<PriorityBadge priority={formData.prioritas} />} />
                </Grid>
              )}
            </Grid>
          )}

          {/* Form Fields */}
          <Grid container spacing={3}>
            
            {/* Tanggal Laporan */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Tanggal Laporan {!readOnly && <span style={{ color: theme.palette.error.main }}>*</span>}
              </Typography>
              {readOnly ? (
                <TextField 
                  fullWidth 
                  size="small" 
                  value={format(formData.tgl_laporan, 'dd MMMM yyyy', { locale: id })} 
                  disabled 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} 
                />
              ) : (
                <DatePicker
                  value={formData.tgl_laporan}
                  onChange={(date) => handleChange('tgl_laporan', date)}
                  format="dd/MM/yyyy"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true, 
                      size: 'small', 
                      error: !!errors.tgl_laporan, 
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 1.5 } } 
                    } 
                  }}
                />
              )}
            </Grid>

            {/* Pelapor - readonly karena dari session */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Pelapor
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={formData.pelapor_nama || session?.user?.name || '-'}
                disabled
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 }, bgcolor: 'grey.50' }}
              />
            </Grid>

            {/* Ruangan */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Ruangan {!readOnly && <span style={{ color: theme.palette.error.main }}>*</span>}
              </Typography>
              {readOnly ? (
                <TextField 
                  fullWidth 
                  size="small" 
                  value={`${formData.ruangan_kode || ''} - ${formData.ruangan_nama || ''}`} 
                  disabled 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} 
                />
              ) : (
                <Autocomplete
                  options={ruanganList}
                  loading={loading.ruangan}
                  getOptionLabel={(opt) => opt ? `${opt.kode_ruangan} - ${opt.nama_ruangan}` : ''}
                  value={selectedRuangan}
                  onChange={handleRuanganChange}
                  isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                  size="small"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Cari ruangan..."
                      error={!!errors.ruangan_id}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                    />
                  )}
                />
              )}
            </Grid>

            {/* PIC Ruangan - Menampilkan PIC dari ruangan yang dipilih */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                PIC Ruangan
              </Typography>
              {readOnly ? (
                <TextField
                  fullWidth
                  size="small"
                  value={getPicDisplayName()}
                  disabled
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 }, bgcolor: 'grey.50' }}
                />
              ) : (
                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={getPicDisplayName()}
                    disabled
                    sx={{ 
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5 }, 
                      bgcolor: picRuangan ? alpha(theme.palette.info.main, 0.05) : 'grey.50',
                      '& .MuiOutlinedInput-root.Mui-disabled': {
                        '& > fieldset': { borderColor: picRuangan ? alpha(theme.palette.info.main, 0.3) : undefined }
                      }
                    }}
                    InputProps={{
                      startAdornment: picRuangan ? (
                        <InputAdornment position="start">
                          <PersonIcon color="info" fontSize="small" />
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                  {picRuangan && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {getPicDetail() || 'PIC akan memverifikasi laporan ini'}
                    </Typography>
                  )}
                  {!picRuangan && selectedRuangan && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                      ⚠️ Belum ada PIC yang ditugaskan untuk ruangan ini
                    </Typography>
                  )}
                  {!selectedRuangan && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Pilih ruangan terlebih dahulu untuk melihat PIC
                    </Typography>
                  )}
                </Box>
              )}
            </Grid>

            {/* Aset */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Aset {!readOnly && <span style={{ color: theme.palette.error.main }}>*</span>}
              </Typography>
              {readOnly ? (
                <TextField 
                  fullWidth 
                  size="small" 
                  value={`${formData.aset_kode || ''} - ${formData.aset_nama || ''}`} 
                  disabled 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} 
                />
              ) : (
                <Autocomplete
                  options={asetList}
                  loading={loading.aset}
                  getOptionLabel={(opt) => opt ? `${opt.kode_barang} - ${opt.nama_barang}` : ''}
                  value={selectedAset}
                  onChange={handleAsetChange}
                  isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                  disabled={!formData.ruangan_id}
                  size="small"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={!formData.ruangan_id ? 'Pilih ruangan terlebih dahulu' : 'Cari aset...'}
                      error={!!errors.aset_id}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                    />
                  )}
                />
              )}
            </Grid>

            {/* Prioritas */}
            <Grid item xs={12} md={6}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Prioritas {!readOnly && <span style={{ color: theme.palette.error.main }}>*</span>}
              </Typography>
              {readOnly ? (
                <Box><PriorityBadge priority={formData.prioritas} /></Box>
              ) : (
                <FormControl fullWidth size="small" error={!!errors.prioritas}>
                  <Select
                    value={formData.prioritas}
                    onChange={(e) => handleChange('prioritas', e.target.value)}
                    sx={{ borderRadius: 1.5 }}
                    startAdornment={
                      <InputAdornment position="start">
                        <FlagIcon fontSize="small" color="action" />
                      </InputAdornment>
                    }
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ 
                            width: 10, 
                            height: 10, 
                            borderRadius: '50%', 
                            bgcolor: theme.palette[opt.color]?.main || theme.palette.grey[500],
                          }} />
                          {opt.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>

            {/* Status - hanya untuk edit */}
            {isEdit && !readOnly && (
              <Grid item xs={12} md={6}>
                <Typography variant="body2" fontWeight={500} mb={0.5}>
                  Status
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    sx={{ borderRadius: 1.5 }}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Deskripsi Kerusakan */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Deskripsi Kerusakan {!readOnly && <span style={{ color: theme.palette.error.main }}>*</span>}
              </Typography>
              {readOnly ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1.5 }}>
                  <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>{formData.deskripsi || '-'}</Typography>
                </Paper>
              ) : (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.deskripsi}
                  onChange={(e) => handleChange('deskripsi', e.target.value)}
                  placeholder="Jelaskan kondisi kerusakan secara detail..."
                  error={!!errors.deskripsi}
                  helperText={errors.deskripsi}
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              )}
            </Grid>

            {/* Foto Kerusakan */}
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>
                Foto Kerusakan {!readOnly && <span style={{ color: theme.palette.text.secondary }}>(opsional)</span>}
              </Typography>
              <SimpleFotoUploader
                photos={formData.foto_kerusakan}
                onPhotosChange={(newPhotos) => handleChange('foto_kerusakan', newPhotos)}
                readOnly={readOnly}
              />
            </Grid>

          </Grid>

          {/* Action Buttons */}
          {!readOnly && (
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {onCancel && (
                <Button variant="outlined" onClick={onCancel} sx={{ borderRadius: 1.5, px: 3 }}>
                  Batal
                </Button>
              )}
             
            </Box>
          )}

        </Paper>
      </form>
    </LocalizationProvider>
  );
};

export default LaporanRusakForm;