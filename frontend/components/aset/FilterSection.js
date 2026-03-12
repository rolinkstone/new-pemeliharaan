// components/aset/FilterSection.js

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
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import * as asetApi from './api/asetApi';

const FilterSection = ({ filters, onFilterChange, session }) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [jenisOptions, setJenisOptions] = useState([]);
  const [kondisiOptions, setKondisiOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

  // Load options on mount
  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoading(true);
      try {
        const [jenisResult, kondisiResult] = await Promise.all([
          asetApi.fetchJenisList(session),
          asetApi.fetchKondisiList(session)
        ]);

        if (jenisResult?.success) {
          setJenisOptions(jenisResult.data || []);
        }
        if (kondisiResult?.success) {
          setKondisiOptions(kondisiResult.data || []);
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [session]);

  // Update local filters and active filters when props change
  useEffect(() => {
    setLocalFilters(filters);
    
    // Update active filters
    const active = [];
    if (filters.search) active.push({ key: 'search', label: `Pencarian: ${filters.search}` });
    if (filters.jenis) active.push({ key: 'jenis', label: `Jenis: ${filters.jenis}` });
    if (filters.kondisi) active.push({ key: 'kondisi', label: `Kondisi: ${filters.kondisi}` });
    if (filters.status) active.push({ key: 'status', label: `Status: ${filters.status}` });
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
      jenis: '',
      kondisi: '',
      status: '',
      search: '',
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleRemoveFilter = (key) => {
    const newFilters = { ...localFilters, [key]: '' };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  const statusOptions = ['Aktif', 'Tidak Aktif', 'Rusak', 'Dipinjam'];

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Search */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Cari Aset"
            placeholder="Ketik kode, nama, merk..."
            value={localFilters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
        </Grid>

        {/* Filter Jenis */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Jenis BMN</InputLabel>
            <Select
              value={localFilters.jenis || ''}
              label="Jenis BMN"
              onChange={(e) => handleChange('jenis', e.target.value)}
              disabled={loading}
            >
              <MenuItem value="">Semua Jenis</MenuItem>
              {jenisOptions.map((jenis) => (
                <MenuItem key={jenis} value={jenis}>
                  {jenis}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Filter Kondisi */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Kondisi</InputLabel>
            <Select
              value={localFilters.kondisi || ''}
              label="Kondisi"
              onChange={(e) => handleChange('kondisi', e.target.value)}
              disabled={loading}
            >
              <MenuItem value="">Semua Kondisi</MenuItem>
              {kondisiOptions.map((kondisi) => (
                <MenuItem key={kondisi} value={kondisi}>
                  {kondisi}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Filter Status */}
        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={localFilters.status || ''}
              label="Status"
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <MenuItem value="">Semua Status</MenuItem>
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
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
        </Stack>
      )}
    </Paper>
  );
};

export default FilterSection;