// components/ruangan/FilterSection.js

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
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

const FilterSection = ({ filters, onFilterChange }) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [activeFilters, setActiveFilters] = useState([]);

  // Update local filters and active filters when props change
  useEffect(() => {
    setLocalFilters(filters);
    
    // Update active filters
    const active = [];
    if (filters.search) active.push({ key: 'search', label: `Pencarian: ${filters.search}` });
    if (filters.status !== 'all' && filters.status !== '') {
      const statusLabel = filters.status === '1' ? 'Aktif' : 'Tidak Aktif';
      active.push({ key: 'status', label: `Status: ${statusLabel}` });
    }
    setActiveFilters(active);
  }, [filters]);

  const handleChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      status: 'all',
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleRemoveFilter = (key) => {
    const newFilters = { ...localFilters };
    if (key === 'search') newFilters.search = '';
    if (key === 'status') newFilters.status = 'all';
    
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Search */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="Cari Ruangan"
            placeholder="Ketik kode ruangan, nama, atau lokasi..."
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

        {/* Filter Status */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={localFilters.status || 'all'}
              label="Status"
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <MenuItem value="all">Semua Status</MenuItem>
              <MenuItem value="1">Aktif</MenuItem>
              <MenuItem value="0">Tidak Aktif</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12} md={2}>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleApply}
              fullWidth
              startIcon={<FilterIcon />}
            >
              Filter
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleReset}
              startIcon={<ClearIcon />}
              disabled={activeFilters.length === 0}
            >
              Reset
            </Button>
          </Box>
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