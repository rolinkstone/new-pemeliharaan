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

// Base URL - Mengambil dari environment variable
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'https://api-tabela.bbpompky.id';

// Placeholder image (base64 SVG)
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFMEUwRTAiLz48cGF0aCBkPSJNMzUgMzBMNjUgNTBMMzUgNzBWMzBaIiBmaWxsPSIjOUU5RTlFIi8+PC9zdmc+';

// ============================================
// FUNGSI MEMBERSIHKAN URL FOTO (DIPERBAIKI)
// ============================================
const cleanPhotoUrl = (photo) => {
  if (!photo) return null;
  
  if (typeof photo === 'string') {
    let cleanUrl = photo;
    
    // Hapus prefix yang salah jika ada
    if (cleanUrl.includes('/-tabela.bbpompky.id')) {
      cleanUrl = cleanUrl.replace('/-tabela.bbpompky.id', '');
    }
    
    // Ganti /api/uploads/ menjadi /uploads/
    cleanUrl = cleanUrl.replace('/api/uploads/', '/uploads/');
    
    // Jika sudah URL lengkap dengan http/https
    if (cleanUrl.startsWith('http')) {
      return cleanUrl;
    }
    
    // Jika dimulai dengan /uploads/ (path relatif)
    if (cleanUrl.startsWith('/uploads/')) {
      return `${BASE_URL}${cleanUrl}`;
    }
    
    // Jika dimulai dengan /uploads (tanpa slash)
    if (cleanUrl.startsWith('/uploads')) {
      return `${BASE_URL}${cleanUrl}`;
    }
    
    // Jika dimulai dengan / (path root)
    if (cleanUrl.startsWith('/')) {
      return `${BASE_URL}/uploads${cleanUrl}`;
    }
    
    // Jika hanya nama file (tanpa path)
    return `${BASE_URL}/uploads/${cleanUrl}`;
  }
  
  // Jika photo adalah object dengan property url
  if (photo.url) {
    return cleanPhotoUrl(photo.url);
  }
  
  // Jika photo adalah object dengan property preview (local file)
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
// KOMPONEN THUMBNAIL FOTO (DIPERBAIKI)
// ============================================
const FotoThumbnail = ({ photos = [], onView }) => {
  const [hover, setHover] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  
  useEffect(() => {
    setImageError(false);
    
    if (photos && photos.length > 0) {
      const firstPhoto = photos[0];
      const url = cleanPhotoUrl(firstPhoto);
      setImageUrl(url);
      console.log('📷 FotoThumbnail - URL:', url);
    } else {
      setImageUrl(null);
    }
  }, [photos]);
  
  const handleClick = (e) => {
    e.stopPropagation();
    onView(photos);
  };
  
  const handleImageError = () => {
    console.log('❌ Gagal memuat gambar:', imageUrl);
    setImageError(true);
  };
  
  if (!photos || photos.length === 0) {
    return (
      <Box sx={{ width: 50, height: 50, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'grey.200', cursor: 'pointer' }} onClick={handleClick}>
        <PhotoIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  if (imageError || !imageUrl) {
    return (
      <Box sx={{ width: 50, height: 50, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderColor: 'grey.200', cursor: 'pointer' }} onClick={handleClick}>
        <BrokenImageIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  const photosArray = Array.isArray(photos) ? photos : [];

  return (
    <Box sx={{ position: 'relative', width: 50, height: 50 }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Box 
        component="img" 
        src={imageUrl} 
        alt="Foto" 
        onError={handleImageError}
        onClick={handleClick} 
        sx={{ width: 50, height: 50, borderRadius: 1, objectFit: 'cover', cursor: 'pointer', border: '1px solid', borderColor: 'grey.200' }} 
      />
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

  // Debug BASE_URL
  console.log('📍 BASE_URL:', BASE_URL);
  console.log('📍 NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

  // ========== DAPATKAN ROLE USER DARI SESSION ==========
  const realmRoles = session?.user?.realm_access?.roles || [];
  
  const isAdmin = realmRoles.includes('admin') || realmRoles.includes('superadmin');
  const isPICRuangan = realmRoles.includes('pic_ruangan') || realmRoles.includes('pic');
  const isKabagTU = realmRoles.includes('kabag_tu');
  const isPPK = realmRoles.includes('ppk');
  const isBendahara = realmRoles.includes('bendahara');
  const isKabalai = realmRoles.includes('kabalai');
  
  console.log('========== USER INFO ==========');
  console.log('Realm Roles:', realmRoles);
  console.log('isKabagTU:', isKabagTU);
  console.log('isPICRuangan:', isPICRuangan);
  console.log('================================');

  // ========== AMBIL DATA PIC DARI API ==========
  useEffect(() => {
    const fetchPicData = async () => {
      if (!session?.accessToken) return;
      
      setLoadingPIC(true);
      
      const endpoints = [
        `${BASE_URL}/api/picruangan`,
        `${BASE_URL}/api/pic_ruangan`,
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
            let picData = result.data || result;
            if (Array.isArray(picData)) {
              pics = picData;
              break;
            }
          }
        } catch (error) {
          console.log(`❌ Error dengan ${url}:`, error.message);
        }
      }
      
      if (pics.length > 0) {
        const picMapping = {};
        pics.forEach(pic => {
          const ruanganId = pic.ruangan_id;
          if (ruanganId) {
            picMapping[ruanganId] = {
              user_name: pic.user_name,
              user_id: pic.user_id,
            };
          }
        });
        setPicDetails(picMapping);
        console.log('📋 Mapping PIC:', picMapping);
      }
      
      setLoadingPIC(false);
    };
    
    fetchPicData();
  }, [session]);

  // ========== FUNGSI CAN VERIFIKASI ==========
  const canVerifikasi = (status) => {
    if (isPICRuangan && status === STATUS.MENUNGGU_VERIFIKASI_PIC) {
      return true;
    }
    if (isAdmin) {
      return true;
    }
    return false;
  };

  // Filter data berdasarkan user yang login
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    if (isAdmin) {
      setFilteredData(data);
      return;
    }

    if (isPICRuangan) {
      const userPicRooms = [];
      
      Object.entries(picDetails).forEach(([ruanganId, pic]) => {
        if (pic.user_id === session?.user?.id) {
          userPicRooms.push(parseInt(ruanganId));
        }
      });
      
      const filtered = data.filter(item => userPicRooms.includes(item.ruangan_id));
      setFilteredData(filtered);
      return;
    }

    setFilteredData(data);
  }, [data, isAdmin, isPICRuangan, picDetails, session]);

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
        case 'disposisi': onDisposisi?.(selectedRow); break;
        case 'verifikasi-ppk': onVerifikasiPPK?.(selectedRow); break;
        case 'selesai-perbaikan':
          if (onSelesaiPerbaikan) {
            onSelesaiPerbaikan(selectedRow);
          } else {
            setSnackbar({ open: true, message: 'Fitur selesaikan perbaikan belum tersedia', severity: 'warning' });
          }
          break;
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
    if (isAdmin) return true;
    return isPICRuangan && [STATUS.DRAFT, STATUS.MENUNGGU_VERIFIKASI_PIC].includes(status);
  };

  const canDelete = () => isAdmin;

  const canDisposisi = (status) => {
    if (isKabagTU && status === STATUS.MENUNGGU_DISPOSISI) {
      return true;
    }
    if (isAdmin) {
      return true;
    }
    return false;
  };

  const canVerifikasiPPK = (status) => {
    if (isAdmin) return true;
    return isPPK && status === STATUS.MENUNGGU_VERIFIKASI_PPK;
  };

  const canSelesaikanPerbaikan = (status) => {
    if (isAdmin) return status === STATUS.DALAM_PERBAIKAN;
    return isPICRuangan && status === STATUS.DALAM_PERBAIKAN;
  };

  const getStatusConfig = (status) => {
    const configs = {
      'draft': { label: 'Draft', icon: <ScheduleIcon />, bgColor: '#9e9e9e', textColor: '#ffffff' },
      'menunggu_verifikasi_pic': { label: 'Menunggu Verifikasi PIC', icon: <WarningIcon />, bgColor: '#ed6c02', textColor: '#ffffff' },
      'menunggu_verifikasi_ppk': { label: 'Menunggu Verifikasi PPK', icon: <AttachMoneyIcon />, bgColor: '#0288d1', textColor: '#ffffff' },
      'diverifikasi_pic': { label: 'Diverifikasi PIC', icon: <CheckCircleIcon />, bgColor: '#2e7d32', textColor: '#ffffff' },
      'diverifikasi_ppk': { label: 'Diverifikasi PPK', icon: <CheckCircleIcon />, bgColor: '#2e7d32', textColor: '#ffffff' },
      'menunggu_disposisi': { label: 'Menunggu Disposisi', icon: <AssignmentIcon />, bgColor: '#9c27b0', textColor: '#ffffff' },
      'diteruskan': { label: 'Diteruskan ke Kabag TU', icon: <ArrowForwardIcon />, bgColor: '#ed6c02', textColor: '#ffffff' },
      'didisposisi': { label: 'Didisposisi ke PPK', icon: <PersonIcon />, bgColor: '#1976d2', textColor: '#ffffff' },
      'dalam_perbaikan': { label: 'Dalam Perbaikan', icon: <BuildIcon />, bgColor: '#ed6c02', textColor: '#ffffff' },
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

  // Get PIC for room
  const getPICForRoom = (row) => {
    if (row.pic_ruangan_nama && typeof row.pic_ruangan_nama === 'string') {
      return { user_name: row.pic_ruangan_nama };
    }
    if (row.pic_nama && typeof row.pic_nama === 'string') {
      return { user_name: row.pic_nama };
    }
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
                    Nomor Laporan
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
                <TableCell>Pelapor</TableCell>
                <TableCell>Ruangan</TableCell>
                <TableCell width={200}>PIC Ruangan</TableCell>
                <TableCell>Aset</TableCell>
                <TableCell>Deskripsi</TableCell>
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
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, fontSize: '0.75rem' }}>
                            {row.pelapor_nama?.charAt(0) || 'U'}
                          </Avatar>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{row.pelapor_nama || '-'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <RoomIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                          <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>{row.ruangan_nama || '-'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <PICAvatar pic={picRuangan} size={28} />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">{row.aset_nama || '-'}</Typography>
                          {row.aset_kode && <Typography variant="caption" color="textSecondary">{row.aset_kode}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>
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
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" color={isAdmin ? "primary" : "success"} />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Verifikasi (Admin)' : 'Verifikasi Laporan'}
              </ListItemText>
            </MenuItem>
          )}

          {selectedRow && canDisposisi(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('disposisi')}>
              <ListItemIcon>
                <SupervisorAccountIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Disposisi (Admin)' : 'Disposisi ke PPK'}
              </ListItemText>
            </MenuItem>
          )}

          {selectedRow && canEdit(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('edit')}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Edit (Admin)' : 'Edit'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canVerifikasiPPK(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('verifikasi-ppk')}>
              <ListItemIcon><AttachMoneyIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Verifikasi PPK (Admin)' : 'Verifikasi PPK'}</ListItemText>
            </MenuItem>
          )}

          {selectedRow && canSelesaikanPerbaikan(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('selesai-perbaikan')} disabled={!onSelesaiPerbaikan}>
              <ListItemIcon><CheckCircleOutlineIcon fontSize="small" color={onSelesaiPerbaikan ? 'success' : 'disabled'} /></ListItemIcon>
              <ListItemText>{isAdmin ? 'Selesaikan Perbaikan (Admin)' : 'Selesaikan Perbaikan'}</ListItemText>
            </MenuItem>
          )}

          <Divider />

          {selectedRow && canDelete() && (
            <MenuItem onClick={() => handleAction('delete')} sx={{ color: theme.palette.error.main }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Hapus (Admin)</ListItemText>
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