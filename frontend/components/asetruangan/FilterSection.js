// components/asetruangan/FilterSection.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Paper,
  Chip,
  Stack,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import * as asetRuanganApi from './api/asetRuanganApi';
import { useSession } from 'next-auth/react';

const FilterSection = ({ filters, onFilterChange, showAsetFilter = true, showRuanganFilter = true }) => {
  const { data: session } = useSession();
  const [localFilters, setLocalFilters] = useState(filters);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Options untuk dropdown
  const [asetOptions, setAsetOptions] = useState([]);
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load options for dropdowns
  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        if (showAsetFilter) {
          const asetResult = await asetRuanganApi.fetchAsetOptions(session);
          if (asetResult?.success) {
            setAsetOptions(asetResult.data || []);
          }
        }
        
        if (showRuanganFilter) {
          const ruanganResult = await asetRuanganApi.fetchRuanganOptions(session);
          if (ruanganResult?.success) {
            setRuanganOptions(ruanganResult.data || []);
          }
        }
      } catch (error) {
        console.error('Error loading options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [session, showAsetFilter, showRuanganFilter]);

  // Update local filters and active filters when props change
  useEffect(() => {
    setLocalFilters(filters);
    
    // Update active filters
    const active = [];
    if (filters.search) active.push({ key: 'search', label: `Pencarian: ${filters.search}` });
    
    if (filters.aset_id) {
      const aset = asetOptions.find(a => a.id === filters.aset_id);
      active.push({ key: 'aset_id', label: `Aset: ${aset?.nama_barang || filters.aset_id}` });
    }
    
    if (filters.ruangan_id) {
      const ruangan = ruanganOptions.find(r => r.id === filters.ruangan_id);
      active.push({ key: 'ruangan_id', label: `Ruangan: ${ruangan?.nama_ruangan || filters.ruangan_id}` });
    }
    
    if (filters.status && filters.status !== 'all') {
      const statusLabel = {
        'aktif': 'Aktif',
        'dipindah': 'Dipindah',
        'dihapuskan': 'Dihapuskan'
      }[filters.status] || filters.status;
      active.push({ key: 'status', label: `Status: ${statusLabel}` });
    }
    
    setActiveFilters(active);
  }, [filters, asetOptions, ruanganOptions]);

  const handleChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      aset_id: '',
      ruangan_id: '',
      status: 'all',
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleRemoveFilter = (key) => {
    const newFilters = { ...localFilters };
    if (key === 'search') newFilters.search = '';
    if (key === 'aset_id') newFilters.aset_id = '';
    if (key === 'ruangan_id') newFilters.ruangan_id = '';
    if (key === 'status') newFilters.status = 'all';
    
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  const statusOptions = [
    { value: 'all', label: 'Semua Status' },
    { value: 'aktif', label: 'Aktif' },
    { value: 'dipindah', label: 'Dipindah' },
    { value: 'dihapuskan', label: 'Dihapuskan' }
  ];

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Search */}
        <Grid item xs={12} md={showAsetFilter && showRuanganFilter ? 3 : 4}>
          <TextField
            fullWidth
            size="small"
            label="Cari"
            placeholder="Cari aset atau ruangan..."
            value={localFilters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Filter Aset */}
        {showAsetFilter && (
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={asetOptions}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return `${option.kode_barang || ''} - ${option.nama_barang || ''}`;
              }}
              value={asetOptions.find(a => a.id === localFilters.aset_id) || null}
              onChange={(event, newValue) => {
                handleChange('aset_id', newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter Aset"
                  placeholder="Pilih aset..."
                  size="small"
                />
              )}
            />
          </Grid>
        )}

        {/* Filter Ruangan */}
        {showRuanganFilter && (
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={ruanganOptions}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return `${option.kode_ruangan || ''} - ${option.nama_ruangan || ''}`;
              }}
              value={ruanganOptions.find(r => r.id === localFilters.ruangan_id) || null}
              onChange={(event, newValue) => {
                handleChange('ruangan_id', newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter Ruangan"
                  placeholder="Pilih ruangan..."
                  size="small"
                />
              )}
            />
          </Grid>
        )}

        {/* Filter Status */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={localFilters.status || 'all'}
              label="Status"
              onChange={(e) => handleChange('status', e.target.value)}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12} md={1}>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleApply}
              fullWidth
              startIcon={<FilterIcon />}
              size="small"
            >
              Filter
            </Button>
          </Box>
        </Grid>

        {/* Reset Button */}
        <Grid item xs={12} md={1}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleReset}
            fullWidth
            startIcon={<ClearIcon />}
            disabled={activeFilters.length === 0}
            size="small"
          >
            Reset
          </Button>
        </Grid>
      </Grid>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
          {activeFilters.map((filter) => (
            <Chip
              key={filter.key}
              label={filter.label}
              onDelete={() => handleRemoveFilter(filter.key)}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
          {activeFilters.length > 0 && (
            <Chip
              label="Hapus Semua"
              onDelete={handleReset}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default FilterSection;