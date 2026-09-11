// components/picruangan/FilterSection.js

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
import * as picRuanganApi from './api/picRuanganApi';
import { useSession } from 'next-auth/react';

const FilterSection = ({ filters, onFilterChange, showUserFilter = true }) => {
  const { data: session } = useSession();
  const [localFilters, setLocalFilters] = useState(filters);
  const [activeFilters, setActiveFilters] = useState([]);
  
  const [userOptions, setUserOptions] = useState([]);
  const [ruanganOptions, setRuanganOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!session) return;
    
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [userResult, ruanganResult] = await Promise.all([
          picRuanganApi.fetchUserOptions(session),
          picRuanganApi.fetchRuanganOptions(session)
        ]);

        if (userResult?.success) {
          setUserOptions(userResult.data || []);
        }
        if (ruanganResult?.success) {
          setRuanganOptions(ruanganResult.data || []);
        }
      } catch (error) {
        console.error('Error loading options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [session]);

  useEffect(() => {
    setLocalFilters(filters);
    
    const active = [];
    if (filters.user_id) {
      const user = userOptions.find(u => u.user_id === filters.user_id);
      active.push({ key: 'user_id', label: `PIC: ${user?.nama || filters.user_id}` });
    }
    if (filters.ruangan_id) {
      const ruangan = ruanganOptions.find(r => r.id === filters.ruangan_id);
      active.push({ key: 'ruangan_id', label: `Ruangan: ${ruangan?.nama_ruangan || filters.ruangan_id}` });
    }
    if (filters.status && filters.status !== 'all') {
      const statusLabel = filters.status === 'aktif' ? 'Aktif' : 'Nonaktif';
      active.push({ key: 'status', label: `Status: ${statusLabel}` });
    }
    
    setActiveFilters(active);
  }, [filters, userOptions, ruanganOptions]);

  const handleChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      user_id: '',
      ruangan_id: '',
      status: 'all',
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleRemoveFilter = (key) => {
    const newFilters = { ...localFilters };
    if (key === 'user_id') newFilters.user_id = '';
    if (key === 'ruangan_id') newFilters.ruangan_id = '';
    if (key === 'status') newFilters.status = 'all';
    
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const statusOptions = [
    { value: 'all', label: 'Semua Status' },
    { value: 'aktif', label: 'Aktif' },
    { value: 'nonaktif', label: 'Nonaktif' }
  ];

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {showUserFilter && (
          <Grid item xs={12} md={4}>
            <Autocomplete
              size="small"
              options={userOptions}
              loading={loadingOptions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') return option;
                return `${option.nama} (${option.nip || '-'})`;
              }}
              value={userOptions.find(u => u.user_id === localFilters.user_id) || null}
              onChange={(event, newValue) => {
                handleChange('user_id', newValue?.user_id || '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter PIC"
                  placeholder="Cari PIC..."
                  size="small"
                />
              )}
            />
          </Grid>
        )}

        <Grid item xs={12} md={4}>
          <Autocomplete
            size="small"
            options={ruanganOptions}
            loading={loadingOptions}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return `${option.kode_ruangan} - ${option.nama_ruangan}`;
            }}
            value={ruanganOptions.find(r => r.id === localFilters.ruangan_id) || null}
            onChange={(event, newValue) => {
              handleChange('ruangan_id', newValue?.id || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter Ruangan"
                placeholder="Cari ruangan..."
                size="small"
              />
            )}
          />
        </Grid>

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

        <Grid item xs={12} md={2}>
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
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleReset}
              startIcon={<ClearIcon />}
              disabled={activeFilters.length === 0}
              size="small"
            >
              Reset
            </Button>
          </Box>
        </Grid>
      </Grid>

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
          <Chip
            label="Hapus Semua"
            onDelete={handleReset}
            size="small"
            color="error"
            variant="outlined"
          />
        </Stack>
      )}
    </Paper>
  );
};

export default FilterSection;