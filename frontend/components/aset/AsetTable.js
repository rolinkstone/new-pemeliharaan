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
  Zoom,
  Fade,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { formatDate } from '../utils/formatDate';

const AsetTable = ({
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

  // Enhanced condition color with icons
  const getKondisiConfig = (kondisi) => {
    switch (kondisi?.toLowerCase()) {
      case 'baik':
        return {
          color: 'success',
          bgColor: alpha(theme.palette.success.main, 0.1),
          icon: <CheckCircleIcon fontSize="small" />,
          label: 'Baik'
        };
      case 'rusak ringan':
        return {
          color: 'warning',
          bgColor: alpha(theme.palette.warning.main, 0.1),
          icon: <WarningIcon fontSize="small" />,
          label: 'Rusak Ringan'
        };
      case 'rusak berat':
        return {
          color: 'error',
          bgColor: alpha(theme.palette.error.main, 0.1),
          icon: <ErrorIcon fontSize="small" />,
          label: 'Rusak Berat'
      };
      case 'rusak':
        return {
          color: 'error',
          bgColor: alpha(theme.palette.error.main, 0.1),
          icon: <ErrorIcon fontSize="small" />,
          label: 'Rusak'
        };
      default:
        return {
          color: 'default',
          bgColor: alpha(theme.palette.grey[500], 0.1),
          icon: <InfoIcon fontSize="small" />,
          label: kondisi || '-'
        };
    }
  };

  // Enhanced status color with icons
  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'aktif':
        return {
          color: 'success',
          bgColor: alpha(theme.palette.success.main, 0.1),
          icon: <CheckCircleIcon fontSize="small" />,
          label: 'Aktif'
        };
      case 'tidak aktif':
        return {
          color: 'error',
          bgColor: alpha(theme.palette.error.main, 0.1),
          icon: <ErrorIcon fontSize="small" />,
          label: 'Tidak Aktif'
        };
      case 'dipinjam':
        return {
          color: 'info',
          bgColor: alpha(theme.palette.info.main, 0.1),
          icon: <InventoryIcon fontSize="small" />,
          label: 'Dipinjam'
        };
      default:
        return {
          color: 'default',
          bgColor: alpha(theme.palette.grey[500], 0.1),
          icon: <InfoIcon fontSize="small" />,
          label: status || '-'
        };
    }
  };

  // Get avatar color based on jenis
  const getJenisAvatar = (jenis) => {
    const colors = {
      'TANAH': theme.palette.success.main,
      'ALAT BESAR': theme.palette.info.main,
      'ALAT ANGKUTAN BERMOTOR': theme.palette.warning.main,
      'MESIN PERALATAN NON TIK': theme.palette.secondary.main,
      'MESIN PERALATAN KHUSUS TIK': theme.palette.primary.main,
    };
    return colors[jenis] || theme.palette.grey[500];
  };

  if (loading) {
    return (
      <Fade in={loading}>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="500px"
          bgcolor="background.paper"
          borderRadius={2}
          boxShadow={1}
        >
          <CircularProgress size={60} thickness={4} />
          <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
            Memuat data aset...
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
            minHeight: '500px',
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
              <InventoryIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h6" color="textPrimary" gutterBottom>
              Belum Ada Data Aset
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Klik tombol "Tambah Aset" untuk menambahkan data baru
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
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {/* No - not sortable */}
                <TableCell
                  width="5%"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  No
                </TableCell>
                
                {/* Jenis BMN - sortable */}
                <TableCell
                  width="10%"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'jenis_bmn' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'jenis_bmn'}
                    direction={sortConfig?.field === 'jenis_bmn' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('jenis_bmn')}
                  >
                    Jenis BMN
                  </TableSortLabel>
                </TableCell>
                
                {/* Kode Barang - sortable */}
                <TableCell
                  width="12%"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'kode_barang' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'kode_barang'}
                    direction={sortConfig?.field === 'kode_barang' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('kode_barang')}
                  >
                    Kode Barang
                  </TableSortLabel>
                </TableCell>
                
                {/* NUP - sortable */}
                <TableCell
                  width="5%"
                  align="center"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'nup' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'nup'}
                    direction={sortConfig?.field === 'nup' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('nup')}
                  >
                    NUP
                  </TableSortLabel>
                </TableCell>
                
                {/* Nama Barang - sortable */}
                <TableCell
                  width="18%"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'nama_barang' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'nama_barang'}
                    direction={sortConfig?.field === 'nama_barang' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('nama_barang')}
                  >
                    Nama Barang
                  </TableSortLabel>
                </TableCell>
                
                {/* Merk/Tipe - not sortable (composite field) */}
                <TableCell
                  width="10%"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  Merk / Tipe
                </TableCell>
                
                {/* Kondisi - sortable */}
                <TableCell
                  width="8%"
                  align="center"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'kondisi' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'kondisi'}
                    direction={sortConfig?.field === 'kondisi' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('kondisi')}
                  >
                    Kondisi
                  </TableSortLabel>
                </TableCell>
                
                {/* Status - sortable */}
                <TableCell
                  width="8%"
                  align="center"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'status_bmn' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'status_bmn'}
                    direction={sortConfig?.field === 'status_bmn' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('status_bmn')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                
                {/* Tanggal Perolehan - sortable */}
                <TableCell
                  width="10%"
                  align="center"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                  sortDirection={sortConfig?.field === 'tanggal_perolehan' ? sortConfig.direction : false}
                >
                  <TableSortLabel
                    active={sortConfig?.field === 'tanggal_perolehan'}
                    direction={sortConfig?.field === 'tanggal_perolehan' ? sortConfig.direction : 'asc'}
                    onClick={() => handleRequestSort('tanggal_perolehan')}
                  >
                    Tgl Perolehan
                  </TableSortLabel>
                </TableCell>
                
                {/* Aksi - not sortable */}
                <TableCell
                  width="8%"
                  align="center"
                  sx={{
                    bgcolor: theme.palette.background.default,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  Aksi
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((aset, index) => {
                const rowNumber = pagination
                  ? (pagination.currentPage - 1) * pagination.perPage + index + 1
                  : index + 1;

                const kondisiConfig = getKondisiConfig(aset.kondisi);
                const statusConfig = getStatusConfig(aset.status_bmn);
                const isHovered = hoveredRow === aset.id;

                return (
                  <TableRow
                    key={aset.id}
                    hover
                    onMouseEnter={() => setHoveredRow(aset.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    sx={{
                      transition: 'all 0.2s',
                      bgcolor: isHovered ? alpha(theme.palette.primary.main, 0.02) : 'inherit',
                      '&:last-child td, &:last-child th': { border: 0 },
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
                            color: isHovered ? 'primary.main' : 'text.primary',
                          }}
                        >
                          {rowNumber}
                        </Typography>
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: alpha(getJenisAvatar(aset.jenis_bmn), 0.1),
                            color: getJenisAvatar(aset.jenis_bmn),
                            fontSize: '0.75rem',
                          }}
                        >
                          {aset.jenis_bmn?.charAt(0) || '?'}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {aset.jenis_bmn || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          p: 0.5,
                          borderRadius: 1,
                          display: 'inline-block',
                        }}
                      >
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          sx={{ fontWeight: 500 }}
                        >
                          {aset.kode_barang || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Chip
                        label={aset.nup || '-'}
                        size="small"
                        variant="outlined"
                        sx={{
                          minWidth: 40,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {aset.nama_barang || '-'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Stack spacing={0.5}>
                        {aset.merk && (
                          <Typography variant="caption" fontWeight="500">
                            {aset.merk}
                          </Typography>
                        )}
                        {aset.tipe && (
                          <Typography variant="caption" color="textSecondary">
                            {aset.tipe}
                          </Typography>
                        )}
                        {!aset.merk && !aset.tipe && '-'}
                      </Stack>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Tooltip title={`Kondisi: ${kondisiConfig.label}`} arrow>
                        <Chip
                          icon={kondisiConfig.icon}
                          label={kondisiConfig.label}
                          size="small"
                          sx={{
                            bgcolor: kondisiConfig.bgColor,
                            color: theme.palette[kondisiConfig.color]?.main || 'text.primary',
                            fontWeight: 600,
                            '& .MuiChip-icon': {
                              color: 'inherit',
                            },
                          }}
                        />
                      </Tooltip>
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
                      <Box
                        sx={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {aset.tanggal_perolehan && aset.tanggal_perolehan !== '0000-00-00'
                            ? formatDate(aset.tanggal_perolehan)
                            : '-'}
                        </Typography>
                        {aset.tanggal_perolehan && (
                          <Typography variant="caption" color="textSecondary">
                            {new Date(aset.tanggal_perolehan).getFullYear()}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center" gap={0.5}>
                        {onView && (
                          <Tooltip title="Lihat Detail" arrow placement="top">
                            <IconButton
                              size="small"
                              onClick={() => onView(aset)}
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
                          <Tooltip title="Edit Data" arrow placement="top">
                            <IconButton
                              size="small"
                              onClick={() => onEdit(aset)}
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
                          <Tooltip title="Hapus Data" arrow placement="top">
                            <IconButton
                              size="small"
                              onClick={() => onDelete(aset)}
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
            rowsPerPage={pagination.perPage || 20}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="Baris per halaman"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} dari ${count}`
            }
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          />
        )}
      </Paper>
    </Zoom>
  );
};

export default AsetTable;