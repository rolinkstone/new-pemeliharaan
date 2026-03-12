import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Box,
  Typography,
  Avatar,
  alpha,
  useTheme,
  Badge,
  Fade,
  Zoom,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ExitToApp as ExitIcon,
  MeetingRoom as RoomIcon,
  Inventory as AsetIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { formatDate } from '../utils/formatDate';

const AsetRuanganTable = ({
  data = [],
  loading = false,
  onEdit,
  onDelete,
  onView,
  onPindah,           // TAMBAHKAN INI
  onCatatKeluar,
  onLihatRiwayat,
  pagination,
  onPageChange,
  sortConfig,
  onSort,
  showAsetColumn = true,
  showRuanganColumn = true,
}) => {
  const theme = useTheme();
  const [hoveredRow, setHoveredRow] = useState(null);

  const handleChangePage = (event, newPage) => {
    if (onPageChange) {
      onPageChange(newPage + 1);
    }
  };

  const handleChangeRowsPerPage = (event) => {
    if (onPageChange) {
      onPageChange(1, parseInt(event.target.value, 10));
    }
  };

  const handleRequestSort = (field) => {
    if (onSort) {
      onSort(field);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'aktif':
        return {
          color: 'success',
          bgColor: alpha(theme.palette.success.main, 0.1),
          icon: <CheckCircleIcon fontSize="small" />,
          label: 'Aktif'
        };
      case 'dipindah':
        return {
          color: 'warning',
          bgColor: alpha(theme.palette.warning.main, 0.1),
          icon: <WarningIcon fontSize="small" />,
          label: 'Dipindah'
        };
      case 'dihapuskan':
        return {
          color: 'error',
          bgColor: alpha(theme.palette.error.main, 0.1),
          icon: <ErrorIcon fontSize="small" />,
          label: 'Dihapuskan'
        };
      default:
        return {
          color: 'default',
          bgColor: alpha(theme.palette.grey[500], 0.1),
          icon: null,
          label: status || '-'
        };
    }
  };

  // Helper function to get aset display name
  const getAsetDisplay = (item) => {
    if (item.aset_detail) {
      return {
        name: item.aset_detail.nama_barang || 'Unknown',
        code: item.aset_detail.kode_barang || '',
        merk: item.aset_detail.merk || '',
        nup: item.aset_detail.nup || ''
      };
    }
    if (item.aset) {
      return {
        name: item.aset.nama_barang || 'Unknown',
        code: item.aset.kode_barang || '',
        merk: item.aset.merk || '',
        nup: item.aset.nup || ''
      };
    }
    return {
      name: `Aset ID: ${item.aset_id}`,
      code: '',
      merk: '',
      nup: ''
    };
  };

  // Helper function to get ruangan display name
  const getRuanganDisplay = (item) => {
    if (item.ruangan_detail) {
      return {
        name: item.ruangan_detail.nama_ruangan || 'Unknown',
        code: item.ruangan_detail.kode_ruangan || '',
        lokasi: item.ruangan_detail.lokasi || ''
      };
    }
    if (item.ruangan) {
      return {
        name: item.ruangan.nama_ruangan || 'Unknown',
        code: item.ruangan.kode_ruangan || '',
        lokasi: item.ruangan.lokasi || ''
      };
    }
    return {
      name: `Ruangan ID: ${item.ruangan_id}`,
      code: '',
      lokasi: ''
    };
  };

  if (loading) {
    return (
      <Fade in={loading}>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
          bgcolor="background.paper"
          borderRadius={2}
          boxShadow={1}
        >
          <CircularProgress size={60} thickness={4} />
          <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
            Memuat data posisi aset...
          </Typography>
        </Box>
      </Fade>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Fade in={true}>
        <Paper
          sx={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box textAlign="center">
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                margin: '0 auto 16px',
              }}
            >
              <AsetIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Belum Ada Data Posisi Aset
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Klik tombol "Tambah Posisi" untuk mencatat lokasi aset
            </Typography>
          </Box>
        </Paper>
      </Fade>
    );
  }

  return (
    <Zoom in={true} style={{ transitionDelay: '100ms' }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
          <Table stickyHeader size="medium">
            <TableHead>
              <TableRow>
                <TableCell width="5%" sx={{ fontWeight: 600 }}>No</TableCell>
                
                <TableCell 
                  width="25%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'aset_id' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'aset_id'}
                    direction={sortConfig?.field === 'aset_id' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('aset_id')}
                  >
                    Aset
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="20%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'ruangan_id' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'ruangan_id'}
                    direction={sortConfig?.field === 'ruangan_id' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('ruangan_id')}
                  >
                    Ruangan
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="15%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'tgl_masuk' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'tgl_masuk'}
                    direction={sortConfig?.field === 'tgl_masuk' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('tgl_masuk')}
                  >
                    Tanggal Masuk
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="15%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'tgl_keluar' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'tgl_keluar'}
                    direction={sortConfig?.field === 'tgl_keluar' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('tgl_keluar')}
                  >
                    Tanggal Keluar
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="10%" 
                  align="center"
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'status' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'status'}
                    direction={sortConfig?.field === 'status' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                
                <TableCell width="10%" sx={{ fontWeight: 600 }}>
                  Keterangan
                </TableCell>
                
                <TableCell width="10%" align="center" sx={{ fontWeight: 600 }}>
                  Aksi
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item, index) => {
                const rowNumber = pagination
                  ? (pagination.currentPage - 1) * pagination.perPage + index + 1
                  : index + 1;

                const statusConfig = getStatusConfig(item.status);
                const isHovered = hoveredRow === item.id;
                const isAktif = item.status === 'aktif' && !item.tgl_keluar;
                
                const asetDisplay = getAsetDisplay(item);
                const ruanganDisplay = getRuanganDisplay(item);

                return (
                  <TableRow
                    key={item.id}
                    hover
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    sx={{
                      transition: 'all 0.2s',
                      bgcolor: isHovered ? alpha(theme.palette.primary.main, 0.02) : 'inherit',
                      '&:hover': {
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                      },
                      ...(isAktif && {
                        borderLeft: `4px solid ${theme.palette.success.main}`,
                      }),
                    }}
                  >
                    <TableCell>
                      <Badge
                        color="primary"
                        variant="dot"
                        invisible={!isHovered}
                      >
                        <Typography variant="body2" sx={{ fontWeight: isHovered ? 600 : 400 }}>
                          {rowNumber}
                        </Typography>
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          <AsetIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {asetDisplay.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontFamily: 'monospace',
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontWeight: 500
                              }}
                            >
                              ID: {item.aset_id}
                            </Typography>
                            {asetDisplay.code && (
                              <Typography variant="caption" color="textSecondary">
                                {asetDisplay.code}
                              </Typography>
                            )}
                            {asetDisplay.nup && (
                              <Typography variant="caption" color="textSecondary">
                                NUP: {asetDisplay.nup}
                              </Typography>
                            )}
                          </Stack>
                          {asetDisplay.merk && (
                            <Typography variant="caption" color="textSecondary">
                              {asetDisplay.merk}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                          }}
                        >
                          <RoomIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {ruanganDisplay.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontFamily: 'monospace',
                                bgcolor: alpha(theme.palette.info.main, 0.05),
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontWeight: 500
                              }}
                            >
                              ID: {item.ruangan_id}
                            </Typography>
                            {ruanganDisplay.code && (
                              <Typography variant="caption" color="textSecondary">
                                {ruanganDisplay.code}
                              </Typography>
                            )}
                          </Stack>
                          {ruanganDisplay.lokasi && (
                            <Typography variant="caption" color="textSecondary">
                              {ruanganDisplay.lokasi}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.tgl_masuk ? formatDate(item.tgl_masuk) : '-'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.tgl_masuk ? new Date(item.tgl_masuk).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.tgl_keluar ? formatDate(item.tgl_keluar) : '-'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.tgl_keluar ? new Date(item.tgl_keluar).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Tooltip title={`Status: ${statusConfig.label}`} arrow>
                        <Chip
                          icon={statusConfig.icon}
                          label={statusConfig.label}
                          size="small"
                          sx={{
                            bgcolor: statusConfig.bgColor,
                            color: theme.palette[statusConfig.color]?.main || 'text.primary',
                            fontWeight: 600,
                            minWidth: 85,
                            '& .MuiChip-icon': {
                              color: 'inherit',
                            },
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color="textSecondary" 
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 150,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {item.keterangan || '-'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center" gap={0.5}>
                        {onView && (
                          <Tooltip title="Lihat Detail" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onView(item)}
                              sx={{
                                color: theme.palette.info.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.info.main, 0.1),
                                },
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onLihatRiwayat && (
                          <Tooltip title="Riwayat Aset" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onLihatRiwayat(item)}
                              sx={{
                                color: theme.palette.secondary.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                },
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {/* TOMBOL PINDAH - untuk aset aktif */}
                        {onPindah && isAktif && (
                          <Tooltip title="Pindah ke Ruangan Lain" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onPindah(item)}
                              sx={{
                                color: theme.palette.info.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.info.main, 0.1),
                                },
                              }}
                            >
                              <SwapIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {/* TOMBOL KELUAR - untuk aset aktif */}
                        {onCatatKeluar && isAktif && (
                          <Tooltip title="Hapus dari Inventaris" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onCatatKeluar(item)}
                              sx={{
                                color: theme.palette.error.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.error.main, 0.1),
                                },
                              }}
                            >
                              <ExitIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onEdit && (
                          <Tooltip title="Edit Data" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onEdit(item)}
                              sx={{
                                color: theme.palette.primary.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onDelete && (
                          <Tooltip title="Hapus Data" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onDelete(item)}
                              sx={{
                                color: theme.palette.error.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.error.main, 0.1),
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {pagination && (
          <TablePagination
            component="div"
            count={pagination.total || 0}
            page={pagination.currentPage ? pagination.currentPage - 1 : 0}
            onPageChange={handleChangePage}
            rowsPerPage={pagination.perPage || 10}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Baris per halaman"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          />
        )}
      </Paper>
    </Zoom>
  );
};

export default AsetRuanganTable;