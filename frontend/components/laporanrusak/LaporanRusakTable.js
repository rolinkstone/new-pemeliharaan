// components/laporanrusak/LaporanRusakTable.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Build as BuildIcon,
  DoneAll as DoneAllIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Room as RoomIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Photo as PhotoIcon,
  BrokenImage as BrokenImageIcon,
  PersonOutline as PersonOutlineIcon,
  SupervisorAccount as SupervisorAccountIcon,
  ArrowForward as ArrowForwardIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useSession } from 'next-auth/react';

// ============================================
// KONSTANTA STATUS
// ============================================
const STATUS = {
  DIAJUKAN: 'diajukan',
  MENUNGGU_KATIM: 'menunggu_katim',
  MENUNGGU_PPK: 'menunggu_ppk',
  DALAM_PERBAIKAN: 'dalam_perbaikan',
  MENUNGGU_KONFIRMASI_KABAG: 'menunggu_konfirmasi_kabag',
  MENUNGGU_KONFIRMASI_USER: 'menunggu_konfirmasi_user',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak'
};

// Base URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://data-tabela.bbpompky.id';

// Placeholder image
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFMEUwRTAiLz48cGF0aCBkPSJNMzUgMzBMNjUgNTBMMzUgNzBWMzBaIiBmaWxsPSIjOUU5RTlFIi8+PC9zdmc+';

// Fungsi untuk membersihkan URL foto
const cleanPhotoUrl = (photo) => {
  if (!photo) return null;
  
  if (typeof photo === 'string') {
    let cleanUrl = photo.replace('/api/uploads/', '/uploads/');
    
    if (cleanUrl.startsWith('http')) {
      return cleanUrl;
    }
    
    if (cleanUrl.startsWith('/uploads/')) {
      return `${BASE_URL}${cleanUrl}`;
    }
    
    if (cleanUrl.startsWith('/')) {
      return `${BASE_URL}/uploads${cleanUrl}`;
    }
    
    return `${BASE_URL}/uploads/${cleanUrl}`;
  }
  
  if (photo.url) {
    return cleanPhotoUrl(photo.url);
  }
  
  if (photo.preview) {
    return photo.preview;
  }
  
  return null;
};

