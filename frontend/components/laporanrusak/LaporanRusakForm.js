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
  Tooltip,
  Autocomplete,
  Button,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  useTheme,
  alpha,
  Badge,
  Fade,
  Zoom,
  Grow,
  Slide,
  Container,
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
  Search as SearchIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Build as BuildIcon,
  DoneAll as DoneAllIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  AddPhotoAlternate as AddPhotoIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Room as RoomIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  Flag as FlagIcon,
  PhotoCamera as PhotoCameraIcon,
  Clear as ClearIcon,
  Check as CheckIcon,
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
// KONSTANTA STATUS - SESUAI DENGAN DATABASE
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

// Status yang valid untuk ditampilkan di Select (tanpa DRAFT)
const VALID_STATUS_OPTIONS = [
  { value: STATUS.MENUNGGU_VERIFIKASI_PIC, label: 'Menunggu Verifikasi PIC' },
  { value: STATUS.MENUNGGU_VERIFIKASI_PPK, label: 'Menunggu Verifikasi PPK' },
  { value: STATUS.DIVERIFIKASI_PIC, label: 'Diverifikasi PIC' },
  { value: STATUS.DIVERIFIKASI_PPK, label: 'Diverifikasi PPK' },
  { value: STATUS.MENUNGGU_DISPOSISI, label: 'Menunggu Disposisi' },
  { value: STATUS.DIDISPOSISI, label: 'Didisposisi' },
  { value: STATUS.DALAM_PERBAIKAN, label: 'Dalam Perbaikan' },
  { value: STATUS.SELESAI, label: 'Selesai' },
  { value: STATUS.DITOLAK, label: 'Ditolak' },
];

