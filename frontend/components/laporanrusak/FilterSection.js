// components/laporanrusak/FilterSection.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Chip,
  InputAdornment,
  IconButton,
  Collapse,
  Button,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import * as laporanApi from './api/laporanRusakApi';
import { useSession } from 'next-auth/react';

const FilterSection = ({ filters, onFilterChange }) => {
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [asetOptions, setAsetOptions] = useState([]);

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'menunggu_verifikasi_pic', label: 'Menunggu Verifikasi PIC' },
    { value: 'menunggu_verifikasi_ppk', label: 'Menunggu Verifikasi PPK' },
    { value: 'diverifikasi_pic', label: 'Diverifikasi PIC' },
    { value: 'diverifikasi_ppk', label: 'Diverifikasi PPK' },
    { value: 'menunggu_disposisi', label: 'Menunggu Disposisi' },
    { value: 'didisposisi', label: 'Didisposisi' },
    { value: 'dalam_perbaikan', label: 'Dalam Perbaikan' },
    { value: 'selesai', label: 'Selesai' },
    { value: 'ditolak', label: 'Ditolak' },
  ];

  const prioritasOptions = [
    { value: 'rendah', label: 'Rendah' },
    { value: 'sedang', label: 'Sedang' },
    { value: 'tinggi', label: 'Tinggi' },
    { value: 'darurat', label: 'Darurat' },
  ];

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (session) {
      fetchOptions();
    }
  }, [session]);

  const fetchOptions = async () => {
    try {
      const [ruanganResult, asetResult] = await Promise.all([
        laporanApi.fetchRuanganOptions(session),
        laporanApi.fetchAsetOptions(session)
      ]);

      if (ruanganResult?.success) {
        setRuanganOptions(ruanganResult.data || []);
      }

      if (asetResult?.success) {
        setAsetOptions(asetResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const handleChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
  };

  const handleApplyFilter = () => {
    onFilterChange(localFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      status: '',
      prioritas: '',
      aset_id: '',
      ruangan_id: '',
      pelapor_id: '',
      search: ''
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const handleSearchChange = (event) => {
    setLocalFilters(prev => ({ ...prev, search: event.target.value }));
  };

  const handleSearchKeyPress = (event) => {
    if (event.key === 'Enter') {
      onFilterChange(localFilters);
    }
  };

  const hasActiveFilters = () => {
    return Object.values(localFilters).some(value => value && value !== '');
  };

  const getActiveFilterCount = () => {
    return Object.values(localFilters).filter(value => value && value !== '').length;
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <FilterIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Filter
          </Typography>
          {hasActiveFilters() && (
            <Chip
              label={`${getActiveFilterCount()} aktif`}
              size="small"
              color="primary"
              onDelete={handleClearFilters}
            />
          )}
        </Box>
        <Box>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Pencarian"
              value={localFilters.search || ''}
              onChange={handleSearchChange}
              onKeyPress={handleSearchKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: localFilters.search && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => handleChange('search', '')}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              placeholder="Cari nomor laporan, deskripsi..."
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={localFilters.status || ''}
                label="Status"
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <MenuItem value="">Semua Status</MenuItem>
                {statusOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Prioritas</InputLabel>
              <Select
                value={localFilters.prioritas || ''}
                label="Prioritas"
                onChange={(e) => handleChange('prioritas', e.target.value)}
              >
                <MenuItem value="">Semua Prioritas</MenuItem>
                {prioritasOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Ruangan</InputLabel>
              <Select
                value={localFilters.ruangan_id || ''}
                label="Ruangan"
                onChange={(e) => handleChange('ruangan_id', e.target.value)}
              >
                <MenuItem value="">Semua Ruangan</MenuItem>
                {ruanganOptions.map(option => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.nama_ruangan} ({option.kode_ruangan})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Aset</InputLabel>
              <Select
                value={localFilters.aset_id || ''}
                label="Aset"
                onChange={(e) => handleChange('aset_id', e.target.value)}
              >
                <MenuItem value="">Semua Aset</MenuItem>
                {asetOptions.map(option => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.nama_barang} ({option.kode_barang})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end" gap={1}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters()}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleApplyFilter}
              >
                Terapkan Filter
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Collapse>
    </Paper>
  );
};

export default FilterSection;