// ============================================
// KOMPONEN FOTO PREVIEW
// ============================================
const FotoPreviewDialog = ({ open, onClose, photos = [], title = 'Foto Kerusakan' }) => {
  const handleDownload = async (photo) => {
    try {
      const imageUrl = cleanPhotoUrl(photo);
      if (!imageUrl) return;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = photo.name || `foto-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = PLACEHOLDER_IMAGE;
  };

  const photosArray = Array.isArray(photos) ? photos : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {photosArray.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ py: 8 }}>
            <PhotoIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="body1" color="textSecondary">Tidak ada foto</Typography>
          </Box>
        ) : (
          <ImageList cols={2} gap={16}>
            {photosArray.map((photo, index) => {
              const imageUrl = cleanPhotoUrl(photo);
              return (
                <ImageListItem key={index}>
                  <img
                    src={imageUrl || PLACEHOLDER_IMAGE}
                    alt={`Foto ${index + 1}`}
                    loading="lazy"
                    onError={handleImageError}
                    style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                  <ImageListItemBar
                    sx={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)' }}
                    position="bottom"
                    title={<Typography variant="caption" sx={{ color: 'white' }}>{photo.name || `Foto ${index + 1}`}</Typography>}
                    actionIcon={
                      <IconButton sx={{ color: 'white' }} onClick={() => handleDownload(photo)} size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    }
                  />
                </ImageListItem>
              );
            })}
          </ImageList>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// KOMPONEN THUMBNAIL FOTO
// ============================================
const FotoThumbnail = ({ photos = [], onView }) => {
  const [hover, setHover] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    setImageError(false);
  }, [photos]);
  
  const handleClick = (e) => {
    e.stopPropagation();
    onView(photos);
  };
  
  if (!photos || photos.length === 0) {
    return (
      <Box sx={{ width: 50, height: 50, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'grey.200', cursor: 'pointer' }} onClick={handleClick}>
        <PhotoIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  const photosArray = Array.isArray(photos) ? photos : [];
  const firstPhoto = photosArray[0];
  const imageUrl = cleanPhotoUrl(firstPhoto);

  if (imageError || !imageUrl) {
    return (
      <Box sx={{ width: 50, height: 50, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'grey.200', cursor: 'pointer' }} onClick={handleClick}>
        <BrokenImageIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: 50, height: 50 }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Box component="img" src={imageUrl} alt="Foto" onError={() => setImageError(true)} onClick={handleClick} sx={{ width: 50, height: 50, borderRadius: 1, objectFit: 'cover', cursor: 'pointer', border: '1px solid', borderColor: 'grey.200' }} />
      {photosArray.length > 1 && (
        <Box sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'primary.main', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 'bold', zIndex: 2, pointerEvents: 'none' }}>
          +{photosArray.length - 1}
        </Box>
      )}
      {hover && (
        <Tooltip title={`${photosArray.length} foto`}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }} onClick={handleClick}>
            <VisibilityIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

// ============================================
// KOMPONEN PIC AVATAR
// ============================================
const PICAvatar = ({ pic, size = 32 }) => {
  const theme = useTheme();
  
  const getDisplayName = (p) => {
    if (!p) return 'PIC';
    if (typeof p === 'string') return p;
    return p.user_name || p.userName || p.nama || p.name || p.pic_nama || 'PIC';
  };

  if (!pic) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Avatar sx={{ width: size, height: size, bgcolor: alpha(theme.palette.grey[500], 0.1), color: theme.palette.grey[500] }}>
          <PersonOutlineIcon sx={{ fontSize: size * 0.6 }} />
        </Avatar>
        <Typography variant="caption" color="textSecondary">Belum ada PIC</Typography>
      </Box>
    );
  }

  const displayName = getDisplayName(pic);
  const initial = displayName.charAt(0).toUpperCase();
  
  return (
    <Tooltip title={displayName}>
      <Box display="flex" alignItems="center" gap={1}>
        <Avatar sx={{ width: size, height: size, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontSize: size * 0.5, fontWeight: 600 }}>
          {initial}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 120 }}>
            {displayName}
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
};

// ============================================
// KOMPONEN UTAMA
// ============================================
const LaporanRusakTable = ({
  data = [],
  loading = false,
  onView,
  onEdit,
  onDelete,
  onVerifikasi,
  onDisposisi,
  onVerifikasiPPK,
  onSelesaiPerbaikan,
  onKatimKirim,
  onPPK,
  onCatatPerbaikan,
  onKonfirmasiKabag,
  onKonfirmasiUser,
  pagination = { currentPage: 1, perPage: 10, total: 0 },
  onPageChange,
  sortConfig = { field: 'tgl_laporan', direction: 'desc' },
  onSort,
  picData = {},
}) => {
  const theme = useTheme();
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPhotos, setPreviewPhotos] = useState([]);
  const [picDetails, setPicDetails] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filteredData, setFilteredData] = useState([]);
  const [loadingPIC, setLoadingPIC] = useState(false);

  // ========== DAPATKAN ROLE USER DARI SESSION ==========
  const userRoles = session?.user?.roles || [];
  const isAdmin = session?.user?.isAdmin || userRoles.includes('admin') || userRoles.includes('superadmin') || userRoles.includes('admin_pemeliharaan');
  const isPICRuangan = session?.user?.isPICRuangan || userRoles.includes('pic_ruangan') || userRoles.includes('pic');
  const isKabagTU = session?.user?.isKabagTU || userRoles.includes('kabag_tu');
  const isPPK = session?.user?.isPPK || userRoles.includes('ppk');
  const isKatim = session?.user?.isKatim || userRoles.includes('katim');

  // ========== AMBIL DATA PIC DARI BEBERAPA SUMBER ==========
  useEffect(() => {
    const fetchPicData = async () => {
      if (!session?.accessToken) return;
      
      setLoadingPIC(true);
      
      // Coba beberapa endpoint
      const endpoints = [
        `${BASE_URL}/api/picruangan`,
        `${BASE_URL}/api/pic_ruangan`,
        `${BASE_URL}/api/ruangan`,
      ];
      
      let pics = [];
      
      for (const url of endpoints) {
        try {
          console.log(`📤 Mencoba fetch dari: ${url}`);
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`📥 Response dari ${url}:`, result);
            
            if (url.includes('ruangan') && !url.includes('pic')) {
              // Data dari endpoint ruangan
              let ruanganData = result.data || result;
              if (Array.isArray(ruanganData)) {
                ruanganData.forEach(ruangan => {
                  if (ruangan.id && (ruangan.pic_user_name || ruangan.pic_user_id)) {
                    pics.push({
                      ruangan_id: ruangan.id,
                      user_name: ruangan.pic_user_name,
                      user_id: ruangan.pic_user_id,
                    });
                  }
                });
              }
            } else {
              // Data dari endpoint picruangan
              let picData = result.data || result;
              if (Array.isArray(picData)) {
                pics = picData;
              }
            }
            
            if (pics.length > 0) break;
          }
        } catch (error) {
          console.log(`❌ Error dengan ${url}:`, error.message);
        }
      }
      
      if (pics.length > 0) {
        console.log('📋 Data PIC yang ditemukan:', pics);
        
        // Buat mapping ruangan_id -> data PIC
        const picMapping = {};
        pics.forEach(pic => {
          const ruanganId = pic.ruangan_id || pic.ruanganId;
          if (ruanganId) {
            picMapping[ruanganId] = {
              user_name: pic.user_name || pic.userName || pic.nama,
              user_id: pic.user_id || pic.userId,
            };
          }
        });
        setPicDetails(picMapping);
        console.log('📋 Mapping PIC by ruangan:', picMapping);
      } else {
        console.log('⚠️ Tidak ada data PIC dari API, menggunakan fallback dari data row');
        
        // Fallback: Ambil PIC dari data row yang sudah ada
        const fallbackMapping = {};
        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.ruangan_id) {
              let picName = row.pic_ruangan_nama || row.pic_nama || row.pic_ruangan;
              if (picName && typeof picName === 'string') {
                fallbackMapping[row.ruangan_id] = {
                  user_name: picName,
                };
              }
            }
          });
          setPicDetails(fallbackMapping);
          console.log('📋 Fallback PIC mapping:', fallbackMapping);
        }
      }
      
      setLoadingPIC(false);
    };
    
    fetchPicData();
  }, [session, data]);

  // ========== FUNGSI CAN VERIFIKASI (CEK FISIK) ==========
  const canVerifikasi = (status) => {
    if (isAdmin) return status === STATUS.DIAJUKAN;
    return isPICRuangan && status === STATUS.DIAJUKAN;
  };

  // Data sudah disaring di backend sesuai role; frontend hanya menampilkan semua
  useEffect(() => {
    setFilteredData(data || []);
  }, [data]);

  const handleMenuOpen = (event, row) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleAction = (action) => {
    handleMenuClose();
    if (selectedRow) {
      switch (action) {
        case 'view': onView?.(selectedRow); break;
        case 'edit': onEdit?.(selectedRow); break;
        case 'delete': onDelete?.(selectedRow); break;
        case 'verifikasi': onVerifikasi?.(selectedRow); break;
        case 'disposisi': 
          console.log('📤 Menjalankan disposisi untuk:', selectedRow.nomor_laporan);
          onDisposisi?.(selectedRow); 
          break;
        case 'verifikasi-ppk': onVerifikasiPPK?.(selectedRow); break;
        case 'selesai-perbaikan': onSelesaiPerbaikan?.(selectedRow); break;
        case 'katim-kirim': onKatimKirim?.(selectedRow); break;
        case 'ppk': onPPK?.(selectedRow); break;
        case 'catat-perbaikan': onCatatPerbaikan?.(selectedRow); break;
        case 'konfirmasi-kabag': onKonfirmasiKabag?.(selectedRow); break;
        case 'konfirmasi-user': onKonfirmasiUser?.(selectedRow); break;
        default: break;
      }
    }
  };

  const handleViewPhotos = (photos) => {
    setPreviewPhotos(Array.isArray(photos) ? photos : []);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewPhotos([]);
  };

  const handleChangePage = (event, newPage) => onPageChange(newPage + 1);
  const handleChangeRowsPerPage = (event) => onPageChange(1, parseInt(event.target.value, 10));
  const handleSortClick = (field) => onSort(field);

  const canEdit = (status) => {
    if (isAdmin) return status === STATUS.DIAJUKAN;
    return isPICRuangan && status === STATUS.DIAJUKAN;
  };

  const canDelete = (row) => {
    if (isAdmin) return row?.status === STATUS.DIAJUKAN;
    if (!row) return false;
    const userId = session?.user?.id || session?.user?.sub;
    const isOwner = String(row.pelapor_id) === String(userId);
    return isOwner && row.status === STATUS.DIAJUKAN;
  };

  // Katim mengetahui & mengirim ke PPK
  const canKatimKirim = (status) => {
    if (isAdmin) return status === STATUS.MENUNGGU_KATIM;
    return isKatim && status === STATUS.MENUNGGU_KATIM;
  };

  // PPK mengetahui + kisaran biaya
  const canPPK = (status) => {
    if (isAdmin) return status === STATUS.MENUNGGU_PPK;
    return isPPK && status === STATUS.MENUNGGU_PPK;
  };

  // PIC/Admin mencatat perbaikan selesai
  const canCatatPerbaikan = (status) => {
    if (isAdmin) return status === STATUS.DALAM_PERBAIKAN;
    return isPICRuangan && status === STATUS.DALAM_PERBAIKAN;
  };

  // Kabag TU konfirmasi
  const canKonfirmasiKabag = (status) => {
    if (isAdmin) return status === STATUS.MENUNGGU_KONFIRMASI_KABAG;
    return isKabagTU && status === STATUS.MENUNGGU_KONFIRMASI_KABAG;
  };

  // User (pelapor) konfirmasi akhir
  const canKonfirmasiUser = (row) => {
    if (isAdmin) return row?.status === STATUS.MENUNGGU_KONFIRMASI_USER;
    if (!row) return false;
    const userId = session?.user?.id || session?.user?.sub;
    const isOwner = String(row.pelapor_id) === String(userId);
    return isOwner && row.status === STATUS.MENUNGGU_KONFIRMASI_USER;
  };

  const getStatusConfig = (status) => {
    const configs = {
      'diajukan': { label: 'Diajukan', icon: <ScheduleIcon />, bgColor: '#ed6c02', textColor: '#ffffff' },
      'menunggu_katim': { label: 'Menunggu Katim', icon: <WarningIcon />, bgColor: '#0288d1', textColor: '#ffffff' },
      'menunggu_ppk': { label: 'Menunggu PPK', icon: <AttachMoneyIcon />, bgColor: '#7b1fa2', textColor: '#ffffff' },
      'dalam_perbaikan': { label: 'Dalam Perbaikan', icon: <BuildIcon />, bgColor: '#ed6c02', textColor: '#ffffff' },
      'menunggu_konfirmasi_kabag': { label: 'Menunggu Konfirmasi Kabag TU', icon: <AssignmentIcon />, bgColor: '#1976d2', textColor: '#ffffff' },
      'menunggu_konfirmasi_user': { label: 'Menunggu Konfirmasi User', icon: <PersonIcon />, bgColor: '#9c27b0', textColor: '#ffffff' },
      'selesai': { label: 'Selesai', icon: <DoneAllIcon />, bgColor: '#2e7d32', textColor: '#ffffff' },
      'ditolak': { label: 'Ditolak', icon: <ErrorIcon />, bgColor: '#d32f2f', textColor: '#ffffff' },
    };
    return configs[status] || { label: status || 'Unknown', icon: <AssignmentIcon />, bgColor: '#9e9e9e', textColor: '#ffffff' };
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      rendah: { label: 'Rendah', color: 'success', variant: 'outlined' },
      sedang: { label: 'Sedang', color: 'warning', variant: 'outlined' },
      tinggi: { label: 'Tinggi', color: 'error', variant: 'outlined' },
      darurat: { label: 'Darurat', color: 'error', variant: 'filled' },
    };
    return configs[priority] || { label: priority || 'Unknown', color: 'default', variant: 'outlined' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: id });
    } catch {
      return dateString;
    }
  };

  // Get PIC for room - PRIORITAS dari data row terlebih dahulu
  const getPICForRoom = (row) => {
    // Cek dari data row langsung (paling akurat karena dari backend)
    if (row.pic_ruangan_nama && typeof row.pic_ruangan_nama === 'string') {
      return { user_name: row.pic_ruangan_nama };
    }
    if (row.pic_nama && typeof row.pic_nama === 'string') {
      return { user_name: row.pic_nama };
    }
    if (row.pic_ruangan && typeof row.pic_ruangan === 'string') {
      return { user_name: row.pic_ruangan };
    }
    
    // Fallback ke mapping dari API
    const pic = picDetails[row.ruangan_id];
    if (pic && pic.user_name) {
      return pic;
    }
    
    return null;
  };

  const getThemeColor = (colorName) => {
    if (colorName === 'default') return theme.palette.grey;
    return theme.palette[colorName] || theme.palette.primary;
  };

  const displayData = filteredData;
  const totalFiltered = displayData.length;
  const currentPage = pagination.currentPage || 1;
  const perPage = pagination.perPage || 10;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedData = displayData.slice(startIndex, startIndex + perPage);

  if (loadingPIC) {
    return (
      <Paper sx={{ width: '100%', p: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center">
          <CircularProgress size={40} />
          <Typography sx={{ ml: 2 }}>Memuat data PIC...</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" width={50}>No</TableCell>
                <TableCell width={80}>Foto</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.field === 'nomor_laporan'}
                    direction={sortConfig.field === 'nomor_laporan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSortClick('nomor_laporan')}
                  >
                    No. Laporan
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortConfig.field === 'tgl_laporan'}
                    direction={sortConfig.field === 'tgl_laporan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSortClick('tgl_laporan')}
                  >
                    Tanggal
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Pelapor</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Ruangan</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }} width={200}>PIC Ruangan</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Aset</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Deskripsi</TableCell>
                <TableCell>Prioritas</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" width={100}>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Typography variant="body2" color="textSecondary">Memuat data...</Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Typography variant="body2" color="textSecondary">
                      {isPICRuangan ? 'Tidak ada laporan untuk ruangan yang Anda tangani' : 'Tidak ada data'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => {
                  const statusConfig = getStatusConfig(row.status);
                  const priorityConfig = getPriorityConfig(row.prioritas);
                  const picRuangan = getPICForRoom(row);
                  const priorityColor = getThemeColor(priorityConfig.color);

                  return (
                    <TableRow
                      key={row.id || index}
                      hover
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) } }}
                      onClick={() => onView(row)}
                    >
                      <TableCell padding="checkbox">
                        <Typography variant="body2" color="textSecondary">{startIndex + index + 1}</Typography>
                      </TableCell>
                      <TableCell>
                        <FotoThumbnail photos={row.foto_kerusakan || []} onView={handleViewPhotos} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{row.nomor_laporan || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(row.tgl_laporan)}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontSize: '0.75rem' }}>
                            {row.pelapor_nama?.charAt(0) || 'U'}
                          </Avatar>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{row.pelapor_nama || '-'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <RoomIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                          <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>{row.ruangan_nama || '-'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <PICAvatar pic={picRuangan} size={28} />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">{row.aset_nama || '-'}</Typography>
                          {row.aset_kode && <Typography variant="caption" color="textSecondary">{row.aset_kode}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <Tooltip title={row.deskripsi || ''}>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.deskripsi || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={priorityConfig.label}
                          size="small"
                          variant={priorityConfig.variant}
                          sx={{
                            bgcolor: priorityConfig.variant === 'filled' ? priorityColor.main : alpha(priorityColor.main, 0.1),
                            color: priorityConfig.variant === 'filled' ? '#fff' : priorityColor.main,
                            fontWeight: 600,
                            minWidth: 70,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={statusConfig.icon}
                          label={statusConfig.label}
                          size="small"
                          variant="filled"
                          sx={{
                            bgcolor: statusConfig.bgColor,
                            color: statusConfig.textColor,
                            fontWeight: 600,
                            maxWidth: 180,
                            '& .MuiChip-icon': { 
                              color: statusConfig.textColor,
                              fontSize: '1rem'
                            },
                            '& .MuiChip-label': {
                              px: 1.5
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, row)}>
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalFiltered}
          rowsPerPage={perPage}
          page={currentPage - 1}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Baris per halaman"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
        />

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} onClick={(e) => e.stopPropagation()}>
          <MenuItem onClick={() => handleAction('view')}>
            <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Detail</ListItemText>
          </MenuItem>

          {selectedRow && canVerifikasi(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('verifikasi')}>
              <ListItemIcon><CheckCircleIcon fontSize="small" color={isAdmin ? 'primary' : 'success'} /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Cek Fisik (Admin)' : 'Cek Fisik BMN'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canKatimKirim(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('katim-kirim')}>
              <ListItemIcon><SupervisorAccountIcon fontSize="small" color="warning" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Kirim ke PPK (Admin)' : 'Kirim ke PPK'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canPPK(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('ppk')}>
              <ListItemIcon><AttachMoneyIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Verifikasi PPK (Admin)' : 'Verifikasi PPK'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canCatatPerbaikan(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('catat-perbaikan')}>
              <ListItemIcon><CheckCircleOutlineIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Catat Perbaikan (Admin)' : 'Catat Perbaikan Selesai'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canKonfirmasiKabag(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('konfirmasi-kabag')}>
              <ListItemIcon><AssignmentIcon fontSize="small" color="primary" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Konfirmasi Kabag TU (Admin)' : 'Konfirmasi Perbaikan'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canKonfirmasiUser(selectedRow) && (
            <MenuItem onClick={() => handleAction('konfirmasi-user')}>
              <ListItemIcon><DoneAllIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Konfirmasi User (Admin)' : 'Konfirmasi Selesai'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canEdit(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('edit')}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Edit (Admin)' : 'Edit'}</ListItemText>
            </MenuItem>
          )}

          <Divider />

          {selectedRow && canDelete(selectedRow) && (
            <MenuItem onClick={() => handleAction('delete')} sx={{ color: theme.palette.error.main }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Hapus</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>

      <FotoPreviewDialog open={previewOpen} onClose={handleClosePreview} photos={previewPhotos} title="Foto Kerusakan" />
    </>
  );
};

export default LaporanRusakTable;