// ============================================
// STATUS BADGE COMPONENT - TIDAK PERNAH "UNKNOWN"
// ============================================
const StatusBadge = React.memo(({ status, size = 'small' }) => {
  const theme = useTheme();
  
  // Pastikan status tidak undefined/null dan selalu string
  // Jika status tidak valid, default ke MENUNGGU_VERIFIKASI_PIC
  const safeStatus = status && Object.values(STATUS).includes(status) 
    ? status 
    : STATUS.MENUNGGU_VERIFIKASI_PIC;
  
  const getStatusConfig = () => {
    switch (safeStatus) {
      case STATUS.SELESAI:
        return {
          color: theme.palette.success.main,
          bgColor: alpha(theme.palette.success.main, 0.15),
          lightBgColor: alpha(theme.palette.success.main, 0.05),
          icon: <DoneAllIcon fontSize="small" />,
          label: 'Selesai',
        };
      case STATUS.DALAM_PERBAIKAN:
        return {
          color: theme.palette.info.main,
          bgColor: alpha(theme.palette.info.main, 0.15),
          lightBgColor: alpha(theme.palette.info.main, 0.05),
          icon: <BuildIcon fontSize="small" />,
          label: 'Dalam Perbaikan',
        };
      case STATUS.DITOLAK:
        return {
          color: theme.palette.error.main,
          bgColor: alpha(theme.palette.error.main, 0.15),
          lightBgColor: alpha(theme.palette.error.main, 0.05),
          icon: <ErrorIcon fontSize="small" />,
          label: 'Ditolak',
        };
      case STATUS.DRAFT:
        return {
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[600], 0.15),
          lightBgColor: alpha(theme.palette.grey[600], 0.05),
          icon: <AssignmentIcon fontSize="small" />,
          label: 'Draft',
        };
      case STATUS.MENUNGGU_VERIFIKASI_PIC:
        return {
          color: theme.palette.warning.main,
          bgColor: alpha(theme.palette.warning.main, 0.15),
          lightBgColor: alpha(theme.palette.warning.main, 0.05),
          icon: <WarningIcon fontSize="small" />,
          label: 'Menunggu Verifikasi PIC',
        };
      case STATUS.MENUNGGU_VERIFIKASI_PPK:
        return {
          color: theme.palette.warning.dark,
          bgColor: alpha(theme.palette.warning.dark, 0.15),
          lightBgColor: alpha(theme.palette.warning.dark, 0.05),
          icon: <WarningIcon fontSize="small" />,
          label: 'Menunggu Verifikasi PPK',
        };
      case STATUS.MENUNGGU_DISPOSISI:
        return {
          color: theme.palette.info.dark,
          bgColor: alpha(theme.palette.info.dark, 0.15),
          lightBgColor: alpha(theme.palette.info.dark, 0.05),
          icon: <AccessTimeIcon fontSize="small" />,
          label: 'Menunggu Disposisi',
        };
      case STATUS.DIVERIFIKASI_PIC:
        return {
          color: theme.palette.success.light,
          bgColor: alpha(theme.palette.success.light, 0.15),
          lightBgColor: alpha(theme.palette.success.light, 0.05),
          icon: <CheckCircleIcon fontSize="small" />,
          label: 'Diverifikasi PIC',
        };
      case STATUS.DIVERIFIKASI_PPK:
        return {
          color: theme.palette.success.main,
          bgColor: alpha(theme.palette.success.main, 0.15),
          lightBgColor: alpha(theme.palette.success.main, 0.05),
          icon: <CheckCircleIcon fontSize="small" />,
          label: 'Diverifikasi PPK',
        };
      case STATUS.DIDISPOSISI:
        return {
          color: theme.palette.secondary.main,
          bgColor: alpha(theme.palette.secondary.main, 0.15),
          lightBgColor: alpha(theme.palette.secondary.main, 0.05),
          icon: <AssignmentIcon fontSize="small" />,
          label: 'Didisposisi',
        };
      default:
        // TIDAK PERNAH MENAMPILKAN "UNKNOWN"
        // Selalu default ke Menunggu Verifikasi PIC
        console.log('⚠️ Status tidak dikenal:', status, 'menggunakan default');
        return {
          color: theme.palette.warning.main,
          bgColor: alpha(theme.palette.warning.main, 0.15),
          lightBgColor: alpha(theme.palette.warning.main, 0.05),
          icon: <WarningIcon fontSize="small" />,
          label: 'Menunggu Verifikasi PIC',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size={size}
      sx={{
        background: config.bgColor,
        backdropFilter: 'blur(4px)',
        color: config.color,
        fontWeight: 600,
        border: `1px solid ${alpha(config.color, 0.3)}`,
        boxShadow: `0 2px 8px ${alpha(config.color, 0.2)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(config.color, 0.3)}`,
          background: config.lightBgColor,
        },
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
});

StatusBadge.displayName = 'StatusBadge';

// Section header component yang lebih elegan dengan efek glassmorphism
const SectionHeader = React.memo(({ title, icon, subtitle, action }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ mb: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              width: 48,
              height: 48,
              borderRadius: 3,
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography 
              variant="h6" 
              fontWeight="700" 
              color="text.primary"
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.text.secondary} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoIcon fontSize="small" sx={{ opacity: 0.7 }} />
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {action && (
          <Grow in={true} timeout={500}>
            <Box>{action}</Box>
          </Grow>
        )}
      </Box>
      <Divider sx={{ mt: 2, borderColor: alpha(theme.palette.primary.main, 0.2) }} />
    </Box>
  );
});

SectionHeader.displayName = 'SectionHeader';

// Info Card component yang lebih menarik dengan efek hover
const InfoCard = ({ title, value, icon, color = 'primary', subtitle }) => {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.05)} 0%, ${alpha(theme.palette[color].main, 0.1)} 100%)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        borderRadius: 3,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette[color].main, 0.2)}`,
          borderColor: alpha(theme.palette[color].main, 0.4),
        }
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
              color: 'white',
              width: 48,
              height: 48,
              borderRadius: 2,
              boxShadow: `0 4px 12px ${alpha(theme.palette[color].main, 0.3)}`,
            }}
          >
            {icon}
          </Avatar>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" fontWeight="500">
              {title}
            </Typography>
            <Typography variant="body1" fontWeight="700" color={theme.palette[color].main}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Priority Chip component dengan efek yang lebih menarik
const PriorityChip = ({ priority }) => {
  const theme = useTheme();
  
  const getPriorityConfig = () => {
    switch (priority) {
      case 'darurat':
        return {
          color: theme.palette.error.main,
          bgColor: alpha(theme.palette.error.main, 0.15),
          icon: <PriorityIcon fontSize="small" />,
          label: 'Darurat',
        };
      case 'tinggi':
        return {
          color: theme.palette.warning.main,
          bgColor: alpha(theme.palette.warning.main, 0.15),
          icon: <PriorityIcon fontSize="small" />,
          label: 'Tinggi',
        };
      case 'sedang':
        return {
          color: theme.palette.info.main,
          bgColor: alpha(theme.palette.info.main, 0.15),
          icon: <PriorityIcon fontSize="small" />,
          label: 'Sedang',
        };
      case 'rendah':
        return {
          color: theme.palette.success.main,
          bgColor: alpha(theme.palette.success.main, 0.15),
          icon: <PriorityIcon fontSize="small" />,
          label: 'Rendah',
        };
      default:
        return {
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[600], 0.15),
          icon: <PriorityIcon fontSize="small" />,
          label: priority || 'Sedang',
        };
    }
  };

  const config = getPriorityConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      sx={{
        background: config.bgColor,
        backdropFilter: 'blur(4px)',
        color: config.color,
        fontWeight: 700,
        border: `1px solid ${alpha(config.color, 0.3)}`,
        boxShadow: `0 2px 8px ${alpha(config.color, 0.2)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: `0 4px 12px ${alpha(config.color, 0.3)}`,
        },
        '& .MuiChip-icon': {
          color: config.color,
        },
      }}
    />
  );
};

