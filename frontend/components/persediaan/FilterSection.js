import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Button,
  Chip,
  InputAdornment,
  IconButton,
  Collapse,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import * as api from './api/persediaanApi';

const FilterSection = ({ filters, onFilterChange, session, onImportXLSX, onDownloadTemplate }) => {
  const [expanded, setExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);
  const [jenisOptions, setJenisOptions] = useState([]);
  const [kategoriOptions, setKategoriOptions] = useState([]);

  // Load filter options
  useEffect(() => {
    if (!session) return;
    const loadOptions = async () => {
      try {
        const res = await api.fetchFilterOptions(session);
        if (res?.success) {
          setJenisOptions(res.data.jenis || []);
          setKategoriOptions(res.data.kategori || []);
        }
      } catch (e) { /* ignore */ }
    };
    loadOptions();
  }, [session]);

  useEffect(() => { setLocalFilters(filters); }, [filters]);

  const handleChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => onFilterChange(localFilters);

  const handleReset = () => {
    const reset = { search: '', jenis: '', kategori: '' };
    setLocalFilters(reset);
    onFilterChange(reset);
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') handleApply(); };

  const activeCount = [filters.search, filters.jenis, filters.kategori].filter(Boolean).length;

  return (
    <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      {/* Search row always visible */}
      <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Cari nama barang..."
          value={localFilters.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          onKeyDown={handleKeyPress}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: localFilters.search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { handleChange('search', ''); handleApply(); }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        <Button variant={expanded ? 'contained' : 'outlined'} size="small"
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setExpanded(!expanded)} color="primary">
          Filter {activeCount > 0 && `(${activeCount})`}
        </Button>

        <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={handleApply}>
          Cari
        </Button>

        {activeCount > 0 && (
          <Button size="small" color="error" onClick={handleReset} startIcon={<ClearIcon />}>
            Reset
          </Button>
        )}

        {/* Active filter chips */}
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {filters.jenis && (
            <Chip label={`Jenis: ${filters.jenis}`} size="small" onDelete={() => onFilterChange({ ...filters, jenis: '' })} />
          )}
          {filters.kategori && (
            <Chip label={`Kategori: ${filters.kategori}`} size="small" onDelete={() => onFilterChange({ ...filters, kategori: '' })} />
          )}
        </Box>
      </Box>

      {/* Expanded filters */}
      <Collapse in={expanded}>
        <Box mt={2} display="flex" gap={2} flexWrap="wrap">
          <TextField select label="Jenis" size="small" value={localFilters.jenis || ''}
            onChange={(e) => handleChange('jenis', e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Semua</MenuItem>
            {jenisOptions.map((j) => <MenuItem key={j} value={j}>{j}</MenuItem>)}
          </TextField>

          <TextField select label="Kategori" size="small" value={localFilters.kategori || ''}
            onChange={(e) => handleChange('kategori', e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Semua</MenuItem>
            {kategoriOptions.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
        </Box>
      </Collapse>

      {/* Upload & Download actions */}
      <Box mt={1.5} display="flex" gap={1} flexWrap="wrap">
        <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={onDownloadTemplate}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
          Download Template
        </Button>
        <Button size="small" variant="text" startIcon={<CloudUploadIcon />} component="label"
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
          Import XLSX
          <input type="file" hidden accept=".xlsx,.xls"
            onChange={(e) => { if (e.target.files[0]) { onImportXLSX(e.target.files[0]); e.target.value = ''; } }} />
        </Button>
      </Box>
    </Paper>
  );
};

export default FilterSection;
