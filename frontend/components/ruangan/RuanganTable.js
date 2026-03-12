// components/ruangan/RuanganTable.js

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
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MeetingRoom as RoomIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

const RuanganTable = ({
  data = [],
  loading = false,
  onEdit,
  onDelete,
  onView,
  pagination,
  onPageChange,
  sortConfig,
  onSort,
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

  const getStatusConfig = (isActive) => {
    if (isActive === 1) {
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
        label: 'Tidak Aktif'
      };
    }
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
            Memuat data ruangan...
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
              <RoomIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Belum Ada Data Ruangan
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Klik tombol "Tambah Ruangan" untuk menambahkan data baru
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
                  width="15%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'kode_ruangan' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'kode_ruangan'}
                    direction={sortConfig?.field === 'kode_ruangan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('kode_ruangan')}
                  >
                    Kode Ruangan
                  </TableSortLabel>
                </TableCell>
                
                <TableCell 
                  width="20%" 
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'nama_ruangan' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'nama_ruangan'}
                    direction={sortConfig?.field === 'nama_ruangan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('nama_ruangan')}
                  >
                    Nama Ruangan
                  </TableSortLabel>
                </TableCell>
                
                <TableCell width="20%" sx={{ fontWeight: 600 }}>
                  Lokasi
                </TableCell>
                
                <TableCell width="25%" sx={{ fontWeight: 600 }}>
                  Deskripsi
                </TableCell>
                
                <TableCell 
                  width="10%" 
                  align="center"
                  sx={{ fontWeight: 600 }}
                  sortDirection={sortConfig?.field === 'is_active' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'is_active'}
                    direction={sortConfig?.field === 'is_active' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('is_active')}
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
              {data.map((ruangan, index) => {
                const rowNumber = pagination
                  ? (pagination.currentPage - 1) * pagination.perPage + index + 1
                  : index + 1;

                const statusConfig = getStatusConfig(ruangan.is_active);
                const isHovered = hoveredRow === ruangan.id;

                return (
                  <TableRow
                    key={ruangan.id}
                    hover
                    onMouseEnter={() => setHoveredRow(ruangan.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    sx={{
                      transition: 'all 0.2s',
                      bgcolor: isHovered ? alpha(theme.palette.primary.main, 0.02) : 'inherit',
                      '&:hover': {
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                      },
                    }}
                  >
                    <TableCell>
                      <Badge
                        color="primary"
                        variant="dot"
                        invisible={!isHovered}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isHovered ? 600 : 400,
                          }}
                        >
                          {rowNumber}
                        </Typography>
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Box
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          p: 0.5,
                          px: 1,
                          borderRadius: 1,
                          display: 'inline-block',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}
                      >
                        {ruangan.kode_ruangan}
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {ruangan.nama_ruangan}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      {ruangan.lokasi || (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" color="textSecondary" sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 250,
                      }}>
                        {ruangan.deskripsi || '-'}
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
                            '& .MuiChip-icon': {
                              color: 'inherit',
                            },
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
                              onClick={() => onView(ruangan)}
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
                        
                        {onEdit && (
                          <Tooltip title="Edit Data" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onEdit(ruangan)}
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
                              onClick={() => onDelete(ruangan)}
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
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          />
        )}
      </Paper>
    </Zoom>
  );
};

export default RuanganTable;