// Komponen untuk upload foto yang lebih baik dengan preview grid yang menarik
const FotoUploader = ({ photos = [], onPhotosChange, readOnly = false }) => {
  const fileInputRef = useRef(null);
  const theme = useTheme();

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    // Validasi tipe file
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024 // max 5MB
    );

    if (validFiles.length !== files.length) {
      alert('Hanya file gambar (max 5MB) yang diperbolehkan');
    }

    // Konversi ke base64 untuk preview
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        onPhotosChange([
          ...photos,
          {
            file: file,
            preview: e.target.result,
            name: file.name,
            size: file.size,
            type: file.type
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const handleViewPhoto = (photo) => {
    if (photo.preview) {
      window.open(photo.preview, '_blank');
    } else if (photo.url) {
      window.open(photo.url, '_blank');
    }
  };

  if (readOnly && photos.length === 0) {
    return (
      <Fade in={true}>
        <Box
          sx={{
            mt: 2,
            p: 6,
            background: `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.05)} 0%, ${alpha(theme.palette.grey[500], 0.1)} 100%)`,
            borderRadius: 3,
            border: `2px dashed ${alpha(theme.palette.grey[400], 0.3)}`,
            textAlign: 'center',
            transition: 'all 0.3s ease-in-out',
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 64, color: alpha(theme.palette.grey[400], 0.5), mb: 2 }} />
          <Typography variant="body1" color="textSecondary" fontWeight="500">
            Tidak ada foto kerusakan
          </Typography>
        </Box>
      </Fade>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Tombol Upload dengan desain yang lebih menarik */}
      {!readOnly && (
        <Zoom in={true} timeout={500}>
          <Box sx={{ mb: 3 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly}
              fullWidth
              sx={{
                py: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: `2px dashed ${theme.palette.primary.main}`,
                borderRadius: 3,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  background: alpha(theme.palette.primary.main, 0.1),
                  border: `2px dashed ${theme.palette.primary.dark}`,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                },
                '& .MuiButton-startIcon': {
                  transition: 'transform 0.3s ease-in-out',
                },
                '&:hover .MuiButton-startIcon': {
                  transform: 'scale(1.1)',
                }
              }}
            >
              <Typography variant="subtitle1" fontWeight="600">
                Upload Foto Kerusakan
              </Typography>
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', textAlign: 'center' }}>
              Format: JPG, PNG, GIF (max 5MB per file)
            </Typography>
          </Box>
        </Zoom>
      )}

      {/* Grid Foto dengan efek masonry yang menarik */}
      {photos.length > 0 && (
        <Fade in={true}>
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                Dokumentasi Kerusakan
              </Typography>
              <Badge badgeContent={photos.length} color="primary" sx={{ '& .MuiBadge-badge': { fontWeight: 600 } }}>
                <PhotoCameraIcon color="action" />
              </Badge>
            </Box>
            <ImageList 
              cols={{ xs: 2, sm: 3, md: 4 }} 
              gap={16} 
              sx={{ 
                mt: 0,
                mb: 0,
                overflow: 'visible',
              }}
            >
              {photos.map((photo, index) => (
                <ImageListItem
                  key={index}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: theme.shadows[4],
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px) scale(1.02)',
                      boxShadow: theme.shadows[12],
                      '& .image-overlay': {
                        opacity: 1,
                      }
                    }
                  }}
                >
                  <img
                    src={photo.preview || photo.url || '/placeholder-image.jpg'}
                    alt={`Foto kerusakan ${index + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      cursor: 'pointer',
                      transition: 'transform 0.3s ease-in-out',
                    }}
                    onClick={() => handleViewPhoto(photo)}
                  />
                  <Box
                    className="image-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease-in-out',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-end',
                      p: 1,
                    }}
                  >
                    {!readOnly ? (
                      <IconButton
                        sx={{ 
                          color: 'white',
                          backgroundColor: alpha(theme.palette.error.main, 0.8),
                          backdropFilter: 'blur(4px)',
                          '&:hover': {
                            backgroundColor: theme.palette.error.main,
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(index);
                        }}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton
                        sx={{ 
                          color: 'white',
                          backgroundColor: alpha(theme.palette.primary.main, 0.8),
                          backdropFilter: 'blur(4px)',
                          '&:hover': {
                            backgroundColor: theme.palette.primary.main,
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPhoto(photo);
                        }}
                        size="small"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        </Fade>
      )}
    </Box>
  );
};

// Komponen Form Field dengan desain yang konsisten
const FormFieldWrapper = ({ children, label, icon, required = false, error, helperText }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Box display="flex" alignItems="center" gap={0.5} sx={{ mb: 0.5 }}>
          {icon && React.cloneElement(icon, { sx: { fontSize: 18, color: 'text.secondary' } })}
          <Typography variant="body2" fontWeight="600" color="text.secondary">
            {label}
            {required && <span style={{ color: theme.palette.error.main, marginLeft: 2 }}>*</span>}
          </Typography>
        </Box>
      )}
      {children}
      {helperText && (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

// Komponen utama
const LaporanRusakForm = ({
  formData: initialFormData = {},
  setFormData,
  errors = {},
  readOnly = false,
  isEdit = false,
}) => {
  const { data: session } = useSession();
  const theme = useTheme();
  
  // Gunakan useRef untuk melacak apakah sudah fetch
  const hasFetchedRef = useRef(false);
  
  const [loading, setLoading] = useState({
    ruangan: false,
    aset: false,
    initial: false
  });
  const [fetchErrors, setFetchErrors] = useState({
    ruangan: null,
    aset: null
  });
  
  // State untuk options
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [asetOptions, setAsetOptions] = useState([]);
  
  // State untuk Autocomplete
  const [ruanganSearchText, setRuanganSearchText] = useState('');
  const [asetSearchText, setAsetSearchText] = useState('');
  
  // ============================================
  // FUNGSI UNTUK MEMASTIKAN STATUS VALID
  // ============================================
  const getValidStatus = useCallback((inputStatus, isEditMode = isEdit) => {
    console.log('🔍 getValidStatus - Input:', { inputStatus, isEditMode });
    
    // JIKA MODE CREATE, SELALU GUNAKAN MENUNGGU_VERIFIKASI_PIC
    if (!isEditMode) {
      console.log('📝 Mode Create: Memaksa status menjadi menunggu_verifikasi_pic');
      return STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    // JIKA MODE EDIT, validasi status
    if (!inputStatus) {
      console.log('⚠️ Status kosong, menggunakan default');
      return STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    // KONVERSI: Jika status adalah 'draft', ubah ke 'menunggu_verifikasi_pic'
    if (inputStatus === STATUS.DRAFT) {
      console.log('🔄 Mengkonversi status draft -> menunggu_verifikasi_pic');
      return STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    // Validasi apakah status termasuk dalam daftar yang diizinkan
    const validStatusValues = Object.values(STATUS);
    if (validStatusValues.includes(inputStatus)) {
      console.log('✅ Status valid:', inputStatus);
      return inputStatus;
    }
    
    // Jika status tidak dikenal, return default
    console.warn(`⚠️ Status tidak dikenal: ${inputStatus}, menggunakan default`);
    return STATUS.MENUNGGU_VERIFIKASI_PIC;
  }, [isEdit]);
  
  // ============================================
  // DEFAULT FORM DATA - DENGAN VALIDASI STATUS
  // ============================================
  const defaultFormData = useMemo(() => {
    // Tentukan status awal dengan validasi ketat
    let initialStatus;
    
    if (isEdit && initialFormData.status) {
      // Mode edit: validasi status dari initialFormData
      console.log('📋 Mode Edit - Status dari DB:', initialFormData.status);
      initialStatus = getValidStatus(initialFormData.status, true);
    } else {
      // Mode create: SELALU gunakan menunggu_verifikasi_pic, TIDAK PERNAH draft
      console.log('🆕 Mode Create - Menggunakan default status');
      initialStatus = STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    return {
      id: null,
      nomor_laporan: '',
      aset_id: '',
      ruangan_id: '',
      pelapor_id: session?.user?.id || session?.user?.sub || '',
      tgl_laporan: new Date(),
      deskripsi: '',
      foto_kerusakan: [],
      prioritas: 'sedang',
      status: initialStatus,
      aset_nama: '',
      aset_kode: '',
      aset_merk: '',
      ruangan_nama: '',
      ruangan_kode: '',
      ruangan_lokasi: '',
      pelapor_nama: session?.user?.name || '',
      created_at: null,
      updated_at: null
    };
  }, [session, isEdit, initialFormData, getValidStatus]);

  // ============================================
  // FORM DATA STATE - DENGAN VALIDASI STATUS KETAT
  // ============================================
  const [formData, setLocalFormData] = useState(() => {
    // Validasi status dengan fungsi getValidStatus
    let validStatus;
    
    if (isEdit && initialFormData.status) {
      // Mode edit: validasi status dari initialFormData
      console.log('📋 Mode Edit - Initial status:', initialFormData.status);
      validStatus = getValidStatus(initialFormData.status, true);
    } else {
      // Mode create: SELALU menunggu_verifikasi_pic
      console.log('🆕 Mode Create - Setting default status');
      validStatus = STATUS.MENUNGGU_VERIFIKASI_PIC;
    }
    
    const newFormData = {
      ...defaultFormData,
      ...initialFormData,
      tgl_laporan: initialFormData.tgl_laporan 
        ? new Date(initialFormData.tgl_laporan) 
        : new Date(),
      pelapor_id: initialFormData.pelapor_id || session?.user?.id || session?.user?.sub || '',
      pelapor_nama: initialFormData.pelapor_nama || session?.user?.name || '',
      foto_kerusakan: initialFormData.foto_kerusakan || [],
      status: validStatus, // PASTIKAN TIDAK PERNAH 'draft'
    };
    
    console.log('📦 Form Data setelah inisialisasi:', newFormData);
    return newFormData;
  });

  // ============================================
  // HANDLE CHANGE - DENGAN VALIDASI STATUS
  // ============================================
  const handleChange = useCallback((field, value) => {
    setLocalFormData(prev => {
      if (prev[field] === value) return prev;
      
      let newValue = value;
      
      // VALIDASI KHUSUS UNTUK STATUS
      if (field === 'status') {
        // Jika mencoba mengubah status ke 'draft', cegah dan beri peringatan
        if (value === STATUS.DRAFT) {
          console.warn('⚠️ Tidak diizinkan mengubah status ke draft');
          newValue = getValidStatus(prev.status, isEdit);
        } else {
          newValue = getValidStatus(value, isEdit);
        }
      }
      
      const newState = {
        ...prev,
        [field]: newValue
      };
      
      console.log(`📝 handleChange - ${field}:`, newValue);
      return newState;
    });
  }, [getValidStatus, isEdit]);

  // ============================================
  // UPDATE PARENT STATE - DENGAN VALIDASI AKHIR
  // ============================================
  useEffect(() => {
    if (setFormData) {
      const timeoutId = setTimeout(() => {
        // PASTIKAN TIDAK ADA 'draft' KETIKA DIKIRIM KE PARENT
        const dataToSend = {
          ...formData,
          status: getValidStatus(formData.status, isEdit)
        };
        console.log('📤 Mengirim ke parent dengan status:', dataToSend.status);
        setFormData(dataToSend);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [formData, setFormData, getValidStatus, isEdit]);

  // ============================================
  // UPDATE LOCAL STATE KETIKA INITIAL DATA BERUBAH
  // ============================================
  useEffect(() => {
    if (initialFormData && Object.keys(initialFormData).length > 0) {
      console.log('🔄 InitialFormData berubah:', initialFormData);
      
      // Validasi status dengan fungsi getValidStatus
      let validStatus;
      
      if (isEdit && initialFormData.status) {
        console.log('📋 Mode Edit - Status baru:', initialFormData.status);
        validStatus = getValidStatus(initialFormData.status, true);
      } else {
        console.log('🆕 Mode Create - Status default');
        validStatus = STATUS.MENUNGGU_VERIFIKASI_PIC;
      }
      
      setLocalFormData(prev => ({
        ...defaultFormData,
        ...initialFormData,
        tgl_laporan: initialFormData.tgl_laporan 
          ? new Date(initialFormData.tgl_laporan) 
          : new Date(),
        pelapor_id: initialFormData.pelapor_id || session?.user?.id || session?.user?.sub || '',
        pelapor_nama: initialFormData.pelapor_nama || session?.user?.name || '',
        foto_kerusakan: initialFormData.foto_kerusakan || [],
        status: validStatus,
      }));
    }
  }, [initialFormData, session, defaultFormData, getValidStatus, isEdit]);

  // Selected objects untuk Autocomplete
  const selectedRuangan = useMemo(() => {
    if (!formData.ruangan_id || !ruanganOptions.length) return null;
    return ruanganOptions.find(r => r.id === formData.ruangan_id) || null;
  }, [formData.ruangan_id, ruanganOptions]);

  const selectedAset = useMemo(() => {
    if (!formData.aset_id || !asetOptions.length) return null;
    return asetOptions.find(a => a.id === formData.aset_id) || null;
  }, [formData.aset_id, asetOptions]);

  // Filter ruangan berdasarkan search text
  const filteredRuanganOptions = useMemo(() => {
    if (!ruanganOptions.length) return [];
    
    let filtered = ruanganOptions.filter(ruangan => ruangan.is_active === 1 || ruangan.is_active === true);
    
    if (ruanganSearchText && ruanganSearchText.length >= 2) {
      const searchLower = ruanganSearchText.toLowerCase();
      filtered = filtered.filter(ruangan => 
        ruangan.kode_ruangan?.toLowerCase().includes(searchLower) ||
        ruangan.nama_ruangan?.toLowerCase().includes(searchLower) ||
        ruangan.lokasi?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [ruanganOptions, ruanganSearchText]);

  // Filter aset berdasarkan search text
  const filteredAsetOptions = useMemo(() => {
    if (!asetOptions.length) {
      return [];
    }
    
    let filtered = asetOptions;
    
    if (asetSearchText && asetSearchText.length >= 2) {
      const searchLower = asetSearchText.toLowerCase();
      filtered = filtered.filter(aset => 
        aset.kode_barang?.toLowerCase().includes(searchLower) ||
        aset.nama_barang?.toLowerCase().includes(searchLower) ||
        aset.merk?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [asetOptions, asetSearchText]);

  // ===== FETCH ASET FUNCTION =====
  const fetchAsetByRuangan = useCallback(async (ruanganId) => {
    if (!session || !ruanganId) {
      console.log('❌ Session atau ruanganId tidak ada');
      setAsetOptions([]);
      return;
    }

    console.log('🔍 Fetching aset untuk ruangan ID:', ruanganId);
    setLoading(prev => ({ ...prev, aset: true }));
    setFetchErrors(prev => ({ ...prev, aset: null }));

    try {
      const asetResult = await laporanApi.fetchAsetByRuangan(session, ruanganId);
      
      console.log('📥 Response dari fetchAsetByRuangan:', asetResult);
      
      if (asetResult?.success) {
        const asetData = Array.isArray(asetResult.data) ? asetResult.data : [];
        
        console.log(`✅ Mendapatkan ${asetData.length} aset untuk ruangan ${ruanganId}`);
        
        if (asetData.length === 0) {
          console.log('⚠️ Tidak ada aset ditemukan di ruangan ini');
        }
        
        setAsetOptions(asetData);
        
        // Auto-select jika hanya 1 aset
        if (asetData.length === 1 && !readOnly) {
          console.log('🎯 Otomatis memilih aset:', asetData[0].nama_barang);
          const singleAset = asetData[0];
          handleChange('aset_id', singleAset.id);
          handleChange('aset_nama', singleAset.nama_barang);
          handleChange('aset_kode', singleAset.kode_barang);
          handleChange('aset_merk', singleAset.merk || '');
        }
      } else {
        console.error('❌ Gagal fetch aset:', asetResult?.message);
        setFetchErrors(prev => ({ 
          ...prev, 
          aset: asetResult?.message || 'Gagal memuat data aset' 
        }));
        setAsetOptions([]);
      }
    } catch (error) {
      console.error('❌ Error fetching aset:', error);
      setFetchErrors(prev => ({ ...prev, aset: error.message }));
      setAsetOptions([]);
    } finally {
      setLoading(prev => ({ ...prev, aset: false }));
    }
  }, [session, readOnly, handleChange]);

  // ===== FETCH RUANGAN FUNCTION =====
  const fetchRuanganOptions = useCallback(async () => {
    if (!session) {
      console.log('⏳ Menunggu session...');
      return;
    }

    console.log('🔍 Fetching ruangan options for PIC...');
    setLoading(prev => ({ ...prev, ruangan: true }));
    setFetchErrors(prev => ({ ...prev, ruangan: null }));

    try {
      const ruanganResult = await laporanApi.fetchRuanganOptions(session, {
        user_id: session?.user?.id || session?.user?.sub
      });
      console.log('📥 Ruangan response:', ruanganResult);
      
      if (ruanganResult?.success) {
        const ruanganData = Array.isArray(ruanganResult.data) ? ruanganResult.data : [];
        
        const aktifRuanganData = ruanganData.filter(ruangan => 
          ruangan.is_active === 1 || ruangan.is_active === true
        );
        
        setRuanganOptions(aktifRuanganData);
        console.log('✅ Ruangan options loaded:', aktifRuanganData.length, 'dari total', ruanganData.length);
      } else {
        setFetchErrors(prev => ({ 
          ...prev, 
          ruangan: ruanganResult?.message || 'Gagal memuat data ruangan' 
        }));
      }
    } catch (error) {
      console.error('❌ Error fetching ruangan:', error);
      setFetchErrors(prev => ({ ...prev, ruangan: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, ruangan: false }));
    }
  }, [session]);

  // Reset aset ketika ruangan berubah
  useEffect(() => {
    if (formData.ruangan_id) {
      console.log('🏠 Ruangan dipilih ID:', formData.ruangan_id, '- Mereset dan fetch aset...');
      
      handleChange('aset_id', '');
      handleChange('aset_nama', '');
      handleChange('aset_kode', '');
      handleChange('aset_merk', '');
      
      fetchAsetByRuangan(formData.ruangan_id);
    } else {
      console.log('🏠 Tidak ada ruangan dipilih, kosongkan opsi aset');
      setAsetOptions([]);
      handleChange('aset_id', '');
      handleChange('aset_nama', '');
      handleChange('aset_kode', '');
      handleChange('aset_merk', '');
    }
  }, [formData.ruangan_id, handleChange, fetchAsetByRuangan]);

  // Fetch options ketika session tersedia
  useEffect(() => {
    if (session && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchRuanganOptions();
    }
  }, [session, fetchRuanganOptions]);

  const handleDateChange = useCallback((date) => {
    handleChange('tgl_laporan', date);
  }, [handleChange]);

  const handleRefreshOptions = useCallback(() => {
    hasFetchedRef.current = false;
    fetchRuanganOptions();
  }, [fetchRuanganOptions]);

  const handleRefreshAset = useCallback(() => {
    if (formData.ruangan_id) {
      fetchAsetByRuangan(formData.ruangan_id);
    }
  }, [formData.ruangan_id, fetchAsetByRuangan]);

  const handlePhotosChange = useCallback((newPhotos) => {
    handleChange('foto_kerusakan', newPhotos);
  }, [handleChange]);

  const prioritasOptions = useMemo(() => [
    { value: 'rendah', label: 'Rendah' },
    { value: 'sedang', label: 'Sedang' },
    { value: 'tinggi', label: 'Tinggi' },
    { value: 'darurat', label: 'Darurat' },
  ], []);

  // Tampilkan skeleton loading dengan desain yang menarik
  if (loading.ruangan) {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          p: 4, 
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${theme.palette.background.paper} 100%)`,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Stack spacing={4}>
          <Box>
            <Skeleton variant="text" width={300} height={48} sx={{ borderRadius: 2 }} />
            <Skeleton variant="text" width={400} height={24} sx={{ borderRadius: 1, mt: 1 }} />
          </Box>
          <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.5) }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
            </Grid>
            <Grid item xs={12}>
              <Skeleton variant="rounded" height={150} sx={{ borderRadius: 3 }} />
            </Grid>
          </Grid>
        </Stack>
      </Paper>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} locale={idLocale}>
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 3, sm: 4, md: 5 },
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${theme.palette.background.paper} 100%)`,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.08)}`,
        }}
      >
        <Grid container spacing={4}>
          {/* Informasi Dasar */}
          <Grid item xs={12}>
            <SectionHeader 
              title="Informasi Dasar" 
              icon={<AssignmentIcon sx={{ fontSize: 24 }} />}
              subtitle="Lengkapi informasi umum laporan kerusakan aset"
            />
          </Grid>

          {/* Info Cards - Tampilkan jika dalam mode edit/readOnly */}
          {(isEdit || readOnly) && (
            <Grid item xs={12}>
              <Grid container spacing={2}>
                {formData.nomor_laporan && (
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoCard
                      title="Nomor Laporan"
                      value={formData.nomor_laporan}
                      icon={<AssignmentIcon />}
                      color="primary"
                      subtitle={`Dibuat: ${formData.created_at ? format(new Date(formData.created_at), 'dd MMM yyyy', { locale: id }) : '-'}`}
                    />
                  </Grid>
                )}
                {formData.status && (
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoCard
                      title="Status"
                      value={<StatusBadge status={formData.status} size="medium" />}
                      icon={<InfoIcon />}
                      color="warning"
                    />
                  </Grid>
                )}
                {formData.pelapor_nama && (
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoCard
                      title="Pelapor"
                      value={formData.pelapor_nama}
                      icon={<PersonIcon />}
                      color="info"
                      subtitle={`ID: ${formData.pelapor_id || '-'}`}
                    />
                  </Grid>
                )}
                {formData.tgl_laporan && (
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoCard
                      title="Tanggal Laporan"
                      value={format(formData.tgl_laporan, 'dd MMMM yyyy', { locale: id })}
                      icon={<CalendarIcon />}
                      color="success"
                    />
                  </Grid>
                )}
              </Grid>
            </Grid>
          )}

          {/* Tanggal Laporan - Untuk mode create */}
          {!isEdit && !readOnly && (
            <Grid item xs={12} md={6}>
              <FormFieldWrapper
                label="Tanggal Laporan"
                icon={<CalendarIcon />}
                required
                error={!!errors.tgl_laporan}
                helperText={errors.tgl_laporan || 'Pilih tanggal laporan kerusakan'}
              >
                <DatePicker
                  value={formData.tgl_laporan}
                  onChange={handleDateChange}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'medium',
                      error: !!errors.tgl_laporan,
                      placeholder: 'DD/MM/YYYY',
                      InputProps: {
                        sx: {
                          borderRadius: 3,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: alpha(theme.palette.divider, 0.5),
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme.palette.primary.main,
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme.palette.primary.main,
                            borderWidth: 2,
                          },
                        }
                      }
                    }
                  }}
                />
              </FormFieldWrapper>
            </Grid>
          )}

          {/* Informasi Aset */}
          <Grid item xs={12}>
            <SectionHeader 
              title="Informasi Aset" 
              icon={<InventoryIcon sx={{ fontSize: 24 }} />}
              subtitle="Pilih ruangan terlebih dahulu, kemudian pilih aset yang mengalami kerusakan"
            />
          </Grid>

          {/* Ruangan */}
          <Grid item xs={12} md={6}>
            <FormFieldWrapper
              label="Pilih Ruangan"
              icon={<RoomIcon />}
              required={!readOnly}
              error={!!errors.ruangan_id}
              helperText={
                errors.ruangan_id || 
                (fetchErrors.ruangan ? (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ErrorIcon fontSize="small" color="error" />
                    {fetchErrors.ruangan}
                  </Box>
                ) : 'Pilih ruangan yang menjadi tanggung jawab Anda')
              }
            >
              <Autocomplete
                options={filteredRuanganOptions}
                loading={loading.ruangan}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  return `${option.kode_ruangan || ''} - ${option.nama_ruangan || ''}`;
                }}
                value={selectedRuangan}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleChange('ruangan_id', newValue.id);
                    handleChange('ruangan_nama', newValue.nama_ruangan);
                    handleChange('ruangan_kode', newValue.kode_ruangan);
                    handleChange('ruangan_lokasi', newValue.lokasi || '');
                  } else {
                    handleChange('ruangan_id', '');
                    handleChange('ruangan_nama', '');
                    handleChange('ruangan_kode', '');
                    handleChange('ruangan_lokasi', '');
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setRuanganSearchText(newInputValue);
                }}
                inputValue={ruanganSearchText}
                disabled={readOnly}
                filterOptions={(x) => x}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Cari berdasarkan kode, nama, atau lokasi"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      sx: {
                        borderRadius: 3,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.divider, 0.5),
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                          borderWidth: 2,
                        },
                      },
                      endAdornment: (
                        <>
                          {!readOnly && (
                            <InputAdornment position="end">
                              <IconButton 
                                size="small" 
                                onClick={handleRefreshOptions}
                                disabled={loading.ruangan}
                                sx={{
                                  color: theme.palette.primary.main,
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  }
                                }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ width: '100%', py: 1 }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          <HomeIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="600">
                            {option.kode_ruangan} - {option.nama_ruangan}
                          </Typography>
                          {option.lokasi && (
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                              <LocationIcon fontSize="inherit" />
                              {option.lokasi}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </li>
                )}
                noOptionsText={
                  ruanganSearchText.length < 2
                    ? 'Ketik minimal 2 karakter untuk mencari'
                    : 'Tidak ada ruangan ditemukan'
                }
                loadingText="Memuat data ruangan..."
                sx={{
                  '& .MuiAutocomplete-inputRoot': {
                    borderRadius: 3,
                  }
                }}
              />
            </FormFieldWrapper>
          </Grid>

          {/* Aset */}
          <Grid item xs={12} md={6}>
            <FormFieldWrapper
              label="Pilih Aset"
              icon={<CategoryIcon />}
              required={!readOnly}
              error={!!errors.aset_id}
              helperText={
                errors.aset_id || 
                (fetchErrors.aset ? (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ErrorIcon fontSize="small" color="error" />
                    {fetchErrors.aset}
                  </Box>
                ) : !formData.ruangan_id 
                  ? 'Pilih ruangan terlebih dahulu' 
                  : asetOptions.length === 0
                    ? 'Tidak ada aset ditemukan di ruangan ini'
                    : `Tersedia ${asetOptions.length} aset di ruangan ini`)
              }
            >
              <Autocomplete
                options={filteredAsetOptions}
                loading={loading.aset}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  return `${option.kode_barang || ''} - ${option.nama_barang || ''}`;
                }}
                value={selectedAset}
                onChange={(event, newValue) => {
                  if (newValue) {
                    handleChange('aset_id', newValue.id);
                    handleChange('aset_nama', newValue.nama_barang);
                    handleChange('aset_kode', newValue.kode_barang);
                    handleChange('aset_merk', newValue.merk || '');
                  } else {
                    handleChange('aset_id', '');
                    handleChange('aset_nama', '');
                    handleChange('aset_kode', '');
                    handleChange('aset_merk', '');
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setAsetSearchText(newInputValue);
                }}
                inputValue={asetSearchText}
                disabled={readOnly || !formData.ruangan_id}
                filterOptions={(x) => x}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Cari berdasarkan kode, nama, atau merk"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      sx: {
                        borderRadius: 3,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.divider, 0.5),
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                          borderWidth: 2,
                        },
                      },
                      endAdornment: (
                        <>
                          {!readOnly && formData.ruangan_id && (
                            <InputAdornment position="end">
                              <IconButton 
                                size="small" 
                                onClick={handleRefreshAset}
                                disabled={loading.aset}
                                sx={{
                                  color: theme.palette.primary.main,
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  }
                                }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ width: '100%', py: 1 }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          <InventoryIcon fontSize="small" />
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="body2" fontWeight="600">
                            {option.kode_barang} - {option.nama_barang}
                          </Typography>
                          <Box display="flex" gap={2} mt={0.5}>
                            {option.merk && (
                              <Typography variant="caption" color="text.secondary">
                                Merk: {option.merk}
                              </Typography>
                            )}
                            {option.kondisi && (
                              <Typography variant="caption" color="text.secondary">
                                Kondisi: {option.kondisi}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </li>
                )}
                noOptionsText={
                  !formData.ruangan_id
                    ? 'Pilih ruangan terlebih dahulu'
                    : loading.aset
                      ? 'Memuat data aset...'
                      : asetSearchText.length < 2
                        ? 'Ketik minimal 2 karakter untuk mencari'
                        : 'Tidak ada aset ditemukan di ruangan ini'
                }
                loadingText="Memuat data aset..."
                sx={{
                  '& .MuiAutocomplete-inputRoot': {
                    borderRadius: 3,
                  }
                }}
              />
            </FormFieldWrapper>
          </Grid>

          {/* Detail Kerusakan */}
          <Grid item xs={12}>
            <SectionHeader 
              title="Detail Kerusakan" 
              icon={<DescriptionIcon sx={{ fontSize: 24 }} />}
              subtitle="Jelaskan secara detail kondisi kerusakan yang terjadi"
            />
          </Grid>

          {/* Deskripsi Kerusakan */}
          <Grid item xs={12}>
            <FormFieldWrapper
              label="Deskripsi Kerusakan"
              icon={<DescriptionIcon />}
              required={!readOnly}
              error={!!errors.deskripsi}
              helperText={errors.deskripsi || 'Jelaskan apa yang rusak, sejak kapan, dan gejala yang muncul'}
            >
              <TextField
                fullWidth
                value={formData.deskripsi || ''}
                onChange={(e) => handleChange('deskripsi', e.target.value)}
                disabled={readOnly}
                multiline
                rows={6}
                placeholder="Contoh: AC tidak mengeluarkan udara dingin, suara berisik, dan mati sendiri setelah 10 menit menyala..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                      borderWidth: 2,
                    },
                  }
                }}
              />
            </FormFieldWrapper>
          </Grid>

          {/* Upload Foto */}
          <Grid item xs={12}>
            <FotoUploader
              photos={formData.foto_kerusakan || []}
              onPhotosChange={handlePhotosChange}
              readOnly={readOnly}
            />
          </Grid>

          {/* Prioritas */}
          <Grid item xs={12}>
            <SectionHeader 
              title="Prioritas Penanganan" 
              icon={<FlagIcon sx={{ fontSize: 24 }} />}
              subtitle="Tentukan tingkat prioritas penanganan kerusakan"
            />
          </Grid>

          {/* Prioritas Select */}
          <Grid item xs={12} md={6}>
            <FormFieldWrapper
              label="Prioritas"
              icon={<PriorityIcon />}
              required={!readOnly}
              error={!!errors.prioritas}
            >
              <FormControl fullWidth error={!!errors.prioritas} disabled={readOnly}>
                <Select
                  value={formData.prioritas || 'sedang'}
                  onChange={(e) => handleChange('prioritas', e.target.value)}
                  sx={{
                    borderRadius: 3,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                      borderWidth: 2,
                    },
                  }}
                  renderValue={(selected) => (
                    <Box display="flex" alignItems="center" gap={1}>
                      <PriorityChip priority={selected} />
                    </Box>
                  )}
                >
                  {prioritasOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PriorityChip priority={option.value} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {formData.prioritas === 'darurat' && '⚠️ Perlu penanganan segera (24 jam)'}
                  {formData.prioritas === 'tinggi' && '🔴 Prioritaskan penanganan (2-3 hari)'}
                  {formData.prioritas === 'sedang' && '🟡 Dapat dijadwalkan (3-5 hari)'}
                  {formData.prioritas === 'rendah' && '🟢 Dapat menunggu (5-7 hari)'}
                </FormHelperText>
              </FormControl>
            </FormFieldWrapper>
          </Grid>

          {/* Status (Hanya untuk mode edit/readOnly) - TANPA OPSI DRAFT */}
          {(readOnly || isEdit) && (
            <Grid item xs={12} md={6}>
              <FormFieldWrapper
                label="Status Laporan"
                icon={<InfoIcon />}
                error={!!errors.status}
              >
                <FormControl fullWidth error={!!errors.status} disabled={readOnly}>
                  <Select
                    value={formData.status || STATUS.MENUNGGU_VERIFIKASI_PIC}
                    onChange={(e) => handleChange('status', e.target.value)}
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: alpha(theme.palette.divider, 0.5),
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme.palette.primary.main,
                        borderWidth: 2,
                      },
                    }}
                    renderValue={(selected) => (
                      <Box display="flex" alignItems="center" gap={1}>
                        <StatusBadge status={selected} size="medium" />
                      </Box>
                    )}
                  >
                    {VALID_STATUS_OPTIONS.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <StatusBadge status={option.value} size="medium" />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FormFieldWrapper>
            </Grid>
          )}

          {/* Info Pelapor (untuk mode create) */}
          {!readOnly && !isEdit && (
            <Grid item xs={12}>
              <Fade in={true}>
                <Box
                  sx={{
                    mt: 3,
                    p: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                    backdropFilter: 'blur(8px)',
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Avatar
                    sx={{
                      background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                      width: 56,
                      height: 56,
                      borderRadius: 3,
                      boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.3)}`,
                    }}
                  >
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="700" color="text.primary">
                      {formData.pelapor_nama || session?.user?.name || 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      <InfoIcon fontSize="small" />
                      ID: {formData.pelapor_id || session?.user?.id || session?.user?.sub || '-'}
                    </Typography>
                  </Box>
                </Box>
              </Fade>
            </Grid>
          )}
        </Grid>
      </Paper>
    </LocalizationProvider>
  );
};

export default LaporanRusakForm;