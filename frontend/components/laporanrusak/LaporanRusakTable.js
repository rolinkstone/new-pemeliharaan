// components/laporanrusak/LaporanRakTable.js

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
  AvatarGroup,
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
  IconButton as MuiIconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Badge,
  Stack,
  Snackbar,
  Alert,
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
  VerifiedUser as VerifiedUserIcon,
  SupervisorAccount as SupervisorAccountIcon,
  ArrowForward as ArrowForwardIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  AdminPanelSettings as AdminIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useSession } from 'next-auth/react';

// ============================================
// KONSTANTA STATUS - SESUAI DENGAN DATABASE
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
// ROLE CONSTANTS
// ============================================
const ROLES = {
  ADMIN: 'admin',
  PIC_RUANGAN: 'pic_ruangan',
  PIC: 'pic',
  KABAG_TU: 'kabag_tu',
  PPK: 'ppk',
  USER: 'user'
};

// Base URL tanpa /api
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5002';

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
  const theme = useTheme();
  
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '60vh',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {photosArray.length === 0 ? (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center"
            sx={{ py: 8 }}
          >
            <PhotoIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="body1" color="textSecondary">
              Tidak ada foto
            </Typography>
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
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => window.open(imageUrl, '_blank')}
                  />
                  <ImageListItemBar
                    sx={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
                      borderBottomLeftRadius: 8,
                      borderBottomRightRadius: 8,
                    }}
                    position="bottom"
                    title={
                      <Typography variant="caption" sx={{ color: 'white' }}>
                        {photo.name || `Foto ${index + 1}`}
                      </Typography>
                    }
                    actionIcon={
                      <IconButton
                        sx={{ color: 'white' }}
                        onClick={() => handleDownload(photo)}
                        size="small"
                      >
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
  const [loadAttempted, setLoadAttempted] = useState(false);
  
  useEffect(() => {
    setImageError(false);
    setLoadAttempted(false);
  }, [photos]);
  
  const handleClick = (e) => {
    e.stopPropagation();
    onView(photos);
  };
  
  if (!photos || photos.length === 0) {
    return (
      <Box
        sx={{
          width: 50,
          height: 50,
          bgcolor: 'grey.100',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid',
          borderColor: 'grey.200',
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        <PhotoIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  const photosArray = Array.isArray(photos) ? photos : [];
  const firstPhoto = photosArray[0];
  const imageUrl = cleanPhotoUrl(firstPhoto);

  const handleImageError = (e) => {
    if (!loadAttempted) {
      setLoadAttempted(true);
      setImageError(true);
      e.target.onerror = null;
    }
  };

  if (imageError || loadAttempted || !imageUrl) {
    return (
      <Box
        sx={{
          width: 50,
          height: 50,
          bgcolor: 'grey.100',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid',
          borderColor: 'grey.200',
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        <BrokenImageIcon sx={{ fontSize: 24, color: 'grey.400' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{ position: 'relative', width: 50, height: 50 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Box
        component="img"
        src={imageUrl}
        alt="Foto"
        onError={handleImageError}
        onClick={handleClick}
        sx={{
          width: 50,
          height: 50,
          borderRadius: 1,
          objectFit: 'cover',
          cursor: 'pointer',
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      />
      {photosArray.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.625rem',
            fontWeight: 'bold',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          +{photosArray.length - 1}
        </Box>
      )}
      {hover && (
        <Tooltip title={`${photosArray.length} foto`}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1,
            }}
            onClick={handleClick}
          >
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
    return p?.nama || p?.user_id || 'PIC';
  };

  if (!pic || (Array.isArray(pic) && pic.length === 0)) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Avatar
          sx={{
            width: size,
            height: size,
            bgcolor: alpha(theme.palette.grey[500], 0.1),
            color: theme.palette.grey[500],
          }}
        >
          <PersonOutlineIcon sx={{ fontSize: size * 0.6 }} />
        </Avatar>
        <Typography variant="caption" color="textSecondary">
          Tidak ada PIC
        </Typography>
      </Box>
    );
  }

  if (Array.isArray(pic) && pic.length > 1) {
    const names = pic.map(p => getDisplayName(p)).join(', ');
    return (
      <Tooltip title={names}>
        <Box display="flex" alignItems="center" gap={1}>
          <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: size, height: size, fontSize: size * 0.4 } }}>
            {pic.slice(0, 3).map((p, idx) => (
              <Avatar
                key={idx}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                }}
              >
                {getDisplayName(p).charAt(0).toUpperCase()}
              </Avatar>
            ))}
          </AvatarGroup>
          <Typography variant="caption" color="textSecondary">
            {pic.length} PIC
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const singlePic = Array.isArray(pic) ? pic[0] : pic;
  const displayName = getDisplayName(singlePic);
  const initial = displayName.charAt(0).toUpperCase();
  
  return (
    <Tooltip title={displayName}>
      <Box display="flex" alignItems="center" gap={1}>
        <Avatar
          sx={{
            width: size,
            height: size,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
            fontSize: size * 0.5,
            fontWeight: 600,
          }}
        >
          {initial}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 120 }}>
            {displayName}
          </Typography>
          {singlePic.jabatan && (
            <Typography variant="caption" color="textSecondary" display="block">
              {singlePic.jabatan}
            </Typography>
          )}
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

  // Dapatkan role user dari session
  const userRole = session?.user?.role || session?.user?.roles?.[0] || 'user';
  const isAdmin = userRole === ROLES.ADMIN;
  const isPICRuangan = [ROLES.PIC_RUANGAN, ROLES.PIC].includes(userRole);
  const isKabagTU = userRole === ROLES.KABAG_TU;
  const isPPK = userRole === ROLES.PPK;

  useEffect(() => {
    const newPicDetails = {};
    data.forEach(row => {
      if (row.ruangan_id) {
        if (row.pic_ruangan) {
          newPicDetails[row.ruangan_id] = row.pic_ruangan;
        } else if (picData[row.ruangan_id]) {
          newPicDetails[row.ruangan_id] = picData[row.ruangan_id];
        }
      }
    });
    setPicDetails(newPicDetails);
  }, [data, picData]);

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
        case 'view':
          if (onView) onView(selectedRow);
          break;
        case 'edit':
          if (onEdit) onEdit(selectedRow);
          break;
        case 'delete':
          if (onDelete) onDelete(selectedRow);
          break;
        case 'verifikasi':
          if (onVerifikasi) onVerifikasi(selectedRow);
          break;
        case 'disposisi':
          if (onDisposisi) onDisposisi(selectedRow);
          break;
        case 'verifikasi-ppk':
          if (onVerifikasiPPK) onVerifikasiPPK(selectedRow);
          break;
        case 'selesai-perbaikan':
          if (onSelesaiPerbaikan) {
            onSelesaiPerbaikan(selectedRow);
          } else {
            console.warn('⚠️ Fungsi onSelesaiPerbaikan tidak tersedia');
            setSnackbar({
              open: true,
              message: 'Fitur selesaikan perbaikan belum tersedia',
              severity: 'warning'
            });
          }
          break;
        default:
          break;
      }
    }
  };

  const handleViewPhotos = (photos) => {
    const photosArray = Array.isArray(photos) ? photos : [];
    setPreviewPhotos(photosArray);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewPhotos([]);
  };

  const handleChangePage = (event, newPage) => {
    onPageChange(newPage + 1);
  };

  const handleChangeRowsPerPage = (event) => {
    onPageChange(1, parseInt(event.target.value, 10));
  };

  const handleSortClick = (field) => {
    onSort(field);
  };

  // Cek apakah user adalah PIC dari ruangan tertentu
  const isPICOfThisRoom = (ruanganId) => {
    if (!ruanganId || !session?.user?.id) return false;
    const pic = picDetails[ruanganId];
    if (!pic) return false;
    
    const picUserId = pic.user_id || pic.id || pic.pic_id;
    return picUserId === session.user.id || picUserId === session.user.sub;
  };

  // Konfigurasi status - PERBAIKAN: Pastikan 'diteruskan' muncul dengan label yang benar
  const getStatusConfig = (status) => {
    const configs = {
      'draft': { label: 'Draft', color: 'default', icon: <ScheduleIcon /> },
      'menunggu_verifikasi_pic': { label: 'Menunggu Verifikasi PIC', color: 'warning', icon: <WarningIcon /> },
      'menunggu_verifikasi_ppk': { label: 'Menunggu Verifikasi PPK', color: 'warning', icon: <WarningIcon /> },
      'diverifikasi_pic': { label: 'Diverifikasi PIC', color: 'info', icon: <CheckCircleIcon /> },
      'diverifikasi_ppk': { label: 'Diverifikasi PPK', color: 'info', icon: <CheckCircleIcon /> },
      'menunggu_disposisi': { label: 'Menunggu Disposisi', color: 'secondary', icon: <AssignmentIcon /> },
      'diteruskan': { label: 'Diteruskan ke Kabag TU', color: 'warning', icon: <ArrowForwardIcon /> }, // PERBAIKAN: Label yang jelas
      'didisposisi': { label: 'Didisposisi ke PPK', color: 'primary', icon: <PersonIcon /> },
      'dalam_perbaikan': { label: 'Dalam Perbaikan', color: 'warning', icon: <BuildIcon /> },
      'selesai': { label: 'Selesai', color: 'success', icon: <DoneAllIcon /> },
      'ditolak': { label: 'Ditolak', color: 'error', icon: <ErrorIcon /> },
    };
    return configs[status] || { label: status || 'Unknown', color: 'default', icon: <AssignmentIcon /> };
  };

  // Konfigurasi prioritas
  const getPriorityConfig = (priority) => {
    const configs = {
      rendah: { label: 'Rendah', color: 'success', variant: 'outlined' },
      sedang: { label: 'Sedang', color: 'warning', variant: 'outlined' },
      tinggi: { label: 'Tinggi', color: 'error', variant: 'outlined' },
      darurat: { label: 'Darurat', color: 'error', variant: 'filled' },
    };
    return configs[priority] || { label: priority || 'Unknown', color: 'default', variant: 'outlined' };
  };

  // Cek apakah bisa diedit
  const canEdit = (status) => {
    if (isAdmin) return true;
    return [STATUS.DRAFT, STATUS.MENUNGGU_VERIFIKASI_PIC].includes(status);
  };

  // Cek apakah bisa dihapus
  const canDelete = () => {
    return isAdmin;
  };

  // Cek apakah bisa diverifikasi (PIC)
  const canVerifikasi = (status) => {
    if (isAdmin) return true;
    return isPICRuangan && status === STATUS.MENUNGGU_VERIFIKASI_PIC;
  };

  // Cek apakah bisa disposisi (Kabag TU)
  const canDisposisi = (status) => {
    if (isAdmin) return true;
    return isKabagTU && status === STATUS.DITERUSKAN; // PERBAIKAN: Kabag TU melihat status 'diteruskan'
  };

  // Cek apakah bisa verifikasi PPK
  const canVerifikasiPPK = (status) => {
    if (isAdmin) return true;
    return isPPK && status === STATUS.MENUNGGU_VERIFIKASI_PPK;
  };

  // Cek apakah bisa selesaikan perbaikan (setelah verifikasi PPK)
  const canSelesaikanPerbaikan = (status, ruanganId) => {
    if (isAdmin) return status === STATUS.DALAM_PERBAIKAN;
    return status === STATUS.DALAM_PERBAIKAN && isPICOfThisRoom(ruanganId);
  };

  // Format tanggal
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: id });
    } catch {
      return dateString;
    }
  };

  // Get PIC for room
  const getPICForRoom = (ruanganId) => {
    if (!ruanganId) return null;
    return picDetails[ruanganId] || null;
  };

  // Safe color getter
  const getThemeColor = (colorName) => {
    if (colorName === 'default') {
      return theme.palette.grey;
    }
    return theme.palette[colorName] || theme.palette.primary;
  };

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
                  <TableCell colSpan={12} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="textSecondary">
                      Memuat data...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="textSecondary">
                      Tidak ada data
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => {
                  const statusConfig = getStatusConfig(row.status);
                  const priorityConfig = getPriorityConfig(row.prioritas);
                  const picRuangan = getPICForRoom(row.ruangan_id);
                  
                  const statusColor = getThemeColor(statusConfig.color);
                  const priorityColor = getThemeColor(priorityConfig.color);

                  return (
                    <TableRow
                      key={row.id || index}
                      hover
                      sx={{
                        '&:last-child td, &:last-child th': { border: 0 },
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                      onClick={() => onView(row)}
                    >
                      <TableCell padding="checkbox">
                        <Typography variant="body2" color="textSecondary">
                          {((pagination.currentPage - 1) * pagination.perPage) + index + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FotoThumbnail 
                          photos={row.foto_kerusakan || []} 
                          onView={handleViewPhotos}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {row.nomor_laporan || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(row.tgl_laporan)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontSize: '0.75rem',
                            }}
                          >
                            {row.pelapor_nama?.charAt(0) || 'U'}
                          </Avatar>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                            {row.pelapor_nama || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <RoomIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                          <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>
                            {row.ruangan_nama || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <PICAvatar pic={picRuangan} size={28} />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {row.aset_nama || '-'}
                          </Typography>
                          {row.aset_kode && (
                            <Typography variant="caption" color="textSecondary">
                              {row.aset_kode}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={row.deskripsi || ''}>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
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
                            bgcolor: priorityConfig.variant === 'filled' 
                              ? priorityColor.main 
                              : alpha(priorityColor.main, 0.1),
                            color: priorityConfig.variant === 'filled' 
                              ? '#fff' 
                              : priorityColor.main,
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
                          sx={{
                            bgcolor: alpha(statusColor.main, 0.1),
                            color: statusColor.main,
                            fontWeight: 600,
                            maxWidth: 150,
                            '& .MuiChip-icon': {
                              color: 'inherit',
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, row)}
                        >
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
          count={pagination.total || 0}
          rowsPerPage={pagination.perPage || 10}
          page={pagination.currentPage ? pagination.currentPage - 1 : 0}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Baris per halaman"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`}
        />

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={() => handleAction('view')}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Detail</ListItemText>
          </MenuItem>

          {/* Verifikasi untuk PIC - Muncul untuk Admin atau PIC yang berwenang */}
          {selectedRow && canVerifikasi(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('verifikasi')}>
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Verifikasi (Admin)' : 'Verifikasi'}
              </ListItemText>
            </MenuItem>
          )}

          {/* Disposisi untuk Kabag TU - Muncul untuk Admin atau Kabag TU */}
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

          {/* Verifikasi PPK - Muncul untuk Admin atau PPK */}
          {selectedRow && canVerifikasiPPK(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('verifikasi-ppk')}>
              <ListItemIcon>
                <AttachMoneyIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Verifikasi PPK (Admin)' : 'Verifikasi PPK'}
              </ListItemText>
            </MenuItem>
          )}

          {/* Selesaikan Perbaikan untuk PIC Ruangan - Setelah verifikasi PPK */}
          {selectedRow && canSelesaikanPerbaikan(selectedRow.status, selectedRow.ruangan_id) && (
            <MenuItem 
              onClick={() => handleAction('selesai-perbaikan')}
              disabled={!onSelesaiPerbaikan}
            >
              <ListItemIcon>
                <CheckCircleOutlineIcon 
                  fontSize="small" 
                  color={onSelesaiPerbaikan ? 'success' : 'disabled'} 
                />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Selesaikan Perbaikan (Admin)' : 'Selesaikan Perbaikan'}
                {!onSelesaiPerbaikan && (
                  <Typography variant="caption" display="block" color="text.disabled">
                    (Fitur tidak tersedia)
                  </Typography>
                )}
              </ListItemText>
            </MenuItem>
          )}

          {/* Edit - Admin bisa edit semua, user biasa hanya bisa edit status tertentu */}
          {selectedRow && canEdit(selectedRow.status) && (
            <MenuItem onClick={() => handleAction('edit')}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Edit (Admin)' : 'Edit'}
              </ListItemText>
            </MenuItem>
          )}

          <Divider />

          {/* Delete - Hanya Admin yang bisa hapus */}
          {selectedRow && canDelete() && (
            <MenuItem onClick={() => handleAction('delete')} sx={{ color: theme.palette.error.main }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>
                {isAdmin ? 'Hapus (Admin)' : 'Hapus'}
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
      </Paper>

      {/* Snackbar untuk notifikasi */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>

      <FotoPreviewDialog
        open={previewOpen}
        onClose={handleClosePreview}
        photos={previewPhotos}
        title="Foto Kerusakan"
      />
    </>
  );
};

export default LaporanRusakTable;