// components/picruangan/PicRuanganTable.js

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
  Person as PersonIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';
import { formatDate } from '../utils/formatDate';

const PicRuanganTable = ({
  data = [],
  loading = false,
  onEdit,
  onDelete,
  onView,
  pagination,
  onPageChange,
  sortConfig,
  onSort,
  readOnly = false,
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
    if (status === 'aktif') {
      return {
        color: 'success',
        bgColor: alpha(theme.palette.success.main, 0.1),
        icon: <CheckCircleIcon fontSize="small" />,
        label: 'Aktif'
      };
    } else {
      return {
        color: 'error',
        bgColor: alpha(theme.palette.error.main, 0.1),
        icon: <CancelIcon fontSize="small" />,
        label: 'Nonaktif'
      };
    }
  };

  // Helper function to get user name from various possible fields
  const getUserName = (item) => {
    // Priority order for user name
    if (item.user_name && item.user_name !== '') {
      return item.user_name;
    }
    if (item.user_nama && item.user_nama !== '') {
      return item.user_nama;
    }
    if (item.user_detail?.nama && item.user_detail?.nama !== '') {
      return item.user_detail.nama;
    }
    if (item.nama && item.nama !== '') {
      return item.nama;
    }
    // Fallback to user_id
    return `User ID: ${item.user_id?.substring(0, 8) || 'Unknown'}`;
  };

  // Helper function to get user NIP
  const getUserNip = (item) => {
    if (item.user_nip && item.user_nip !== '-') return item.user_nip;
    if (item.user_detail?.nip && item.user_detail?.nip !== '-') return item.user_detail.nip;
    return null;
  };

  // Helper function to get user Jabatan
  const getUserJabatan = (item) => {
    if (item.user_jabatan && item.user_jabatan !== '-') return item.user_jabatan;
    if (item.user_detail?.jabatan && item.user_detail?.jabatan !== '-') return item.user_detail.jabatan;
    return null;
  };

  // Helper function to get user Email
  const getUserEmail = (item) => {
    if (item.user_email && item.user_email !== '-') return item.user_email;
    if (item.user_detail?.email && item.user_detail?.email !== '-') return item.user_detail.email;
    return null;
  };

  // Helper function to get ruangan name
  const getRuanganName = (item) => {
    if (item.ruangan_nama && item.ruangan_nama !== '') {
      return item.ruangan_nama;
    }
    if (item.ruangan_detail?.nama_ruangan && item.ruangan_detail?.nama_ruangan !== '') {
      return item.ruangan_detail.nama_ruangan;
    }
    return `Ruangan ID: ${item.ruangan_id}`;
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
            Memuat data PIC ruangan...
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
              <PersonIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Belum Ada Data PIC Ruangan
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Klik tombol "Tambah PIC" untuk menambahkan penugasan baru
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
                  width="20%" 
                  sx={{ fontWeight: 600 }}
                >
                  PIC
                </TableCell>
                
                <TableCell 
                  width="20%" 
                  sx={{ fontWeight: 600 }}
                >
                  Ruangan
                </TableCell>
                
                <TableCell 
                  width="15%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'tgl_penugasan' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'tgl_penugasan'}
                    direction={sortConfig?.field === 'tgl_penugasan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('tgl_penugasan')}
                  >
                    Tanggal Penugasan
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="15%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'tgl_berakhir' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'tgl_berakhir'}
                    direction={sortConfig?.field === 'tgl_berakhir' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('tgl_berakhir')}
                  >
                    Tanggal Berakhir
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
                const isAktif = item.status === 'aktif';
                
                const userName = getUserName(item);
                const userNip = getUserNip(item);
                const userJabatan = getUserJabatan(item);
                const userEmail = getUserEmail(item);
                const ruanganName = getRuanganName(item);

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
                    
                    {/* Kolom PIC - Menampilkan Nama */}
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
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {userName}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {userNip && (
                              <Chip
                                size="small"
                                icon={<BadgeIcon fontSize="small" />}
                                label={userNip}
                                variant="outlined"
                                sx={{ height: 20 }}
                              />
                            )}
                            {userEmail && (
                              <Typography variant="caption" color="textSecondary">
                                {userEmail}
                              </Typography>
                            )}
                          </Stack>
                          {userJabatan && (
                            <Typography variant="caption" color="textSecondary">
                              {userJabatan}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    
                    {/* Kolom Ruangan - Menampilkan Nama Ruangan */}
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
                            {ruanganName}
                          </Typography>
                          {item.ruangan_kode && (
                            <Typography variant="caption" color="textSecondary">
                              {item.ruangan_kode}
                            </Typography>
                          )}
                          {item.ruangan_lokasi && (
                            <Typography variant="caption" color="textSecondary" display="block">
                              {item.ruangan_lokasi}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.tgl_penugasan ? formatDate(item.tgl_penugasan) : '-'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.tgl_berakhir ? formatDate(item.tgl_berakhir) : '-'}
                      </Typography>
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
                            minWidth: 70,
                          }}
                        />
                      </Tooltip>
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
                        
                        {!readOnly && onEdit && (
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
                        
                        {!readOnly && onDelete && (
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

export default PicRuanganTable;